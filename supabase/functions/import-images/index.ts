// Edge Function "import-images": admin dán link một bài đăng, hàm tìm các ảnh trong trang rồi tải ảnh đã chọn
// về kho ảnh sản phẩm. Khách chỉ thấy ảnh đã lưu; link nguồn không được lưu lại ở đâu.
//
//   { action: 'scan',   url }              → { images: [url, ...] }
//   { action: 'import', urls[], referer }  → { saved: [publicUrl, ...], failed: n }
//
// Chỉ tài khoản admin dùng được (kiểm tra bằng hàm is_admin). Địa chỉ nội bộ bị chặn để tránh bị lợi dụng truy cập mạng nội bộ.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { blockedReason, isPrivateIp, extractImageUrls, sniffImage } from './extract.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const MAX_HTML = 2 * 1024 * 1024;
const MAX_IMG = 5 * 1024 * 1024; // bằng giới hạn của kho ảnh
const MAX_IMPORT = 12;
const BUCKET = 'product-images';

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// Tên miền trỏ về địa chỉ nội bộ cũng bị chặn
async function hostResolvesPrivate(host) {
  try {
    if (typeof Deno === 'undefined' || !Deno.resolveDns) return false;
    for (const type of ['A', 'AAAA']) {
      try {
        const ips = await Deno.resolveDns(host, type);
        if (ips.some((ip) => isPrivateIp(ip))) return true;
      } catch (_e) { /* không có bản ghi loại này */ }
    }
  } catch (_e) { /* không kiểm tra được thì bỏ qua */ }
  return false;
}

// Tải một địa chỉ, tự theo chuyển hướng nhưng kiểm tra lại từng chặng
async function safeFetch(startUrl, headers, timeoutMs) {
  let url = startUrl;
  for (let hop = 0; hop < 5; hop++) {
    const why = blockedReason(url);
    if (why) throw new Error(why);
    if (await hostResolvesPrivate(new URL(url).hostname)) throw new Error('Link nội bộ không được phép.');
    const res = await fetch(url, { headers, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = new URL(res.headers.get('location'), url).href;
      continue;
    }
    return { res, url };
  }
  throw new Error('Link chuyển hướng quá nhiều lần.');
}

// Đọc thân phản hồi, dừng ở mức giới hạn
async function readBody(res, max, truncate) {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      if (truncate) { chunks.push(value.slice(0, value.length - (size - max))); break; }
      throw new Error('File quá lớn.');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0));
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

async function scan(url) {
  if (typeof url !== 'string' || url.length > 2000) throw new Error('Dán link bài đăng hoặc trang có ảnh.');
  const { res, url: finalUrl } = await safeFetch(url, { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,image/*;q=0.8,*/*;q=0.5', 'Accept-Language': 'vi,en;q=0.8' }, 10000);
  if (!res.ok) throw new Error('Trang trả về lỗi ' + res.status + '. Có thể bài đăng ở chế độ riêng tư hoặc cần đăng nhập.');
  const type = (res.headers.get('content-type') || '').toLowerCase();
  if (type.startsWith('image/')) { await res.body?.cancel(); return [finalUrl]; }
  if (!type.includes('html') && !type.includes('xml')) throw new Error('Link này không phải trang web hoặc ảnh.');
  const html = new TextDecoder('utf-8').decode(await readBody(res, MAX_HTML, true));
  return extractImageUrls(html, finalUrl);
}

async function importOne(admin, imgUrl, referer) {
  const headers = { 'User-Agent': UA, Accept: 'image/avif,image/webp,image/*,*/*;q=0.8' };
  if (referer && !blockedReason(referer)) headers.Referer = referer;
  const { res } = await safeFetch(imgUrl, headers, 15000);
  if (!res.ok) throw new Error('Ảnh trả về lỗi ' + res.status);
  const len = parseInt(res.headers.get('content-length') || '0', 10);
  if (len > MAX_IMG) { await res.body?.cancel(); throw new Error('Ảnh quá lớn (trên 5MB).'); }
  const bytes = await readBody(res, MAX_IMG, false);
  const kind = sniffImage(bytes);
  if (!kind) throw new Error('Định dạng ảnh không hỗ trợ (chỉ JPG, PNG, WEBP).');
  const path = 'p/' + crypto.randomUUID().replace(/-/g, '').slice(0, 14) + '.' + kind.ext;
  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: kind.type, cacheControl: '31536000' });
  if (error) throw new Error('Không lưu được ảnh: ' + error.message);
  return admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Chỉ nhận POST.' }, 405);

  // Chỉ admin
  const auth = req.headers.get('Authorization') || '';
  const url = Deno.env.get('SUPABASE_URL');
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: auth } } });
  const { data: isAdmin, error: authErr } = await asUser.rpc('is_admin');
  if (authErr || isAdmin !== true) return json({ error: 'Chỉ tài khoản quản trị dùng được tính năng này.' }, 403);

  let body;
  try { body = await req.json(); } catch (_e) { return json({ error: 'Dữ liệu gửi lên không đúng.' }, 400); }

  try {
    if (body.action === 'scan') {
      const images = await scan(String(body.url || '').trim());
      return json({ images });
    }
    if (body.action === 'import') {
      const urls = (Array.isArray(body.urls) ? body.urls : []).filter((u) => typeof u === 'string').slice(0, MAX_IMPORT);
      if (!urls.length) return json({ error: 'Chưa chọn ảnh nào.' }, 400);
      const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
      const saved = [];
      let failed = 0;
      let lastError = '';
      // Tải lần lượt theo nhóm nhỏ để không chiếm nhiều bộ nhớ cùng lúc
      for (let i = 0; i < urls.length; i += 3) {
        const part = await Promise.allSettled(urls.slice(i, i + 3).map((u) => importOne(admin, u, typeof body.referer === 'string' ? body.referer : '')));
        part.forEach((r) => { if (r.status === 'fulfilled') saved.push(r.value); else { failed++; lastError = String(r.reason?.message || r.reason); } });
      }
      return json({ saved, failed, lastError });
    }
    return json({ error: 'Thao tác không hợp lệ.' }, 400);
  } catch (e) {
    return json({ error: String(e?.message || e) }, 400);
  }
});
