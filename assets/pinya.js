/* Pinya Printing · dữ liệu và nghiệp vụ dùng chung cho trang cửa hàng và trang quản trị.
 *
 * Bản này lưu mọi thứ trong localStorage của trình duyệt để chạy thử không cần máy chủ:
 * khách đặt hàng ở trang cửa hàng thì trang quản trị thấy ngay (trong cùng một trình duyệt,
 * kể cả khi mở 2 tab cạnh nhau).
 *
 * Khi đưa lên mạng thật: thay phần "LƯU TRỮ" bên dưới bằng API của backend
 * (Supabase, Firebase, máy chủ riêng). Các trang chỉ gọi Pinya.load(), Pinya.update(), Pinya.act.*
 */
(function () {
  'use strict';

  const BRAND = 'Pinya Printing';

  // Bảng màu cho danh mục (màu pastel, khai báo trong base.css)
  const INKS = { c: 'Xanh baby', m: 'Hồng phấn', y: 'Vàng bơ', k: 'Xám khói', g: 'Xanh bạc hà', l: 'Tím lavender', p: 'Cam đào' };

  // Luồng đơn: khách đặt hàng (kèm link file) → thanh toán → shop in → vận chuyển → giao
  // who: bên đang phải làm bước tiếp theo
  const STATUSES = {
    cho_coc:    { admin: 'Chờ thanh toán',  customer: 'Chờ bạn thanh toán', stage: 1, who: 'customer' },
    san_xuat:   { admin: 'Đang in',         customer: 'Đang in',            stage: 2, who: null },
    van_chuyen: { admin: 'Đang vận chuyển', customer: 'Đang vận chuyển',    stage: 3, who: null },
    da_giao:    { admin: 'Đã giao',         customer: 'Đã giao',            stage: 4, who: null, done: true },
    huy:        { admin: 'Đã hủy',          customer: 'Đã hủy',             stage: -1, who: null, off: true }
  };
  const STATUS_ORDER = ['cho_coc', 'san_xuat', 'van_chuyen', 'da_giao', 'huy'];
  const STAGES = ['Đặt hàng', 'Thanh toán', 'Đang in', 'Vận chuyển', 'Nhận hàng'];

  const SHIP_METHODS = {
    bo:    { name: 'Đường bộ',          days: 8 },
    bien:  { name: 'Đường biển',        days: 25 },
    nhanh: { name: 'Chuyển phát nhanh', days: 5 }
  };
  const SHIP_STAGES = ['Kho Trung Quốc', 'Cửa khẩu Lạng Sơn', 'Kho Việt Nam', 'Đang giao đến bạn'];
  const CITIES = { 'Quảng Châu': '广州', 'Thâm Quyến': '深圳', 'Đông Quản': '东莞', 'Nghĩa Ô': '义乌' };
  const DEST = ['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Tỉnh, thành khác'];

  const H = 3600e3, D = 24 * H;

  // ==== Định dạng ====
  const nf = new Intl.NumberFormat('vi-VN');
  const pad = n => String(n).padStart(2, '0');
  const fmt = {
    vnd: n => nf.format(Math.round(n || 0)) + ' ₫',
    num: n => nf.format(n || 0),
    date: t => { const d = new Date(t); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); },
    time: t => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); },
    dateTime: t => fmt.time(t) + ' · ' + fmt.date(t),
    ago: t => {
      const s = (Date.now() - t) / 1000;
      if (s < 60) return 'vừa xong';
      if (s < 3600) return Math.floor(s / 60) + ' phút trước';
      if (s < 86400) return Math.floor(s / 3600) + ' giờ trước';
      if (s < 86400 * 7) return Math.floor(s / 86400) + ' ngày trước';
      return fmt.date(t);
    },
    phone: p => {
      const d = String(p || '').replace(/\D/g, '');
      return d.length === 10 ? d.slice(0, 4) + ' ' + d.slice(4, 7) + ' ' + d.slice(7) : (p || '');
    },
    // 1000000 → "1 triệu", 1500000 → "1,5 triệu"
    short: n => n >= 1e6 ? nf.format(Math.round(n / 1e5) / 10) + ' triệu' : nf.format(n) + ' ₫'
  };

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = p => (p || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const isUrl = s => /^https?:\/\/\S+\.\S+/i.test(String(s || '').trim());

  function normPhone(p) {
    let d = String(p || '').replace(/\D/g, '');
    if (d.startsWith('84') && d.length === 11) d = '0' + d.slice(2);
    return d;
  }
  // "9.800" → 9800, "12,5" → 12.5 (cách gõ số kiểu Việt Nam)
  function parseNum(v) {
    const s = String(v == null ? '' : v).replace(/[^\d,]/g, '').replace(',', '.');
    return s ? parseFloat(s) : NaN;
  }

  function makeId(t, n) {
    const d = new Date(t);
    return 'PP-' + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + '-' + String(n).padStart(4, '0');
  }

  // ==== Sản phẩm ====
  function priceRange(p) {
    const ps = (p.variants || []).map(v => +v.price || 0);
    return ps.length ? { min: Math.min.apply(null, ps), max: Math.max.apply(null, ps) } : { min: 0, max: 0 };
  }
  function soldCount(db, pid) {
    return db.orders.filter(o => o.status !== 'huy').reduce((a, o) => a + o.items.filter(i => i.productId === pid).reduce((b, i) => b + i.qty, 0), 0);
  }

  // ==== Thanh toán ====
  // Đơn dưới ngưỡng: trả 100% hoặc cọc depositLow%. Từ ngưỡng trở lên: trả 100% hoặc cọc depositHigh%.
  function depositRate(settings, total) {
    return total < settings.payThreshold ? settings.depositLow : settings.depositHigh;
  }
  function payOptions(settings, total) {
    const dep = depositRate(settings, total);
    return [
      { pct: 100, label: 'Thanh toán 100%', note: 'Trả hết một lần, shop báo xưởng in ngay', amount: total },
      { pct: dep, label: 'Đặt cọc ' + dep + '%', note: 'Phần còn lại ' + fmt.vnd(total - Math.round(total * dep / 100)) + ' trả khi nhận hàng', amount: Math.round(total * dep / 100) }
    ];
  }
  function payLabel(o) { return o.payPct >= 100 ? 'Thanh toán 100%' : 'Đặt cọc ' + o.payPct + '%'; }

  function money(o) {
    const sub = o.items.reduce((a, it) => a + (it.price || 0) * (it.qty || 0), 0);
    const total = sub + (+o.extraFee || 0);
    const first = o.paid1 && o.paid1Amount != null ? o.paid1Amount : Math.round(total * o.payPct / 100);
    const paid = (o.paid1 ? first : 0) + (o.balancePaid ? total - first : 0);
    return { sub, total, first, paid, remaining: total - paid };
  }

  // Link mạng xã hội rút gọn để hiện trong bảng: facebook.com/thuha → fb/thuha
  function shortSocial(u) {
    const s = String(u || '').trim();
    if (!s) return '';
    const m = s.replace(/^https?:\/\//i, '').replace(/^(www\.|m\.)/i, '').replace(/\/+$/, '');
    const parts = m.split(/[/?#]/);
    const host = parts[0].toLowerCase();
    const tail = parts.slice(1).filter(Boolean).pop() || '';
    const tag = /facebook|fb\.com/.test(host) ? 'fb' : /instagram/.test(host) ? 'ig' : /zalo/.test(host) ? 'zalo' : /tiktok/.test(host) ? 'tiktok' : host;
    const out = tail ? tag + '/' + tail : tag;
    return out.length > 26 ? out.slice(0, 25) + '…' : out;
  }

  // ==== Đơn in: đơn shop đặt xưởng Trung Quốc ====
  // Một đơn in gom nhiều đơn khách. Mỗi dòng: { orderId, productName, variantName, qty, cny }
  // Quy đổi VNĐ = đơn giá tệ × tỷ giá; thành tiền = quy đổi × số lượng
  function lineCost(l, rate) {
    const unitVnd = Math.round((+l.cny || 0) * (+rate || 0));
    return { unitVnd, totalVnd: unitVnd * (+l.qty || 0), totalCny: Math.round((+l.cny || 0) * (+l.qty || 0) * 100) / 100 };
  }
  function jobCost(j) {
    const lines = (j.lines || []).map(l => lineCost(l, j.rate));
    return {
      lines,
      totalVnd: lines.reduce((a, x) => a + x.totalVnd, 0),
      totalCny: Math.round(lines.reduce((a, x) => a + x.totalCny, 0) * 100) / 100,
      qty: (j.lines || []).reduce((a, l) => a + (+l.qty || 0), 0)
    };
  }
  // Trạng thái đơn in tự suy ra: điền cân nặng = đã về kho; có mã vận đơn = đang về VN
  function jobStatus(j) {
    if (+j.kg > 0) return { key: 'da_ve', label: 'Đã về kho', cls: 'ok' };
    if (String(j.mvd || '').trim()) return { key: 'dang_ve', label: 'Đang về VN', cls: '' };
    return { key: 'dat_xuong', label: 'Đã đặt xưởng', cls: 'act' };
  }
  function jobForOrder(db, orderId) {
    return (db.printJobs || []).find(j => (j.lines || []).some(l => l.orderId === orderId)) || null;
  }
  // Đơn khách đã thanh toán, đang chờ in, mà chưa nằm trong đơn in nào
  function needsPrint(db, o) {
    return o.status === 'san_xuat' && !jobForOrder(db, o.id);
  }
  // Đơn khách có thể đưa vào đơn in: chưa hủy, chưa giao, chưa thuộc đơn in khác
  function printable(db, o, exceptJobId) {
    if (['huy', 'da_giao'].includes(o.status)) return false;
    const j = jobForOrder(db, o.id);
    return !j || j.id === exceptJobId;
  }

  // ==== Phụ phí đơn in: một khoản chi chung cho nhiều đơn in, chia theo tỷ lệ cân nặng ====
  // fee: { id, name, amount, jobIds[], note }. Ví dụ ship nội địa từ kho VN về nhà cho một lô 2-3 đơn in.
  // Mỗi đơn in chịu: amount × cân đơn đó / tổng cân các đơn trong lô. Làm tròn đồng, phần dư dồn cho đơn nặng nhất.
  function feeShares(fee, db) {
    const amount = Math.round(+fee.amount || 0);
    const jobs = (fee.jobIds || []).map(id => (db.printJobs || []).find(j => j.id === id)).filter(Boolean);
    const rows = jobs.map(j => ({ jobId: j.id, kg: +j.kg > 0 ? +j.kg : 0, pct: 0, amount: 0 }));
    const totalKg = rows.reduce((a, r) => a + r.kg, 0);
    if (!rows.length || totalKg <= 0) return { ok: false, rows, totalKg, amount };
    rows.forEach(r => { r.pct = r.kg / totalKg * 100; r.amount = Math.floor(amount * r.kg / totalKg); });
    let rest = amount - rows.reduce((a, r) => a + r.amount, 0);
    const order = rows.map((r, i) => i).filter(i => rows[i].kg > 0).sort((a, b) => rows[b].kg - rows[a].kg);
    for (let k = 0; rest > 0 && order.length; k = (k + 1) % order.length, rest--) rows[order[k]].amount++;
    return { ok: true, rows, totalKg, amount };
  }
  // Các khoản phụ phí đơn in này đang chịu: [{ fee, amount, kg, pct }]
  function feesOfJob(db, jobId) {
    const out = [];
    (db.jobFees || []).forEach(f => {
      if (!(f.jobIds || []).includes(jobId)) return;
      const r = feeShares(f, db).rows.find(x => x.jobId === jobId);
      if (r) out.push({ fee: f, amount: r.amount, kg: r.kg, pct: r.pct });
    });
    return out;
  }
  const jobFeeTotal = (db, jobId) => feesOfJob(db, jobId).reduce((a, x) => a + x.amount, 0);
  // Giá vốn một đơn in: tiền hàng + ship TQ–VN theo bảng giá cân + phụ phí được chia
  function jobFullCost(db, j) {
    const goods = jobCost(j).totalVnd;
    const sq = shipQuote((db.logistics || []).find(w => w.id === j.whId), j.kg);
    const ship = sq && sq.ok ? sq.cost : 0;
    const fee = jobFeeTotal(db, j.id);
    return { goods, ship, fee, total: goods + ship + fee };
  }

  // ==== Phân loại nhanh theo số lượng ====
  // Mẫu có sẵn dùng chung cho mọi sản phẩm. Phân loại thêm tay chỉ nằm trong sản phẩm đó, không đi vào mẫu.
  const QTY_PRESETS = [
    { id: 'q-nho', name: 'Số lượng nhỏ', unit: 'cái', tiers: [10, 20, 50, 100] },
    { id: 'q-chuan', name: 'Thông dụng', unit: 'cái', tiers: [50, 100, 200, 500, 1000] },
    { id: 'q-lon', name: 'Số lượng lớn', unit: 'cái', tiers: [500, 1000, 2000, 5000] }
  ];
  const qtyPresets = db => QTY_PRESETS.map(x => Object.assign({ builtin: true }, x)).concat(db.variantPresets || []);
  // "50, 100  200;500" → [50, 100, 200, 500] (bỏ trùng, xếp tăng dần)
  function parseTiers(s) {
    const set = new Set(String(s || '').split(/[\s,;]+/).map(x => Math.round(parseNum(x))).filter(n => n > 0));
    return [...set].sort((a, b) => a - b);
  }
  // Giá mỗi phân loại = đơn giá × số lượng (để trống nếu chưa nhập đơn giá, shop điền sau)
  function qtyVariants(tiers, unit, unitPrice, prefix) {
    const u = String(unit || '').trim();
    const pre = String(prefix || '').trim();
    return tiers.map(n => ({
      id: uid('v'), name: (pre ? pre + ' · ' : '') + nf.format(n) + (u ? ' ' + u : ''),
      price: +unitPrice > 0 ? Math.round(+unitPrice * n) : '', minQty: 1
    }));
  }

  // ==== Logistics: kho trung chuyển TQ–VN và bảng giá cân ====
  // rates: [{ id, from, to, price }] — giá theo kg; "to" để trống nghĩa là "trở lên"
  function findRate(w, kg) {
    const rows = (w.rates || []).slice().sort((a, b) => (+a.from || 0) - (+b.from || 0));
    return rows.find(r => kg >= (+r.from || 0) && (r.to === '' || r.to == null || kg <= +r.to)) || null;
  }
  function shipQuote(w, kg) {
    kg = +kg || 0;
    if (!w || kg <= 0) return null;
    const r = findRate(w, kg);
    if (!r) return { ok: false };
    const raw = Math.round(kg * (+r.price || 0));
    const min = +w.minCharge || 0;
    return { ok: true, rate: +r.price, cost: Math.max(raw, min), usedMin: min > raw };
  }
  function rateLabel(r) {
    const f = fmt.num(+r.from || 0);
    return (r.to === '' || r.to == null) ? 'Từ ' + f + ' kg' : f + '–' + fmt.num(+r.to) + ' kg';
  }

  function expectedDone(o) {
    return o.produceStart ? o.produceStart + (+o.leadDays || 7) * D : null;
  }
  function expectedArrival(o) {
    if (!o.shipping || !o.shipping.startedAt) return null;
    return o.shipping.startedAt + (SHIP_METHODS[o.shipping.method] || SHIP_METHODS.bo).days * D;
  }

  function orderTitle(o) {
    const first = o.items[0];
    if (!first) return 'Đơn trống';
    return first.productName + (o.items.length > 1 ? ' + ' + (o.items.length - 1) + ' sản phẩm khác' : '');
  }
  function orderQty(o) { return o.items.reduce((a, i) => a + i.qty, 0); }

  // ==== Việc cần làm ====
  function adminNeeds(o, db) {
    const out = [];
    if (db && needsPrint(db, o)) out.push('Chưa đặt in');
    if (o.status === 'cho_coc') {
      if (o.paidNotice) out.push('Khách báo đã chuyển khoản');
      else if (Date.now() - o.createdAt > 2 * D) out.push('Nhắc khách thanh toán');
    }
    if (o.status === 'san_xuat' && expectedDone(o) && Date.now() > expectedDone(o)) out.push('Quá ngày dự kiến xong');
    if (o.status === 'da_giao' && !o.balancePaid) out.push('Thu phần còn lại');
    if (o.unreadAdmin) out.push(o.unreadAdmin + ' tin nhắn mới');
    return out;
  }
  function customerNeeds(o) {
    const out = [];
    if (o.status === 'cho_coc' && !o.paidNotice) out.push('Chuyển khoản thanh toán');
    if (o.status === 'da_giao' && !o.balancePaid) out.push('Thanh toán phần còn lại');
    if (o.unreadCustomer) out.push(o.unreadCustomer + ' tin nhắn mới');
    return out;
  }

  function pillClass(o, view) {
    const s = STATUSES[o.status];
    if (s.off) return 'off';
    if (s.done) return o.balancePaid ? 'ok' : 'act';
    const paidWait = o.status === 'cho_coc' && o.paidNotice;
    if (view === 'customer') return s.who === 'customer' && !paidWait ? 'act' : '';
    return paidWait ? 'act' : '';
  }
  function pill(o, view) {
    let label = STATUSES[o.status][view];
    if (o.status === 'cho_coc' && o.paidNotice) label = view === 'customer' ? 'Chờ shop xác nhận' : 'Khách báo đã chuyển';
    return '<span class="pill ' + pillClass(o, view) + '">' + esc(label) + '</span>';
  }
  function catTag(db, catId) {
    const c = db.categories.find(x => x.id === catId);
    return c ? '<span class="cat-tag" data-ink="' + esc(c.ink) + '"><i></i>' + esc(c.name) + '</span>' : '';
  }
  // Ảnh đại diện sản phẩm; chưa có ảnh thì hiện ô màu pastel theo danh mục
  function thumb(db, p, cls) {
    const c = db.categories.find(x => x.id === p.catId) || { ink: 'c' };
    if (p.images && p.images[0]) return '<img class="' + (cls || '') + '" src="' + esc(p.images[0]) + '" alt="' + esc(p.name) + '" loading="lazy">';
    return '<span class="ph ' + (cls || '') + '" data-ink="' + esc(c.ink) + '" aria-hidden="true"><span>' + esc((p.name || '?').trim().charAt(0).toUpperCase()) + '</span></span>';
  }

  // ==== Dữ liệu mẫu ====
  function baseCategories() {
    return [
      { id: 'in-giay', name: 'In giấy',       ink: 'c', desc: 'Name card, hộp giấy, túi giấy, tem nhãn, catalogue' },
      { id: 'in-mica', name: 'In nhựa, mica', ink: 'm', desc: 'Móc khóa acrylic, standee, kệ mica, huy hiệu' },
      { id: 'in-3d',   name: 'In 3D',         ink: 'y', desc: 'Figure, mô hình, mẫu thử sản phẩm' },
      { id: 'in-vai',  name: 'In vải',        ink: 'k', desc: 'Áo thun, túi tote, cờ, băng rôn vải' }
    ];
  }
  function baseSettings() {
    return {
      shopName: BRAND,
      tagline: 'In ấn tại xưởng, giao tận tay',
      about: 'Pinya nhận in giấy, nhựa mica, in 3D và in vải tại xưởng với giá xưởng.\n' +
        'Chọn sản phẩm và phân loại, gửi link file thiết kế, thanh toán là xong. Hàng in xong giao tận tay toàn quốc.',
      zalo: '0900000000', email: 'hello@example.com', address: '', hours: '8:00 – 18:00, Thứ Hai đến Thứ Bảy',
      facebook: '', instagram: '',
      payThreshold: 1000000, depositLow: 50, depositHigh: 70, lastRate: 3650,
      bankName: 'Vietcombank', bankNumber: '0000 000 000', bankHolder: 'PINYA PRINTING',
      adminName: 'Pinya', adminEmail: 'admin@example.com',
      look: baseLook()
    };
  }

  // ==== Giao diện tùy chỉnh: avatar, màu, font, cỡ chữ, mục hiển thị ====
  // Mục "show": true là hiện. Khóa thiếu coi như hiện (để thêm mục mới sau này không làm mất trang).
  const SHOW_KEYS = [
    ['Thanh ngang', [['navAbout', 'Mục Giới thiệu'], ['navCats', 'Các danh mục in ấn'], ['navContact', 'Mục Liên hệ'], ['navTrack', 'Nút Theo dõi đơn']]],
    ['Trang chủ', [['tagline', 'Dòng giới thiệu ngắn'], ['heroArt', 'Hình minh họa bên phải'], ['heroBtns', 'Hai nút Xem sản phẩm và Theo dõi'], ['catGrid', 'Lưới danh mục']]],
    ['Danh mục và sản phẩm', [['sort', 'Ô sắp xếp sản phẩm'], ['pnotes', 'Ghi chú dưới sản phẩm (thời gian in, thanh toán)']]],
    ['Chân trang', [['footer', 'Hiện chân trang'], ['footContact', 'Cột Liên hệ'], ['footCats', 'Cột Danh mục']]]
  ];
  function baseLook() {
    return { avatar: '', theme: 'sky', mode: 'auto', font: 'default', size: 'md', show: {}, hiddenCats: [] };
  }
  function normLook(l) {
    const b = baseLook();
    l = l && typeof l === 'object' ? l : {};
    return {
      avatar: typeof l.avatar === 'string' ? l.avatar : '',
      theme: THEMES[l.theme] ? l.theme : b.theme,
      mode: ['auto', 'light', 'dark'].includes(l.mode) ? l.mode : b.mode,
      font: FONTS[l.font] ? l.font : b.font,
      size: SIZES[l.size] != null ? l.size : b.size,
      show: Object.assign({}, l.show),
      hiddenCats: Array.isArray(l.hiddenCats) ? l.hiddenCats.slice() : []
    };
  }
  // Màu nhấn của web. "sky" là bộ mặc định trong base.css nên không ghi đè gì.
  // dark: giá trị riêng khi ở chế độ tối.
  const THEMES = {
    sky: { name: 'Baby blue', dot: '#8FCBF0' },
    pink: { name: 'Hồng phấn', dot: '#F5A3C7', sky: '#F5A3C7', deep: '#D6578F', soft: '#FDE3EE', wash: '#FEEFF5', text: '#B73C78', hover: '#F18DB8', onCta: '#4A1530', paper: '#FFF8FB', rule: '#F3DCE6',
      dark: { deep: '#F08BB8', soft: '#3A1F2D', wash: '#2A1722', text: '#F6AFCF' } },
    mint: { name: 'Bạc hà', dot: '#9ED9C3', sky: '#9ED9C3', deep: '#2F9C78', soft: '#DDF4EA', wash: '#EAF8F2', text: '#1F7A5B', hover: '#86CDB3', onCta: '#0E3326', paper: '#F6FCF9', rule: '#D8EBE3',
      dark: { deep: '#7ACDAE', soft: '#17352B', wash: '#112820', text: '#8FDDBF' } },
    lavender: { name: 'Tím lavender', dot: '#C7B9F2', sky: '#C7B9F2', deep: '#7A63CC', soft: '#EAE4FB', wash: '#F1EDFD', text: '#5F49B0', hover: '#B6A5EC', onCta: '#26194F', paper: '#FAF8FF', rule: '#E3DDF4',
      dark: { deep: '#B3A3EC', soft: '#2A2347', wash: '#1F1A38', text: '#C9BDF5' } },
    peach: { name: 'Cam đào', dot: '#F7C4A3', sky: '#F7C4A3', deep: '#D9772F', soft: '#FDE8D8', wash: '#FEF1E6', text: '#B35A16', hover: '#F2B085', onCta: '#4A2308', paper: '#FFFAF6', rule: '#F2E1D3',
      dark: { deep: '#EDA06B', soft: '#3B2616', wash: '#2B1C10', text: '#F5BE94' } }
  };
  const THEME_VARS = ['--sky', '--sky-deep', '--sky-soft', '--sky-wash', '--accent-text', '--cta', '--cta-hover', '--on-cta', '--focus', '--paper', '--rule'];
  const MODES = { auto: 'Theo thiết bị', light: 'Sáng', dark: 'Tối' };
  // gf: tên họ font trên Google Fonts (đều có tiếng Việt). Bỏ trống nếu đã tải sẵn hoặc là font hệ thống.
  const FONTS = {
    default: { name: 'Mặc định (Quicksand + Nunito)' },
    nunito: { name: 'Nunito, tròn và dễ đọc', display: '"Nunito"', body: '"Nunito"' },
    vietnam: { name: 'Be Vietnam Pro, hiện đại', display: '"Be Vietnam Pro"', body: '"Be Vietnam Pro"', gf: 'Be+Vietnam+Pro:wght@400;500;600;700;800' },
    lexend: { name: 'Lexend, rộng và thoáng', display: '"Lexend"', body: '"Lexend"', gf: 'Lexend:wght@400;500;600;700' },
    montserrat: { name: 'Montserrat, gọn và mạnh', display: '"Montserrat"', body: '"Montserrat"', gf: 'Montserrat:wght@400;500;600;700;800' },
    lora: { name: 'Lora, tiêu đề có chân', display: '"Lora"', body: '"Nunito"', gf: 'Lora:wght@500;600;700' },
    system: { name: 'Font có sẵn trên máy', display: 'system-ui', body: 'system-ui' }
  };
  const SIZES = { sm: '92%', md: '', lg: '110%', xl: '125%' };
  const SIZE_NAMES = { sm: 'Nhỏ', md: 'Vừa', lg: 'Lớn', xl: 'Rất lớn' };
  let avatarSrc = '';
  let lastLook = null;

  function applyLook(look) {
    look = normLook(look);
    lastLook = look;
    avatarSrc = look.avatar;
    const root = document.documentElement;
    if (look.mode === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', look.mode);
    const dark = look.mode === 'dark' || (look.mode === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

    THEME_VARS.forEach(v => root.style.removeProperty(v));
    const t = THEMES[look.theme];
    if (look.theme !== 'sky') {
      const set = (k, v) => root.style.setProperty(k, v);
      set('--sky', t.sky); set('--cta', t.sky); set('--on-cta', t.onCta);
      if (dark) {
        set('--sky-deep', t.dark.deep); set('--focus', t.dark.deep); set('--sky-soft', t.dark.soft);
        set('--sky-wash', t.dark.wash); set('--accent-text', t.dark.text);
        set('--cta-hover', 'color-mix(in srgb, ' + t.sky + ' 75%, #fff)');
      } else {
        set('--sky-deep', t.deep); set('--focus', t.deep); set('--sky-soft', t.soft); set('--sky-wash', t.wash);
        set('--accent-text', t.text); set('--cta-hover', t.hover); set('--paper', t.paper); set('--rule', t.rule);
      }
    }

    const f = FONTS[look.font];
    if (f && f.display) {
      root.style.setProperty('--font-display', f.display + ',"Quicksand","Nunito",system-ui,sans-serif');
      root.style.setProperty('--font-body', f.body + ',"Nunito","Segoe UI",system-ui,sans-serif');
      root.style.setProperty('--font-mono', f.body + ',"Nunito","Segoe UI",system-ui,sans-serif');
      if (f.gf && !document.getElementById('font-' + look.font)) {
        const l = document.createElement('link');
        l.id = 'font-' + look.font; l.rel = 'stylesheet';
        l.href = 'https://fonts.googleapis.com/css2?family=' + f.gf + '&display=swap';
        document.head.appendChild(l);
      }
    } else {
      ['--font-display', '--font-body', '--font-mono'].forEach(v => root.style.removeProperty(v));
    }
    root.style.fontSize = SIZES[look.size] || '';

    if (avatarSrc) {
      const icon = document.querySelector('link[rel="icon"]') || document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'icon' }));
      icon.href = avatarSrc;
    }
  }
  try {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const again = () => { if (lastLook && lastLook.mode === 'auto') applyLook(lastLook); };
    if (mq.addEventListener) mq.addEventListener('change', again);
  } catch (e) {}

  const lookOf = db => normLook(db && db.settings && db.settings.look);
  const showSection = (db, key) => lookOf(db).show[key] !== false;
  const catVisible = (db, id) => !lookOf(db).hiddenCats.includes(id);
  const visibleCategories = db => db.categories.filter(c => catVisible(db, c.id));

  function baseLogistics() {
    const r = (from, to, price) => ({ id: uid('r'), from, to, price });
    return [
      { id: 'lg1', name: 'Kho Bằng Tường (mẫu)', route: 'Quảng Châu → Hà Nội', method: 'bo', days: '4–6 ngày',
        cnAddress: '广西凭祥市 · địa chỉ mẫu, thay bằng địa chỉ kho thật', vnAddress: 'Kho Long Biên, Hà Nội',
        contact: 'Zalo: 0900 000 001', minCharge: 50000, note: 'Hàng cồng kềnh quy đổi: dài × rộng × cao (cm) / 6000.',
        rates: [r(0, 20, 32000), r(20, 100, 28000), r(100, '', 24000)], demo: true },
      { id: 'lg2', name: 'Kho Đông Hưng (mẫu)', route: 'Thâm Quyến → TP.HCM', method: 'bo', days: '7–10 ngày',
        cnAddress: '广西东兴市 · địa chỉ mẫu, thay bằng địa chỉ kho thật', vnAddress: 'Kho Tân Bình, TP.HCM',
        contact: 'Zalo: 0900 000 002', minCharge: 80000, note: 'Hàng dễ vỡ (mica, figure) đóng thùng gỗ, phụ phí 30.000 ₫/kiện.',
        rates: [r(0, 30, 38000), r(30, 150, 33000), r(150, '', 29000)], demo: true }
    ];
  }

  function seed() {
    const now = Date.now();
    const v = (name, price, minQty) => ({ id: uid('v'), name, price, minQty: minQty || 1 });
    const prod = (id, catId, name, desc, leadDays, variants, ago) => ({ id, catId, name, desc, leadDays, variants, images: [], active: true, demo: true, createdAt: now - ago * D });
    const products = [
      prod('sp-namecard', 'in-giay', 'Name card', 'Giấy couche 300gsm, in sắc nét, bo góc theo yêu cầu. Giá tính theo hộp 100 cái.', 5,
        [v('Hộp 100 cái · in 1 mặt', 90000), v('Hộp 100 cái · in 2 mặt', 120000), v('Hộp 100 cái · 2 mặt, cán mờ', 140000)], 40),
      prod('sp-hopgiay', 'in-giay', 'Hộp giấy cứng nắp rời', 'Giấy Ivory 350gsm bồi carton, in 4 màu, cán màng mờ. Phù hợp đựng bánh, quà tặng, mỹ phẩm.', 8,
        [v('15 × 15 × 5 cm', 18000, 200), v('20 × 15 × 6 cm', 22000, 200), v('25 × 20 × 8 cm', 28000, 200)], 30),
      prod('sp-mockhoa', 'in-mica', 'Móc khóa acrylic', 'Mica trong 3 mm, in UV sắc nét, cắt theo hình, kèm khoen bạc.', 7,
        [v('5 × 5 cm · in 1 mặt', 9000, 50), v('6 × 6 cm · in 2 mặt', 13000, 50), v('Shaker 7 cm', 25000, 30)], 25),
      prod('sp-standee', 'in-mica', 'Standee mica', 'Mica trong 3 mm, in UV, đế cài chắc chắn.', 7,
        [v('Cao 15 cm · đế 5 cm', 35000, 10), v('Cao 20 cm · đế 8 cm', 55000, 10)], 20),
      prod('sp-figure', 'in-3d', 'Figure resin', 'In resin độ phân giải cao, chà nhám kỹ. Gửi file STL hoặc ảnh mẫu.', 6,
        [v('Cao 8 cm · chưa sơn', 120000), v('Cao 12 cm · sơn màu', 380000)], 15),
      prod('sp-tote', 'in-vai', 'Túi tote canvas', 'Canvas 12oz màu kem, in lụa, quai dài đeo vai.', 10,
        [v('35 × 40 cm · in 1 mặt', 45000, 50), v('35 × 40 cm · in 2 mặt', 58000, 50)], 12),
      prod('sp-aothun', 'in-vai', 'Áo thun cotton in DTF', 'Cotton 100% 250gsm, đủ size S–XL, in DTF bền màu.', 9,
        [v('In mặt trước khổ A4', 115000, 20), v('In 2 mặt khổ A4', 145000, 20)], 8)
    ];
    const P = id => products.find(p => p.id === id);
    const item = (pid, vi, qty) => { const p = P(pid); const vv = p.variants[vi]; return { productId: p.id, productName: p.name, catId: p.catId, variantId: vv.id, variantName: vv.name, price: vv.price, qty }; };

    const customers = [
      { id: 'kh1', name: 'Nguyễn Thu Hà',  phone: '0912345678', email: 'thuha@example.com', company: 'Tiệm bánh Mây', address: '12 Phố Huế', city: 'Hà Nội', createdAt: now - 62 * D },
      { id: 'kh2', name: 'Trần Minh Khoa', phone: '0987654321', email: 'khoa@example.com',  company: 'Studio Lam',    address: '45 Lê Lợi', city: 'TP. Hồ Chí Minh', createdAt: now - 20 * D },
      { id: 'kh3', name: 'Lê Hoàng Yến',   phone: '0903222111', email: 'yen@example.com',   company: 'Yến Merch',     address: '8 Bạch Đằng', city: 'Đà Nẵng', createdAt: now - 15 * D }
    ];
    const factories = [
      { id: 'x1', name: 'Hưng Thịnh', cn: '兴盛包装',   city: 'Đông Quản',  cats: ['in-giay'],           contact: 'WeChat: wx_hungthinh_demo', rating: 4.8, note: 'Hộp cứng, ép kim đẹp.' },
      { id: 'x2', name: 'Kim Long',   cn: '金龙印刷',   city: 'Quảng Châu', cats: ['in-giay', 'in-vai'], contact: 'WeChat: wx_kimlong_demo',   rating: 4.5, note: 'Name card, tem nhãn, giá tốt.' },
      { id: 'x3', name: 'Á Đông',     cn: '亚东亚克力', city: 'Thâm Quyến', cats: ['in-mica'],           contact: 'WeChat: wx_yadong_demo',    rating: 4.7, note: 'In UV sắc nét, cắt laser chuẩn.' },
      { id: 'x4', name: 'Tân Tạo 3D', cn: '新造三维',   city: 'Thâm Quyến', cats: ['in-3d'],             contact: 'WeChat: wx_xinzao_demo',    rating: 4.6, note: 'Resin, SLS, hoàn thiện sơn tốt.' },
      { id: 'x5', name: 'Hoa Dương',  cn: '华阳服饰',   city: 'Quảng Châu', cats: ['in-vai'],            contact: 'WeChat: wx_huayang_demo',   rating: 4.4, note: 'Áo thun, tote, in DTF.' }
    ];

    const settings = baseSettings();
    let n = 0;
    const order = (o, plan) => {
      const x = Object.assign({
        id: makeId(o.createdAt, ++n), extraFee: 0, extraNote: '', paid1: false, paid1Amount: null,
        balancePaid: false, paidNotice: null, produceStart: null, shipping: null, deliveredAt: null,
        factoryId: null, cancelReason: '', note: '', messages: [], history: [], unreadAdmin: 0, unreadCustomer: 0, demo: true
      }, o);
      const sub = x.items.reduce((a, i) => a + i.price * i.qty, 0);
      x.payPct = plan === 'full' ? 100 : depositRate(settings, sub);
      x.leadDays = Math.max.apply(null, x.items.map(i => (P(i.productId) || {}).leadDays || 7));
      x.updatedAt = x.history.length ? x.history[x.history.length - 1].at : x.createdAt;
      if (x.paid1) {
        x.paid1Amount = Math.round(money(x).total * x.payPct / 100);
        if (x.payPct >= 100) x.balancePaid = true;
      }
      return x;
    };
    const ship = c => ({ name: c.name, phone: c.phone, social: 'https://facebook.com/' + c.id + '.demo', address: c.address, city: c.city });
    const drive = name => 'https://drive.google.com/drive/folders/mau-' + name;

    const orders = [
      order({ customerId: 'kh1', items: [item('sp-namecard', 2, 5)], ...ship(customers[0]), file: drive('namecard-may'),
        status: 'da_giao', createdAt: now - 40 * D, factoryId: 'x2', paid1: true, produceStart: now - 39 * D,
        shipping: { method: 'bo', tracking: 'VC-77105', stage: 3, startedAt: now - 33 * D }, deliveredAt: now - 25 * D,
        history: [
          { at: now - 40 * D, by: 'customer', text: 'Đặt hàng, chọn thanh toán 100%' },
          { at: now - 39 * D, by: 'admin', text: 'Xác nhận đã nhận tiền, bắt đầu in' },
          { at: now - 33 * D, by: 'admin', text: 'Hàng rời xưởng, vận chuyển đường bộ' },
          { at: now - 25 * D, by: 'admin', text: 'Đã giao hàng' }
        ] }, 'full'),
      order({ customerId: 'kh1', items: [item('sp-tote', 0, 200)], ...ship(customers[0]), file: drive('tote-may'),
        status: 'van_chuyen', createdAt: now - 21 * D, factoryId: 'x5', paid1: true, produceStart: now - 20 * D,
        shipping: { method: 'bo', tracking: 'VC-88213', stage: 1, startedAt: now - 3 * D },
        history: [
          { at: now - 21 * D, by: 'customer', text: 'Đặt hàng, chọn đặt cọc 70%' },
          { at: now - 20 * D, by: 'admin', text: 'Xác nhận đã nhận tiền, bắt đầu in' },
          { at: now - 3 * D, by: 'admin', text: 'Hàng rời xưởng, vận chuyển đường bộ' },
          { at: now - 1 * D, by: 'admin', text: 'Hàng tới Cửa khẩu Lạng Sơn' }
        ] }),
      order({ customerId: 'kh1', items: [item('sp-mockhoa', 1, 300)], ...ship(customers[0]), file: drive('mockhoa-may'),
        status: 'san_xuat', createdAt: now - 6 * D, factoryId: 'x3', paid1: true, produceStart: now - 5 * D, unreadCustomer: 1,
        messages: [{ at: now - 5 * H, from: 'admin', text: 'File của bạn ổn rồi, xưởng đang in nhé. Dự kiến xong trong tuần này.' }],
        history: [
          { at: now - 6 * D, by: 'customer', text: 'Đặt hàng, chọn đặt cọc 70%' },
          { at: now - 5 * D, by: 'admin', text: 'Xác nhận đã nhận tiền, bắt đầu in' }
        ] }),
      order({ customerId: 'kh1', items: [item('sp-hopgiay', 1, 500)], ...ship(customers[0]), file: drive('hopgiay-may'),
        note: 'Logo in ép kim vàng trên nắp.', status: 'cho_coc', createdAt: now - 3 * H,
        history: [{ at: now - 3 * H, by: 'customer', text: 'Đặt hàng, chọn đặt cọc 70%' }] }),
      order({ customerId: 'kh2', items: [item('sp-standee', 1, 40)], ...ship(customers[1]), file: drive('standee-lam'),
        status: 'cho_coc', createdAt: now - 26 * H, paidNotice: now - 2 * H, unreadAdmin: 1,
        messages: [{ at: now - 2 * H, from: 'customer', text: 'Mình đã chuyển khoản, nội dung ghi mã đơn.' }],
        history: [
          { at: now - 26 * H, by: 'customer', text: 'Đặt hàng, chọn thanh toán 100%' },
          { at: now - 2 * H, by: 'customer', text: 'Báo đã chuyển khoản' }
        ] }, 'full'),
      order({ customerId: 'kh3', items: [item('sp-aothun', 0, 50)], ...ship(customers[2]), file: drive('aothun-yen'),
        status: 'san_xuat', createdAt: now - 12 * D, factoryId: 'x5', paid1: true, produceStart: now - 11 * D,
        history: [
          { at: now - 12 * D, by: 'customer', text: 'Đặt hàng, chọn đặt cọc 70%' },
          { at: now - 11 * D, by: 'admin', text: 'Xác nhận đã nhận tiền, bắt đầu in' }
        ] }),
      order({ customerId: 'kh3', items: [item('sp-figure', 0, 3)], ...ship(customers[2]), file: drive('figure-yen'),
        status: 'san_xuat', createdAt: now - 3 * D, paid1: true, produceStart: now - 2 * D,
        history: [
          { at: now - 3 * D, by: 'customer', text: 'Đặt hàng, chọn đặt cọc 50%' },
          { at: now - 2 * D, by: 'admin', text: 'Xác nhận đã nhận tiền, bắt đầu in' }
        ] }),
      order({ customerId: 'kh2', items: [item('sp-figure', 0, 2), item('sp-mockhoa', 0, 100)], ...ship(customers[1]), file: drive('figure-lam'),
        note: 'Figure theo file STL, móc khóa in logo studio.', status: 'cho_coc', createdAt: now - 40 * 60e3, unreadAdmin: 1,
        messages: [{ at: now - 30 * 60e3, from: 'customer', text: 'Shop ơi figure có in được màu trong suốt không?' }],
        history: [{ at: now - 40 * 60e3, by: 'customer', text: 'Đặt hàng, chọn đặt cọc 70%' }] })
    ];

    // Đơn in mẫu: gom từ các đơn khách đã thanh toán (đơn figure của Lê Hoàng Yến cố ý để "chưa đặt in")
    const lineFrom = (o, cny) => o.items.map((it, i) => ({ id: uid('dl'), orderId: o.id, itemIndex: i, productName: it.productName, variantName: it.variantName, qty: it.qty, cny: cny[i] }));
    const byItem = pid => orders.find(o => o.items[0].productId === pid && o.status !== 'cho_coc');
    const printJobs = [
      { id: 'dj1', code: 'DI-0001', mvd: 'SF1234567890', rate: 3650, kg: 28, whId: 'lg1', note: '', createdAt: now - 20 * D, demo: true,
        lines: lineFrom(byItem('sp-tote'), [6.5]) },
      { id: 'dj2', code: 'DI-0002', mvd: '', rate: 3650, kg: '', whId: 'lg2', note: 'Gửi chung một lô', createdAt: now - 5 * D, demo: true,
        lines: lineFrom(byItem('sp-aothun'), [19]).concat(lineFrom(byItem('sp-mockhoa'), [1.8])) }
    ];

    return { version: VERSION, seq: n, jobSeq: 2, settings, categories: baseCategories(), products, customers, factories, logistics: baseLogistics(), printJobs, jobFees: [], variantPresets: [], orders };
  }

  // ==== LƯU TRỮ (thay phần này khi có backend) ====
  const VERSION = 4;
  const DB_KEY = 'pinya-db-v4';
  const SESSION_KEY = 'pinya-session-';
  const CART_KEY = 'pinya-cart';
  let memory = null;
  const memSession = {};
  let memCart = [];

  function load() {
    if (CLOUD) { if (!memory) memory = emptyDb(); return memory; }
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && d.version === VERSION) {
          d.settings = Object.assign(baseSettings(), d.settings); // thêm trường cài đặt mới nếu có
          d.settings.look = normLook(d.settings.look);
          if (!Array.isArray(d.logistics)) d.logistics = baseLogistics();
          if (!Array.isArray(d.printJobs)) d.printJobs = [];
          if (!Array.isArray(d.jobFees)) d.jobFees = [];
          if (!Array.isArray(d.variantPresets)) d.variantPresets = [];
          memory = d;
          return d;
        }
      }
    } catch (e) {}
    if (memory) return memory;
    memory = seed();
    persist(memory);
    return memory;
  }

  function persist(d) {
    memory = d;
    if (CLOUD) { if (pageRole === 'admin' && adminOk) scheduleFlush(); return true; }
    try { localStorage.setItem(DB_KEY, JSON.stringify(d)); return true; }
    catch (e) {
      window.dispatchEvent(new CustomEvent('pinya:save-error'));
      return false;
    }
  }

  // Đọc, sửa, lưu trong một lần. fn nhận db và trả về giá trị bất kỳ.
  function update(fn) {
    const d = load();
    const r = fn(d);
    persist(d);
    return r;
  }

  function reset() { if (CLOUD) return memory; memory = seed(); persist(memory); return memory; }

  // Bỏ đơn in đã xóa khỏi các khoản phụ phí; khoản nào hết đơn in thì xóa luôn
  function pruneJobFees(d) {
    const ids = new Set((d.printJobs || []).map(j => j.id));
    d.jobFees = (d.jobFees || []).map(f => Object.assign({}, f, { jobIds: (f.jobIds || []).filter(id => ids.has(id)) })).filter(f => f.jobIds.length);
  }

  // Bắt đầu trống: giữ danh mục và cài đặt; xóa sản phẩm, đơn, khách, xưởng mẫu
  function clearDemo() {
    if (CLOUD) return;
    return update(d => {
      d.products = d.products.filter(p => !p.demo);
      d.orders = d.orders.filter(o => !o.demo);
      const used = new Set(d.orders.map(o => o.customerId));
      d.customers = d.customers.filter(c => used.has(c.id) || !/^kh\d$/.test(c.id));
      d.factories = d.factories.filter(f => !/_demo$/.test(f.contact || ''));
      d.logistics = (d.logistics || []).filter(w => !w.demo);
      d.printJobs = (d.printJobs || []).filter(j => !j.demo);
      pruneJobFees(d);
    });
  }

  function onChange(cb) {
    changeCbs.push(cb);
    window.addEventListener('storage', e => {
      if (e.key === DB_KEY) { memory = null; cb('db'); }
      if (e.key === CART_KEY) cb('cart');
    });
  }

  function getSession(role) {
    if (CLOUD && role === 'admin') return adminOk ? { email: adminEmail } : null;
    try { return JSON.parse(localStorage.getItem(SESSION_KEY + role) || 'null'); }
    catch (e) { return memSession[role] || null; }
  }
  function setSession(role, val) {
    if (CLOUD) return; // bản Supabase: phiên đăng nhập do Supabase giữ
    memSession[role] = val;
    try {
      if (val) localStorage.setItem(SESSION_KEY + role, JSON.stringify(val));
      else localStorage.removeItem(SESSION_KEY + role);
    } catch (e) {}
  }

  // Số điện thoại khách vừa tra cứu ở mục "Theo dõi tiến độ in" (chỉ lưu trên máy khách)
  const TRACK_KEY = 'pinya-track';
  let memTrack = '';
  function getTrack() {
    try { return localStorage.getItem(TRACK_KEY) || ''; } catch (e) { return memTrack; }
  }
  function setTrack(p) {
    memTrack = p || '';
    try { if (p) localStorage.setItem(TRACK_KEY, p); else localStorage.removeItem(TRACK_KEY); } catch (e) {}
  }
  function ordersByPhone(db, phone) {
    const p = normPhone(phone);
    if (p.length < 9) return [];
    return db.orders.filter(o => normPhone(o.phone) === p || normPhone((findCustomer(db, o.customerId) || {}).phone) === p)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  // Giỏ hàng của người đang xem: [{ pid, vid, qty }]
  function getCart() {
    try { const c = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); return Array.isArray(c) ? c : []; }
    catch (e) { return memCart; }
  }
  function setCart(c) {
    memCart = c;
    try { localStorage.setItem(CART_KEY, JSON.stringify(c)); } catch (e) {}
  }
  function addToCart(pid, vid, qty) {
    const c = getCart();
    const hit = c.find(x => x.pid === pid && x.vid === vid);
    if (hit) hit.qty += qty; else c.push({ pid, vid, qty });
    setCart(c);
    return c;
  }
  // Ghép giỏ với dữ liệu sản phẩm hiện tại; bỏ dòng có sản phẩm đã xóa hoặc ẩn
  function cartLines(db) {
    return getCart().map(x => {
      const p = db.products.find(pp => pp.id === x.pid && pp.active);
      const v = p && p.variants.find(vv => vv.id === x.vid);
      return p && v ? { pid: p.id, vid: v.id, qty: x.qty, product: p, variant: v, line: v.price * x.qty } : null;
    }).filter(Boolean);
  }

  // ==== Tra cứu ====
  const findOrder = (db, id) => db.orders.find(o => o.id === id) || null;
  const findCustomer = (db, id) => db.customers.find(c => c.id === id) || null;
  const findFactory = (db, id) => db.factories.find(f => f.id === id) || null;
  const findProduct = (db, id) => db.products.find(p => p.id === id) || null;
  const findCategory = (db, id) => db.categories.find(c => c.id === id) || null;
  const findCustomerByPhone = (db, phone) => {
    const p = normPhone(phone);
    return p ? db.customers.find(c => normPhone(c.phone) === p) || null : null;
  };

  // ==== Nghiệp vụ ====
  function log(o, text, by) {
    const at = Date.now();
    o.history.push({ at, by, text });
    o.updatedAt = at;
  }

  const act = {
    upsertCustomer(db, data) {
      let c = findCustomerByPhone(db, data.phone);
      if (c) {
        ['name', 'email', 'company', 'address', 'city'].forEach(k => { if (data[k] && !c[k]) c[k] = data[k]; });
        return c;
      }
      c = { id: uid('kh'), name: (data.name || '').trim(), phone: normPhone(data.phone),
        email: data.email || '', company: data.company || '', address: data.address || '', city: data.city || '', createdAt: Date.now() };
      db.customers.push(c);
      return c;
    },
    // lines: [{ product, variant, qty }] từ cartLines(); info.payPct: 100 hoặc tỷ lệ cọc
    placeOrder(db, lines, info, customerId) {
      db.seq = (db.seq || 0) + 1;
      const now = Date.now();
      const o = {
        id: makeId(now, db.seq), customerId, status: 'cho_coc', createdAt: now, updatedAt: now,
        items: lines.map(l => ({ productId: l.product.id, productName: l.product.name, catId: l.product.catId,
          variantId: l.variant.id, variantName: l.variant.name, price: l.variant.price, qty: l.qty })),
        name: info.name, phone: normPhone(info.phone), social: info.social || '', address: info.address || '', city: info.city || DEST[0],
        file: info.file || '', note: info.note || '', payPct: info.payPct,
        leadDays: Math.max.apply(null, lines.map(l => +l.product.leadDays || 7)),
        extraFee: 0, extraNote: '', paid1: false, paid1Amount: null, balancePaid: false,
        paidNotice: null, produceStart: null, shipping: null, deliveredAt: null, factoryId: null, cancelReason: '',
        messages: [], history: [], unreadAdmin: 0, unreadCustomer: 0
      };
      log(o, 'Đặt hàng, chọn ' + payLabel(o).toLowerCase(), 'customer');
      db.orders.push(o);
      return o;
    },
    sendMessage(db, o, from, text) {
      o.messages.push({ at: Date.now(), from, text });
      if (from === 'customer') o.unreadAdmin = (o.unreadAdmin || 0) + 1;
      else o.unreadCustomer = (o.unreadCustomer || 0) + 1;
      o.updatedAt = Date.now();
    },
    markRead(db, o, who) {
      if (who === 'admin') o.unreadAdmin = 0; else o.unreadCustomer = 0;
    },
    // Khách
    notifyPaid(db, o) {
      o.paidNotice = Date.now();
      log(o, 'Báo đã chuyển khoản', 'customer');
      act.sendMessage(db, o, 'customer', 'Mình đã chuyển khoản ' + fmt.vnd(money(o).first) + ', nội dung ghi ' + o.id + '.');
    },
    setFile(db, o, file) {
      o.file = file;
      log(o, 'Cập nhật link file thiết kế', 'customer');
      o.unreadAdmin = (o.unreadAdmin || 0) + 1;
    },
    // Quản trị
    confirmPayment(db, o) {
      o.paid1 = true;
      o.paid1Amount = Math.round(money(o).total * o.payPct / 100);
      if (o.payPct >= 100) o.balancePaid = true;
      o.paidNotice = null;
      o.status = 'san_xuat';
      o.produceStart = Date.now();
      log(o, 'Xác nhận đã nhận tiền, bắt đầu in', 'admin');
    },
    // whId, kg: kho trung chuyển và cân nặng (không bắt buộc); phí ship là chi phí nội bộ, khách không thấy
    startShipping(db, o, method, tracking, whId, kg) {
      const w = (db.logistics || []).find(x => x.id === whId);
      const q = w ? shipQuote(w, kg) : null;
      o.shipping = { method, tracking, stage: 0, startedAt: Date.now(), warehouseId: w ? w.id : null, warehouseName: w ? w.name : '', kg: +kg || 0, cost: q && q.ok ? q.cost : null };
      o.status = 'van_chuyen';
      log(o, 'Hàng rời xưởng, vận chuyển ' + SHIP_METHODS[method].name.toLowerCase() + (w ? ' qua ' + w.name : ''), 'admin');
    },
    savePrintJob(db, j) {
      db.printJobs = db.printJobs || [];
      const i = db.printJobs.findIndex(x => x.id === j.id);
      if (i >= 0) db.printJobs[i] = Object.assign({}, db.printJobs[i], j);
      else {
        db.jobSeq = (db.jobSeq || db.printJobs.length) + 1;
        db.printJobs.unshift(Object.assign({ createdAt: Date.now(), code: 'DI-' + String(db.jobSeq).padStart(4, '0') }, j));
      }
      // Ghi vào lịch sử các đơn khách vừa được đưa vào đơn in
      const saved = db.printJobs.find(x => x.id === j.id);
      new Set((j.lines || []).map(l => l.orderId)).forEach(oid => {
        const o = findOrder(db, oid);
        if (o && !o.history.some(h => h.jobId === j.id)) {
          o.history.push({ at: Date.now(), by: 'admin', text: 'Đã đặt in trong đơn ' + saved.code, jobId: j.id });
          o.updatedAt = Date.now();
        }
      });
      if (+j.rate > 0) db.settings.lastRate = +j.rate; // nhớ tỷ giá lần gần nhất để điền sẵn
    },
    deletePrintJob(db, id) {
      db.printJobs = (db.printJobs || []).filter(j => j.id !== id);
      pruneJobFees(db);
    },
    saveJobFee(db, f) {
      db.jobFees = db.jobFees || [];
      const i = db.jobFees.findIndex(x => x.id === f.id);
      if (i >= 0) db.jobFees[i] = Object.assign({}, db.jobFees[i], f);
      else db.jobFees.unshift(Object.assign({ createdAt: Date.now() }, f));
    },
    deleteJobFee(db, id) {
      db.jobFees = (db.jobFees || []).filter(f => f.id !== id);
    },
    saveVariantPreset(db, p) {
      db.variantPresets = db.variantPresets || [];
      const i = db.variantPresets.findIndex(x => x.id === p.id);
      if (i >= 0) db.variantPresets[i] = p; else db.variantPresets.push(p);
    },
    deleteVariantPreset(db, id) {
      db.variantPresets = (db.variantPresets || []).filter(x => x.id !== id);
    },
    // Quản trị sửa đơn: thông tin khách, file, ghi chú, số lượng và giá từng dòng, cách thanh toán
    editOrder(db, o, data) {
      ['name', 'social', 'address', 'city', 'file', 'note'].forEach(k => { if (data[k] != null) o[k] = data[k]; });
      if (data.phone != null) o.phone = normPhone(data.phone);
      if (Array.isArray(data.items)) {
        data.items.forEach((it, i) => {
          if (!o.items[i]) return;
          if (+it.qty > 0) o.items[i].qty = Math.round(+it.qty);
          if (+it.price >= 0) o.items[i].price = Math.round(+it.price);
        });
      }
      if (data.payPct && !o.paid1) o.payPct = +data.payPct;
      log(o, 'Shop sửa thông tin đơn', 'admin');
    },
    saveLogistic(db, w) {
      db.logistics = db.logistics || [];
      const i = db.logistics.findIndex(x => x.id === w.id);
      if (i >= 0) db.logistics[i] = Object.assign({}, db.logistics[i], w);
      else db.logistics.push(w);
    },
    deleteLogistic(db, id) {
      db.logistics = (db.logistics || []).filter(w => w.id !== id);
    },
    setShipStage(db, o, i) {
      o.shipping.stage = i;
      log(o, i === 3 ? 'Đang giao đến khách' : 'Hàng tới ' + SHIP_STAGES[i], 'admin');
    },
    markDelivered(db, o) {
      o.deliveredAt = Date.now();
      if (o.shipping) o.shipping.stage = 3;
      o.status = 'da_giao';
      log(o, 'Đã giao hàng', 'admin');
    },
    confirmBalance(db, o) {
      o.balancePaid = true;
      log(o, 'Xác nhận đã thanh toán đủ', 'admin');
    },
    setExtraFee(db, o, fee, note) {
      o.extraFee = fee;
      o.extraNote = note;
      log(o, fee ? 'Cập nhật phụ phí ' + fmt.vnd(fee) + (note ? ': ' + note : '') : 'Bỏ phụ phí', 'admin');
    },
    cancel(db, o, reason, by) {
      o.status = 'huy';
      o.cancelReason = reason || '';
      log(o, 'Hủy đơn' + (reason ? ': ' + reason : ''), by);
    },
    reopen(db, o) {
      o.status = o.paid1 ? 'san_xuat' : 'cho_coc';
      o.cancelReason = '';
      log(o, 'Mở lại đơn', 'admin');
    },
    setStatus(db, o, s) {
      o.status = s;
      if (s === 'san_xuat' && !o.produceStart) o.produceStart = Date.now();
      log(o, 'Đổi trạng thái sang “' + STATUSES[s].admin + '”', 'admin');
    },
    setFactory(db, o, id) {
      o.factoryId = id || null;
      const f = findFactory(db, id);
      log(o, f ? 'Giao cho xưởng ' + f.name : 'Bỏ chọn xưởng', 'admin');
    },
    saveProduct(db, p) {
      const i = db.products.findIndex(x => x.id === p.id);
      if (i >= 0) db.products[i] = Object.assign({}, db.products[i], p);
      else db.products.unshift(Object.assign({ createdAt: Date.now() }, p));
    },
    deleteProduct(db, id) {
      db.products = db.products.filter(p => p.id !== id);
    },
    saveCategory(db, c) {
      const i = db.categories.findIndex(x => x.id === c.id);
      if (i >= 0) Object.assign(db.categories[i], c);
      else db.categories.push(c);
    },
    deleteCategory(db, id) {
      db.categories = db.categories.filter(c => c.id !== id);
    }
  };

  // ==== SUPABASE ====
  // Bật khi assets/config.js có địa chỉ và khóa. Không có thì web chạy chế độ thử, lưu trong trình duyệt.
  // Ý tưởng: bộ nhớ trong trang (memory) vẫn là nguồn đọc đồng bộ như cũ; mọi thay đổi của quản trị được so với
  // bản đã đồng bộ rồi ghi lên bảng "records". Khách không ghi trực tiếp, chỉ gọi 3 hàm đặt hàng/xem đơn/thao tác đơn.
  const CFG = window.PINYA_CONFIG || {};
  const CLOUD = !!(CFG.supabaseUrl && CFG.supabaseKey);
  const SEP = '\u0001';
  const PUBLIC_KINDS = ['settings', 'category', 'product'];
  const COLLECTIONS = [['category', 'categories'], ['product', 'products'], ['customer', 'customers'], ['factory', 'factories'],
    ['logistic', 'logistics'], ['printjob', 'printJobs'], ['jobfee', 'jobFees'], ['preset', 'variantPresets'], ['order', 'orders']];
  let sb = null, pageRole = 'shop', adminOk = false, adminEmail = '', loadError = null;
  const synced = new Map(); // khóa → { json, ts }: trạng thái đã có trên máy chủ
  const changeCbs = [];
  let serverHasSettings = false;
  let lastPull = '', flushing = false, again = false, retryT = null, pollT = null, syncState = 'ok', pollBound = false;

  const emitChange = () => changeCbs.forEach(cb => { try { cb('db'); } catch (e) {} });
  const setSync = st => { syncState = st; window.dispatchEvent(new CustomEvent('pinya:sync', { detail: st })); };
  const errText = e => {
    const m = String((e && e.message) || e || '');
    if (/fetch|network|load failed|timeout/i.test(m)) return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
    return m || 'Có lỗi xảy ra, thử lại sau.';
  };

  function emptyDb() {
    return { version: VERSION, seq: 0, jobSeq: 0, settings: baseSettings(), categories: [], products: [], customers: [], factories: [],
      logistics: [], printJobs: [], jobFees: [], variantPresets: [], orders: [] };
  }

  // Mọi thứ trong db thành các dòng (kind, id, data). adminEmail không đưa lên máy chủ (đăng nhập do Supabase quản).
  function flatten(d) {
    const m = new Map();
    const add = (kind, id, data, extra) => m.set(kind + SEP + id, Object.assign({ kind, id, data, pos: 0, phone: null }, extra));
    const st = Object.assign({}, d.settings); delete st.adminEmail;
    add('settings', 'main', st);
    COLLECTIONS.forEach(([kind, key]) => (d[key] || []).forEach((x, i) => add(kind, x.id, x, {
      pos: kind === 'category' ? i : 0,
      phone: kind === 'order' || kind === 'customer' ? normPhone(x.phone) : null
    })));
    add('meta', 'counters', { jobSeq: d.jobSeq || 0 });
    return m;
  }
  const sig = v => JSON.stringify([v.data, v.pos]);

  const byCreatedDesc = (a, b) => (b.data.createdAt || 0) - (a.data.createdAt || 0);
  const byCreatedAsc = (a, b) => (a.data.createdAt || 0) - (b.data.createdAt || 0);
  const byRowCreated = (a, b) => String(a.created_at).localeCompare(String(b.created_at));
  const sorter = kind => kind === 'category' ? ((a, b) => a.pos - b.pos)
    : ['product', 'printjob', 'jobfee'].includes(kind) ? byCreatedDesc
    : ['order', 'customer'].includes(kind) ? byCreatedAsc : byRowCreated;

  function applySettings(d, data) {
    d.settings = Object.assign(baseSettings(), data || {});
    d.settings.look = normLook(d.settings.look);
  }

  function buildFromRows(rows) {
    const d = emptyDb();
    const by = {};
    rows.forEach(r => { (by[r.kind] = by[r.kind] || []).push(r); });
    applySettings(d, (by.settings || [])[0] && by.settings[0].data);
    COLLECTIONS.forEach(([kind, key]) => { d[key] = (by[kind] || []).sort(sorter(kind)).map(r => r.data); });
    const meta = (by.meta || []).find(r => r.id === 'counters');
    d.jobSeq = meta ? +meta.data.jobSeq || 0 : 0;
    memory = d;
    // Gốc so sánh lấy từ chính bộ nhớ vừa dựng, để giá trị mặc định thêm vào không bị coi là thay đổi chưa lưu
    const flat = flatten(d);
    synced.clear();
    const ts = {}; rows.forEach(r => { ts[r.kind + SEP + r.id] = r.updated_at; });
    serverHasSettings = !!(by.settings && by.settings.length);
    // Mọi thứ hiện có coi là đã đồng bộ. Riêng cài đặt khi máy chủ còn trống: để chưa đồng bộ, lần đăng nhập đầu sẽ ghi lên.
    flat.forEach((v, k) => { if (serverHasSettings || k !== 'settings' + SEP + 'main') synced.set(k, { json: sig(v), ts: ts[k] || '' }); });
    lastPull = rows.reduce((a, r) => (r.updated_at > a ? r.updated_at : a), '');
  }

  async function fetchRows(kinds, since) {
    let rows = [], from = 0;
    for (;;) {
      let q = sb.from('records').select('kind,id,data,phone,pos,created_at,updated_at')
        .order('updated_at', { ascending: true }).order('kind').order('id').range(from, from + 999);
      if (kinds) q = q.in('kind', kinds);
      if (since) q = q.gt('updated_at', since);
      const { data, error } = await q;
      if (error) throw error;
      rows = rows.concat(data || []);
      if (!data || data.length < 1000) break;
      from += 1000;
    }
    return rows;
  }
  async function fetchAll() {
    buildFromRows(await fetchRows(pageRole === 'admin' && adminOk ? null : PUBLIC_KINDS));
  }

  function diff() {
    const cur = flatten(memory);
    const ups = [], dels = [];
    cur.forEach((v, k) => { const j = sig(v); const s = synced.get(k); if (!s || s.json !== j) ups.push({ k, v, j, s }); });
    synced.forEach((s, k) => { if (!cur.has(k)) dels.push({ k, s }); });
    return { ups, dels };
  }
  const pendingCount = () => { if (!CLOUD || !memory || !adminOk) return 0; const d = diff(); return d.ups.length + d.dels.length; };

  function scheduleFlush() { setSync('saving'); clearTimeout(retryT); setTimeout(flush, 0); }

  async function flush() {
    if (flushing) { again = true; return; }
    flushing = true;
    try {
      do {
        again = false;
        const { ups, dels } = diff();
        // xóa
        const gone = {};
        dels.forEach(x => { const [kind, id] = x.k.split(SEP); (gone[kind] = gone[kind] || []).push(id); });
        for (const kind of Object.keys(gone)) {
          const { error } = await sb.from('records').delete().eq('kind', kind).in('id', gone[kind]);
          if (error) throw error;
          gone[kind].forEach(id => synced.delete(kind + SEP + id));
        }
        // đơn đã có: ghi kèm điều kiện updated_at, nếu khách vừa cập nhật đơn thì báo xung đột
        const orders = ups.filter(x => x.v.kind === 'order' && x.s);
        const rest = ups.filter(x => !(x.v.kind === 'order' && x.s));
        for (const x of orders) {
          const { data, error } = await sb.from('records').update({ data: x.v.data, phone: x.v.phone })
            .eq('kind', 'order').eq('id', x.v.id).eq('updated_at', x.s.ts).select('updated_at');
          if (error) throw error;
          if (!data || !data.length) {
            await fetchAll();
            setSync('ok');
            window.dispatchEvent(new CustomEvent('pinya:conflict'));
            emitChange();
            return;
          }
          synced.set(x.k, { json: x.j, ts: data[0].updated_at });
        }
        for (let i = 0; i < rest.length; i += 100) {
          const chunk = rest.slice(i, i + 100);
          const { data, error } = await sb.from('records')
            .upsert(chunk.map(x => ({ kind: x.v.kind, id: x.v.id, data: x.v.data, phone: x.v.phone, pos: x.v.pos })), { onConflict: 'kind,id' })
            .select('kind,id,updated_at');
          if (error) throw error;
          const ts = {}; (data || []).forEach(r => { ts[r.kind + SEP + r.id] = r.updated_at; });
          chunk.forEach(x => synced.set(x.k, { json: x.j, ts: ts[x.k] || (x.s && x.s.ts) || '' }));
        }
        if (!again && pendingCount()) again = true;
      } while (again);
      setSync('ok');
    } catch (e) {
      const authLost = e && (e.status === 401 || e.status === 403 || e.code === '42501' || /jwt/i.test(String(e.message || '')));
      if (authLost) {
        adminOk = false;
        setSync('error');
        window.dispatchEvent(new CustomEvent('pinya:auth-lost'));
      } else {
        setSync('error');
        window.dispatchEvent(new CustomEvent('pinya:save-error', { detail: errText(e) }));
        retryT = setTimeout(flush, 8000);
      }
    } finally { flushing = false; }
  }

  // Ghép các dòng mới từ máy chủ vào bộ nhớ (quản trị mở nhiều thiết bị, hoặc khách vừa nhắn tin)
  function mergeRows(rows) {
    rows.forEach(r => {
      if (r.kind === 'settings') applySettings(memory, r.data);
      else if (r.kind === 'meta') { if (r.id === 'counters') memory.jobSeq = +r.data.jobSeq || 0; }
      else {
        const col = COLLECTIONS.find(c => c[0] === r.kind);
        if (!col) return;
        const arr = memory[col[1]];
        const i = arr.findIndex(x => x.id === r.id);
        if (i >= 0) arr[i] = r.data; else arr.push(r.data);
        if (r.kind === 'category') {
          const pos = {}; rows.filter(x => x.kind === 'category').forEach(x => { pos[x.id] = x.pos; });
          arr.sort((a, b) => (pos[a.id] != null ? pos[a.id] : 1e9) - (pos[b.id] != null ? pos[b.id] : 1e9));
        } else if (['product', 'printjob', 'jobfee'].includes(r.kind)) arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        else if (['order', 'customer'].includes(r.kind)) arr.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      }
    });
    const flat = flatten(memory);
    rows.forEach(r => { const k = r.kind + SEP + r.id; if (flat.has(k)) synced.set(k, { json: sig(flat.get(k)), ts: r.updated_at }); });
  }

  async function pullChanges() {
    if (!sb || pageRole !== 'admin' || !adminOk || flushing || document.hidden || pendingCount()) return;
    const rows = await fetchRows(null, lastPull);
    if (!rows.length) return;
    rows.forEach(r => { if (r.updated_at > lastPull) lastPull = r.updated_at; });
    const fresh = rows.filter(r => { const s = synced.get(r.kind + SEP + r.id); return !s || s.ts !== r.updated_at; });
    if (!fresh.length) return;
    mergeRows(fresh);
    emitChange();
  }

  async function checkAdmin() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { adminOk = false; adminEmail = ''; return false; }
    const { data, error } = await sb.rpc('is_admin');
    adminOk = !error && data === true;
    adminEmail = adminOk ? (session.user.email || '') : '';
    return adminOk;
  }

  // Lần đầu quản trị đăng nhập vào máy chủ còn trống: tạo cài đặt và 4 danh mục mặc định
  function ensureSeed() {
    if (!serverHasSettings) {
      memory.categories = baseCategories();
      scheduleFlush();
    }
  }

  function startPolling() {
    clearInterval(pollT);
    const tick = () => {
      if (document.hidden) return;
      if (pageRole === 'admin') pullChanges().catch(() => {});
      else if (getTrack()) cust.refresh().catch(() => {});
    };
    pollT = setInterval(tick, 20000);
    if (!pollBound) { pollBound = true; document.addEventListener('visibilitychange', tick); }
  }

  async function init(r) {
    pageRole = r === 'admin' ? 'admin' : 'shop';
    if (!CLOUD) { load(); return; }
    try {
      if (!window.supabase || !window.supabase.createClient) throw new Error('Không tải được thư viện kết nối máy chủ. Kiểm tra mạng rồi tải lại trang.');
      sb = sb || window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true } });
      if (pageRole === 'admin') await checkAdmin();
      await fetchAll();
      if (pageRole === 'admin' && adminOk) ensureSeed();
      if (pageRole === 'shop' && getTrack()) { try { await cust.track(getTrack()); } catch (e) {} }
      startPolling();
    } catch (e) { loadError = e; }
    if (pageRole === 'admin') window.addEventListener('beforeunload', e => { if (flushing || pendingCount()) { e.preventDefault(); e.returnValue = ''; } });
  }

  const auth = {
    async signIn(email, pass) {
      if (!CLOUD) return { ok: false, error: 'Chưa cấu hình.' };
      try {
        const { error } = await sb.auth.signInWithPassword({ email, password: pass });
        if (error) return { ok: false, error: /invalid/i.test(error.message) ? 'Email hoặc mật khẩu chưa đúng.' : errText(error) };
        if (!(await checkAdmin())) { await sb.auth.signOut(); return { ok: false, error: 'Tài khoản này chưa được cấp quyền quản trị.' }; }
        await fetchAll();
        ensureSeed();
        startPolling();
        return { ok: true };
      } catch (e) { return { ok: false, error: errText(e) }; }
    },
    async signOut() {
      try { await sb.auth.signOut(); } catch (e) {}
      adminOk = false; adminEmail = '';
      try { await fetchAll(); } catch (e) {}
    }
  };

  // ==== Khách: đặt hàng và theo dõi đơn (qua hàm trên Supabase, hoặc ghi thẳng bộ nhớ ở chế độ thử) ====
  const cust = {
    async track(phone) {
      phone = normPhone(phone);
      if (!CLOUD) return ordersByPhone(load(), phone);
      const { data, error } = await sb.rpc('track_orders', { p_phone: phone });
      if (error) throw error;
      load().orders = data || [];
      return load().orders;
    },
    async refresh() {
      const phone = getTrack();
      if (!CLOUD || !phone) return;
      const before = JSON.stringify(load().orders);
      await cust.track(phone);
      if (JSON.stringify(load().orders) !== before) emitChange();
    },
    async submitOrder(lines, info) {
      if (!CLOUD) return update(d => { const c = act.upsertCustomer(d, info); return act.placeOrder(d, lines, info, c.id); });
      const { data, error } = await sb.rpc('submit_order', { p_order: {
        name: info.name, phone: normPhone(info.phone), social: info.social || '', address: info.address || '', city: info.city || '',
        file: info.file || '', note: info.note || '', payPct: info.payPct,
        items: lines.map(l => ({ productId: l.pid, variantId: l.vid, qty: l.qty }))
      } });
      if (error) throw error;
      const db = load();
      db.orders = (db.orders || []).filter(o => o.id !== data.id).concat(data);
      return data;
    },
    // action: message | notify_paid | set_file | cancel | mark_read
    async action(id, action, payload) {
      payload = payload || {};
      if (!CLOUD) {
        update(d => {
          const o = findOrder(d, id);
          if (!o || normPhone(o.phone) !== normPhone(getTrack())) return;
          if (action === 'message') act.sendMessage(d, o, 'customer', payload.text);
          else if (action === 'notify_paid') act.notifyPaid(d, o);
          else if (action === 'set_file') act.setFile(d, o, payload.file);
          else if (action === 'cancel') act.cancel(d, o, 'Khách hủy đơn', 'customer');
          else if (action === 'mark_read') act.markRead(d, o, 'customer');
        });
        return findOrder(load(), id);
      }
      const { data, error } = await sb.rpc('customer_action', { p_id: id, p_phone: getTrack(), p_action: action, p_payload: payload });
      if (error) throw error;
      const db = load();
      const i = db.orders.findIndex(o => o.id === id);
      if (i >= 0) db.orders[i] = data; else db.orders.push(data);
      return data;
    }
  };

  // Ảnh sản phẩm: lên kho ảnh của Supabase, trong sản phẩm chỉ lưu địa chỉ ảnh
  async function uploadImage(dataUrl) {
    if (!CLOUD || !adminOk) return dataUrl;
    const blob = await (await fetch(dataUrl)).blob();
    const path = 'p/' + uid('i') + '.jpg';
    const { error } = await sb.storage.from('product-images').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
    if (error) throw error;
    return sb.storage.from('product-images').getPublicUrl(path).data.publicUrl;
  }

  // Mã danh mục dạng chữ không dấu, dùng làm neo liên kết (#dm-in-giay)
  function slugify(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'muc';
  }

  // ==== Giao diện dùng chung ====
  function selectText(el) {
    try {
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) {}
  }

  // Gọi trong lúc xử lý click; nếu trình duyệt chặn thì bôi đen sẵn nội dung
  function copyText(text, fallbackEl) {
    let p;
    try { p = navigator.clipboard.writeText(text); } catch (e) { p = Promise.reject(e); }
    return Promise.resolve(p).then(() => true, () => { if (fallbackEl) selectText(fallbackEl); return false; });
  }

  let toastTimer;
  function toast(msg) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  function lightbox(src, alt) {
    const box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', alt || 'Ảnh');
    box.innerHTML = '<img alt=""><button class="btn btn-quiet btn-sm" type="button">Đóng</button>';
    box.querySelector('img').src = src;
    box.querySelector('img').alt = alt || '';
    const close = () => { box.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    box.addEventListener('click', e => { if (e.target === box || e.target.tagName === 'BUTTON') close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(box);
    box.querySelector('button').focus();
  }

  // Thu nhỏ ảnh trước khi lưu để không đầy bộ nhớ trình duyệt
  function fileToDataUrl(file, max, quality) {
    max = max || 900; quality = quality || 0.8;
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('not-image')); return; }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * s);
        c.height = Math.round(img.naturalHeight * s);
        const g = c.getContext('2d');
        g.fillStyle = '#FFFFFF';
        g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load')); };
      img.src = url;
    });
  }

  // Logo shop: đặt file ảnh ở assets/logo.png. Chưa có file thì web dùng biểu tượng mặc định.
  const LOGO = 'assets/logo.png';
  let logoOk = false;
  function loadLogo(cb) {
    const img = new Image();
    img.onload = () => {
      logoOk = true;
      const icon = document.querySelector('link[rel="icon"]') || document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'icon' }));
      icon.href = avatarSrc || LOGO;
      cb();
    };
    img.src = LOGO;
  }
  const logoSrc = () => avatarSrc || (logoOk ? LOGO : '');
  function brandMark() {
    return logoSrc()
      ? '<img class="brand-logo" src="' + esc(logoSrc()) + '" alt="">'
      : '<svg class="reg" viewBox="0 0 32 32" aria-hidden="true"><circle class="ln" cx="16" cy="16" r="10"/><circle class="dot" cx="16" cy="16" r="4.5"/><path class="ln" d="M16 1v30M1 16h30"/></svg>';
  }

  try { applyLook(load().settings.look); } catch (e) {}
  window.addEventListener('pinya:save-error', e => toast(CLOUD
    ? 'Chưa lưu được lên máy chủ. ' + ((e.detail || '') + ' Web sẽ tự thử lại.').trim()
    : 'Không lưu được: bộ nhớ trình duyệt đã đầy hoặc bị chặn. Thử bớt ảnh sản phẩm.'));

  window.Pinya = {
    BRAND, INKS, STATUSES, STATUS_ORDER, STAGES, SHIP_METHODS, SHIP_STAGES, CITIES, DEST, DAY: D,
    fmt, esc, uid, isUrl, normPhone, parseNum, slugify, priceRange, soldCount,
    depositRate, payOptions, payLabel, money, shipQuote, rateLabel, shortSocial,
    lineCost, jobCost, jobStatus, jobForOrder, needsPrint, printable, expectedDone, expectedArrival, orderTitle, orderQty,
    adminNeeds, customerNeeds, pill, pillClass, catTag, thumb,
    load, update, reset, clearDemo, onChange, getSession, setSession,
    getCart, setCart, addToCart, cartLines, getTrack, setTrack, ordersByPhone,
    findOrder, findCustomer, findFactory, findProduct, findCategory, findCustomerByPhone,
    LOGO, loadLogo, brandMark, hasLogo: () => !!logoSrc(), logoSrc,
    SHOW_KEYS, THEMES, MODES, FONTS, SIZE_NAMES, baseLook, normLook, applyLook, lookOf, showSection, catVisible, visibleCategories,
    feeShares, feesOfJob, jobFeeTotal, jobFullCost, QTY_PRESETS, qtyPresets, parseTiers, qtyVariants,
    isCloud: CLOUD, init, auth, cust, uploadImage, errText, pendingCount,
    syncState: () => syncState, loadError: () => loadError,
    act, ui: { toast, copyText, selectText, lightbox, fileToDataUrl }
  };
})();
