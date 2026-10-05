// Phần gọi mạng: tải trang an toàn, quét ảnh (riêng trang sản phẩm Xiaohongshu đọc từ địa chỉ dữ liệu công khai của nó).
// Không dùng API riêng của Deno (trừ kiểm tra DNS khi có) để chạy thử được bằng Node.
import { blockedReason, isPrivateIp, extractImageUrls, urlsInText } from './extract.ts';

export const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
export const MAX_HTML = 2 * 1024 * 1024;

// Tên miền trỏ về địa chỉ nội bộ cũng bị chặn
async function hostResolvesPrivate(host) {
  try {
    const D = globalThis.Deno;
    if (!D || !D.resolveDns) return false;
    for (const type of ['A', 'AAAA']) {
      try {
        const ips = await D.resolveDns(host, type);
        if (ips.some((ip) => isPrivateIp(ip))) return true;
      } catch (_e) { /* không có bản ghi loại này */ }
    }
  } catch (_e) { /* không kiểm tra được thì bỏ qua */ }
  return false;
}

// Tải một địa chỉ, tự theo chuyển hướng nhưng kiểm tra lại từng chặng
export async function safeFetch(startUrl, headers, timeoutMs) {
  let url = startUrl;
  for (let hop = 0; hop < 5; hop++) {
    const why = blockedReason(url);
    if (why) throw new Error(why);
    if (await hostResolvesPrivate(new URL(url).hostname)) throw new Error('Link nội bộ không được phép.');
    const res = await fetch(url, { headers, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      await res.body?.cancel();
      url = new URL(res.headers.get('location'), url).href;
      continue;
    }
    return { res, url };
  }
  throw new Error('Link chuyển hướng quá nhiều lần.');
}

// Đọc thân phản hồi, dừng ở mức giới hạn
export async function readBody(res, max, truncate) {
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

const PAGE_HEADERS = { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,image/*;q=0.8,*/*;q=0.5', 'Accept-Language': 'vi,en;q=0.8,zh-CN;q=0.6' };
const LOGIN_PATH = /\/(login|signin|sign-in|sign_in|accounts\/login|checkpoint|passport)(\/|$)/i;

// Mở link (theo chuyển hướng), trả về trang cuối cùng; báo lỗi rõ khi trang lỗi hoặc bắt đăng nhập
async function openPage(link) {
  const { res, url } = await safeFetch(link, PAGE_HEADERS, 10000);
  if (!res.ok) { await res.body?.cancel(); throw new Error('Trang trả về lỗi ' + res.status + '. Có thể bài đăng ở chế độ riêng tư hoặc cần đăng nhập.'); }
  if (LOGIN_PATH.test(new URL(url).pathname)) { await res.body?.cancel(); throw new Error('Trang này bắt đăng nhập mới xem được nên không lấy được.'); }
  return { res, url };
}

export function firstLink(text) {
  const t = String(text || '').trim();
  if (!t || t.length > 4000) throw new Error('Dán link bài đăng hoặc trang có ảnh.');
  const u = urlsInText(t)[0];
  if (!u) throw new Error('Không thấy link nào trong nội dung vừa dán. Link phải bắt đầu bằng https://');
  return u;
}

// ---- Quét ảnh của một trang ----
export async function scanImages(text) {
  const { res, url } = await openPage(firstLink(text));
  const xhs = xhsItemId(url);
  if (xhs) { await res.body?.cancel(); return xhsImages(xhs); }
  const type = (res.headers.get('content-type') || '').toLowerCase();
  if (type.startsWith('image/')) { await res.body?.cancel(); return [url]; }
  if (!type.includes('html') && !type.includes('xml')) { await res.body?.cancel(); throw new Error('Link này không phải trang web hoặc ảnh.'); }
  const html = new TextDecoder('utf-8').decode(await readBody(res, MAX_HTML, true));
  return extractImageUrls(html, url);
}

// ---- Xiaohongshu: trang sản phẩm đọc dữ liệu từ địa chỉ công khai mà chính trang đó gọi khi mở ----
export function xhsItemId(pageUrl) {
  try {
    const u = new URL(pageUrl);
    if (!/(^|\.)xiaohongshu\.com$/.test(u.hostname)) return '';
    const m = /\/goods-detail\/([0-9a-f]{24})(\/|$)/i.exec(u.pathname);
    return m ? m[1].toLowerCase() : '';
  } catch (_e) { return ''; }
}

async function getJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json', Origin: 'https://www.xiaohongshu.com', Referer: 'https://www.xiaohongshu.com/' },
    signal: AbortSignal.timeout(12000)
  });
  const text = new TextDecoder('utf-8').decode(await readBody(res, MAX_HTML, false));
  let j;
  try { j = JSON.parse(text); } catch (_e) { throw new Error('Xiaohongshu trả về dữ liệu lạ.'); }
  if (!res.ok || j.success === false) throw new Error('Xiaohongshu từ chối: ' + (j.msg || res.status));
  return j;
}

const httpsUrl = (u) => (typeof u === 'string' && u ? (u.startsWith('//') ? 'https:' + u : u) : '');

// Ảnh chính (ảnh lướt đầu trang) rồi ảnh chi tiết (phần mô tả)
export async function xhsImages(itemId) {
  if (!/^[0-9a-f]{24}$/.test(itemId)) throw new Error('Mã sản phẩm Xiaohongshu không đúng.');
  const j = await getJson('https://mall.xiaohongshu.com/api/store/jpd/edith/detail/h5/toc?item_id=' + itemId);
  const t = j && j.data && j.data.template_data && j.data.template_data[0];
  if (!t) throw new Error('Không đọc được sản phẩm này (có thể đã gỡ hoặc hết hàng).');
  const main = ((t.carouselH5 && t.carouselH5.images) || []).map((x) => httpsUrl(x && x.url));
  const detail = ((t.graphicDetailsV4 && t.graphicDetailsV4.images) || []).map((x) => httpsUrl(x && x.url));
  return [...new Set(main.concat(detail).filter(Boolean))];
}
