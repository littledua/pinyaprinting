// Edge Function "import-images": admin dán link một bài đăng, hàm tìm các ảnh trong trang rồi tải ảnh đã chọn
// về kho ảnh sản phẩm. Khách chỉ thấy ảnh đã lưu; link nguồn không được lưu lại ở đâu.
//
//   { action: 'scan',   url }              → { images: [url, ...] }   (url có thể là cả đoạn chia sẻ có chữ)
//   { action: 'import', urls[], referer }  → { saved: [publicUrl, ...], failed: n }
//
// Chỉ tài khoản admin dùng được (kiểm tra bằng hàm is_admin). Địa chỉ nội bộ bị chặn để tránh bị lợi dụng truy cập mạng nội bộ.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { blockedReason, sniffImage } from './extract.ts';
import { UA, safeFetch, readBody, scanImages } from './core.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const MAX_IMG = 5 * 1024 * 1024; // bằng giới hạn của kho ảnh
const MAX_IMPORT = 12;
const BUCKET = 'product-images';

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

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
      const images = await scanImages(String(body.url || ''));
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
