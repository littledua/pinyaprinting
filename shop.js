/* Pinya Printing · trang cửa hàng: giới thiệu, danh mục, sản phẩm, đặt hàng 3 bước, theo dõi tiến độ in, liên hệ */
(() => {
  'use strict';
  const P = window.Pinya;
  const { fmt, esc, STATUSES, STAGES, SHIP_METHODS, SHIP_STAGES, DEST } = P;
  const root = document.getElementById('shop');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ui = { sort: 'new', sel: null, confirm: null, trackErr: '' };
  let lastRoute = '';

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
    return { view: 'about' };
  }
  function go(hash) {
    if (location.hash === '#' + hash) { render(); window.scrollTo(0, 0); } else location.hash = hash;
  }

  // Giữ chữ đang gõ trong các ô tự do khi trang vẽ lại
  function snapshot() {
    const snap = {};
    root.querySelectorAll('[data-keep] input[id],[data-keep] textarea[id],[data-keep] select[id]').forEach(el => {
      if (el.type !== 'radio') snap[el.id] = el.value;
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

  function render() {
    let db = P.load();
    const r = route();
    const key = r.view + ':' + (r.id || '');
    const keep = key === lastRoute ? snapshot() : null;
    lastRoute = key;

    if (r.view === 'order') {
      const o = P.findOrder(db, r.id);
      if (o && phoneOk(o) && o.unreadCustomer) {
        P.update(d => { const x = P.findOrder(d, r.id); if (x) P.act.markRead(d, x, 'customer'); });
        db = P.load();
      }
    }

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
      default: body = viewAbout(db);
    }
    root.innerHTML = header(db, r) + '<main id="main">' + body + '</main>' + footer(db);
    document.title = (title ? title + ' · ' : '') + db.settings.shopName;
    if (keep) restore(keep);
    const thread = document.getElementById('thread');
    if (thread) thread.scrollTop = thread.scrollHeight;
  }

  function notFound(h, p) {
    return `<div class="wrap page"><div class="panel empty"><h3>${esc(h)}</h3><p>${esc(p)}</p><a class="btn btn-ghost btn-sm" href="#gioi-thieu">Về trang giới thiệu</a></div></div>`;
  }

  // ==== Khung trang ====
  function header(db, r) {
    const s = db.settings;
    const n = P.cartLines(db).length;
    const cur = c => c ? ' aria-current="page"' : '';
    const activeCat = r.view === 'cat' ? r.id : r.view === 'product' ? (P.findProduct(db, r.id) || {}).catId : null;
    return `<header class="sh-head"><div class="wrap sh-row">
      <a class="brand" href="#gioi-thieu">${P.brandMark()}<span class="brand-word">${esc(s.shopName)}</span></a>
      <nav class="sh-nav" aria-label="Giới thiệu, danh mục in ấn, liên hệ">
        <a href="#gioi-thieu"${cur(r.view === 'about')}>Giới thiệu</a>
        ${db.categories.map(c => `<a href="#dm-${esc(c.id)}" data-ink="${esc(c.ink)}"${cur(activeCat === c.id)}><i></i>${esc(c.name)}</a>`).join('')}
        <a href="#lien-he"${cur(r.view === 'contact')}>Liên hệ</a>
      </nav>
      <div class="sh-tools">
        <a class="sh-track" href="#theo-doi"${cur(r.view === 'track' || r.view === 'order')}>${ICON.track}<span>Theo dõi đơn</span></a>
        <a class="cart-btn" href="#gio-hang" aria-label="Giỏ hàng${n ? ', ' + n + ' sản phẩm' : ''}"${cur(['cart', 'file', 'pay'].includes(r.view))}>${ICON.bag}${n ? `<span class="count">${n}</span>` : ''}</a>
      </div>
    </div></header>`;
  }

  function footer(db) {
    const s = db.settings;
    return `<footer class="sh-foot"><div class="wrap foot-grid">
      <div><a class="brand" href="#gioi-thieu">${P.brandMark()}<span class="brand-word">${esc(s.shopName)}</span></a>${s.tagline ? `<p>${esc(s.tagline)}</p>` : ''}</div>
      <div><h3>Liên hệ</h3><ul class="foot-list">
        <li>Zalo: ${esc(fmt.phone(s.zalo))}</li>
        ${s.email ? `<li>${esc(s.email)}</li>` : ''}${s.hours ? `<li>${esc(s.hours)}</li>` : ''}${s.address ? `<li>${esc(s.address)}</li>` : ''}
      </ul></div>
      <div><h3>Danh mục in ấn</h3><ul class="foot-list">
        ${db.categories.map(c => `<li><a href="#dm-${esc(c.id)}">${esc(c.name)}</a></li>`).join('')}
        <li><a href="#theo-doi">Theo dõi tiến độ in</a></li>
      </ul></div>
    </div><div class="wrap foot-bottom"><span>© ${new Date().getFullYear()} ${esc(s.shopName)}</span><a href="admin.html">Quản trị</a></div></footer>`;
  }

  function payRule(s) {
    return `Đơn dưới ${fmt.short(s.payThreshold)}: thanh toán 100% hoặc cọc ${s.depositLow}%. Đơn từ ${fmt.short(s.payThreshold)}: thanh toán 100% hoặc cọc ${s.depositHigh}%.`;
  }

  // ==== Giới thiệu ====
  function viewAbout(db) {
    const s = db.settings;
    const paras = String(s.about || '').split(/\n+/).filter(x => x.trim()).map(x => `<p>${esc(x)}</p>`).join('');
    const first = db.categories[0];
    const count = id => db.products.filter(p => p.active && p.catId === id).length;
    return `<section class="hero"><div class="wrap hero-in">
        <div>
          ${s.tagline ? `<p class="eyebrow">${esc(s.tagline)}</p>` : ''}
          <h1>${esc(s.shopName)}</h1>
          <div class="about">${paras}</div>
          <div class="hero-actions">
            ${first ? `<a class="btn btn-cta" href="#dm-${esc(first.id)}">Xem sản phẩm</a>` : ''}
            <a class="btn btn-ghost" href="#theo-doi">Theo dõi tiến độ in</a>
          </div>
        </div>
        ${P.hasLogo()
          ? `<div class="hero-art hero-logo"><img src="${P.LOGO}" alt="Logo ${esc(s.shopName)}"></div>`
          : `<div class="hero-art" aria-hidden="true"><div class="sheet">${CROPS}
          <div class="slug"><span>${esc(s.shopName)}</span><span>Bản in thử</span></div>
          <div class="plates"><span class="plate c"></span><span class="plate m"></span><span class="plate y"></span></div>
          ${BAR}
        </div></div>`}
      </div></section>
      <section class="wrap sec" aria-labelledby="dm-title">
        <div class="sec-h"><h2 id="dm-title">Danh mục in ấn</h2><p>Chọn danh mục để xem sản phẩm và giá từng phân loại.</p></div>
        ${db.categories.length ? `<div class="cat-grid">${db.categories.map(c => {
          const n = count(c.id);
          return `<a class="cat-card" data-ink="${esc(c.ink)}" href="#dm-${esc(c.id)}"><span class="blob"></span><h3>${esc(c.name)}</h3>${c.desc ? `<p>${esc(c.desc)}</p>` : ''}<span class="cnt">${n ? n + ' sản phẩm' : 'Sắp có sản phẩm'} →</span></a>`;
        }).join('')}</div>` : '<div class="panel empty"><p>Shop đang cập nhật danh mục.</p></div>'}
      </section>`;
  }

  // ==== Danh mục ====
  function sortProducts(list) {
    const by = {
      new: (a, b) => b.createdAt - a.createdAt,
      low: (a, b) => P.priceRange(a).min - P.priceRange(b).min,
      high: (a, b) => P.priceRange(b).min - P.priceRange(a).min,
      name: (a, b) => a.name.localeCompare(b.name, 'vi')
    };
    return list.slice().sort(by[ui.sort] || by.new);
  }

  function pcard(db, p) {
    const pr = P.priceRange(p);
    return `<a class="pcard" href="#sp-${esc(p.id)}">${P.thumb(db, p, 'pimg')}<div class="pbody">${P.catTag(db, p.catId)}
      <h3>${esc(p.name)}</h3><p class="pmeta">${p.variants.length} phân loại</p>
      <p class="price">${pr.min !== pr.max ? 'Từ ' : ''}<b>${fmt.vnd(pr.min)}</b></p></div></a>`;
  }

  function viewCat(db, id) {
    const c = P.findCategory(db, id);
    if (!c) return notFound('Không tìm thấy danh mục này', 'Danh mục có thể đã được đổi tên hoặc gỡ bỏ.');
    const list = sortProducts(db.products.filter(p => p.active && p.catId === c.id && p.variants.length));
    const sorts = [['new', 'Mới nhất'], ['low', 'Giá thấp → cao'], ['high', 'Giá cao → thấp'], ['name', 'Tên A → Z']];
    return `<div class="wrap page">
      <nav class="crumbs" aria-label="Đường dẫn"><a href="#gioi-thieu">Giới thiệu</a><span>/</span><span aria-current="page">${esc(c.name)}</span></nav>
      <div class="page-head"><div><h1>${esc(c.name)}</h1>${c.desc ? `<p>${esc(c.desc)}</p>` : ''}</div>
        ${list.length > 1 ? `<div><label class="sr-only" for="sort">Sắp xếp</label><select class="sort" id="sort">${sorts.map(([v, l]) => `<option value="${v}"${ui.sort === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>` : ''}</div>
      ${list.length ? `<div class="pgrid">${list.map(p => pcard(db, p)).join('')}</div>`
        : `<div class="panel empty"><h3>Danh mục đang cập nhật sản phẩm</h3><p>Bạn cần in gì trong mục này, nhắn shop để được tư vấn.</p><a class="btn btn-ghost btn-sm" href="#lien-he">Liên hệ shop</a></div>`}
    </div>`;
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
    const min = v ? (+v.minQty || 1) : 1;
    if (ui.sel.qty < min) ui.sel.qty = min;
    const imgs = p.images || [];
    if (ui.sel.img >= imgs.length) ui.sel.img = 0;
    const main = imgs.length ? `<img class="main" src="${esc(imgs[ui.sel.img])}" alt="${esc(p.name)}">` : P.thumb(db, p, 'main');

    return `<div class="wrap page">
      <nav class="crumbs" aria-label="Đường dẫn"><a href="#gioi-thieu">Giới thiệu</a><span>/</span>
        ${c ? `<a href="#dm-${esc(c.id)}">${esc(c.name)}</a><span>/</span>` : ''}<span aria-current="page">${esc(p.name)}</span></nav>
      <div class="pdetail">
        <div class="pgal">${main}
          ${imgs.length > 1 ? `<div class="thumbs">${imgs.map((src, i) => `<button type="button" data-act="img" data-i="${i}" aria-pressed="${i === ui.sel.img}" aria-label="Xem ảnh ${i + 1}"><img src="${esc(src)}" alt=""></button>`).join('')}</div>` : ''}
        </div>
        <div class="pinfo">
          <div>${P.catTag(db, p.catId)}<h1>${esc(p.name)}</h1></div>
          ${v ? `<p class="pprice">${fmt.vnd(v.price)}</p>` : '<p class="muted">Sản phẩm đang cập nhật giá.</p>'}
          ${p.desc ? `<p class="pdesc">${esc(p.desc)}</p>` : ''}
          ${v ? `<div><p class="lbl">Phân loại: <b>${esc(v.name)}</b></p>
            <div class="vchips" role="group" aria-label="Chọn phân loại">${p.variants.map(x =>
              `<button type="button" class="vchip" data-act="variant" data-id="${esc(x.id)}" aria-pressed="${x.id === v.id}">${esc(x.name)}<small>${fmt.vnd(x.price)}${(+x.minQty || 1) > 1 ? ' · tối thiểu ' + fmt.num(x.minQty) : ''}</small></button>`).join('')}</div></div>
          <div class="qty-row"><span class="lbl" id="q-lbl">Số lượng</span>
            <div class="qty"><button type="button" data-act="qty-" aria-label="Giảm số lượng">−</button><input id="pq" inputmode="numeric" autocomplete="off" value="${ui.sel.qty}" aria-labelledby="q-lbl"><button type="button" data-act="qty+" aria-label="Tăng số lượng">+</button></div>
            ${min > 1 ? `<span class="hint">Tối thiểu ${fmt.num(min)}</span>` : ''}
            <span class="hint" id="pq-total" aria-live="polite">Thành tiền ${fmt.vnd(v.price * ui.sel.qty)}</span></div>
          <div class="pbtns"><button class="btn btn-ghost" type="button" data-act="add">Thêm vào giỏ</button><button class="btn btn-cta" type="button" data-act="buy">Mua ngay</button></div>` : ''}
          <ul class="pnotes">
            ${p.leadDays ? `<li>In khoảng ${esc(p.leadDays)} ngày, cộng thời gian vận chuyển</li>` : ''}
            <li>Bạn gửi file thiết kế qua link Google Drive ở bước đặt hàng</li>
            <li>${esc(payRule(db.settings))}</li>
          </ul>
        </div>
      </div></div>`;
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
      </div></div>`;
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
          <p class="hint" style="margin-top:10px">Đặt xong, trang hiện số tài khoản để bạn chuyển khoản.</p>
        </aside>
      </div></div>`;
  }

  function refreshCartNumbers() {
    const lines = P.cartLines(P.load());
    lines.forEach((l, i) => { const el = document.getElementById('ct-' + i); if (el) el.textContent = fmt.vnd(l.line); });
    const el = document.getElementById('sum-total');
    if (el) el.textContent = fmt.vnd(lines.reduce((a, l) => a + l.line, 0));
  }

  function cartEdit(fn) {
    const lines = P.cartLines(P.load());
    const c = lines.map(l => ({ pid: l.pid, vid: l.vid, qty: l.qty, min: +l.variant.minQty || 1 }));
    fn(c);
    P.setCart(c.filter(Boolean).map(x => ({ pid: x.pid, vid: x.vid, qty: Math.max(x.min, x.qty) })));
    render();
  }

  function bankBlock(db, amount, memo) {
    const s = db.settings;
    const line = (label, id, value, copyValue) =>
      `<dt>${label}</dt><dd class="copy-line"><b id="${id}">${esc(value)}</b><button class="copy-mini" type="button" data-copy-value="${esc(copyValue || value)}" data-copy-target="${id}">Sao chép</button></dd>`;
    return `<dl class="kv" style="margin-top:14px"><dt>Ngân hàng</dt><dd>${esc(s.bankName)}</dd>
      ${line('Số tài khoản', 'cp-acc', s.bankNumber, String(s.bankNumber).replace(/\s/g, ''))}
      <dt>Chủ tài khoản</dt><dd>${esc(s.bankHolder)}</dd>
      ${line('Số tiền', 'cp-amt', fmt.vnd(amount), String(Math.round(amount)))}
      ${line('Nội dung', 'cp-memo', memo)}</dl>`;
  }

  function viewDone(db, id) {
    const o = P.findOrder(db, id);
    if (!o || !phoneOk(o)) return notFound('Không tìm thấy đơn này', 'Vào "Theo dõi đơn" và nhập số điện thoại đặt hàng để xem lại.');
    const m = P.money(o);
    return `<div class="wrap page"><div class="done-wrap"><section class="panel lead">
      <div class="done-mark">${ICON.check}</div>
      <h1 style="font-size:1.8rem">Đã đặt hàng ${esc(o.id)}</h1>
      <p class="muted" style="margin-top:8px">Cảm ơn ${esc(o.name)}. Bạn chọn <b>${esc(P.payLabel(o).toLowerCase())}</b>, chuyển khoản <b>${fmt.vnd(m.first)}</b> để shop báo xưởng in.</p>
      ${bankBlock(db, m.first, o.id)}
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
    if (!o) return notFound('Không tìm thấy đơn ' + id, 'Kiểm tra lại mã đơn, hoặc vào "Theo dõi đơn" để xem các đơn của bạn.');
    if (!phoneOk(o)) {
      return `<div class="wrap page">${trackForm(db, 'Xem đơn ' + esc(o.id), 'Nhập số điện thoại bạn dùng khi đặt đơn này để xem chi tiết.')}</div>`;
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
  function withOrder(fn) {
    const r = route();
    if (r.view !== 'order') return;
    P.update(d => { const o = P.findOrder(d, r.id); if (o && phoneOk(o)) fn(d, o); });
  }
  function toTop() { window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); }

  function addSelected() {
    const { v } = currentVariant();
    if (!v) return false;
    const min = +v.minQty || 1;
    if (ui.sel.qty < min) ui.sel.qty = min;
    P.addToCart(ui.sel.pid, ui.sel.vid, ui.sel.qty);
    return true;
  }

  root.addEventListener('click', e => {
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
      case 'img': ui.sel.img = i; render(); return;
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
        ui.sel.qty = Math.max(min, ui.sel.qty + (a === 'qty+' ? step : -step));
        render(); return;
      }
      case 'add': if (addSelected()) { P.ui.toast('Đã thêm vào giỏ hàng.'); render(); } return;
      case 'buy': if (addSelected()) go('gio-hang'); return;
      case 'cq-': case 'cq+':
        cartEdit(c => { const x = c[i]; if (x) x.qty += (a === 'cq+' ? 1 : -1) * (x.min >= 50 ? 10 : 1); }); return;
      case 'rm': cartEdit(c => { c[i] = null; }); P.ui.toast('Đã xóa khỏi giỏ hàng.'); return;
      case 'track-clear': P.setTrack(''); ui.trackErr = ''; go('theo-doi'); return;
      case 'cancel-ask': ui.confirm = route().id; render(); return;
      case 'cancel-no': ui.confirm = null; render(); return;
      case 'cancel-yes': withOrder((d, o) => P.act.cancel(d, o, 'Khách hủy đơn', 'customer')); ui.confirm = null; P.ui.toast('Đã hủy đơn.'); render(); return;
      case 'paid': withOrder((d, o) => P.act.notifyPaid(d, o)); P.ui.toast('Đã báo chuyển khoản. Shop sẽ xác nhận sớm.'); render(); return;
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
      const out = document.getElementById('pq-total');
      if (v && out) out.textContent = 'Thành tiền ' + fmt.vnd(v.price * ui.sel.qty);
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
      ui.sel.qty = Math.max(v ? (+v.minQty || 1) : 1, ui.sel.qty || 0);
      el.value = ui.sel.qty;
      const out = document.getElementById('pq-total');
      if (v && out) out.textContent = 'Thành tiền ' + fmt.vnd(v.price * ui.sel.qty);
      return;
    }
    if (el.classList.contains('cq')) {
      const i = +el.dataset.i;
      const q = parseInt(el.value.replace(/\D/g, ''), 10) || 0;
      const lines = P.cartLines(P.load());
      const c = lines.map(l => ({ pid: l.pid, vid: l.vid, qty: l.qty }));
      if (c[i]) { c[i].qty = Math.max(+lines[i].variant.minQty || 1, q); el.value = c[i].qty; }
      P.setCart(c);
      refreshCartNumbers();
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
      document.getElementById('pay-later').textContent = fmt.vnd(sub - o.amount);
    }
  });

  root.addEventListener('keydown', e => {
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
      if (r.view === 'order') {
        const o = P.findOrder(P.load(), r.id);
        if (o && P.normPhone(o.phone) !== phone) { setErr('tr-phone', 'Số điện thoại không khớp với đơn này.'); return; }
      }
      P.setTrack(phone);
      ui.trackErr = '';
      lastRoute = '';
      render();
      return;
    }

    if (f.id === 'chat-form') {
      const inp = document.getElementById('chat-input');
      const text = inp.value.trim();
      if (!text) return;
      withOrder((d, o) => P.act.sendMessage(d, o, 'customer', text));
      inp.value = '';
      render();
      const again = document.getElementById('chat-input'); if (again) again.focus();
      return;
    }

    if (f.id === 'refile-form') {
      const link = val('rf-link').trim();
      if (!P.isUrl(link)) { setErr('rf-link', 'Dán link bắt đầu bằng https://, ví dụ link Google Drive.'); return; }
      withOrder((d, o) => P.act.setFile(d, o, link));
      document.getElementById('rf-link').value = '';
      P.ui.toast('Đã cập nhật link file. Shop sẽ dùng file mới.');
      render();
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
      const o = P.update(d => {
        const lines = P.cartLines(d);
        if (!lines.length) return null;
        const sub = lines.reduce((a, l) => a + l.line, 0);
        const allowed = P.payOptions(d.settings, sub).map(x => x.pct);
        const c = P.act.upsertCustomer(d, info);
        return P.act.placeOrder(d, lines, Object.assign({}, info, { file: co.file, note: co.note || '', payPct: allowed.includes(picked) ? picked : 100 }), c.id);
      });
      if (!o) { render(); return; }
      P.setCart([]);
      setCo({ ship: info });
      P.setTrack(P.normPhone(info.phone));
      go('dat-xong-' + o.id);
    }
  });

  window.addEventListener('hashchange', () => {
    ui.confirm = null;
    render();
    window.scrollTo(0, 0);
  });
  P.loadLogo(() => render());
  P.onChange(() => render());
  render();
})();
