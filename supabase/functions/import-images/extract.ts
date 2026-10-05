// Phần thuần (không gọi mạng): tìm địa chỉ ảnh trong HTML và chặn địa chỉ nội bộ.
// Viết bằng cú pháp JS thường để vừa chạy trên Deno (Edge Function) vừa chạy thử bằng Node.

// ---- Chặn địa chỉ nội bộ (SSRF) ----
export function parseIPv4(s) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return null;
  const p = m.slice(1).map(Number);
  return p.every((n) => n >= 0 && n <= 255) ? p : null;
}

export function isPrivateIPv4(p) {
  const [a, b] = p;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19));
}

export function isPrivateIp(ip) {
  const v4 = parseIPv4(ip);
  if (v4) return isPrivateIPv4(v4);
  const s = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (!s.includes(':')) return false;
  if (s === '::' || s === '::1') return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (mapped) { const p = parseIPv4(mapped[1]); return !p || isPrivateIPv4(p); }
  if (/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(s)) return true; // dạng hex của IPv4-mapped, coi là nội bộ cho chắc
  if (/^f[cd]/.test(s)) return true; // fc00::/7
  if (/^fe[89ab]/.test(s)) return true; // fe80::/10
  return false;
}

// Trả về lý do bị chặn, hoặc '' nếu địa chỉ hợp lệ để tải
export function blockedReason(urlString) {
  let u;
  try { u = new URL(urlString); } catch (_e) { return 'Link không đúng định dạng.'; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'Chỉ nhận link bắt đầu bằng http hoặc https.';
  if (u.username || u.password) return 'Link có chứa tài khoản, không hỗ trợ.';
  if (u.port && u.port !== '80' && u.port !== '443') return 'Link dùng cổng lạ, không hỗ trợ.';
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return 'Link không có tên miền.';
  if (host === 'localhost' || /\.(localhost|local|internal|lan|home\.arpa|corp)$/.test(host)) return 'Link nội bộ không được phép.';
  if (parseIPv4(host) || host.includes(':')) return isPrivateIp(host) ? 'Link nội bộ không được phép.' : '';
  if (!host.includes('.')) return 'Link nội bộ không được phép.';
  return '';
}

// ---- Tìm ảnh trong HTML ----
const ENT = { '&amp;': '&', '&quot;': '"', '&#34;': '"', '&#39;': "'", '&#x27;': "'", '&apos;': "'", '&lt;': '<', '&gt;': '>', '&#38;': '&', '&#x26;': '&' };
export const decodeEntities = (s) => String(s).replace(/&(?:amp|quot|apos|lt|gt|#34|#39|#38|#x27|#x26);/g, (m) => ENT[m] || m);

function attrsOf(tag) {
  const out = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m;
  while ((m = re.exec(tag))) out[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  return out;
}

// "a.jpg 320w, b.jpg 1080w" → b.jpg (bản lớn nhất)
export function bestFromSrcset(srcset) {
  let best = '', score = -1;
  String(srcset || '').split(/,(?=\s*\S+\s+\d)|,\s+(?=\S)/).forEach((part) => {
    const bits = part.trim().split(/\s+/);
    if (!bits[0]) return;
    const d = bits[1] || '';
    const n = /^(\d+(?:\.\d+)?)[wx]$/.exec(d);
    const sc = n ? parseFloat(n[1]) * (d.endsWith('x') ? 1000 : 1) : 0;
    if (sc >= score) { best = bits[0]; score = sc; }
  });
  return best;
}

const SKIP_WORDS = /(sprite|favicon|\bicon\b|icons?[-_/]|logo|avatar|emoji|spinner|loading|pixel|tracking|badge|button|placeholder|blank|1x1|ads?[-_/])/i;

function collectJsonImages(node, out, depth) {
  if (depth > 6 || node == null) return;
  if (typeof node === 'string') { if (/^https?:\/\//i.test(node)) out.push(node); return; }
  if (Array.isArray(node)) { node.slice(0, 40).forEach((x) => collectJsonImages(x, out, depth + 1)); return; }
  if (typeof node === 'object') {
    ['image', 'images', 'contentUrl', 'thumbnailUrl', 'url'].forEach((k) => {
      if (k in node && (k !== 'url' || /image|photo|picture/i.test(String(node['@type'] || '')))) collectJsonImages(node[k], out, depth + 1);
    });
  }
}

// Trả về mảng địa chỉ ảnh tuyệt đối, ảnh đại diện của bài viết lên trước
export function extractImageUrls(html, pageUrl, max) {
  max = max || 40;
  const found = [];
  const add = (raw, tier) => {
    if (!raw) return;
    let abs;
    try { abs = new URL(decodeEntities(raw).trim(), base).href; } catch (_e) { return; }
    if (!/^https?:/i.test(abs) || /\.(svg|ico|gif)(\?|#|$)/i.test(abs) || SKIP_WORDS.test(abs)) return;
    found.push({ url: abs, tier });
  };
  let base = pageUrl;
  const baseTag = /<base\s[^>]*>/i.exec(html);
  if (baseTag) { const h = attrsOf(baseTag[0]).href; if (h) { try { base = new URL(h, pageUrl).href; } catch (_e) { /* giữ base cũ */ } } }

  // 1) ảnh đại diện bài viết (Open Graph, Twitter, image_src)
  (html.match(/<meta\s[^>]*>/gi) || []).forEach((tag) => {
    const a = attrsOf(tag);
    const key = (a.property || a.name || a.itemprop || '').toLowerCase();
    if (['og:image', 'og:image:url', 'og:image:secure_url', 'twitter:image', 'twitter:image:src', 'image'].includes(key)) add(a.content, 0);
  });
  (html.match(/<link\s[^>]*>/gi) || []).forEach((tag) => {
    const a = attrsOf(tag);
    if (/image_src/i.test(a.rel || '')) add(a.href, 0);
  });
  // 2) dữ liệu có cấu trúc JSON-LD
  const ld = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = ld.exec(html))) {
    try { const arr = []; collectJsonImages(JSON.parse(m[1]), arr, 0); arr.forEach((u) => add(u, 1)); } catch (_e) { /* JSON hỏng thì bỏ qua */ }
  }
  // 3) thẻ <img> và <source>
  (html.match(/<(?:img|source)\s[^>]*>/gi) || []).forEach((tag) => {
    const a = attrsOf(tag);
    const w = parseInt(a.width, 10), h = parseInt(a.height, 10);
    if ((w && w < 120) || (h && h < 120)) return;
    const hay = (a.class || '') + ' ' + (a.alt || '') + ' ' + (a.id || '');
    if (/(icon|logo|avatar|emoji|sprite)/i.test(hay)) return;
    const set = a.srcset || a['data-srcset'];
    add((set && bestFromSrcset(set)) || a['data-src'] || a['data-original'] || a['data-lazy-src'] || a.src, 2);
  });
  // 4) ảnh nằm trong dữ liệu JSON của trang (trang dựng bằng JavaScript)
  const unescaped = html.replace(/\\u002F/gi, '/').replace(/\\u0026/gi, '&').replace(/\\\//g, '/');
  let n = 0;
  const re = /https?:\/\/[^\s"'<>\\)]+?\.(?:jpe?g|png|webp)(?:\?[^\s"'<>\\)]*)?/gi;
  while ((m = re.exec(unescaped)) && n++ < 80) add(m[0], 3);

  const seen = new Set();
  const out = [];
  found.sort((x, y) => x.tier - y.tier).forEach((f) => {
    const key = f.url.replace(/[?#].*$/, '');
    if (seen.has(key)) return;
    seen.add(key);
    out.push(f.url);
  });
  return out.slice(0, max);
}

// Đoán loại ảnh từ vài byte đầu file
export function sniffImage(bytes) {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { type: 'image/jpeg', ext: 'jpg' };
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { type: 'image/png', ext: 'png' };
  if (bytes.length > 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return { type: 'image/webp', ext: 'webp' };
  return null;
}
