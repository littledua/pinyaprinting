/* Pinya Printing · trang cửa hàng: giới thiệu, danh mục, sản phẩm, đặt hàng 3 bước, theo dõi tiến độ in, liên hệ */
(() => {
  'use strict';
  const P = window.Pinya;
  const { fmt, esc, STATUSES, STAGES, SHIP_METHODS, SHIP_STAGES, DEST } = P;
  const root = document.getElementById('shop');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const MAXQ = 99999;
  const clampQ = (q, min) => Math.min(MAXQ, Math.max(min || 1, q || 0));
  const ui = { q: '', menu: false, more: {}, sort: 'new', sel: null, confirm: null, trackErr: '', busy: false };
  let lastRoute = '';
  let booted = false;
  const reading = new Set(); // đơn đang gửi yêu cầu "đã đọc", tránh gửi lặp

  // Thông tin đang điền ở bước Gửi file và Thanh toán (giữ khi tải lại trang)
  const CO_KEY = 'pinya-checkout';
  let memCo = {};
  const getCo = () => { try { return JSON.parse(sessionStorage.getItem(CO_KEY) || '{}') || {}; } catch (e) { return memCo; } };
  const setCo = c => { memCo = c; try { sessionStorage.setItem(CO_KEY, JSON.stringify(c)); } catch (e) {} };
  const patchCo = p => setCo(Object.assign(getCo(), p));

  const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICON = {
    bag: svg('<path d="M3 4h2.2l2.3 11.2h10.8l2.2-8.2H6.3"/><circle cx="9.5" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/>'),
    track: svg('<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>'),
    chat: svg('<path d="M4 5h16v11H9l-5 4z"/>'),
    mail: svg('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7l8 6 8-6"/>'),
    clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    pin: svg('<path d="M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>'),
    link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
    search: svg('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>'),
    menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    left: svg('<path d="M15 5l-7 7 7 7"/>'),
    right: svg('<path d="M9 5l7 7-7 7"/>'),
    check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    folder: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>')
  };
  const REG = '<svg class="reg" viewBox="0 0 32 32" aria-hidden="true"><circle class="ln" cx="16" cy="16" r="10"/><circle class="dot" cx="16" cy="16" r="4.5"/><path class="ln" d="M16 1v30M1 16h30"/></svg>';
  const CROPS = '<span class="crop tl"></span><span class="crop tr"></span><span class="crop bl"></span><span class="crop br"></span>';
  const BAR = '<div class="bar proof-bar" aria-hidden="true">' + ['c', 'm', 'y', 'k'].map(k => [1, 2, 3, 4].map(i => `<span class="${k}${i}"></span>`).join('')).join('') + '</div>';

  const safeUrl = u => { u = String(u || '').trim(); if (!u) return ''; return /^https?:\/\//i.test(u) ? u : 'https://' + u.replace(/^\/+/, ''); };
  const phoneOk = o => P.normPhone(o.phone) === P.normPhone(P.getTrack());

  // ==== Điều hướng ====
  function route() {
    const h = location.hash.replace(/^#/, '');
    if (h.indexOf('dm-') === 0) return { view: 'cat', id: h.slice(3) };
    if (h.indexOf('sp-') === 0) return { view: 'product', id: h.slice(3) };
    if (h.indexOf('don-') === 0) return { view: 'order', id: h.slice(4) };
    if (h.indexOf('dat-xong-') === 0) return { view: 'done', id: h.slice(9) };
    if (h === 'gio-hang') return { view: 'cart' };
    if (h === 'gui-file') return { view: 'file' };
    if (h === 'thanh-toan') return { view: 'pay' };
    if (h === 'theo-doi') return { view: 'track' };
    if (h === 'lien-he') return { view: 'contact' };
    if (h === 'tim-kiem') return { view: 'search' };
    return { view: 'about' };
  }
  function go(hash) {
    if (location.hash === '#' + hash) { render(); window.scrollTo({ top: 0, behavior: 'instant' }); } else location.hash = hash;
  }

  // Giữ chữ đang gõ trong các ô tự do khi trang vẽ lại
  function snapshot() {
    const snap = {};
    root.querySelectorAll('[data-keep] input[id],[data-keep] textarea[id],[data-keep] select[id]').forEach(el => {
      if (el.type !== 'radio' && el.type !== 'file') snap[el.id] = el.value;
    });
    const a = document.activeElement;
    return { snap, focus: a && root.contains(a) && a.id ? a.id : null };
  }
  function restore(s) {
    Object.keys(s.snap).forEach(id => {
      const el = document.getElementById(id);
      if (el && (el.tagName !== 'SELECT' || Array.from(el.options).some(o => o.value === s.snap[id]))) el.value = s.snap[id];
    });
    if (s.focus) { const el = document.getElementById(s.focus); if (el) el.focus({ preventScroll: true }); }
  }

  function loadFailed() {
    return `<div class="wrap page"><div class="panel empty"><h3>Chưa tải được cửa hàng</h3><p>${esc(P.errText(P.loadError()))}</p>
      <button class="btn btn-cta btn-sm" type="button" onclick="location.reload()">Tải lại trang</button></div></div>`;
  }

  function render() {
    if (!booted) return;
    if (P.loadError()) { root.innerHTML = loadFailed(); return; }
    const db = P.load();
    const r = route();
    const key = r.view + ':' + (r.id || '');
    const keep = key === lastRoute ? snapshot() : null;
    lastRoute = key;

    if (r.view === 'order') {
      const o = P.findOrder(db, r.id);
      if (o && phoneOk(o) && o.unreadCustomer && !reading.has(o.id)) {
        reading.add(o.id);
        P.cust.action(o.id, 'mark_read').then(() => { reading.delete(o.id); render(); }, () => { reading.delete(o.id); });
      }
    }

    P.applyLook(db.settings.look);
    let body, title = '';
    switch (r.view) {
      case 'cat': body = viewCat(db, r.id); title = (P.findCategory(db, r.id) || {}).name; break;
      case 'product': body = viewProduct(db, r.id); title = (P.findProduct(db, r.id) || {}).name; break;
      case 'cart': body = viewCart(db); title = 'Giỏ hàng'; break;
      case 'file': body = viewFile(db); title = 'Gửi file thiết kế'; break;
      case 'pay': body = viewPay(db); title = 'Thanh toán'; break;
      case 'done': body = viewDone(db, r.id); title = 'Đã đặt hàng'; break;
      case 'track': body = viewTrack(db); title = 'Theo dõi tiến độ in'; break;
      case 'order': body = viewOrder(db, r.id); title = 'Đơn ' + r.id; break;
      case 'contact': body = viewContact(db); title = 'Liên hệ'; break;
      case 'search': body = viewSearch(db); title = 'Tìm sản phẩm'; break;
      default: body = viewAbout(db);
    }
    root.innerHTML = header(db, r) + '<main id="main">' + body + '</main>' + footer(db);
    document.title = (title ? title + ' · ' : '') + db.settings.shopName;
    if (keep) restore(keep);
    bindGallery();
    if (document.activeElement && document.activeElement.id === 'find-q' && r.view !== 'search') showDrop(db);
    const thread = document.getElementById('thread');
    if (thread) thread.scrollTop = thread.scrollHeight;
  }

  function showDrop(db) {
    const box = document.getElementById('find-drop');
    if (!box) return;
    const html = findDrop(db, ui.q);
    box.innerHTML = html;
    box.hidden = !html;
  }
  function hideDrop() { const box = document.getElementById('find-drop'); if (box) box.hidden = true; }

  function notFound(h, p) {
    return `<div class="wrap page"><div class="panel empty"><h3>${esc(h)}</h3><p>${esc(p)}</p><a class="btn btn-ghost btn-sm" href="#gioi-thieu">Về trang chủ</a></div></div>`;
  }

  // ==== Khung trang ====
  // Đầu trang kiểu Tiệm Dứa: logo tròn + tên + khẩu hiệu, ô tìm kiếm (máy tính nằm giữa, điện thoại xuống hàng dưới),
  // chữ menu trên máy tính, nút ☰ mở menu thả xuống trên điện thoại, giỏ hàng có số màu nhấn.
  function navLinks(db, r) {
    const cur = c => c ? ' aria-current="page"' : '';
    const activeCat = r.view === 'cat' ? r.id : r.view === 'product' ? (P.findProduct(db, r.id) || {}).catId : null;
    return {
      cats: P.showSection(db, 'navCats') ? P.visibleCategories(db).map(c => `<a href="#dm-${esc(c.id)}" data-ink="${esc(c.ink)}"${cur(activeCat === c.id)}><i></i>${esc(c.name)}</a>`).join('') : '',
      track: P.showSection(db, 'navTrack') ? `<a href="#theo-doi"${cur(r.view === 'track' || r.view === 'order')}>Theo dõi đơn</a>` : '',
      contact: P.showSection(db, 'navContact') ? `<a href="#lien-he"${cur(r.view === 'contact')}>Liên hệ</a>` : ''
    };
  }

  function header(db, r) {
    const s = db.settings;
    const n = P.cartLines(db).length;
    const L = navLinks(db, r);
    const sub = s.tagline && P.showSection(db, 'tagline') ? `<small>${esc(s.tagline)}</small>` : '';
    return `<header class="sh-head${ui.menu ? ' menu-open' : ''}"><div class="wrap sh-row">
      <a class="brand" href="#gioi-thieu">${P.brandMark()}<span class="brand-word"><b>${esc(s.shopName)}</b>${sub}</span></a>
      <form class="sh-find" id="find-form" role="search" data-keep>
        <label class="sr-only" for="find-q">Tìm sản phẩm</label>${ICON.search}
        <input id="find-q" type="search" enterkeyhint="search" autocomplete="off" placeholder="Tìm sản phẩm…" value="${esc(ui.q)}">
        <button class="find-x" type="button" data-act="find-clear" aria-label="Xóa chữ tìm"${ui.q ? '' : ' hidden'}>×</button>
        <div class="find-drop" id="find-drop" hidden></div>
      </form>
      <nav class="sh-links" aria-label="Menu chính">
        ${P.showSection(db, 'catGrid') ? `<a href="#gioi-thieu"${r.view === 'about' ? ' aria-current="page"' : ''}>Sản phẩm</a>` : ''}${L.track}${L.contact}
      </nav>
      <div class="sh-tools">
        <a class="cart-btn" href="#gio-hang" aria-label="Giỏ hàng${n ? ', ' + n + ' sản phẩm' : ''}"${['cart', 'file', 'pay'].includes(r.view) ? ' aria-current="page"' : ''}>${ICON.bag}${n ? `<span class="count">${n > 99 ? '99+' : n}</span>` : ''}</a>
        <button class="menu-btn" type="button" data-act="menu" aria-expanded="${!!ui.menu}" aria-controls="sh-menu" aria-label="${ui.menu ? 'Đóng menu' : 'Mở menu'}">${ui.menu ? ICON.close : ICON.menu}</button>
      </div>
    </div>
    <nav class="sh-menu wrap" id="sh-menu" aria-label="Menu"${ui.menu ? '' : ' hidden'}>
      <a href="#gioi-thieu"${r.view === 'about' ? ' aria-current="page"' : ''}>Trang chủ</a>
      ${L.cats ? `<p class="sh-menu-h">Danh mục</p>${L.cats}` : ''}
      ${L.track || L.contact ? `<p class="sh-menu-h">Hỗ trợ</p>${L.track}${L.contact}` : ''}
    </nav></header>`;
  }

  function footer(db) {
    const s = db.settings;
    if (!P.showSection(db, 'footer')) return '';
    const about = String(s.about || '').split(/\n+/).map(x => x.trim()).filter(Boolean)[0] || s.tagline || '';
    return `<footer class="sh-foot"><div class="wrap foot-grid">
      <div class="foot-brand"><a class="brand" href="#gioi-thieu">${P.brandMark()}<span class="brand-word"><b>${esc(s.shopName)}</b></span></a>${about ? `<p>${esc(about)}</p>` : ''}</div>
      ${P.showSection(db, 'footCats') ? `<div><h3>Khám phá</h3><ul class="foot-list">
        ${P.visibleCategories(db).map(c => `<li><a href="#dm-${esc(c.id)}">${esc(c.name)}</a></li>`).join('')}
        <li><a href="#tim-kiem">Tìm sản phẩm</a></li>
      </ul></div>` : ''}
      <div><h3>Hỗ trợ khách hàng</h3><ul class="foot-list">
        <li><a href="#theo-doi">Theo dõi đơn</a></li><li><a href="#gio-hang">Giỏ hàng</a></li><li><a href="#lien-he">Liên hệ</a></li>
      </ul></div>
      ${P.showSection(db, 'footContact') ? `<div><h3>Liên hệ</h3><ul class="foot-list">
        ${P.normPhone(s.zalo) ? `<li>Zalo: ${esc(fmt.phone(s.zalo))}</li>` : ''}
        ${s.email ? `<li>${esc(s.email)}</li>` : ''}${s.hours ? `<li>${esc(s.hours)}</li>` : ''}${s.address ? `<li>${esc(s.address)}</li>` : ''}
      </ul></div>` : ''}
    </div><div class="wrap foot-bottom"><span>© ${new Date().getFullYear()} ${esc(s.shopName)}. In tại xưởng, giao toàn quốc.</span><a href="admin.html">Quản trị</a></div></footer>`;
  }

  function payRule(s) {
    return `Đơn dưới ${fmt.short(s.payThreshold)}: thanh toán 100% hoặc cọc ${s.depositLow}%. Đơn từ ${fmt.short(s.payThreshold)}: thanh toán 100% hoặc cọc ${s.depositHigh}%.`;
  }

  // ==== Sản phẩm hiển thị cho khách ====
  const shown = db => db.products.filter(p => p.active && p.variants.length && P.catVisible(db, p.catId));
  const minOf = p => Math.min.apply(null, p.variants.map(v => +v.minQty || 1));

  // Thẻ sản phẩm kiểu Tiệm Dứa: khung trắng bo tròn, ảnh 4:5, nhãn số lượng tối thiểu, nút "+" màu nhấn.
  function pcard(db, p, i) {
    const pr = P.priceRange(p);
    const min = minOf(p);
    return `<a class="pcard" href="#sp-${esc(p.id)}"${i != null ? ` style="--i:${Math.min(i, 11)}"` : ''}>
      <span class="pc-img">${P.thumb(db, p, 'pimg')}${min > 1 ? `<span class="pc-badge">Tối thiểu ${fmt.num(min)}</span>` : ''}<span class="pc-plus" aria-hidden="true">+</span></span>
      <span class="pc-body"><h3>${esc(p.name)}</h3>
        <span class="pc-price">${pr.min !== pr.max ? '<small>từ</small>' : ''}<b>${fmt.vnd(pr.min)}</b>${p.variants.length > 1 ? `<span>${p.variants.length} loại</span>` : ''}</span></span></a>`;
  }

  // Ảnh cho bong bóng danh mục: ảnh bìa (ảnh đầu tiên) của sản phẩm đầu tiên có ảnh trong danh mục.
  function catCover(db, c) {
    const p = db.products.find(x => x.active && x.catId === c.id && x.images && x.images[0]);
    return p ? p.images[0] : '';
  }
  function bubbles(db, active) {
    const cats = P.visibleCategories(db);
    if (!cats.length) return '';
    return `<nav class="bubbles" aria-label="Danh mục"><div class="wrap bub-row">${cats.map(c => {
      const img = catCover(db, c);
      return `<a class="bub" href="#dm-${esc(c.id)}" data-ink="${esc(c.ink)}"${active === c.id ? ' aria-current="page"' : ''}>
        <span class="bub-ring">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : `<span class="bub-ph">${esc(c.name.trim().charAt(0).toUpperCase())}</span>`}</span>
        <span class="bub-name">${esc(c.name)}</span></a>`;
    }).join('')}</div></nav>`;
  }

  // Nổi bật tuần này: đặt nhiều nhất 7 ngày qua; chưa có đơn thì lấy bán chạy mọi lúc, rồi mới nhất.
  function featured(db) {
    const list = shown(db);
    if (list.length < 2) return [];
    const since = Date.now() - 7 * 864e5;
    const score = {}, all = {};
    (db.orders || []).forEach(o => {
      if (o.status === 'huy') return;
      (o.items || []).forEach(it => {
        all[it.productId] = (all[it.productId] || 0) + (+it.qty || 0);
        if ((o.createdAt || 0) >= since) score[it.productId] = (score[it.productId] || 0) + (+it.qty || 0);
      });
    });
    return list.slice().sort((a, b) => (score[b.id] || 0) - (score[a.id] || 0) || (all[b.id] || 0) - (all[a.id] || 0) || (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 10);
  }
  function featuredStrip(db) {
    const list = featured(db);
    if (!list.length) return '';
    return `<section class="feat" aria-labelledby="feat-h"><div class="wrap">
      <div class="sec-h"><div><h2 id="feat-h">Nổi bật tuần này</h2><p>Được đặt nhiều nhất 7 ngày qua</p></div>
        <div class="feat-arrows"><button type="button" class="round-btn" data-act="feat-prev" aria-label="Xem sản phẩm trước">${ICON.left}</button><button type="button" class="round-btn" data-act="feat-next" aria-label="Xem sản phẩm sau">${ICON.right}</button></div></div>
      <div class="feat-row" id="feat-row">${list.map(p => {
        const pr = P.priceRange(p);
        return `<a class="fcard" href="#sp-${esc(p.id)}"><span class="fcard-img">${P.thumb(db, p, 'pimg')}</span><b>${esc(p.name)}</b><span>${fmt.vnd(pr.min)}</span></a>`;
      }).join('')}</div>
    </div></section>`;
  }

  // Lưới "Tất cả sản phẩm": chip danh mục, sắp xếp, xem thêm 20 sản phẩm mỗi lần.
  const PAGE = 20;
  const SORTS = [['new', 'Mới nhất'], ['hot', 'Bán chạy'], ['low', 'Giá thấp → cao'], ['high', 'Giá cao → thấp'], ['name', 'Tên A → Z']];
  function sortProducts(db, list) {
    const sold = {};
    (db.orders || []).forEach(o => { if (o.status !== 'huy') (o.items || []).forEach(it => { sold[it.productId] = (sold[it.productId] || 0) + (+it.qty || 0); }); });
    const by = {
      new: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
      hot: (a, b) => (sold[b.id] || 0) - (sold[a.id] || 0),
      low: (a, b) => P.priceRange(a).min - P.priceRange(b).min,
      high: (a, b) => P.priceRange(b).min - P.priceRange(a).min,
      name: (a, b) => a.name.localeCompare(b.name, 'vi')
    };
    return list.slice().sort(by[ui.sort] || by.new);
  }
  function browser(db, catId, title, sub) {
    const all = shown(db);
    const list = sortProducts(db, catId ? all.filter(p => p.catId === catId) : all);
    const cats = P.visibleCategories(db).filter(c => all.some(p => p.catId === c.id));
    const limit = ui.more[catId || 'all'] || PAGE;
    const head = `<div class="sec-h"><div><${catId ? 'h1' : 'h2'}>${esc(title)}</${catId ? 'h1' : 'h2'}>${sub ? `<p>${esc(sub)}</p>` : ''}</div>
      ${list.length > 1 && P.showSection(db, 'sort') ? `<div class="sort-wrap"><label for="sort">Sắp xếp</label><select class="sort" id="sort">${SORTS.map(([v, l]) => `<option value="${v}"${ui.sort === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>` : ''}</div>`;
    const chips = cats.length > 1 ? `<div class="chips" role="list"><a role="listitem" class="chip" href="#gioi-thieu"${catId ? '' : ' aria-current="page"'}>Tất cả <span>${all.length}</span></a>${cats.map(c => `<a role="listitem" class="chip" href="#dm-${esc(c.id)}"${catId === c.id ? ' aria-current="page"' : ''}>${esc(c.name)} <span>${all.filter(p => p.catId === c.id).length}</span></a>`).join('')}</div>` : '';
    const grid = list.length
      ? `<div class="pgrid">${list.slice(0, limit).map((p, i) => pcard(db, p, i)).join('')}</div>
         ${list.length > limit ? `<div class="more"><p>Đang xem ${fmt.num(limit)} / ${fmt.num(list.length)}</p><button class="btn btn-soft" type="button" data-act="more" data-k="${esc(catId || 'all')}">Xem thêm ${fmt.num(Math.min(PAGE, list.length - limit))} sản phẩm</button></div>` : ''}`
      : `<div class="panel empty"><h3>Danh mục đang cập nhật sản phẩm</h3><p>Bạn cần in gì trong mục này, nhắn shop để được tư vấn.</p><a class="btn btn-ghost btn-sm" href="#lien-he">Liên hệ shop</a></div>`;
    return head + chips + grid;
  }

  // ==== Trang chủ ====
  function viewAbout(db) {
    const showAll = P.showSection(db, 'allGrid');
    const bub = P.showSection(db, 'catGrid') ? bubbles(db, null) : '';
    const feat = P.showSection(db, 'featured') ? featuredStrip(db) : '';
    const any = shown(db).length;
    return `${bub}${feat}
      ${showAll || !any ? `<section class="wrap sec" id="san-pham">${any ? browser(db, null, 'Tất cả sản phẩm', '') : '<div class="panel empty"><h3>Shop đang cập nhật sản phẩm</h3><p>Nhắn shop để được tư vấn.</p><a class="btn btn-ghost btn-sm" href="#lien-he">Liên hệ shop</a></div>'}</section>` : ''}`;
  }

  // ==== Tìm sản phẩm ====
  const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').replace(/×/g, 'x').toLowerCase();
  function searchHits(db, q) {
    const words = fold(q).split(/\s+/).filter(Boolean);
    if (!words.length) return null;
    return shown(db).filter(p => {
      const c = P.findCategory(db, p.catId);
      const hay = fold([p.name, p.desc, c && c.name].concat(p.variants.map(v => v.name)).join(' '));
      return words.every(w => hay.includes(w));
    });
  }
  function searchResults(db, q) {
    const hits = searchHits(db, q);
    if (hits === null) return '<p class="muted">Gõ tên sản phẩm, loại hoặc kích thước vào ô tìm kiếm ở trên, ví dụ “hộp giấy”, “móc khóa”.</p>';
    if (!hits.length) return `<div class="panel empty"><h3>Không thấy sản phẩm phù hợp</h3><p>Thử từ khóa ngắn hơn, hoặc chọn từ danh mục.</p><a class="btn btn-ghost btn-sm" href="#lien-he">Nhắn shop để được tư vấn</a></div>`;
    return `<p class="muted" style="margin-bottom:14px" aria-live="polite">${hits.length} sản phẩm cho “${esc(q.trim())}”</p><div class="pgrid">${hits.map((p, i) => pcard(db, p, i)).join('')}</div>`;
  }
  // Gợi ý ngay dưới ô tìm (như Tiệm Dứa): tối đa 6 sản phẩm, dòng cuối "Xem tất cả".
  function findDrop(db, q) {
    const hits = searchHits(db, q);
    if (!hits) return '';
    if (!hits.length) return '<p class="fd-empty">Không thấy sản phẩm phù hợp.</p>';
    return hits.slice(0, 6).map(p => `<a class="fd-row" href="#sp-${esc(p.id)}">${P.thumb(db, p, 'fd-img')}<span><b>${esc(p.name)}</b><span>${fmt.vnd(P.priceRange(p).min)}</span></span></a>`).join('') +
      `<a class="fd-all" href="#tim-kiem">Xem tất cả ${hits.length} kết quả →</a>`;
  }
  function viewSearch(db) {
    return `<div class="wrap page"><div class="sec-h"><div><h1>Tìm sản phẩm</h1></div></div>
      <div id="search-out">${searchResults(db, ui.q)}</div></div>`;
  }

  // ==== Danh mục ====
  function viewCat(db, id) {
    const c = P.findCategory(db, id);
    if (!c || !P.catVisible(db, c.id)) return notFound('Không tìm thấy danh mục này', 'Danh mục có thể đã được đổi tên hoặc gỡ bỏ.');
    return `${P.showSection(db, 'catGrid') ? bubbles(db, c.id) : ''}<div class="wrap page">${browser(db, c.id, c.name, c.desc)}</div>`;
  }

  // ==== Sản phẩm ====
  function viewProduct(db, id) {
    const p = P.findProduct(db, id);
    if (!p || !p.active) return notFound('Sản phẩm không còn bán', 'Sản phẩm có thể đã được ẩn hoặc gỡ bỏ.');
    const c = P.findCategory(db, p.catId);
    if (!ui.sel || ui.sel.pid !== p.id) {
      const v0 = p.variants[0];
      ui.sel = { pid: p.id, vid: v0 ? v0.id : null, qty: v0 ? (+v0.minQty || 1) : 1, img: 0 };
    }
    const v = p.variants.find(x => x.id === ui.sel.vid) || p.variants[0];
    if (v) ui.sel.vid = v.id;
    // Sản phẩm dùng nhóm phân loại: khách chọn từng nhóm, mỗi tổ hợp đang bán có giá riêng
    const grouped = (p.groups || []).length > 0 && p.variants.every(x => Array.isArray(x.opts));
    const min = v ? (+v.minQty || 1) : 1;
    if (ui.sel.qty < min) ui.sel.qty = min;
    const imgs = p.images || [];
    if (ui.sel.img >= imgs.length) ui.sel.img = 0;
    const slides = imgs.length
      ? imgs.map((src, i) => `<figure class="slide"><img src="${esc(src)}" alt="${esc(p.name)}${imgs.length > 1 ? ', ảnh ' + (i + 1) : ''}"${i ? ' loading="lazy"' : ''}></figure>`).join('')
      : `<figure class="slide">${P.thumb(db, p, 'main')}</figure>`;
    const total = v ? v.price * ui.sel.qty : 0;
    const vname = v ? (grouped ? v.opts.join(' · ') : v.name) : '';

    return `<div class="wrap page pd-page">
      <nav class="crumbs pd-crumbs" aria-label="Đường dẫn"><a href="#gioi-thieu">Trang chủ</a><span>/</span>
        ${c ? `<a href="#dm-${esc(c.id)}">${esc(c.name)}</a><span>/</span>` : ''}<span aria-current="page">${esc(p.name)}</span></nav>
      <div class="pdetail">
        <div class="pgal">
          <div class="gal-track" id="gal" tabindex="0" aria-label="Ảnh sản phẩm, vuốt ngang để xem">${slides}</div>
          ${imgs.length > 1 ? `<span class="gal-n" id="gal-n" aria-hidden="true">${ui.sel.img + 1}/${imgs.length}</span>
            <button type="button" class="gal-arrow prev round-btn" data-act="gal" data-d="-1" aria-label="Ảnh trước">${ICON.left}</button>
            <button type="button" class="gal-arrow next round-btn" data-act="gal" data-d="1" aria-label="Ảnh sau">${ICON.right}</button>
            <div class="thumbs">${imgs.map((src, i) => `<button type="button" data-act="img" data-i="${i}" aria-pressed="${i === ui.sel.img}" aria-label="Xem ảnh ${i + 1}"><img src="${esc(src)}" alt=""></button>`).join('')}</div>` : ''}
        </div>
        <div class="pinfo">
          <div class="pd-head">${P.catTag(db, p.catId)}<h1>${esc(p.name)}</h1></div>
          ${v ? `<div class="pd-price"><span class="pprice">${fmt.vnd(v.price)}</span>${min > 1 ? `<span class="pop-pill">Tối thiểu ${fmt.num(min)}</span>` : ''}</div>` : '<p class="muted">Sản phẩm đang cập nhật giá.</p>'}
          ${p.leadDays ? `<p class="pd-lead">${ICON.clock}In khoảng ${esc(p.leadDays)} ngày, cộng thời gian vận chuyển</p>` : ''}
          ${v && grouped ? p.groups.map((g, gi) => `<div class="pd-opt"><p class="lbl">${esc(g.name)}: <b>${esc(v.opts[gi])}</b></p>
            <div class="vchips" role="group" aria-label="${esc(g.name)}">${g.values.filter(val => p.variants.some(x => x.opts[gi] === val)).map(val =>
              `<button type="button" class="vchip" data-act="opt" data-g="${gi}" data-v="${esc(val)}" aria-pressed="${v.opts[gi] === val}">${esc(val)}</button>`).join('')}</div></div>`).join('') : ''}
          ${v && !grouped ? `<div class="pd-opt"><p class="lbl">Phân loại: <b>${esc(v.name)}</b></p>
            <div class="vchips" role="group" aria-label="Chọn phân loại">${p.variants.map(x =>
              `<button type="button" class="vchip" data-act="variant" data-id="${esc(x.id)}" aria-pressed="${x.id === v.id}">${esc(x.name)}<small>${fmt.vnd(x.price)}${(+x.minQty || 1) > 1 ? ' · từ ' + fmt.num(x.minQty) : ''}</small></button>`).join('')}</div></div>` : ''}
          ${v ? `<div class="qty-row"><span class="lbl" id="q-lbl">Số lượng</span>
            <div class="qty"><button type="button" data-act="qty-" aria-label="Giảm số lượng">−</button><input id="pq" inputmode="numeric" autocomplete="off" value="${ui.sel.qty}" aria-labelledby="q-lbl"><button type="button" data-act="qty+" aria-label="Tăng số lượng">+</button></div>
            <span class="hint" id="pq-total" aria-live="polite">Thành tiền <b>${fmt.vnd(total)}</b></span></div>
          <div class="pbtns"><button class="btn btn-pop" type="button" data-act="add">${ICON.bag}Thêm vào giỏ</button><button class="btn btn-cta" type="button" data-act="buy">Mua ngay</button></div>` : ''}
          ${p.desc ? `<section class="pd-box"><h2>Mô tả</h2><p class="pdesc">${esc(p.desc)}</p></section>` : ''}
          ${P.showSection(db, 'pnotes') ? `<ul class="pnotes">
            <li>Bạn gửi file thiết kế qua link Google Drive ở bước đặt hàng</li>
            <li>${esc(payRule(db.settings))}</li>
          </ul>` : ''}
        </div>
      </div></div>
      ${v ? `<div class="float-bar" role="region" aria-label="Đặt nhanh"><div class="fb-sum"><b id="pq-total2">${fmt.vnd(total)}</b><small>${fmt.num(ui.sel.qty)} · ${esc(vname)}</small></div>
        <button class="fb-cart" type="button" data-act="add" aria-label="Thêm vào giỏ">${ICON.bag}</button><button class="btn btn-cta" type="button" data-act="buy">Mua ngay</button></div>` : ''}`;
  }

  function setTotals(v) {
    if (!v) return;
    const s = fmt.vnd(v.price * clampQ(ui.sel.qty, 1));
    const out = document.getElementById('pq-total'); if (out) out.innerHTML = 'Thành tiền <b>' + s + '</b>';
    const o2 = document.getElementById('pq-total2'); if (o2) o2.textContent = s;
    const sm = document.querySelector('.fb-sum small'); if (sm) sm.textContent = sm.textContent.replace(/^[\d.]+/, fmt.num(clampQ(ui.sel.qty, 1)));
  }
  // Ảnh sản phẩm: vuốt ngang (scroll-snap); số đếm và ảnh nhỏ đi theo ảnh đang xem
  function galGo(i, smooth) {
    const g = document.getElementById('gal');
    if (!g) return;
    g.scrollTo({ left: i * g.clientWidth, behavior: smooth && !reduceMotion ? 'smooth' : 'instant' });
  }
  function bindGallery() {
    const g = document.getElementById('gal');
    if (!g) return;
    if (ui.sel && ui.sel.img) galGo(ui.sel.img, false);
    let tick = 0;
    g.addEventListener('scroll', () => {
      cancelAnimationFrame(tick);
      tick = requestAnimationFrame(() => {
        const i = Math.round(g.scrollLeft / Math.max(1, g.clientWidth));
        if (!ui.sel || i === ui.sel.img) return;
        ui.sel.img = i;
        const n = document.getElementById('gal-n'); if (n) n.textContent = (i + 1) + '/' + g.children.length;
        root.querySelectorAll('.thumbs [data-act="img"]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.i === i)));
      });
    }, { passive: true });
  }

  function currentVariant() {
    const p = P.findProduct(P.load(), ui.sel && ui.sel.pid);
    return p ? { p, v: p.variants.find(x => x.id === ui.sel.vid) } : {};
  }

  // ==== Đặt hàng: 1 Giỏ hàng · 2 Gửi file · 3 Thanh toán ====
  function steps(n) {
    const names = ['Giỏ hàng', 'Gửi file', 'Thanh toán'];
    const hrefs = ['gio-hang', 'gui-file', 'thanh-toan'];
    return `<ol class="co-steps" aria-label="Các bước đặt hàng">${names.map((s, i) => {
      const inner = `<b>${i < n ? '✓' : i + 1}</b><span>${s}</span>`;
      return `<li class="${i < n ? 'done' : i === n ? 'now' : ''}"${i === n ? ' aria-current="step"' : ''}>${i < n ? `<a href="#${hrefs[i]}">${inner}</a>` : inner}</li>`;
    }).join('')}</ol>`;
  }

  function emptyCart(db) {
    return `<div class="wrap page"><div class="panel empty"><h3>Giỏ hàng đang trống</h3><p>Chọn danh mục để xem sản phẩm và giá từng phân loại.</p>
      ${db.categories[0] ? `<a class="btn btn-cta btn-sm" href="#dm-${esc(db.categories[0].id)}">Xem sản phẩm</a>` : ''}</div></div>`;
  }

  function miniSummary(lines) {
    const sub = lines.reduce((a, l) => a + l.line, 0);
    return `<table class="items"><tbody>${lines.map(l => `<tr><td><span class="it-name">${esc(l.product.name)}</span><small>${esc(l.variant.name)} · ${fmt.num(l.qty)} sp</small></td><td class="r"><b>${fmt.vnd(l.line)}</b></td></tr>`).join('')}</tbody></table>
      <table class="money"><tbody><tr class="total"><td>Tổng tiền hàng</td><td>${fmt.vnd(sub)}</td></tr></tbody></table>`;
  }

  function cline(db, l, i) {
    const min = +l.variant.minQty || 1;
    return `<div class="cline">${P.thumb(db, l.product, 'cimg')}
      <div><a class="cname" href="#sp-${esc(l.pid)}">${esc(l.product.name)}</a><span class="cvar">${esc(l.variant.name)} · ${fmt.vnd(l.variant.price)}</span></div>
      <span class="ctotal" id="ct-${i}">${fmt.vnd(l.line)}</span>
      <div class="cctl">
        <div class="qty sm"><button type="button" data-act="cq-" data-i="${i}" aria-label="Giảm">−</button><input class="cq" id="cq-${i}" data-i="${i}" inputmode="numeric" autocomplete="off" value="${l.qty}" aria-label="Số lượng ${esc(l.product.name)}"><button type="button" data-act="cq+" data-i="${i}" aria-label="Tăng">+</button></div>
        ${min > 1 ? `<span class="hint">Tối thiểu ${fmt.num(min)}</span>` : ''}
        <button class="link-btn" type="button" data-act="rm" data-i="${i}">Xóa</button>
      </div></div>`;
  }

  function viewCart(db) {
    const lines = P.cartLines(db);
    if (lines.length !== P.getCart().length) P.setCart(lines.map(l => ({ pid: l.pid, vid: l.vid, qty: l.qty })));
    if (!lines.length) return emptyCart(db);
    const sub = lines.reduce((a, l) => a + l.line, 0);
    return `<div class="wrap page">
      <div class="page-head"><div><h1>Giỏ hàng</h1><p>${lines.length} sản phẩm</p></div><a class="link-btn" href="#gioi-thieu">Tiếp tục xem sản phẩm</a></div>
      ${steps(0)}
      <div class="cart-grid">
        <section class="panel" aria-label="Sản phẩm trong giỏ">${lines.map((l, i) => cline(db, l, i)).join('')}</section>
        <aside class="panel summary"><div class="panel-h"><h2>Tạm tính</h2></div>
          <table class="money"><tbody><tr class="total"><td>Tổng tiền hàng</td><td id="sum-total">${fmt.vnd(sub)}</td></tr></tbody></table>
          <p class="hint" style="margin-top:12px">${esc(payRule(db.settings))}</p>
          <div class="actions"><a class="btn btn-cta" href="#gui-file" style="width:100%">Tiếp tục: gửi file</a></div>
        </aside>
      </div></div>
      <div class="buy-bar"><div><small>Tạm tính</small><b id="sum-total2">${fmt.vnd(sub)}</b></div><a class="btn btn-cta" href="#gui-file">Tiếp tục: gửi file</a></div>`;
  }

  function viewFile(db) {
    const lines = P.cartLines(db);
    if (!lines.length) return emptyCart(db);
    const co = getCo();
    return `<div class="wrap page">
      <div class="page-head"><div><h1>Gửi file thiết kế</h1><p>Dán link Google Drive chứa file in của bạn.</p></div></div>
      ${steps(1)}
      <div class="cart-grid">
        <form class="panel" id="file-form" novalidate data-keep>
          <div class="panel-h"><h2>Link file</h2></div>
          <div class="field"><label for="co-file">Link Google Drive <span class="req" aria-hidden="true">*</span></label>
            <input id="co-file" type="url" autocomplete="off" placeholder="https://drive.google.com/…" value="${esc(co.file || '')}" aria-describedby="co-file-hint err-co-file">
            <p class="err" id="err-co-file"></p></div>
          <ul class="pnotes" id="co-file-hint" style="margin-top:12px">
            <li>Mở quyền chia sẻ “Bất kỳ ai có đường liên kết” để shop tải được file</li>
            <li>Mỗi sản phẩm một file, đặt tên file theo tên sản phẩm cho dễ nhận</li>
            <li>File in nên là PDF, AI hoặc PNG 300 dpi; in 3D gửi STL hoặc OBJ</li>
          </ul>
          <div class="field" style="margin-top:16px"><label for="co-note">Ghi chú cho shop</label>
            <textarea id="co-note" rows="3" placeholder="Màu sắc, vị trí in, ngày cần hàng…">${esc(co.note || '')}</textarea></div>
          <div class="actions"><a class="link-btn" href="#gio-hang">← Giỏ hàng</a><button class="btn btn-cta" type="submit">Tiếp tục: thanh toán</button></div>
        </form>
        <aside class="panel summary"><div class="panel-h"><h2>Đơn của bạn</h2></div>${miniSummary(lines)}</aside>
      </div></div>`;
  }

  function viewPay(db) {
    const lines = P.cartLines(db);
    if (!lines.length) return emptyCart(db);
    const co = getCo();
    if (!P.isUrl(co.file)) {
      return `<div class="wrap page">${steps(1)}<div class="panel empty"><h3>Bạn chưa gửi link file thiết kế</h3><p>Dán link Google Drive trước khi thanh toán.</p>
        <a class="btn btn-cta btn-sm" href="#gui-file">Gửi file</a></div></div>`;
    }
    const s = db.settings;
    const sub = lines.reduce((a, l) => a + l.line, 0);
    const opts = P.payOptions(s, sub);
    const pick = opts.some(o => o.pct === co.payPct) ? co.payPct : opts[0].pct;
    const chosen = opts.find(o => o.pct === pick);
    const known = P.getTrack() ? P.findCustomerByPhone(db, P.getTrack()) : null;
    const k = Object.assign({}, known || {}, co.ship || {});
    const field = (id, label, attrs, value, full) =>
      `<div class="field${full ? ' full' : ''}"><label for="${id}">${label} <span class="req" aria-hidden="true">*</span></label><input id="${id}" ${attrs} value="${esc(value || '')}" aria-describedby="err-${id}"><p class="err" id="err-${id}"></p></div>`;
    return `<div class="wrap page">
      <div class="page-head"><div><h1>Thanh toán</h1><p>Điền thông tin nhận hàng và chọn cách thanh toán.</p></div></div>
      ${steps(2)}
      <div class="cart-grid">
        <form class="stack" id="checkout" novalidate data-keep>
          <section class="panel"><div class="panel-h"><h2>Thông tin nhận hàng</h2></div>
            <div class="form-grid">
              ${field('co-name', 'Họ tên', 'autocomplete="name" placeholder="VD: Nguyễn Thu Hà"', k.name)}
              ${field('co-phone', 'Số điện thoại', 'type="tel" inputmode="tel" autocomplete="tel" placeholder="Dùng số này để theo dõi đơn"', k.phone ? fmt.phone(k.phone) : '')}
              ${field('co-social', 'Link mạng xã hội', 'type="url" autocomplete="url" placeholder="Facebook, Instagram hoặc Zalo của bạn"', k.social, true)}
              ${field('co-address', 'Địa chỉ nhận hàng', 'autocomplete="street-address" placeholder="Số nhà, đường, phường"', k.address, true)}
              <div class="field"><label for="co-city">Tỉnh, thành</label><select id="co-city">${DEST.map(d => `<option${d === k.city ? ' selected' : ''}>${esc(d)}</option>`).join('')}</select></div>
            </div>
          </section>
          <fieldset class="panel pay-box"><legend class="sr-only">Cách thanh toán</legend>
            <div class="panel-h"><h2>Cách thanh toán</h2><span class="muted">Đơn ${sub < s.payThreshold ? 'dưới' : 'từ'} ${esc(fmt.short(s.payThreshold))}</span></div>
            <div class="pay-opts">${opts.map(o => `<label class="pay-opt">
              <input type="radio" name="pay" value="${o.pct}" aria-label="${esc(o.label)}, chuyển khoản ${fmt.vnd(o.amount)}"${o.pct === pick ? ' checked' : ''}>
              <span class="po-title">${esc(o.label)}</span>
              <span class="po-amt">${fmt.vnd(o.amount)}</span>
              <span class="po-note">${esc(o.note)}</span></label>`).join('')}</div>
          </fieldset>
          ${transferBox(db, chosen.amount, co.code)}
          <section class="panel"><div class="panel-h"><h2>File thiết kế</h2><a class="link-btn" href="#gui-file">Sửa</a></div>
            <p class="copy-line" style="overflow-wrap:anywhere">${ICON.folder.replace('<svg', '<svg width="18" height="18"')}<a href="${esc(co.file)}" target="_blank" rel="noopener">${esc(co.file)}</a></p>
            ${co.note ? `<p class="muted" style="margin-top:6px">${esc(co.note)}</p>` : ''}
          </section>
        </form>
        <aside class="panel summary"><div class="panel-h"><h2>Đơn của bạn</h2></div>
          ${miniSummary(lines)}
          <table class="money"><tbody>
            <tr class="sub"><td id="pay-label">${esc(chosen.label)}</td><td></td></tr>
            <tr><td><b>Chuyển khoản ngay</b></td><td><b id="pay-now">${fmt.vnd(chosen.amount)}</b></td></tr>
            <tr class="sub"><td>Trả khi nhận hàng</td><td id="pay-later">${fmt.vnd(sub - chosen.amount)}</td></tr>
          </tbody></table>
          <div class="actions"><button class="btn btn-cta" type="submit" form="checkout" style="width:100%">Đặt hàng</button></div>
          <p class="hint" style="margin-top:10px">Quét mã QR để chuyển khoản, tải ảnh chụp chuyển khoản lên rồi bấm Đặt hàng.</p>
        </aside>
      </div></div>
      <div class="buy-bar"><div><small>Chuyển khoản ngay</small><b id="pay-now2">${fmt.vnd(chosen.amount)}</b></div><button class="btn btn-cta" type="submit" form="checkout">Đặt hàng</button></div>`;
  }

  function refreshCartNumbers() {
    const lines = P.cartLines(P.load());
    lines.forEach((l, i) => { const el = document.getElementById('ct-' + i); if (el) el.textContent = fmt.vnd(l.line); });
    const el = document.getElementById('sum-total');
    if (el) el.textContent = fmt.vnd(lines.reduce((a, l) => a + l.line, 0));
    const b2 = document.getElementById('sum-total2');
    if (b2) b2.textContent = fmt.vnd(lines.reduce((a, l) => a + l.line, 0));
  }

  function cartEdit(fn) {
    const lines = P.cartLines(P.load());
    const c = lines.map(l => ({ pid: l.pid, vid: l.vid, qty: l.qty, min: +l.variant.minQty || 1 }));
    fn(c);
    P.setCart(c.filter(Boolean).map(x => ({ pid: x.pid, vid: x.vid, qty: clampQ(x.qty, x.min) })));
    render();
  }

  function bankBlock(db, amount, memo) {
    const s = db.settings;
    const line = (label, id, value, copyValue) =>
      `<dt>${label}</dt><dd class="copy-line"><b id="${id}">${esc(value)}</b><button class="copy-mini" type="button" data-copy-value="${esc(copyValue || value)}" data-copy-target="${id}">Sao chép</button></dd>`;
    const qr = P.vietQr(s, amount, memo);
    const kv = `<dl class="kv"><dt>Ngân hàng</dt><dd>${esc(s.bankName)}</dd>
      ${line('Số tài khoản', 'cp-acc', s.bankNumber, String(s.bankNumber).replace(/\s/g, ''))}
      <dt>Chủ tài khoản</dt><dd>${esc(s.bankHolder)}</dd>
      ${line('Số tiền', 'cp-amt', fmt.vnd(amount), String(Math.round(amount)))}
      ${line('Nội dung', 'cp-memo', memo)}</dl>`;
    // QR VietQR có sẵn số tiền và nội dung; tải không được thì ẩn khung, khách vẫn chuyển theo thông tin bên cạnh
    return `<div class="pay-qr${qr ? '' : ' no-qr'}">${qr ? `<figure class="qr-box"><span class="qr-tag">Quét để chuyển</span>
        <img src="${esc(qr)}" alt="Mã QR chuyển khoản ${esc(fmt.vnd(amount))} vào ${esc(s.bankName)} ${esc(s.bankNumber)}, nội dung ${esc(memo)}" width="200" height="200" onerror="this.closest('.pay-qr').classList.add('no-qr');this.parentNode.remove()">
        <figcaption>Mở app ngân hàng, chọn quét mã QR. Số tiền và nội dung đã điền sẵn.</figcaption></figure>` : ''}${kv}</div>`;
  }

  // Chuyển khoản ngay ở bước Thanh toán: mã đơn giữ trước làm nội dung, khách gửi ảnh chụp rồi mới đặt
  function transferBox(db, amount, code) {
    if (!code) {
      if (!ui.reserving) {
        ui.reserving = true;
        P.cust.reserveCode().then(c => { patchCo({ code: c }); ui.reserving = false; render(); },
          e => { ui.reserving = false; ui.codeErr = P.errText(e); render(); });
      }
      return `<section class="panel" id="pay-transfer"><div class="panel-h"><h2>Chuyển khoản</h2></div>
        ${ui.codeErr ? `<p class="err">${esc(ui.codeErr)}</p><button class="btn btn-quiet btn-sm" type="button" data-act="code-retry">Thử lại</button>` : '<p class="muted">Đang tạo mã đơn cho bạn…</p>'}</section>`;
    }
    const pf = ui.proof;
    return `<section class="panel" id="pay-transfer"><div class="panel-h"><h2>Chuyển khoản</h2><span class="muted">Mã đơn <b>${esc(code)}</b></span></div>
      <p class="muted">Chuyển <b>${fmt.vnd(amount)}</b>, nội dung ghi đúng mã đơn <b>${esc(code)}</b>. Quét mã QR là có sẵn cả hai.</p>
      ${bankBlock(db, amount, code)}
      <div class="proof" id="proof-box">
        <p class="lbl" style="margin-top:18px">Ảnh chụp chuyển khoản <span class="req" aria-hidden="true">*</span></p>
        <input id="proof-in" type="file" accept="image/*" class="sr-only" aria-describedby="err-proof">
        ${pf ? `<div class="proof-ok"><img src="${esc(pf.url)}" alt="Ảnh chuyển khoản đã chọn"><div><b>Đã chọn ảnh chuyển khoản</b><span>${esc(pf.name)}</span></div><label class="btn btn-quiet btn-sm" for="proof-in">Đổi ảnh</label></div>`
          : `<label class="proof-pick" for="proof-in">${ICON.folder}<b>Tải lên ảnh chụp chuyển khoản</b><span>Chụp màn hình app ngân hàng sau khi chuyển · JPG, PNG</span></label>`}
        <p class="err" id="err-proof"></p>
      </div></section>`;
  }

  function viewDone(db, id) {
    const o = P.findOrder(db, id);
    if (!o || !phoneOk(o)) return notFound('Không tìm thấy đơn này', 'Vào "Theo dõi đơn" và nhập số điện thoại đặt hàng để xem lại.');
    const m = P.money(o);
    return `<div class="wrap page"><div class="done-wrap"><section class="panel lead">
      <div class="done-mark">${ICON.check}</div>
      <h1 style="font-size:1.8rem">Đã đặt hàng ${esc(o.id)}</h1>
      ${o.paidNotice ? `<p class="muted" style="margin-top:8px">Cảm ơn ${esc(o.name)}. Shop đã nhận ảnh chuyển khoản <b>${fmt.vnd(m.first)}</b> (${esc(P.payLabel(o).toLowerCase())}). Shop kiểm tra tiền xong sẽ báo xưởng in, bạn theo dõi ở trang đơn.</p>`
        : `<p class="muted" style="margin-top:8px">Cảm ơn ${esc(o.name)}. Bạn chọn <b>${esc(P.payLabel(o).toLowerCase())}</b>, chuyển khoản <b>${fmt.vnd(m.first)}</b> để shop báo xưởng in.</p>
      ${bankBlock(db, m.first, o.id)}`}
      <div class="actions"><a class="btn btn-cta" href="#don-${esc(o.id)}">Xem tiến độ đơn này</a><a class="btn btn-ghost" href="#gioi-thieu">Về trang chủ</a></div>
      <p class="hint" style="margin-top:14px">Lần sau, vào "Theo dõi đơn" và nhập số ${esc(fmt.phone(o.phone))} để xem lại.</p>
    </section></div></div>`;
  }

  // ==== Theo dõi tiến độ in ====
  function trackForm(db, title, sub) {
    const demo = db.orders.some(o => o.demo);
    return `<div class="track-box panel" data-keep>
      <h1 style="font-size:clamp(1.6rem,3vw,2.1rem)">${title}</h1><p class="muted" style="margin-top:8px">${sub}</p>
      <form id="track-form" novalidate><div class="field"><label class="sr-only" for="tr-phone">Số điện thoại</label>
        <input id="tr-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="Số điện thoại đặt hàng" aria-describedby="err-tr-phone"><p class="err" id="err-tr-phone">${esc(ui.trackErr)}</p></div>
        <button class="btn btn-cta" type="submit">Xem đơn</button></form>
      ${demo ? '<p class="hint" style="margin-top:14px">Bản chạy thử: nhập 0912 345 678 để xem đơn mẫu.</p>' : ''}
    </div>`;
  }

  function mini(o) {
    const s = STATUSES[o.status];
    return `<div class="mini" aria-hidden="true">${STAGES.map((_, i) => `<span class="${s.off ? '' : (s.done || i < s.stage) ? 'done' : i === s.stage ? 'now' : ''}"></span>`).join('')}</div>`;
  }

  function todoText(o) {
    const m = P.money(o);
    if (o.status === 'cho_coc' && !o.paidNotice) return 'Chuyển khoản ' + fmt.vnd(m.first) + ' (' + P.payLabel(o).toLowerCase() + ') để shop báo xưởng in.';
    if (o.status === 'da_giao' && !o.balancePaid) return 'Còn lại ' + fmt.vnd(m.remaining) + ' cần thanh toán.';
    if (o.unreadCustomer) return 'Shop có ' + o.unreadCustomer + ' tin nhắn mới cho bạn.';
    return '';
  }

  function viewTrack(db) {
    const phone = P.getTrack();
    if (!phone) return `<div class="wrap page">${trackForm(db, 'Theo dõi tiến độ in', 'Nhập số điện thoại bạn dùng khi đặt hàng để xem các đơn và tiến độ in.')}</div>`;
    const list = P.ordersByPhone(db, phone);
    let html = `<div class="wrap page"><div class="page-head"><div><h1>Đơn của bạn</h1>
      <p>Số ${esc(fmt.phone(phone))} · ${list.length} đơn · <button class="link-btn" type="button" data-act="track-clear">Đổi số khác</button></p></div></div>`;
    if (!list.length) {
      return html + `<div class="panel empty"><h3>Chưa có đơn nào với số này</h3><p>Kiểm tra lại số điện thoại, hoặc nhắn shop để được hỗ trợ.</p>
        <button class="btn btn-ghost btn-sm" type="button" data-act="track-clear">Nhập số khác</button></div></div>`;
    }
    const todo = list.filter(o => P.customerNeeds(o).length && o.status !== 'huy');
    if (todo.length) {
      html += `<h2 class="sec-title">Cần bạn xử lý</h2><div class="todo">${todo.map(o => `<article class="panel todo-card">${P.pill(o, 'customer')}
        <h3>${esc(P.orderTitle(o))}</h3><p>${esc(todoText(o))}</p><a class="btn btn-ghost btn-sm" href="#don-${esc(o.id)}">Xem và xử lý</a></article>`).join('')}</div>`;
    }
    html += `<h2 class="sec-title">Tất cả đơn</h2><div class="olist">${list.map(o => {
      const m = P.money(o), s = STATUSES[o.status];
      return `<a class="orow" href="#don-${esc(o.id)}">
        <div class="orow-main"><span class="orow-title">${esc(P.orderTitle(o))}</span><span class="orow-meta"><span>${esc(o.id)}</span><span>Đặt ${fmt.date(o.createdAt)}</span><span>${fmt.num(P.orderQty(o))} sp</span></span></div>
        ${mini(o)}
        <div class="orow-status">${P.pill(o, 'customer')}${o.unreadCustomer ? `<span class="hint">${o.unreadCustomer} tin nhắn mới</span>` : ''}</div>
        <div class="orow-money">${fmt.vnd(m.total)}<small>${s.off ? 'Đã hủy' : 'Bước ' + (s.stage + 1) + '/' + STAGES.length + ' · ' + STAGES[s.stage]}</small></div>
      </a>`;
    }).join('')}</div></div>`;
    return html;
  }

  // ==== Chi tiết đơn ====
  function stepper(o) {
    const s = STATUSES[o.status];
    if (s.off) return '';
    return `<ol class="stepper" aria-label="Tiến độ đơn hàng">${STAGES.map((label, i) => {
      const cls = (s.done || i < s.stage) ? 'done' : i === s.stage ? 'now' : '';
      return `<li class="${cls}"${cls === 'now' ? ' aria-current="step"' : ''}><span>${label}</span></li>`;
    }).join('')}</ol><p class="stepper-cap">Bước ${s.stage + 1}/${STAGES.length}: <b>${STAGES[s.stage]}</b></p>`;
  }

  function cancelControl(o) {
    if (ui.confirm === o.id) {
      return `<div class="confirm"><p>Hủy đơn ${esc(o.id)}?</p><div class="actions" style="margin-top:0">
        <button class="btn btn-danger btn-sm" type="button" data-act="cancel-yes">Hủy đơn</button>
        <button class="btn btn-quiet btn-sm" type="button" data-act="cancel-no">Không, giữ lại</button></div></div>`;
    }
    return '<button class="link-btn" type="button" data-act="cancel-ask">Hủy đơn</button>';
  }

  function nextPanel(db, o) {
    const m = P.money(o);
    switch (o.status) {
      case 'cho_coc':
        return o.paidNotice
          ? `<section class="panel lead"><div class="panel-h"><h2>Shop đang xác nhận thanh toán</h2></div>
              <p>Bạn đã báo chuyển khoản lúc ${fmt.dateTime(o.paidNotice)}. Shop xác nhận trong giờ làm việc rồi báo xưởng in.</p></section>`
          : `<section class="panel lead"><div class="panel-h"><h2>Thanh toán để bắt đầu in</h2><span class="muted">${esc(P.payLabel(o))}</span></div>
              <p>Chuyển khoản <b>${fmt.vnd(m.first)}</b> theo thông tin dưới đây.</p>
              ${bankBlock(db, m.first, o.id)}
              <div class="actions"><button class="btn btn-cta btn-sm" type="button" data-act="paid">Tôi đã chuyển khoản</button>${cancelControl(o)}</div></section>`;
      case 'san_xuat': {
        const done = P.expectedDone(o);
        return `<section class="panel lead"><div class="panel-h"><h2>Xưởng đang in</h2></div>
          <p>Bắt đầu ${fmt.date(o.produceStart)}${done ? ', dự kiến xong khoảng <b>' + fmt.date(done) + '</b>' : ''}.</p>
          <p class="muted">Xong hàng, shop kiểm số lượng và chất lượng rồi gửi về cho bạn.</p></section>`;
      }
      case 'van_chuyen': {
        const sh = o.shipping || { stage: 0, method: 'bo' };
        const eta = P.expectedArrival(o);
        return `<section class="panel lead"><div class="panel-h"><h2>Đang vận chuyển</h2><span class="muted">${(SHIP_METHODS[sh.method] || SHIP_METHODS.bo).name}</span></div>
          <ol class="track">${SHIP_STAGES.map((st, i) => `<li class="${i < sh.stage ? 'done' : i === sh.stage ? 'now' : ''}"><i></i>${st}${i === 3 ? ' · ' + esc(o.city) : ''}</li>`).join('')}</ol>
          <dl class="kv"><dt>Mã vận đơn</dt><dd>${esc(sh.tracking || 'Đang cập nhật')}</dd>${eta ? `<dt>Dự kiến nhận</dt><dd>khoảng ${fmt.date(eta)}</dd>` : ''}</dl></section>`;
      }
      case 'da_giao':
        return `<section class="panel lead"><div class="panel-h"><h2>Đã giao hàng</h2>${o.deliveredAt ? `<span class="muted">${fmt.date(o.deliveredAt)}</span>` : ''}</div>
          ${o.balancePaid ? '<p>Đơn đã hoàn tất. Cảm ơn bạn đã đặt in cùng shop.</p>'
            : `<p>Còn lại <b>${fmt.vnd(m.remaining)}</b>. Bạn chuyển khoản theo thông tin dưới đây.</p>${bankBlock(db, m.remaining, o.id)}`}
          <div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="reorder">Đặt lại đơn này</button></div></section>`;
      case 'huy':
        return `<section class="panel lead"><div class="panel-h"><h2>Đơn đã hủy</h2></div>${o.cancelReason ? `<p class="muted">Lý do: ${esc(o.cancelReason)}</p>` : ''}
          <div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="reorder">Đặt lại các sản phẩm này</button></div></section>`;
    }
    return '';
  }

  function itemsPanel(o) {
    const m = P.money(o);
    return `<section class="panel"><div class="panel-h"><h2>Sản phẩm</h2></div><table class="items"><tbody>
      ${o.items.map(it => `<tr><td><span class="it-name">${esc(it.productName)}</span><small>${esc(it.variantName)}</small></td>
        <td class="r">${fmt.num(it.qty)} × ${fmt.vnd(it.price)}</td><td class="r"><b>${fmt.vnd(it.qty * it.price)}</b></td></tr>`).join('')}
      ${o.extraFee ? `<tr><td colspan="2">Phụ phí${o.extraNote ? `<small>${esc(o.extraNote)}</small>` : ''}</td><td class="r"><b>${fmt.vnd(o.extraFee)}</b></td></tr>` : ''}
    </tbody></table><table class="money"><tbody><tr class="total"><td>Tổng</td><td>${fmt.vnd(m.total)}</td></tr></tbody></table></section>`;
  }

  function infoPanel(o) {
    const canEdit = ['cho_coc', 'san_xuat'].includes(o.status);
    const rows = [
      ['Người nhận', esc(o.name) + ' · ' + esc(fmt.phone(o.phone))],
      ['Mạng xã hội', esc(o.social)],
      ['Địa chỉ', esc([o.address, o.city].filter(Boolean).join(', '))],
      ['Ghi chú', esc(o.note)]
    ].filter(r => r[1]);
    return `<section class="panel"><div class="panel-h"><h2>File và giao hàng</h2></div>
      <dl class="kv"><dt>File thiết kế</dt><dd>${P.isUrl(o.file) ? `<a href="${esc(o.file)}" target="_blank" rel="noopener">${esc(o.file)}</a>` : '<span class="muted">Chưa có</span>'}</dd>
      ${rows.map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('')}</dl>
      ${canEdit ? `<form id="refile-form" class="composer" style="margin-top:14px" novalidate data-keep>
        <label class="sr-only" for="rf-link">Link file mới</label>
        <input id="rf-link" class="search" type="url" placeholder="Gửi lại link Drive khác nếu cần" autocomplete="off" aria-describedby="err-rf-link">
        <button class="btn btn-quiet btn-sm" type="submit">Cập nhật</button></form><p class="err" id="err-rf-link"></p>` : ''}
    </section>`;
  }

  function paymentPanel(o) {
    const m = P.money(o);
    const ok = '<span class="pill ok">Đã nhận</span>';
    const rows = o.payPct >= 100
      ? `<tr><td>Thanh toán 100% ${o.paid1 ? ok : ''}</td><td>${fmt.vnd(m.first)}</td></tr>
         ${m.total > m.first ? `<tr><td>Phụ phí phát sinh ${o.balancePaid ? ok : ''}</td><td>${fmt.vnd(m.total - m.first)}</td></tr>` : ''}`
      : `<tr><td>Đặt cọc ${o.payPct}% ${o.paid1 ? ok : ''}</td><td>${fmt.vnd(m.first)}</td></tr>
         <tr><td>Trả khi nhận hàng ${o.balancePaid ? ok : ''}</td><td>${fmt.vnd(m.total - m.first)}</td></tr>`;
    return `<section class="panel"><div class="panel-h"><h2>Thanh toán</h2></div><table class="money"><tbody>
      <tr><td>Tổng đơn</td><td>${fmt.vnd(m.total)}</td></tr>${rows}
      <tr class="total"><td>Còn phải trả</td><td>${fmt.vnd(m.remaining)}</td></tr>
    </tbody></table></section>`;
  }

  function messagesPanel(db, o) {
    const shop = db.settings.shopName;
    const msgs = o.messages.length
      ? o.messages.map(x => `<div class="msg ${x.from === 'customer' ? 'me' : ''}">${esc(x.text)}<small>${x.from === 'customer' ? 'Bạn' : esc(shop)} · ${fmt.dateTime(x.at)}</small></div>`).join('')
      : '<p class="muted">Chưa có tin nhắn. Hỏi shop bất cứ điều gì về đơn này.</p>';
    return `<section class="panel" id="chat"><div class="panel-h"><h2>Nhắn shop</h2></div>
      <div class="thread" id="thread" aria-live="polite">${msgs}</div>
      <form class="composer" id="chat-form" data-keep><label class="sr-only" for="chat-input">Tin nhắn</label>
        <textarea id="chat-input" rows="1" placeholder="Nhắn cho shop…"></textarea><button class="btn btn-cta btn-sm" type="submit">Gửi</button></form></section>`;
  }

  function historyPanel(o) {
    return `<section class="panel"><div class="panel-h"><h2>Lịch sử</h2></div><ol class="hist">${o.history.slice().reverse().map(h =>
      `<li class="by-${h.by}"><div>${esc(h.text)}<time>${fmt.dateTime(h.at)}</time></div></li>`).join('')}</ol></section>`;
  }

  function viewOrder(db, id) {
    const o = P.findOrder(db, id);
    // Chưa nhập số điện thoại, hoặc đơn không thuộc số này: hỏi số điện thoại (không tiết lộ đơn có tồn tại hay không)
    if (!o || !phoneOk(o)) {
      return `<div class="wrap page">${trackForm(db, 'Xem đơn ' + esc(id), 'Nhập số điện thoại bạn dùng khi đặt đơn này để xem chi tiết.')}</div>`;
    }
    return `<div class="wrap page">
      <a class="back" href="#theo-doi">← Đơn của bạn</a>
      <div class="page-head"><div><p class="eyebrow">${esc(o.id)}</p><h1>${esc(P.orderTitle(o))}</h1><p>Đặt lúc ${fmt.dateTime(o.createdAt)}</p></div>${P.pill(o, 'customer')}</div>
      ${stepper(o)}
      <div class="detail">
        <div class="stack">${nextPanel(db, o)}${itemsPanel(o)}${infoPanel(o)}</div>
        <div class="stack">${paymentPanel(o)}${messagesPanel(db, o)}${historyPanel(o)}</div>
      </div></div>`;
  }

  // ==== Liên hệ ====
  function viewContact(db) {
    const s = db.settings;
    const z = P.normPhone(s.zalo);
    const card = (icon, title, inner) => `<section class="panel ccard"><span class="ic">${icon}</span><h2>${title}</h2>${inner}</section>`;
    const cards = [];
    if (z) cards.push(card(ICON.chat, 'Zalo, điện thoại',
      `<p class="copy-line"><b class="val" id="ct-zalo">${esc(fmt.phone(z))}</b><button class="copy-mini" type="button" data-copy-value="${esc(z)}" data-copy-target="ct-zalo">Sao chép</button></p>
       <a class="btn btn-cta btn-sm" href="https://zalo.me/${esc(z)}" target="_blank" rel="noopener">Nhắn Zalo</a>`));
    if (s.email) cards.push(card(ICON.mail, 'Email',
      `<p class="copy-line"><b class="val" id="ct-mail">${esc(s.email)}</b><button class="copy-mini" type="button" data-copy-value="${esc(s.email)}" data-copy-target="ct-mail">Sao chép</button></p>`));
    if (s.hours) cards.push(card(ICON.clock, 'Giờ làm việc', `<p class="val">${esc(s.hours)}</p>`));
    if (s.address) cards.push(card(ICON.pin, 'Địa chỉ', `<p class="val">${esc(s.address)}</p>`));
    const socials = [['Facebook', s.facebook], ['Instagram', s.instagram]].filter(x => x[1]);
    if (socials.length) cards.push(card(ICON.link, 'Mạng xã hội',
      `<div class="actions" style="margin-top:4px">${socials.map(([n, u]) => `<a class="btn btn-ghost btn-sm" href="${esc(safeUrl(u))}" target="_blank" rel="noopener">${n}</a>`).join('')}</div>`));
    return `<div class="wrap page"><div class="page-head"><div><h1>Liên hệ</h1><p>Nhắn Zalo là nhanh nhất. Shop trả lời trong giờ làm việc.</p></div></div>
      <div class="contact-grid">${cards.join('')}</div></div>`;
  }

  // ==== Xử lý thao tác ====
  function setErr(id, msg) {
    const box = document.getElementById('err-' + id);
    if (box) box.textContent = msg || '';
    const el = document.getElementById(id);
    if (el) el.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }
  // Thao tác của khách trên đơn đang xem. Chờ máy chủ trả lời rồi mới vẽ lại trang.
  async function custAct(action, payload, okMsg) {
    const r = route();
    if (r.view !== 'order' || ui.busy) return false;
    ui.busy = true;
    try {
      await P.cust.action(r.id, action, payload);
      if (okMsg) P.ui.toast(okMsg);
      return true;
    } catch (e) {
      P.ui.toast(P.errText(e));
      return false;
    } finally { ui.busy = false; render(); }
  }
  function toTop() { window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); }

  function addSelected() {
    const { v } = currentVariant();
    if (!v) return false;
    const min = +v.minQty || 1;
    ui.sel.qty = clampQ(ui.sel.qty, min);
    P.addToCart(ui.sel.pid, ui.sel.vid, ui.sel.qty);
    return true;
  }

  root.addEventListener('click', e => {
    if (!e.target.closest('.sh-find')) hideDrop();
    const t = e.target.closest('[data-act],[data-copy-value]');
    if (!t) return;

    if (t.dataset.copyValue != null) {
      const label = t.textContent;
      P.ui.copyText(t.dataset.copyValue, document.getElementById(t.dataset.copyTarget)).then(ok => {
        t.textContent = ok ? 'Đã chép' : 'Nhấn Ctrl + C';
        setTimeout(() => { t.textContent = label; }, 1800);
      });
      return;
    }

    const a = t.dataset.act;
    const i = +t.dataset.i;
    switch (a) {
      case 'img': galGo(i, true); return;
      case 'gal': { const g = document.getElementById('gal'); if (g) galGo(Math.max(0, Math.min(g.children.length - 1, (ui.sel.img || 0) + (+t.dataset.d))), true); return; }
      case 'opt': {
        const { p, v } = currentVariant();
        if (!p || !v) return;
        const nv = P.pickVariant(p.variants, +t.dataset.g, t.dataset.v, v.opts);
        if (nv) { ui.sel.vid = nv.id; if (ui.sel.qty < (+nv.minQty || 1)) ui.sel.qty = +nv.minQty || 1; }
        render(); return;
      }
      case 'variant': {
        ui.sel.vid = t.dataset.id;
        const { v } = currentVariant();
        if (v && ui.sel.qty < (+v.minQty || 1)) ui.sel.qty = +v.minQty || 1;
        render(); return;
      }
      case 'qty-': case 'qty+': {
        const { v } = currentVariant();
        const min = v ? (+v.minQty || 1) : 1;
        const step = min >= 50 ? 10 : 1;
        ui.sel.qty = clampQ(ui.sel.qty + (a === 'qty+' ? step : -step), min);
        render(); return;
      }
      case 'menu': ui.menu = !ui.menu; render(); return;
      case 'code-retry': ui.codeErr = ''; render(); return;
      case 'find-clear': {
        ui.q = ''; hideDrop();
        const inp = document.getElementById('find-q'); if (inp) { inp.value = ''; inp.focus(); }
        t.hidden = true;
        const out = document.getElementById('search-out'); if (out) out.innerHTML = searchResults(P.load(), '');
        return;
      }
      case 'more': { const k = t.dataset.k; ui.more[k] = (ui.more[k] || PAGE) + PAGE; render(); return; }
      case 'feat-prev': case 'feat-next': {
        const row = document.getElementById('feat-row');
        if (row) row.scrollBy({ left: (a === 'feat-next' ? 1 : -1) * row.clientWidth * 0.8, behavior: reduceMotion ? 'auto' : 'smooth' });
        return;
      }
      case 'add': if (addSelected()) { P.ui.toast('Đã thêm vào giỏ hàng.'); render(); } return;
      case 'buy': if (addSelected()) go('gio-hang'); return;
      case 'cq-': case 'cq+':
        cartEdit(c => { const x = c[i]; if (x) x.qty = clampQ(x.qty + (a === 'cq+' ? 1 : -1) * (x.min >= 50 ? 10 : 1), x.min); }); return;
      case 'rm': cartEdit(c => { c[i] = null; }); P.ui.toast('Đã xóa khỏi giỏ hàng.'); return;
      case 'track-clear': P.setTrack(''); ui.trackErr = ''; go('theo-doi'); return;
      case 'cancel-ask': ui.confirm = route().id; render(); return;
      case 'cancel-no': ui.confirm = null; render(); return;
      case 'cancel-yes': ui.confirm = null; custAct('cancel', {}, 'Đã hủy đơn.'); return;
      case 'paid': custAct('notify_paid', {}, 'Đã báo chuyển khoản. Shop sẽ xác nhận sớm.'); return;
      case 'reorder': {
        const db = P.load();
        const o = P.findOrder(db, route().id);
        if (!o) return;
        let missing = 0;
        o.items.forEach(it => {
          const p = P.findProduct(db, it.productId);
          const v = p && p.active && p.variants.find(x => x.id === it.variantId);
          if (v) P.addToCart(p.id, v.id, Math.max(it.qty, +v.minQty || 1)); else missing++;
        });
        if (missing) P.ui.toast(missing + ' sản phẩm không còn bán nên không thêm được.');
        go('gio-hang'); return;
      }
    }
  });

  root.addEventListener('input', e => {
    const el = e.target;
    if (el.id === 'pq') {
      ui.sel.qty = parseInt(el.value.replace(/\D/g, ''), 10) || 0;
      const { v } = currentVariant();
      setTotals(v);
      return;
    }
    if (el.id === 'find-q') {
      ui.q = el.value;
      const x = root.querySelector('.find-x'); if (x) x.hidden = !ui.q;
      const out = document.getElementById('search-out');
      if (out) out.innerHTML = searchResults(P.load(), ui.q);
      else showDrop(P.load());
      return;
    }
    if (el.id && document.getElementById('err-' + el.id) && document.getElementById('err-' + el.id).textContent) setErr(el.id, '');
  });

  root.addEventListener('change', e => {
    const el = e.target;
    if (el.id === 'sort') { ui.sort = el.value; render(); return; }
    // Ô số lượng: sửa ngay trong ô, không vẽ lại trang (để cú bấm nút kế tiếp không bị mất)
    if (el.id === 'pq') {
      const { v } = currentVariant();
      ui.sel.qty = clampQ(ui.sel.qty, v ? (+v.minQty || 1) : 1);
      el.value = ui.sel.qty;
      setTotals(v);
      return;
    }
    if (el.classList.contains('cq')) {
      const i = +el.dataset.i;
      const q = parseInt(el.value.replace(/\D/g, ''), 10) || 0;
      const lines = P.cartLines(P.load());
      const c = lines.map(l => ({ pid: l.pid, vid: l.vid, qty: l.qty }));
      if (c[i]) { c[i].qty = clampQ(q, +lines[i].variant.minQty || 1); el.value = c[i].qty; }
      P.setCart(c);
      refreshCartNumbers();
      return;
    }
    if (el.id === 'proof-in') {
      const file = el.files && el.files[0];
      if (!file) return;
      if (!/^image\//.test(file.type)) { setErr('proof', 'File này không phải ảnh. Chọn ảnh chụp màn hình chuyển khoản.'); return; }
      if (file.size > 15 * 1024 * 1024) { setErr('proof', 'Ảnh quá lớn (trên 15MB).'); return; }
      if (ui.proof) URL.revokeObjectURL(ui.proof.url);
      ui.proof = { file, url: URL.createObjectURL(file), name: file.name };
      render();
      return;
    }
    // Chọn cách thanh toán: cập nhật số tiền ngay trong khung tóm tắt
    if (el.name === 'pay') {
      const db = P.load();
      const sub = P.cartLines(db).reduce((a, l) => a + l.line, 0);
      const o = P.payOptions(db.settings, sub).find(x => x.pct === +el.value);
      if (!o) return;
      patchCo({ payPct: o.pct });
      document.getElementById('pay-label').textContent = o.label;
      document.getElementById('pay-now').textContent = fmt.vnd(o.amount);
      const pn2 = document.getElementById('pay-now2'); if (pn2) pn2.textContent = fmt.vnd(o.amount);
      render(); // mã QR đổi theo số tiền vừa chọn
      document.getElementById('pay-later').textContent = fmt.vnd(sub - o.amount);
    }
  });

  root.addEventListener('focusin', e => { if (e.target.id === 'find-q' && ui.q && route().view !== 'search') showDrop(P.load()); });

  root.addEventListener('keydown', e => {
    if (e.key === 'Escape') { hideDrop(); if (ui.menu) { ui.menu = false; render(); } }
    if (e.target.id === 'chat-input' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      document.getElementById('chat-form').requestSubmit();
    }
  });

  root.addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target;
    const val = id => (document.getElementById(id) || {}).value || '';

    if (f.id === 'track-form') {
      const phone = P.normPhone(val('tr-phone'));
      if (phone.length < 9) { setErr('tr-phone', 'Nhập số điện thoại, ít nhất 9 chữ số.'); document.getElementById('tr-phone').focus(); return; }
      const r = route();
      if (ui.busy) return;
      ui.busy = true;
      P.setTrack(phone);
      P.cust.track(phone).then(() => {
        const o = r.view === 'order' ? P.findOrder(P.load(), r.id) : true;
        if (!o || (o !== true && P.normPhone(o.phone) !== phone)) {
          P.setTrack('');
          ui.trackErr = 'Số điện thoại không khớp với đơn này.';
        } else ui.trackErr = '';
      }, e => { P.setTrack(''); ui.trackErr = P.errText(e); }).then(() => { ui.busy = false; lastRoute = ''; render(); });
      return;
    }

    if (f.id === 'find-form') {
      const i = document.getElementById('find-q'); if (i) i.blur();
      hideDrop();
      if (route().view !== 'search') go('tim-kiem');
      return;
    }

    if (f.id === 'chat-form') {
      const inp = document.getElementById('chat-input');
      const text = inp.value.trim();
      if (!text) return;
      inp.value = '';
      custAct('message', { text }).then(() => { const again = document.getElementById('chat-input'); if (again) again.focus(); });
      return;
    }

    if (f.id === 'refile-form') {
      const link = val('rf-link').trim();
      if (!P.isUrl(link)) { setErr('rf-link', 'Dán link bắt đầu bằng https://, ví dụ link Google Drive.'); return; }
      document.getElementById('rf-link').value = '';
      custAct('set_file', { file: link }, 'Đã cập nhật link file. Shop sẽ dùng file mới.');
      return;
    }

    if (f.id === 'file-form') {
      const file = val('co-file').trim();
      if (!P.isUrl(file)) { setErr('co-file', 'Dán link bắt đầu bằng https://, ví dụ link Google Drive.'); document.getElementById('co-file').focus(); return; }
      patchCo({ file, note: val('co-note').trim() });
      go('thanh-toan');
      return;
    }

    if (f.id === 'checkout') {
      const co = getCo();
      const info = { name: val('co-name').trim(), phone: val('co-phone').trim(), social: val('co-social').trim(), address: val('co-address').trim(), city: val('co-city') };
      patchCo({ ship: info });
      const bad = [];
      if (!info.name) bad.push(['co-name', 'Nhập họ tên người nhận.']);
      if (P.normPhone(info.phone).length < 9) bad.push(['co-phone', 'Nhập số điện thoại, ít nhất 9 chữ số.']);
      if (!info.social) bad.push(['co-social', 'Dán link Facebook, Instagram hoặc Zalo để shop liên hệ khi cần.']);
      if (!info.address) bad.push(['co-address', 'Nhập địa chỉ nhận hàng.']);
      ['co-name', 'co-phone', 'co-social', 'co-address'].forEach(id => setErr(id, ''));
      bad.forEach(b => setErr(b[0], b[1]));
      if (bad.length) { document.getElementById(bad[0][0]).focus(); return; }
      const picked = +((f.querySelector('input[name="pay"]:checked') || {}).value || 100);
      const db = P.load();
      const lines = P.cartLines(db);
      if (!lines.length) { render(); return; }
      if (ui.busy) return;
      const sub = lines.reduce((a, l) => a + l.line, 0);
      const allowed = P.payOptions(db.settings, sub).map(x => x.pct);
      if (!co.code) { P.ui.toast('Đang tạo mã đơn, chờ một chút rồi bấm lại.'); return; }
      if (!ui.proof) {
        setErr('proof', 'Tải lên ảnh chụp chuyển khoản trước khi đặt hàng.');
        const box = document.getElementById('proof-box'); if (box) box.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
        return;
      }
      const btns = document.querySelectorAll('button[form="checkout"]');
      const setBtn = (dis, txt) => btns.forEach(b => { b.disabled = dis; b.textContent = txt; });
      ui.busy = true; setBtn(true, 'Đang gửi ảnh…');
      P.cust.uploadProof(ui.proof.file).then(proof => {
        setBtn(true, 'Đang gửi đơn…');
        return P.cust.submitOrder(lines, Object.assign({}, info, { file: co.file, note: co.note || '', payPct: allowed.includes(picked) ? picked : 100, code: co.code, proof }));
      }).then(o => {
        P.setCart([]);
        if (ui.proof) URL.revokeObjectURL(ui.proof.url);
        ui.proof = null;
        setCo({ ship: info });
        P.setTrack(P.normPhone(info.phone));
        ui.busy = false;
        go('dat-xong-' + o.id);
      }, e => {
        ui.busy = false;
        setBtn(false, 'Đặt hàng');
        P.ui.toast(e && e.message === 'not-image' ? 'File này không phải ảnh.' : P.errText(e));
      });
    }
  });

  // Chuyển trang thì lên đầu ngay (không cuộn mượt); bấm Back thì về đúng chỗ đang xem
  const seenY = {};
  let curHash = location.hash, popped = false;
  window.addEventListener('scroll', () => { seenY[curHash] = window.scrollY; }, { passive: true });
  window.addEventListener('popstate', () => { popped = true; });
  window.addEventListener('hashchange', () => {
    ui.confirm = null;
    ui.menu = false;
    curHash = location.hash;
    render();
    const y = popped && seenY[curHash] ? seenY[curHash] : 0;
    popped = false;
    window.scrollTo({ top: y, behavior: 'instant' });
  });
  P.loadLogo(() => render());
  P.onChange(() => render());
  P.init('shop').then(() => { booted = true; render(); });
})();
