/* Pinya Printing · trang quản trị */
(() => {
  'use strict';
  const P = window.Pinya;
  const { fmt, esc, INKS, STATUSES, STATUS_ORDER, STAGES, SHIP_METHODS, SHIP_STAGES, CITIES, DAY } = P;
  const app = document.getElementById('app');
  const ROLE = 'admin';
  // Mật khẩu chỉ dùng cho bản chạy thử. Bản thật phải kiểm tra đăng nhập ở máy chủ.
  const DEMO_PASS = 'demo';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ui = {
    q: '', status: 'all', cat: 'all', customer: null,
    picked: new Set(), bulkTo: 'san_xuat', bulkAsk: false,
    lEdit: null, lDraft: null, lDel: null, lKg: '',
    jEdit: null, jDel: null, jq: '', oEdit: false, jDraft: null, jPre: null, jOpen: null, npPicked: new Set(),
    pq: '', pcat: 'all', pstate: 'all',
    confirm: null, draft: { id: null, images: [] },
    prod: null, prodDel: false,
    cEdit: null, cDel: null, fEdit: null, dataAsk: null,
    look: null,
    feEdit: null, feDraft: null, feDel: null,
    qk: { open: false, unit: 'cái', tiers: '50, 100, 200, 500, 1000', price: '', prefix: '', pname: '' }
  };
  let lastRoute = '';

  const REG = '<svg class="reg" viewBox="0 0 32 32" aria-hidden="true"><circle class="ln" cx="16" cy="16" r="10"/><circle class="dot" cx="16" cy="16" r="4.5"/><path class="ln" d="M16 1v30M1 16h30"/></svg>';
  const sum = (arr, f) => arr.reduce((a, x) => a + (f(x) || 0), 0);
  const custName = (db, id) => { const c = P.findCustomer(db, id); return c ? c.name : ''; };
  const catName = (db, id) => (P.findCategory(db, id) || {}).name || 'Chưa phân loại';

  // ==== Điều hướng ====
  function route() {
    const h = location.hash.replace(/^#/, '');
    if (h === 'don-hang') return { view: 'orders' };
    if (h === 'don-in') return { view: 'jobs' };
    if (h.indexOf('don-') === 0) return { view: 'order', id: h.slice(4) };
    if (h === 'san-pham') return { view: 'products' };
    if (h === 'sp-moi') return { view: 'product', id: '' };
    if (h.indexOf('sp-') === 0) return { view: 'product', id: h.slice(3) };
    if (h === 'danh-muc') return { view: 'categories' };
    if (h === 'xuong') return { view: 'factories' };
    if (h === 'logistics') return { view: 'logistics' };
    if (h === 'cai-dat') return { view: 'settings' };
    if (h === 'giao-dien') return { view: 'look' };
    return { view: 'overview' };
  }
  function go(hash) {
    if (location.hash === '#' + hash) render(); else location.hash = hash;
  }

  function snapshot() {
    const snap = {};
    app.querySelectorAll('input[id],textarea[id],select[id]').forEach(el => {
      if (el.type === 'file' || el.dataset.bind || el.dataset.nokeep) return;
      snap[el.id] = (el.type === 'radio' || el.type === 'checkbox') ? el.checked : el.value;
    });
    const a = document.activeElement;
    return { snap, focus: a && app.contains(a) && a.id ? a.id : null };
  }
  function restore(s) {
    Object.keys(s.snap).forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.type === 'radio' || el.type === 'checkbox') el.checked = s.snap[id];
      else if (el.tagName !== 'SELECT' || Array.from(el.options).some(o => o.value === s.snap[id])) el.value = s.snap[id];
    });
    if (s.focus) {
      const el = document.getElementById(s.focus);
      if (el) {
        el.focus({ preventScroll: true });
        if (el.setSelectionRange && /^(text|search|tel|url|email)$/.test(el.type)) {
          const n = el.value.length; try { el.setSelectionRange(n, n); } catch (e) {}
        }
      }
    }
  }

  // ==== Vẽ trang ====
  function render() {
    let db = P.load();
    const sess = P.getSession(ROLE);
    const r = route();
    const key = sess ? r.view + ':' + (r.id || '') : 'login';
    const keep = key === lastRoute ? snapshot() : null;
    lastRoute = key;

    if (!sess) {
      app.innerHTML = viewLogin(db);
      if (keep) restore(keep);
      return;
    }

    if (r.view === 'order') {
      const o = P.findOrder(db, r.id);
      if (o && o.unreadAdmin) {
        P.update(d => { const x = P.findOrder(d, r.id); if (x) P.act.markRead(d, x, 'admin'); });
        db = P.load();
      }
    }
    if (r.view === 'product') prepareDraft(db, r.id);
    if (r.view === 'look') prepareLook(db);
    if (r.view === 'jobs') prepareFee(db);
    // Trang Giao diện xem thử ngay bản nháp; các trang khác dùng bản đã lưu
    P.applyLook(r.view === 'look' && ui.look ? ui.look : db.settings.look);

    let body;
    switch (r.view) {
      case 'order': body = viewOrder(db, r.id); break;
      case 'orders': body = viewOrders(db); break;
      case 'products': body = viewProducts(db); break;
      case 'product': body = viewProduct(db); break;
      case 'categories': body = viewCategories(db); break;
      case 'factories': body = viewFactories(db); break;
      case 'logistics': prepareLogistic(db); body = viewLogistics(db); break;
      case 'jobs': body = viewJobs(db); break;
      case 'settings': body = viewSettings(db); break;
      case 'look': body = viewLook(db); break;
      default: body = viewOverview(db);
    }
    app.innerHTML = `<div class="adm">${side(db, r.view)}<main class="adm-main" id="main">${body}</main></div>`;
    document.title = 'Quản trị · ' + db.settings.shopName;
    if (keep) restore(keep);
    const thread = document.getElementById('thread');
    if (thread) thread.scrollTop = thread.scrollHeight;
  }

  function side(db, view) {
    const todo = db.orders.filter(o => P.adminNeeds(o, db).length).length;
    const cur = (...v) => v.includes(view) ? ' aria-current="page"' : '';
    const s = db.settings;
    return `<aside class="side">
      <a class="brand" href="#tong-quan" aria-label="${esc(s.shopName)}, tổng quan">${P.brandMark()}<span class="brand-word">${esc(s.shopName)}</span></a>
      <p class="side-tag">Quản trị</p>
      <nav class="side-nav" aria-label="Quản trị">
        <a href="#tong-quan"${cur('overview')}>Tổng quan</a>
        <a href="#don-hang"${cur('orders', 'order')}>Đơn hàng${todo ? ` <span class="count" aria-label="${todo} đơn cần xử lý">${todo}</span>` : ''}</a>
        <a href="#don-in"${cur('jobs')}>Đơn in</a>
        <a href="#san-pham"${cur('products', 'product')}>Sản phẩm</a>
        <a href="#danh-muc"${cur('categories')}>Danh mục</a>
        <a href="#xuong"${cur('factories')}>Xưởng</a>
        <a href="#logistics"${cur('logistics')}>Logistics</a>
        <a href="#giao-dien"${cur('look')}>Giao diện</a>
        <a href="#cai-dat"${cur('settings')}>Cài đặt</a>
      </nav>
      <div class="side-foot">
        <div class="side-user"><span class="avatar" aria-hidden="true">${P.logoSrc() ? `<img src="${esc(P.logoSrc())}" alt="">` : esc((s.adminName || 'A').trim().split(/\s+/).pop().charAt(0).toUpperCase())}</span>
          <div><b>${esc(s.adminName)}</b><small>${esc(s.adminEmail)}</small></div></div>
        <a href="index.html">Xem cửa hàng</a>
        <button class="link-btn" type="button" data-act="logout" style="justify-self:start;padding-left:0">Đăng xuất</button>
      </div>
    </aside>`;
  }

  // ==== Đăng nhập ====
  function viewLogin(db) {
    return `<div class="login"><div class="login-card">
      <a class="brand" href="index.html">${P.brandMark()}<span class="brand-word">${esc(db.settings.shopName)}</span></a>
      <h1>Đăng nhập quản trị</h1>
      <form id="login-form" novalidate>
        <div class="field"><label for="al-email">Email</label>
          <input id="al-email" type="email" autocomplete="username" aria-describedby="err-al-email"><p class="err" id="err-al-email"></p></div>
        <div class="field"><label for="al-pass">Mật khẩu</label>
          <input id="al-pass" type="password" autocomplete="current-password" aria-describedby="err-al-pass"><p class="err" id="err-al-pass"></p></div>
        <button class="btn btn-cta" type="submit">Đăng nhập</button>
      </form>
      <div class="login-alt"><span>Bản chạy thử: email <b>${esc(db.settings.adminEmail)}</b>, mật khẩu <b>demo</b>. Khi đưa lên mạng cần làm đăng nhập thật ở máy chủ.</span>
        <button class="btn btn-quiet btn-sm" type="button" data-act="fill-demo">Điền tài khoản mẫu</button></div>
      <div class="login-foot"><a href="index.html">← Về cửa hàng</a></div>
    </div></div>`;
  }

  // ==== Tổng quan ====
  function viewOverview(db) {
    const os = db.orders;
    const now = Date.now();
    const by = s => os.filter(o => o.status === s);
    const deposit = by('cho_coc');
    const notified = deposit.filter(o => o.paidNotice);
    const running = os.filter(o => ['san_xuat', 'van_chuyen'].includes(o.status));
    const recent = os.filter(o => o.paid1 && o.status !== 'huy' && now - o.createdAt < 30 * DAY);
    const sales = sum(recent, o => P.money(o).total);
    const deps = sum(recent, o => P.money(o).paid);
    const debt = sum(os.filter(o => o.paid1 && o.status !== 'huy'), o => P.money(o).remaining);

    const tasks = os.map(o => ({ o, needs: P.adminNeeds(o, db) })).filter(x => x.needs.length)
      .sort((a, b) => (b.o.status === 'cho_coc' && b.o.paidNotice ? 1 : 0) - (a.o.status === 'cho_coc' && a.o.paidNotice ? 1 : 0) || a.o.updatedAt - b.o.updatedAt);

    const best = db.products.map(p => ({ p, n: P.soldCount(db, p.id) })).filter(x => x.n).sort((a, b) => b.n - a.n).slice(0, 5);
    const today = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
    const pipe = STATUS_ORDER.filter(s => s !== 'huy').map(s =>
      `<a href="#don-hang" data-filter="${s}" class="${s === 'cho_coc' && notified.length ? 'act' : ''}"><b>${by(s).length}</b><span>${STATUSES[s].admin}</span></a>`).join('');

    return `<div class="page-head"><div><h1>Tổng quan</h1><p>${esc(today.charAt(0).toUpperCase() + today.slice(1))}</p></div>
        <a class="btn btn-cta btn-sm" href="#don-hang" data-filter="todo">Xem việc cần làm</a></div>
      <div class="tiles">
        <a class="tile${notified.length ? ' hot' : ''}" href="#don-hang" data-filter="cho_coc"><span class="lbl">Chờ thanh toán</span><b>${deposit.length}</b>
          ${notified.length ? `<span class="flag">${notified.length} khách báo đã chuyển</span>` : '<span class="sub">Đơn mới đặt</span>'}</a>
        <a class="tile" href="#don-hang" data-filter="san_xuat"><span class="lbl">Đang in</span><b>${by('san_xuat').length}</b><span class="sub">Đã nhận tiền</span></a>
        <a class="tile" href="#don-hang" data-filter="van_chuyen"><span class="lbl">Đang vận chuyển</span><b>${by('van_chuyen').length}</b><span class="sub">${running.length} đơn đang chạy</span></a>
        <a class="tile${os.some(o => o.status === 'da_giao' && !o.balancePaid) ? ' hot' : ''}" href="#don-hang" data-filter="todo"><span class="lbl">Việc cần làm</span><b>${tasks.length}</b><span class="sub">Xác nhận tiền, thu nốt, tin nhắn</span></a>
      </div>
      <div class="tiles three" style="margin-top:14px">
        <div class="tile"><span class="lbl">Doanh số đã chốt · 30 ngày</span><b>${fmt.vnd(sales)}</b><span class="sub">${recent.length} đơn đã thanh toán</span></div>
        <div class="tile"><span class="lbl">Tiền đã nhận · 30 ngày</span><b>${fmt.vnd(deps)}</b></div>
        <div class="tile"><span class="lbl">Còn phải thu</span><b>${fmt.vnd(debt)}</b><span class="sub">Phần còn lại của các đơn đã chạy</span></div>
      </div>
      <h2 class="sec-title" style="margin-top:28px">Đơn theo trạng thái</h2>
      <div class="pipe">${pipe}</div>
      <div class="two" style="margin-top:24px">
        <section class="panel"><div class="panel-h"><h2>Việc cần làm</h2><span class="muted">${tasks.length} việc</span></div>
          ${tasks.length ? `<ul class="tasks">${tasks.map(({ o, needs }) => `<li><a href="#don-${esc(o.id)}">
              <span class="t-title">${esc(P.orderTitle(o))}</span>
              <span class="t-why">${P.pill(o, 'admin')}<span class="hint">${esc(needs.join(' · '))}</span></span>
              <span class="t-meta"><span>${esc(o.id)}</span><span>${esc(o.name)}</span><span>${fmt.ago(o.updatedAt)}</span></span>
            </a></li>`).join('')}</ul>` : '<div class="empty"><h3>Không còn việc tồn</h3><p>Mọi đơn đang chờ khách hoặc đang chạy.</p></div>'}
        </section>
        <section class="panel"><div class="panel-h"><h2>Bán chạy</h2><a class="link-btn" href="#san-pham">Tất cả sản phẩm</a></div>
          ${best.length ? `<ul class="tasks">${best.map(({ p, n }) => `<li><a href="#sp-${esc(p.id)}"><span class="t-title">${esc(p.name)}</span>
              <span class="t-why"><b class="num">${fmt.num(n)}</b><span class="hint">đã đặt</span></span><span class="t-meta">${P.catTag(db, p.catId)}</span></a></li>`).join('')}</ul>`
            : '<p class="muted">Chưa có đơn nào.</p>'}
        </section>
      </div>`;
  }

  // ==== Đơn hàng ====
  const FILTERS = {
    all: { label: 'Tất cả', test: () => true },
    todo: { label: 'Cần xử lý', test: (o, db) => P.adminNeeds(o, db).length > 0 },
    noprint: { label: 'Chưa đặt in', test: (o, db) => P.needsPrint(db, o) },
    running: { label: 'Đang in, vận chuyển', test: o => ['san_xuat', 'van_chuyen'].includes(o.status) }
  };
  STATUS_ORDER.forEach(s => { FILTERS[s] = { label: STATUSES[s].admin, test: o => o.status === s }; });

  function viewOrders(db) {
    let list = db.orders.slice().sort((a, b) => b.updatedAt - a.updatedAt);
    if (ui.customer) list = list.filter(o => o.customerId === ui.customer);
    if (ui.cat !== 'all') list = list.filter(o => o.items.some(i => i.catId === ui.cat));
    const q = ui.q.trim().toLowerCase();
    if (q) list = list.filter(o => [o.id, o.name, o.phone, o.social, o.items.map(i => i.productName).join(' ')].join(' ').toLowerCase().includes(q));
    const counts = {};
    Object.keys(FILTERS).forEach(k => { counts[k] = list.filter(o => FILTERS[k].test(o, db)).length; });
    if (!FILTERS[ui.status]) ui.status = 'all';
    const shown = list.filter(o => FILTERS[ui.status].test(o, db));
    const chipKeys = ['all', 'todo'].concat(counts.noprint || ui.status === 'noprint' ? ['noprint'] : [], STATUS_ORDER.filter(s => counts[s] || ui.status === s));
    if (ui.status === 'running') chipKeys.splice(2, 0, 'running');
    const cust = ui.customer ? P.findCustomer(db, ui.customer) : null;

    // Chỉ giữ các đơn đang chọn mà vẫn còn hiện trong danh sách
    const shownIds = new Set(shown.map(o => o.id));
    ui.picked = new Set([...ui.picked].filter(id => shownIds.has(id)));
    const nPick = ui.picked.size;
    const allPicked = shown.length > 0 && nPick === shown.length;

    const rows = shown.map(o => {
      const needs = P.adminNeeds(o, db);
      const on = ui.picked.has(o.id);
      const job = P.jobForOrder(db, o.id);
      const m = P.money(o);
      const soc = P.shortSocial(o.social);
      const payTag = o.payPct >= 100 ? '<span class="tag-pay ckf">CKF</span>' : `<span class="tag-pay">Cọc ${o.payPct}%</span>`;
      const payNote = o.payPct >= 100
        ? (o.paid1 ? 'Đã nhận đủ' : 'Chưa chuyển khoản')
        : (o.paid1 ? 'Đã cọc ' + fmt.vnd(m.first) : 'Chưa cọc · cần ' + fmt.vnd(m.first));
      const items = o.items.map(it => `<span class="it-line">${esc(it.productName)} <b>× ${fmt.num(it.qty)}</b></span>`).join('');
      return `<tr data-href="#don-${esc(o.id)}"${on ? ' class="picked"' : ''}>
        <td class="pick"><input type="checkbox" class="o-pick" data-nokeep="1" data-id="${esc(o.id)}"${on ? ' checked' : ''} aria-label="Chọn đơn ${esc(o.id)}"></td>
        <td class="id"><a href="#don-${esc(o.id)}">${esc(o.id)}</a>${o.unreadAdmin ? '<span class="dot-new" title="Tin nhắn mới"></span>' : ''}<span class="sub">${fmt.date(o.createdAt)}</span></td>
        <td>${esc(o.name)}<span class="sub">${esc(fmt.phone(o.phone))}</span></td>
        <td>${soc ? (P.isUrl(o.social) ? `<a class="soc" href="${esc(o.social)}" target="_blank" rel="noopener" title="${esc(o.social)}">${esc(soc)}</a>` : `<span class="soc">${esc(soc)}</span>`) : '<span class="muted">—</span>'}</td>
        <td>${P.pill(o, 'admin')}${needs.length ? `<span class="sub${needs[0] === 'Chưa đặt in' ? ' warn-t' : ''}">${esc(needs[0])}</span>` : ''}${job ? `<span class="sub">In: ${esc(job.code)} · ${esc(P.jobStatus(job).label)}</span>` : ''}</td>
        <td class="items-cell">${items}</td>
        <td class="r"><b>${fmt.vnd(m.total)}</b> ${payTag}<span class="sub">${esc(payNote)}</span></td>
      </tr>`;
    }).join('');

    return `<div class="page-head"><div><h1>Đơn hàng</h1><p>${db.orders.length} đơn · ${counts.todo} đơn cần bạn xử lý</p></div></div>
      <div class="toolbar">
        <label class="sr-only" for="o-search">Tìm đơn</label>
        <input class="search" id="o-search" type="search" placeholder="Tìm mã đơn, tên khách, số điện thoại, sản phẩm…" value="${esc(ui.q)}" autocomplete="off">
        <label class="sr-only" for="o-cat">Danh mục</label>
        <select id="o-cat"><option value="all">Mọi danh mục</option>${db.categories.map(c => `<option value="${esc(c.id)}"${ui.cat === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
        ${cust ? `<button class="chip-btn" type="button" data-act="clear-customer" aria-pressed="true">Khách: ${esc(cust.name)} ✕</button>` : ''}
      </div>
      <div class="filters" role="group" aria-label="Lọc theo trạng thái">${chipKeys.map(k =>
        `<button class="chip-btn" type="button" data-act="status" data-v="${k}" aria-pressed="${ui.status === k}">${FILTERS[k].label} <span class="n">${counts[k]}</span></button>`).join('')}</div>
      ${shown.length ? `<div class="tbl-wrap tbl-scroll"><table class="tbl orders">
        <thead><tr><th class="pick"><input type="checkbox" id="o-all" data-nokeep="1"${allPicked ? ' checked' : ''} aria-label="Chọn tất cả ${shown.length} đơn đang hiện"></th><th>Mã đơn</th><th>Khách hàng</th><th>Mạng xã hội</th><th>Trạng thái</th><th>Sản phẩm</th><th class="r">Tổng đơn</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
        ${nPick ? `<div class="bulk" role="region" aria-label="Thao tác hàng loạt">
          <b>Đã chọn ${nPick} đơn</b>
          <label class="sr-only" for="bulk-status">Chuyển sang trạng thái</label>
          <select id="bulk-status" data-nokeep="1">${STATUS_ORDER.map(s => `<option value="${s}"${s === ui.bulkTo ? ' selected' : ''}>Chuyển sang: ${STATUSES[s].admin}</option>`).join('')}</select>
          ${ui.bulkAsk ? `<span class="bulk-ask">Đổi ${nPick} đơn sang “${esc(STATUSES[ui.bulkTo].admin)}”?</span>
            <button class="btn btn-cta btn-sm" type="button" data-act="bulk-yes">Đồng ý</button><button class="btn btn-quiet btn-sm" type="button" data-act="bulk-no">Thôi</button>`
            : `<button class="btn btn-cta btn-sm" type="button" data-act="bulk-ask">Áp dụng</button><button class="link-btn" type="button" data-act="bulk-clear">Bỏ chọn</button>`}
        </div>` : ''}`
      : '<div class="panel empty"><h3>Không có đơn phù hợp</h3><p>Thử bỏ bớt bộ lọc hoặc từ khóa tìm kiếm.</p></div>'}`;
  }

  // Đổi trạng thái hàng loạt: đi đúng nghiệp vụ của từng bước, không chỉ đổi nhãn
  function bulkApply(d, o, to) {
    if (o.status === to) return false;
    if (to === 'san_xuat' && o.status === 'cho_coc') P.act.confirmPayment(d, o);
    else if (to === 'van_chuyen' && o.status === 'san_xuat') P.act.startShipping(d, o, 'bo', '', null, 0);
    else if (to === 'da_giao' && o.status === 'van_chuyen') P.act.markDelivered(d, o);
    else if (to === 'huy') P.act.cancel(d, o, '', 'admin');
    else P.act.setStatus(d, o, to);
    return true;
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

  function gallery(images, removable, act) {
    return `<div class="gallery">${images.map((src, i) =>
      `<button type="button" data-act="${removable ? act : 'img'}" data-i="${i}" aria-label="${removable ? 'Bỏ ảnh ' + (i + 1) : 'Phóng to ảnh ' + (i + 1)}"${removable ? ` title="Bấm để bỏ ảnh này" class="rm${i === 0 && act === 'pimg-rm' ? ' cover' : ''}"` : ''}><img src="${esc(src)}" alt="Ảnh ${i + 1}"></button>`
    ).join('')}</div>`;
  }

  function factoryOptions(db, o, selected) {
    const cats = new Set(o.items.map(i => i.catId));
    const fit = db.factories.filter(f => f.cats.some(c => cats.has(c)));
    const other = db.factories.filter(f => !fit.includes(f));
    const opt = f => `<option value="${esc(f.id)}"${f.id === selected ? ' selected' : ''}>${esc(f.name)} · ${esc(f.city)}</option>`;
    return `<option value="">Chưa chọn xưởng</option>
      ${fit.length ? `<optgroup label="Phù hợp với đơn này">${fit.map(opt).join('')}</optgroup>` : ''}
      ${other.length ? `<optgroup label="Xưởng khác">${other.map(opt).join('')}</optgroup>` : ''}`;
  }

  function nextPanel(db, o) {
    const m = P.money(o);
    const fac = P.findFactory(db, o.factoryId);
    switch (o.status) {
      case 'cho_coc': {
        const old = !o.paidNotice && Date.now() - o.createdAt > 2 * DAY;
        return `<section class="panel lead"><div class="panel-h"><h2>Chờ khách thanh toán ${fmt.vnd(m.first)}</h2><span class="muted">${esc(P.payLabel(o))} · đặt ${fmt.ago(o.createdAt)}</span></div>
          ${o.paidNotice ? `<p class="note-box warn">Khách báo đã chuyển khoản lúc ${fmt.dateTime(o.paidNotice)}. Kiểm tra tài khoản trước khi xác nhận.</p>`
            : old ? '<p class="note-box warn">Đơn đặt hơn 2 ngày chưa thanh toán. Nhắn khách nhắc chuyển khoản.</p>'
            : '<p class="muted">Khách vừa đặt hàng, đang chờ chuyển khoản.</p>'}
          <dl class="kv" style="margin-top:12px"><dt>Số tiền</dt><dd class="num">${fmt.vnd(m.first)}</dd><dt>Nội dung</dt><dd>${esc(o.id)}</dd>
            <dt>Tài khoản</dt><dd>${esc(db.settings.bankName)} · ${esc(db.settings.bankNumber)}</dd></dl>
          <p class="hint" style="margin-top:10px">Trước khi xác nhận, mở link file của khách để chắc file in được.</p>
          <div class="actions"><button class="btn btn-cta btn-sm" type="button" data-act="pay-ok">Đã nhận tiền, bắt đầu in</button>
            ${P.isUrl(o.file) ? `<a class="btn btn-ghost btn-sm" href="${esc(o.file)}" target="_blank" rel="noopener">Mở file của khách</a>` : ''}</div></section>`;
      }
      case 'san_xuat': {
        const done = P.expectedDone(o);
        const late = done && Date.now() > done;
        return `<section class="panel lead"><div class="panel-h"><h2>Đang in hàng</h2>${late ? '<span class="pill off">Quá ngày dự kiến</span>' : ''}</div>
          <p>${fac ? 'Xưởng ' + esc(fac.name) + ' · ' : ''}bắt đầu ${fmt.date(o.produceStart)}${done ? ', dự kiến xong ' + fmt.date(done) : ''}.</p>
          <div class="form-grid" style="margin-top:14px">
            <div class="field"><label for="sh-wh">Kho trung chuyển</label><select id="sh-wh"><option value="">Chưa chọn kho</option>${(db.logistics || []).map(w => `<option value="${esc(w.id)}">${esc(w.name)}${w.route ? ' · ' + esc(w.route) : ''}</option>`).join('')}</select></div>
            <div class="field"><label for="sh-kg">Cân nặng</label><div class="unit"><input id="sh-kg" inputmode="decimal" autocomplete="off" placeholder="VD: 12,5"><span>kg</span></div></div>
            <div class="field"><label for="sh-method">Tuyến vận chuyển</label><select id="sh-method">${Object.keys(SHIP_METHODS).map(k => `<option value="${k}">${SHIP_METHODS[k].name}</option>`).join('')}</select></div>
            <div class="field"><label for="sh-track">Mã vận đơn</label><input id="sh-track" autocomplete="off" placeholder="VD: VC-90412"></div>
          </div>
          <p class="hint" id="sh-quote" aria-live="polite" style="margin-top:8px">Chọn kho và nhập cân nặng để xem phí ship theo bảng giá.</p>
          <div class="actions"><button class="btn btn-cta btn-sm" type="button" data-act="ship-start">Hàng rời xưởng, bắt đầu vận chuyển</button></div></section>`;
      }
      case 'van_chuyen': {
        const sh = o.shipping || { stage: 0, method: 'bo' };
        const eta = P.expectedArrival(o);
        return `<section class="panel lead"><div class="panel-h"><h2>Đang vận chuyển</h2><span class="muted">${(SHIP_METHODS[sh.method] || SHIP_METHODS.bo).name} · ${esc(sh.tracking || 'chưa có mã')}</span></div>
          <ol class="track">${SHIP_STAGES.map((st, i) => `<li class="${i < sh.stage ? 'done' : i === sh.stage ? 'now' : ''}"><i></i>${st}${i === 3 ? ' · ' + esc(o.city) : ''}</li>`).join('')}</ol>
          ${eta ? `<p class="muted">Dự kiến tới khách khoảng ${fmt.date(eta)}.</p>` : ''}
          ${sh.warehouseName ? `<p class="note-box" style="margin-top:10px">Kho ${esc(sh.warehouseName)}${sh.kg ? ' · ' + esc(fmt.num(sh.kg)) + ' kg' : ''}${sh.cost != null ? ' · phí ship ' + fmt.vnd(sh.cost) + ' (chi phí của shop, khách không thấy)' : ''}</p>` : ''}
          <div class="actions">
            ${sh.stage < 3 ? `<button class="btn btn-ghost btn-sm" type="button" data-act="ship-next">Cập nhật: ${SHIP_STAGES[sh.stage + 1]}</button>` : ''}
            <button class="btn ${sh.stage >= 3 ? 'btn-cta' : 'btn-quiet'} btn-sm" type="button" data-act="delivered">Đánh dấu đã giao</button>
          </div></section>`;
      }
      case 'da_giao':
        return o.balancePaid
          ? `<section class="panel lead"><div class="panel-h"><h2>Đơn hoàn tất</h2><span class="pill ok">Đã thu đủ</span></div><p>Giao ngày ${o.deliveredAt ? fmt.date(o.deliveredAt) : ''}, khách đã thanh toán đủ ${fmt.vnd(m.total)}.</p></section>`
          : `<section class="panel lead"><div class="panel-h"><h2>Thu phần còn lại</h2></div><p>Đã giao ngày ${o.deliveredAt ? fmt.date(o.deliveredAt) : ''}. Còn phải thu <b>${fmt.vnd(m.remaining)}</b>.</p>
            <div class="actions"><button class="btn btn-cta btn-sm" type="button" data-act="balance-ok">Xác nhận đã thanh toán đủ</button></div></section>`;
      case 'huy':
        return `<section class="panel lead"><div class="panel-h"><h2>Đơn đã hủy</h2></div>${o.cancelReason ? `<p class="muted">Lý do: ${esc(o.cancelReason)}</p>` : ''}
          <div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="reopen">Mở lại đơn</button></div></section>`;
    }
    return '';
  }

  function itemsPanel(o) {
    const m = P.money(o);
    const editable = !['da_giao', 'huy'].includes(o.status) && !o.balancePaid;
    return `<section class="panel"><div class="panel-h"><h2>Sản phẩm</h2></div><table class="items"><tbody>
      ${o.items.map(it => `<tr><td><span class="it-name">${esc(it.productName)}</span><small>${esc(it.variantName)}</small></td>
        <td class="r">${fmt.num(it.qty)} × ${fmt.vnd(it.price)}</td><td class="r"><b>${fmt.vnd(it.qty * it.price)}</b></td></tr>`).join('')}
      ${o.extraFee ? `<tr><td colspan="2">Phụ phí${o.extraNote ? `<small>${esc(o.extraNote)}</small>` : ''}</td><td class="r"><b>${fmt.vnd(o.extraFee)}</b></td></tr>` : ''}
    </tbody></table>
    <table class="money"><tbody><tr class="total"><td>Tổng</td><td>${fmt.vnd(m.total)}</td></tr></tbody></table>
    ${editable ? `<form id="fee-form" class="form-grid" style="margin-top:14px" novalidate>
      <div class="field"><label for="fee-amt">Phụ phí</label><div class="unit"><input id="fee-amt" inputmode="numeric" autocomplete="off" value="${o.extraFee ? esc(fmt.num(o.extraFee)) : ''}" placeholder="0"><span>₫</span></div></div>
      <div class="field"><label for="fee-note">Lý do</label><input id="fee-note" autocomplete="off" value="${esc(o.extraNote || '')}" placeholder="VD: Chỉnh file, ship hỏa tốc"></div>
      <div class="full"><button class="btn btn-quiet btn-sm" type="submit">Lưu phụ phí</button>${o.paid1 ? ' <span class="hint">Số tiền khách đã trả giữ nguyên, phụ phí cộng vào phần còn phải thu.</span>' : ''}</div>
    </form>` : ''}</section>`;
  }

  function infoPanel(o) {
    const rows = [
      ['Người nhận', `${esc(o.name)} · <span class="copy-line" style="display:inline-flex"><b id="cp-phone">${esc(fmt.phone(o.phone))}</b><button class="copy-mini" type="button" data-copy-value="${esc(o.phone)}" data-copy-target="cp-phone">Sao chép</button></span>`],
      ['Mạng xã hội', P.isUrl(o.social) ? `<a href="${esc(o.social)}" target="_blank" rel="noopener">${esc(o.social)}</a>` : esc(o.social)],
      ['Địa chỉ', esc([o.address, o.city].filter(Boolean).join(', '))],
      ['Ghi chú', esc(o.note)]
    ].filter(r => r[1]);
    return `<section class="panel"><div class="panel-h"><h2>File thiết kế</h2></div>
        ${P.isUrl(o.file) ? `<p class="copy-line" style="overflow-wrap:anywhere"><a href="${esc(o.file)}" target="_blank" rel="noopener">${esc(o.file)}</a></p>
          <div class="actions" style="margin-top:10px"><a class="btn btn-ghost btn-sm" href="${esc(o.file)}" target="_blank" rel="noopener">Mở file</a>
          <button class="copy-mini" type="button" data-copy-value="${esc(o.file)}">Sao chép link</button></div>` : '<p class="note-box warn">Khách chưa gửi link file. Nhắn khách gửi qua khung tin nhắn.</p>'}
      </section>
      <section class="panel"><div class="panel-h"><h2>Giao hàng</h2><button class="link-btn" type="button" data-act="customer-orders" data-id="${esc(o.customerId)}">Các đơn của khách này</button></div>
      <dl class="kv">${rows.map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('')}</dl></section>`;
  }

  function paymentPanel(o) {
    const m = P.money(o);
    const ok = '<span class="pill ok">Đã nhận</span>';
    const rows = o.payPct >= 100
      ? `<tr><td>Thanh toán 100% ${o.paid1 ? ok : ''}</td><td>${fmt.vnd(m.first)}</td></tr>
         ${m.total > m.first ? `<tr><td>Phụ phí phát sinh ${o.balancePaid ? ok : ''}</td><td>${fmt.vnd(m.total - m.first)}</td></tr>` : ''}`
      : `<tr><td>Đặt cọc ${o.payPct}% ${o.paid1 ? ok : ''}</td><td>${fmt.vnd(m.first)}</td></tr>
         <tr><td>Thu khi giao hàng ${o.balancePaid ? ok : ''}</td><td>${fmt.vnd(m.total - m.first)}</td></tr>`;
    return `<section class="panel"><div class="panel-h"><h2>Thanh toán</h2><span class="muted">Khách chọn ${esc(P.payLabel(o).toLowerCase())}</span></div><table class="money"><tbody>
      <tr><td>Tổng đơn</td><td>${fmt.vnd(m.total)}</td></tr>${rows}
      <tr class="total"><td>Còn phải thu</td><td>${fmt.vnd(m.remaining)}</td></tr>
    </tbody></table></section>`;
  }

  function factoryPanel(db, o) {
    const f = P.findFactory(db, o.factoryId);
    return `<section class="panel"><div class="panel-h"><h2>Xưởng phụ trách</h2></div>
      <div class="field"><label class="sr-only" for="fac-select">Xưởng</label><select id="fac-select">${factoryOptions(db, o, o.factoryId)}</select></div>
      ${f ? `<dl class="kv" style="margin-top:12px"><dt>Tên</dt><dd>${esc(f.name)} <span style="font-family:var(--font-cjk)">${esc(f.cn)}</span></dd>
        <dt>Khu vực</dt><dd>${esc(f.city)} <span style="font-family:var(--font-cjk)">${esc(CITIES[f.city] || '')}</span></dd><dt>Liên hệ</dt><dd>${esc(f.contact)}</dd></dl>` : ''}
    </section>`;
  }

  function messagesPanel(db, o) {
    const msgs = o.messages.length
      ? o.messages.map(m => `<div class="msg ${m.from === 'admin' ? 'me' : ''}">${esc(m.text)}<small>${m.from === 'admin' ? esc(db.settings.adminName) : esc(o.name)} · ${fmt.dateTime(m.at)}</small></div>`).join('')
      : '<p class="muted">Chưa có tin nhắn với khách về đơn này.</p>';
    return `<section class="panel"><div class="panel-h"><h2>Nhắn khách</h2></div>
      <div class="thread" id="thread" aria-live="polite">${msgs}</div>
      <form class="composer" id="chat-form"><label class="sr-only" for="chat-input">Tin nhắn cho khách</label>
        <textarea id="chat-input" rows="1" placeholder="Nhắn cho ${esc(o.name)}…"></textarea>
        <button class="btn btn-cta btn-sm" type="submit">Gửi</button></form></section>`;
  }

  function historyPanel(o) {
    return `<section class="panel"><div class="panel-h"><h2>Lịch sử</h2></div><ol class="hist">${o.history.slice().reverse().map(h =>
      `<li class="by-${h.by}"><div>${esc(h.text)}<time>${h.by === 'admin' ? 'Shop' : 'Khách'} · ${fmt.dateTime(h.at)}</time></div></li>`).join('')}</ol></section>`;
  }

  function morePanel(o) {
    const cancel = o.status === 'huy' ? '' : (ui.confirm === o.id
      ? `<div class="confirm"><p>Hủy đơn ${esc(o.id)}?</p>
          <div class="field"><label for="cx-reason">Lý do (khách sẽ thấy)</label><input id="cx-reason" autocomplete="off" placeholder="VD: Khách đổi ý, hết hàng"></div>
          <div class="actions" style="margin-top:0"><button class="btn btn-danger btn-sm" type="button" data-act="cancel-yes">Hủy đơn</button>
          <button class="btn btn-quiet btn-sm" type="button" data-act="cancel-no">Không</button></div></div>`
      : '<button class="btn btn-danger btn-sm" type="button" data-act="cancel-ask">Hủy đơn</button>');
    return `<section class="panel"><div class="panel-h"><h2>Thao tác khác</h2></div>
      <div class="field"><label for="ms-status">Đổi trạng thái thủ công</label>
        <div class="composer" style="margin-top:0"><select id="ms-status" style="flex:1">${STATUS_ORDER.map(s => `<option value="${s}"${s === o.status ? ' selected' : ''}>${STATUSES[s].admin}</option>`).join('')}</select>
        <button class="btn btn-quiet btn-sm" type="button" data-act="set-status">Đổi</button></div>
        <p class="hint">Chỉ dùng khi cần sửa sai. Bình thường hãy dùng nút ở bước hiện tại.</p></div>
      <div style="margin-top:14px">${cancel}</div></section>`;
  }

  function editOrderForm(db, o) {
    const f = (id, label, value, attrs, full) =>
      `<div class="field${full ? ' full' : ''}"><label for="${id}">${label}</label><input id="${id}" value="${esc(value || '')}" autocomplete="off"${attrs || ''} aria-describedby="err-${id}"><p class="err" id="err-${id}"></p></div>`;
    const sub = o.items.reduce((a, it) => a + it.price * it.qty, 0);
    const opts = P.payOptions(db.settings, sub).map(x => x.pct);
    if (!opts.includes(o.payPct)) opts.push(o.payPct);
    return `<form id="oe-form" class="panel lead" novalidate>
      <div class="panel-h"><h2>Sửa đơn ${esc(o.id)}</h2><span class="muted">Mọi thay đổi được ghi vào lịch sử đơn</span></div>
      <h3 class="sec-title">Khách hàng</h3>
      <div class="form-grid">
        ${f('oe-name', 'Họ tên', o.name)}
        ${f('oe-phone', 'Số điện thoại', fmt.phone(o.phone), ' type="tel" inputmode="tel"')}
        ${f('oe-social', 'Link mạng xã hội', o.social, ' type="url"', true)}
        ${f('oe-address', 'Địa chỉ nhận hàng', o.address)}
        <div class="field"><label for="oe-city">Tỉnh, thành</label><select id="oe-city">${P.DEST.concat(P.DEST.includes(o.city) ? [] : [o.city]).map(d => `<option${d === o.city ? ' selected' : ''}>${esc(d)}</option>`).join('')}</select></div>
        ${f('oe-file', 'Link file thiết kế', o.file, ' type="url"', true)}
        <div class="field full"><label for="oe-note">Ghi chú</label><textarea id="oe-note" rows="2">${esc(o.note || '')}</textarea></div>
      </div>
      <h3 class="sec-title">Sản phẩm</h3>
      <div class="vrows">${o.items.map((it, i) => `<div class="vrow oe-row">
        <div class="field"><span class="lbl">${esc(it.productName)}</span><span class="hint">${esc(it.variantName)}</span></div>
        <div class="field"><label for="oe-qty-${i}">Số lượng</label><input id="oe-qty-${i}" value="${esc(it.qty)}" inputmode="numeric" autocomplete="off"></div>
        <div class="field"><label for="oe-price-${i}">Đơn giá</label><div class="unit"><input id="oe-price-${i}" value="${esc(fmt.num(it.price))}" inputmode="numeric" autocomplete="off"><span>₫</span></div></div>
      </div>`).join('')}</div>
      <div class="form-grid" style="margin-top:14px">
        <div class="field"><label for="oe-pay">Cách thanh toán</label><select id="oe-pay"${o.paid1 ? ' disabled' : ''}>${opts.map(p => `<option value="${p}"${p === o.payPct ? ' selected' : ''}>${p >= 100 ? 'Thanh toán 100% (CKF)' : 'Đặt cọc ' + p + '%'}</option>`).join('')}</select>
          ${o.paid1 ? '<p class="hint">Khách đã chuyển tiền nên không đổi cách thanh toán được.</p>' : ''}</div>
      </div>
      <div class="actions"><button class="btn btn-cta btn-sm" type="submit">Lưu thay đổi</button><button class="link-btn" type="button" data-act="oe-cancel">Thôi</button></div>
    </form>`;
  }

  function viewOrder(db, id) {
    const o = P.findOrder(db, id);
    if (!o) return `<a class="back" href="#don-hang">← Đơn hàng</a><div class="panel empty"><h3>Không tìm thấy đơn ${esc(id)}</h3></div>`;
    return `<a class="back" href="#don-hang">← Đơn hàng</a>
      <div class="page-head"><div><p class="eyebrow">${esc(o.id)}</p><h1>${esc(P.orderTitle(o))}</h1>
        <p>${esc(o.name)} · Đặt ${fmt.dateTime(o.createdAt)}</p></div>
        <div class="actions" style="margin-top:0">${P.pill(o, 'admin')}${ui.oEdit ? '' : '<button class="btn btn-ghost btn-sm" type="button" data-act="oe-open">Sửa đơn</button>'}</div></div>
      ${stepper(o)}
      <div class="detail">
        <div class="stack">${ui.oEdit ? editOrderForm(db, o) : ''}${nextPanel(db, o)}${itemsPanel(o)}${infoPanel(o)}</div>
        <div class="stack">${jobPanel(db, o)}${messagesPanel(db, o)}${paymentPanel(o)}${factoryPanel(db, o)}${historyPanel(o)}${morePanel(o)}</div>
      </div>`;
  }

  // ==== Sản phẩm ====
  function viewProducts(db) {
    let list = db.products.slice();
    if (ui.pcat !== 'all') list = list.filter(p => p.catId === ui.pcat);
    if (ui.pstate !== 'all') list = list.filter(p => (ui.pstate === 'on') === !!p.active);
    const q = ui.pq.trim().toLowerCase();
    if (q) list = list.filter(p => (p.name + ' ' + p.variants.map(v => v.name).join(' ')).toLowerCase().includes(q));
    const demo = db.products.filter(p => p.demo).length;
    const countIn = id => db.products.filter(p => p.catId === id).length;

    const rows = list.map(p => {
      const pr = P.priceRange(p);
      return `<tr data-href="#sp-${esc(p.id)}">
        <td>${P.thumb(db, p, 'pimg')}</td>
        <td><b>${esc(p.name)}</b>${p.demo ? '<span class="tag-demo">Mẫu</span>' : ''}<span class="sub">${esc(catName(db, p.catId))}</span></td>
        <td class="r">${p.variants.length ? (pr.min === pr.max ? fmt.vnd(pr.min) : fmt.vnd(pr.min) + ' – ' + fmt.vnd(pr.max)) : '<span class="muted">Chưa có giá</span>'}</td>
        <td>${p.active ? '<span class="pill ok">Đang bán</span>' : '<span class="pill">Đang ẩn</span>'}</td>
        <td class="r">${p.variants.length}</td>
        <td class="r">${fmt.num(P.soldCount(db, p.id))}</td>
      </tr>`;
    }).join('');

    return `<div class="page-head"><div><h1>Sản phẩm</h1><p>${db.products.length} sản phẩm · ${db.products.filter(p => p.active).length} đang bán</p></div>
        <a class="btn btn-cta btn-sm" href="#sp-moi">Thêm sản phẩm</a></div>
      ${demo ? `<p class="note-box" style="margin-bottom:16px">Đang có ${demo} sản phẩm mẫu để xem thử, giá chỉ là ví dụ. Sửa thành sản phẩm thật, hoặc xóa hết ở <a href="#cai-dat">Cài đặt</a>.</p>` : ''}
      <div class="toolbar">
        <label class="sr-only" for="p-search">Tìm sản phẩm</label>
        <input class="search" id="p-search" type="search" placeholder="Tìm tên sản phẩm, phân loại…" value="${esc(ui.pq)}" autocomplete="off">
        <label class="sr-only" for="p-state">Trạng thái</label>
        <select id="p-state"><option value="all">Mọi trạng thái</option><option value="on"${ui.pstate === 'on' ? ' selected' : ''}>Đang bán</option><option value="off"${ui.pstate === 'off' ? ' selected' : ''}>Đang ẩn</option></select>
      </div>
      <div class="filters" role="group" aria-label="Lọc theo danh mục">
        <button class="chip-btn" type="button" data-act="pcat" data-v="all" aria-pressed="${ui.pcat === 'all'}">Tất cả <span class="n">${db.products.length}</span></button>
        ${db.categories.map(c => `<button class="chip-btn" type="button" data-act="pcat" data-v="${esc(c.id)}" data-ink="${esc(c.ink)}" aria-pressed="${ui.pcat === c.id}"><i></i>${esc(c.name)} <span class="n">${countIn(c.id)}</span></button>`).join('')}
      </div>
      ${list.length ? `<div class="tbl-wrap"><table class="tbl prods">
        <thead><tr><th class="th-img"><span class="sr-only">Ảnh</span></th><th>Sản phẩm</th><th class="r">Giá</th><th>Trạng thái</th><th class="r">Phân loại</th><th class="r">Đã đặt</th></tr></thead>
        <tbody>${rows}</tbody></table></div>`
      : `<div class="panel empty"><h3>${db.products.length ? 'Không có sản phẩm phù hợp' : 'Chưa có sản phẩm nào'}</h3><p>${db.products.length ? 'Thử bỏ bớt bộ lọc.' : 'Thêm sản phẩm đầu tiên, rồi thêm các phân loại và giá.'}</p><a class="btn btn-cta btn-sm" href="#sp-moi">Thêm sản phẩm</a></div>`}`;
  }

  // Tạo nhanh phân loại theo số lượng. Mẫu dùng chung; phân loại thêm tay chỉ ở sản phẩm này.
  function quickBox(db) {
    const q = ui.qk;
    const b = 'data-nokeep="1"';
    const presets = P.qtyPresets(db).map(x => `<span class="qchip"><button type="button" class="chip-btn" data-act="qk-preset" data-id="${esc(x.id)}">${esc(x.name)} <span class="n">${x.tiers.map(n => fmt.num(n)).join(' · ')}</span></button>${x.builtin ? '' : `<button type="button" class="qdel" data-act="qk-del" data-id="${esc(x.id)}" aria-label="Xóa mẫu ${esc(x.name)}">×</button>`}</span>`).join('');
    return `<div class="qk">
      <button class="btn btn-ghost btn-sm" type="button" data-act="qk-toggle" aria-expanded="${q.open}">Tạo nhanh theo số lượng</button>
      ${q.open ? `<div class="qk-body">
        <p class="hint">Chọn một mẫu số lượng hoặc tự nhập các mức, web tạo sẵn từng phân loại. Giá mỗi phân loại là giá cả gói, khách chọn phân loại rồi chọn số gói.</p>
        <div class="qchips" role="group" aria-label="Mẫu số lượng">${presets}</div>
        <div class="form-grid">
          <div class="field full"><label for="qk-tiers">Các mức số lượng (cách nhau bằng dấu phẩy)</label><input id="qk-tiers" ${b} data-qk="tiers" value="${esc(q.tiers)}" autocomplete="off" placeholder="50, 100, 200, 500, 1000"></div>
          <div class="field"><label for="qk-unit">Đơn vị</label><input id="qk-unit" ${b} data-qk="unit" value="${esc(q.unit)}" autocomplete="off" placeholder="cái, tờ, bộ…"></div>
          <div class="field"><label for="qk-price">Đơn giá mỗi cái (không bắt buộc)</label><div class="unit"><input id="qk-price" ${b} data-qk="price" value="${esc(q.price)}" inputmode="numeric" autocomplete="off" placeholder="Để trống nếu nhập giá sau"><span>₫</span></div></div>
          <div class="field full"><label for="qk-prefix">Ghi thêm vào tên (không bắt buộc)</label><input id="qk-prefix" ${b} data-qk="prefix" value="${esc(q.prefix)}" autocomplete="off" placeholder="VD: In 2 mặt"></div>
        </div>
        <p class="hint" id="qk-out" aria-live="polite">${qkText()}</p>
        <p class="err" id="err-qk"></p>
        <div class="actions" style="margin-top:8px"><button class="btn btn-cta btn-sm" type="button" data-act="qk-gen">Tạo phân loại</button>
          <input class="qk-name" id="qk-pname" ${b} data-qk="pname" value="${esc(q.pname)}" autocomplete="off" placeholder="Tên mẫu mới" aria-label="Tên mẫu mới">
          <button class="btn btn-quiet btn-sm" type="button" data-act="qk-save">Lưu các mức này thành mẫu</button></div>
      </div>` : ''}</div>`;
  }
  function qkText() {
    const q = ui.qk;
    const t = P.parseTiers(q.tiers);
    if (!t.length) return 'Nhập ít nhất một mức số lượng.';
    return 'Sẽ tạo ' + t.length + ' phân loại: ' + P.qtyVariants(t, q.unit, P.parseNum(q.price), q.prefix).map(v => v.name + (v.price !== '' ? ' (' + fmt.vnd(v.price) + ')' : '')).join(', ') + '.';
  }

  function newVariant() { return { id: P.uid('v'), name: '', price: '', minQty: 1 }; }

  function prepareDraft(db, id) {
    const key = id || 'new';
    if (ui.prod && ui.prod._key === key) return;
    ui.prodDel = false;
    if (id) {
      const p = P.findProduct(db, id);
      ui.prod = p ? JSON.parse(JSON.stringify(p)) : null;
      if (ui.prod) ui.prod._key = key;
    } else {
      ui.prod = { _key: key, _new: true, id: P.uid('sp'), catId: ui.pcat !== 'all' ? ui.pcat : ((db.categories[0] || {}).id || ''), name: '', desc: '', leadDays: 7, variants: [newVariant()], images: [], active: true };
    }
  }

  function viewProduct(db) {
    const p = ui.prod;
    if (!p) return `<a class="back" href="#san-pham">← Sản phẩm</a><div class="panel empty"><h3>Không tìm thấy sản phẩm</h3><p>Sản phẩm có thể đã bị xóa.</p></div>`;
    if (!db.categories.length) {
      return `<a class="back" href="#san-pham">← Sản phẩm</a><div class="panel empty"><h3>Cần có danh mục trước</h3><p>Tạo ít nhất một danh mục để xếp sản phẩm vào.</p><a class="btn btn-cta btn-sm" href="#danh-muc">Tạo danh mục</a></div>`;
    }
    const b = 'data-bind="1"';
    const vrows = p.variants.map((v, i) => `<div class="vrow">
        <div class="field"><label for="pv-name-${v.id}">Tên phân loại</label><input id="pv-name-${v.id}" ${b} data-v="${v.id}" data-k="name" value="${esc(v.name)}" autocomplete="off" placeholder="VD: 6 × 6 cm · in 2 mặt"></div>
        <div class="field"><label for="pv-price-${v.id}">Giá</label><div class="unit"><input id="pv-price-${v.id}" ${b} data-v="${v.id}" data-k="price" value="${v.price === '' ? '' : esc(fmt.num(v.price))}" inputmode="numeric" autocomplete="off" placeholder="0"><span>₫</span></div></div>
        <div class="field"><label for="pv-min-${v.id}">SL tối thiểu</label><input id="pv-min-${v.id}" ${b} data-v="${v.id}" data-k="minQty" value="${esc(v.minQty)}" inputmode="numeric" autocomplete="off"></div>
        <button class="icon-btn" type="button" data-act="v-rm" data-id="${v.id}" aria-label="Xóa phân loại ${i + 1}"${p.variants.length < 2 ? ' disabled' : ''}>×</button>
      </div>`).join('');
    const live = !p._new && p.active;
    return `<a class="back" href="#san-pham">← Sản phẩm</a>
      <div class="page-head"><div><h1>${p._new ? 'Thêm sản phẩm' : esc(p.name || 'Sửa sản phẩm')}</h1>${p.demo ? '<p>Sản phẩm mẫu, giá chỉ là ví dụ.</p>' : ''}</div>
        ${live ? `<a class="btn btn-ghost btn-sm" href="index.html#sp-${esc(p.id)}">Xem trên cửa hàng</a>` : ''}</div>
      <form id="prod-form" class="detail" novalidate>
        <div class="stack">
          <section class="panel"><div class="panel-h"><h2>Thông tin</h2></div>
            <div class="form-grid">
              <div class="field full"><label for="pf-name">Tên sản phẩm <span class="req" aria-hidden="true">*</span></label>
                <input id="pf-name" ${b} data-k="name" value="${esc(p.name)}" autocomplete="off" placeholder="VD: Móc khóa acrylic" aria-describedby="err-pf-name"><p class="err" id="err-pf-name"></p></div>
              <div class="field"><label for="pf-cat">Danh mục <span class="req" aria-hidden="true">*</span></label>
                <select id="pf-cat" ${b} data-k="catId">${db.categories.map(c => `<option value="${esc(c.id)}"${c.id === p.catId ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
              <div class="field"><label for="pf-lead">Thời gian sản xuất</label><div class="unit"><input id="pf-lead" ${b} data-k="leadDays" value="${esc(p.leadDays || '')}" inputmode="numeric" autocomplete="off"><span>ngày</span></div></div>
              <div class="field full"><label for="pf-desc">Mô tả</label>
                <textarea id="pf-desc" ${b} data-k="desc" rows="4" placeholder="Chất liệu, kỹ thuật in, lưu ý khi gửi file…">${esc(p.desc)}</textarea></div>
            </div>
          </section>
          <section class="panel"><div class="panel-h"><h2>Phân loại và giá</h2><span class="muted">${p.variants.length} phân loại</span></div>
            <p class="hint" style="margin-bottom:12px">Mỗi phân loại có giá riêng, ví dụ theo kích thước, chất liệu, số mặt in. Phân loại thêm tay ở đây chỉ thuộc sản phẩm này, không lưu cho sản phẩm khác.</p>
            ${quickBox(db)}
            <div class="vrows">${vrows}</div>
            <p class="err" id="err-pf-variants" style="margin-top:8px"></p>
            <div class="actions" style="margin-top:12px"><button class="btn btn-quiet btn-sm" type="button" data-act="v-add">+ Thêm phân loại</button></div>
          </section>
        </div>
        <div class="stack">
          <section class="panel"><div class="panel-h"><h2>Ảnh sản phẩm</h2></div>
            ${p.images.length ? gallery(p.images, true, 'pimg-rm') + '<p class="hint">Ảnh đầu tiên là ảnh bìa. Bấm vào ảnh để bỏ.</p>' : '<p class="muted">Chưa có ảnh. Cửa hàng sẽ hiện ô màu theo danh mục.</p>'}
            <div class="actions" style="margin-top:10px">
              <input id="pimg-files" type="file" accept="image/*" multiple class="sr-only file-in">
              <label class="btn btn-quiet btn-sm" for="pimg-files">Thêm ảnh</label>
            </div>
          </section>
          <section class="panel"><div class="panel-h"><h2>Trạng thái</h2></div>
            <div class="checks">
              <label class="check"><input type="radio" name="pf-active" value="1" data-act-radio="active"${p.active ? ' checked' : ''}>Đang bán</label>
              <label class="check"><input type="radio" name="pf-active" value="0" data-act-radio="active"${p.active ? '' : ' checked'}>Ẩn khỏi cửa hàng</label>
            </div>
          </section>
          <section class="panel">
            <div class="actions" style="margin-top:0"><button class="btn btn-cta" type="submit">${p._new ? 'Thêm sản phẩm' : 'Lưu thay đổi'}</button><a class="link-btn" href="#san-pham">Thôi</a></div>
            ${p._new ? '' : (ui.prodDel
              ? `<div class="confirm"><p>Xóa sản phẩm “${esc(p.name)}”? Đơn đã đặt vẫn giữ thông tin sản phẩm.</p><div class="actions" style="margin-top:0">
                  <button class="btn btn-danger btn-sm" type="button" data-act="p-del-yes">Xóa sản phẩm</button><button class="btn btn-quiet btn-sm" type="button" data-act="p-del-no">Không</button></div></div>`
              : '<div class="actions"><button class="btn btn-danger btn-sm" type="button" data-act="p-del-ask">Xóa sản phẩm</button></div>')}
          </section>
        </div>
      </form>`;
  }

  // ==== Danh mục ====
  function categoryForm(db) {
    const c = ui.cEdit === 'new' ? { name: '', desc: '', ink: 'c' } : (P.findCategory(db, ui.cEdit) || { name: '', desc: '', ink: 'c' });
    return `<form id="c-form" class="panel" novalidate style="margin-bottom:20px">
      <div class="panel-h"><h2>${ui.cEdit === 'new' ? 'Thêm danh mục' : 'Sửa danh mục ' + esc(c.name)}</h2></div>
      <div class="form-grid">
        <div class="field"><label for="cf-name">Tên danh mục <span class="req" aria-hidden="true">*</span></label><input id="cf-name" value="${esc(c.name)}" autocomplete="off" placeholder="VD: In decal" aria-describedby="err-cf-name"><p class="err" id="err-cf-name"></p></div>
        <div class="field"><label for="cf-desc">Mô tả ngắn</label><input id="cf-desc" value="${esc(c.desc)}" autocomplete="off" placeholder="VD: Tem nhãn, sticker, decal dán"></div>
        <fieldset class="field full cat-pick"><legend>Màu</legend><div class="swatches">${Object.keys(INKS).map(k =>
          `<label class="swatch" data-ink="${k}"><input type="radio" name="cf-ink" id="cf-ink-${k}" value="${k}"${c.ink === k ? ' checked' : ''}><i></i>${INKS[k]}</label>`).join('')}</div></fieldset>
      </div>
      <div class="actions"><button class="btn btn-cta btn-sm" type="submit">${ui.cEdit === 'new' ? 'Thêm danh mục' : 'Lưu danh mục'}</button><button class="link-btn" type="button" data-act="c-cancel">Thôi</button></div>
    </form>`;
  }

  function viewCategories(db) {
    const n = id => db.products.filter(p => p.catId === id).length;
    const last = db.categories.length - 1;
    const rows = db.categories.map((c, i) => {
      const count = n(c.id);
      const del = ui.cDel === c.id
        ? `<div class="confirm" style="grid-column:1/-1;margin-top:0"><p>Xóa danh mục “${esc(c.name)}”?</p><div class="actions" style="margin-top:0">
            <button class="btn btn-danger btn-sm" type="button" data-act="c-del-yes" data-id="${esc(c.id)}">Xóa danh mục</button><button class="btn btn-quiet btn-sm" type="button" data-act="c-del-no">Không</button></div></div>`
        : '';
      return `<div class="crow" data-ink="${esc(c.ink)}">
        <span class="blob" aria-hidden="true"></span>
        <div><b>${esc(c.name)}</b><small>${c.desc ? esc(c.desc) + ' · ' : ''}${count} sản phẩm</small></div>
        <div class="ord">
          <button class="icon-btn up" type="button" data-act="c-up" data-id="${esc(c.id)}" aria-label="Đưa ${esc(c.name)} lên"${i === 0 ? ' disabled' : ''}>↑</button>
          <button class="icon-btn down" type="button" data-act="c-down" data-id="${esc(c.id)}" aria-label="Đưa ${esc(c.name)} xuống"${i === last ? ' disabled' : ''}>↓</button>
        </div>
        <div class="ord">
          <button class="btn btn-quiet btn-xs" type="button" data-act="c-edit" data-id="${esc(c.id)}">Sửa</button>
          <button class="btn btn-danger btn-xs" type="button" data-act="c-del-ask" data-id="${esc(c.id)}"${count ? ` disabled title="Chuyển hoặc xóa ${count} sản phẩm trong danh mục trước"` : ''}>Xóa</button>
        </div>
        ${del}
      </div>`;
    }).join('');
    return `<div class="page-head"><div><h1>Danh mục</h1><p>Hiện trên thanh ngang của cửa hàng, cạnh Giới thiệu và Liên hệ, theo thứ tự dưới đây.</p></div>
        ${ui.cEdit ? '' : '<button class="btn btn-cta btn-sm" type="button" data-act="c-new">Thêm danh mục</button>'}</div>
      ${ui.cEdit ? categoryForm(db) : ''}
      ${db.categories.length ? `<div class="clist">${rows}</div>` : '<div class="panel empty"><h3>Chưa có danh mục</h3><p>Thêm danh mục để bắt đầu xếp sản phẩm.</p></div>'}
      <p class="hint" style="margin-top:12px">Danh mục còn sản phẩm thì không xóa được. Chuyển sản phẩm sang danh mục khác hoặc xóa sản phẩm trước.</p>`;
  }

  // ==== Xưởng ====
  function factoryForm(db) {
    const f = ui.fEdit === 'new' ? { cats: [], rating: 4.5, city: 'Quảng Châu' } : (P.findFactory(db, ui.fEdit) || { cats: [] });
    const cityOpts = Object.keys(CITIES).concat(['Khác']);
    return `<form id="f-form" class="panel" novalidate style="margin-bottom:20px">
      <div class="panel-h"><h2>${ui.fEdit === 'new' ? 'Thêm xưởng' : 'Sửa xưởng ' + esc(f.name)}</h2></div>
      <div class="form-grid three">
        <div class="field"><label for="ff-name">Tên gọi <span class="req" aria-hidden="true">*</span></label><input id="ff-name" value="${esc(f.name || '')}" autocomplete="off" aria-describedby="err-ff-name"><p class="err" id="err-ff-name"></p></div>
        <div class="field"><label for="ff-cn">Tên tiếng Trung</label><input id="ff-cn" lang="zh-Hans" value="${esc(f.cn || '')}" autocomplete="off" placeholder="VD: 兴盛包装"></div>
        <div class="field"><label for="ff-city">Khu vực</label><select id="ff-city">${cityOpts.map(c => `<option${c === f.city ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
        <fieldset class="field full cat-pick" id="ff-cats" aria-describedby="err-ff-cats"><legend>Danh mục làm được <span class="req" aria-hidden="true">*</span></legend>
          <div class="checks">${db.categories.map(c => `<label class="check"><input type="checkbox" id="ff-cat-${esc(c.id)}" value="${esc(c.id)}"${f.cats.includes(c.id) ? ' checked' : ''}>${esc(c.name)}</label>`).join('')}</div>
          <p class="err" id="err-ff-cats"></p></fieldset>
        <div class="field"><label for="ff-contact">Liên hệ</label><input id="ff-contact" value="${esc(f.contact || '')}" autocomplete="off" placeholder="WeChat, số điện thoại"></div>
        <div class="field"><label for="ff-rating">Đánh giá (1–5)</label><input id="ff-rating" inputmode="decimal" value="${esc(f.rating || '')}" autocomplete="off"></div>
        <div class="field"><label for="ff-note">Ghi chú</label><input id="ff-note" value="${esc(f.note || '')}" autocomplete="off" placeholder="Điểm mạnh, số lượng tối thiểu…"></div>
      </div>
      <div class="actions"><button class="btn btn-cta btn-sm" type="submit">Lưu xưởng</button><button class="link-btn" type="button" data-act="f-cancel">Thôi</button></div>
    </form>`;
  }

  function viewFactories(db) {
    const cards = db.factories.map(f => {
      const os = db.orders.filter(o => o.factoryId === f.id);
      const run = os.filter(o => !STATUSES[o.status].done && !STATUSES[o.status].off).length;
      return `<article class="panel fcard">
        <div class="fcard-top"><div><div class="cjk" lang="zh-Hans">${esc(f.cn || '')}</div><h3>${esc(f.name)}</h3></div><span class="rating" aria-label="Đánh giá ${esc(f.rating)} trên 5">★ ${esc(f.rating)}</span></div>
        <div class="tags">${f.cats.map(k => P.catTag(db, k)).join('')}</div>
        <dl><dt>Khu vực</dt><dd>${esc(f.city)} <span style="font-family:var(--font-cjk)">${esc(CITIES[f.city] || '')}</span></dd>
          <dt>Liên hệ</dt><dd>${esc(f.contact || '—')}</dd>
          <dt>Đơn</dt><dd>${run} đang làm · ${os.length} tổng</dd></dl>
        ${f.note ? `<p class="muted" style="font-size:.92rem">${esc(f.note)}</p>` : ''}
        <div><button class="btn btn-quiet btn-xs" type="button" data-act="f-edit" data-id="${esc(f.id)}">Sửa</button></div>
      </article>`;
    }).join('');
    return `<div class="page-head"><div><h1>Xưởng</h1><p>${db.factories.length} xưởng đối tác · chỉ shop thấy, khách không thấy</p></div>
        ${ui.fEdit ? '' : '<button class="btn btn-cta btn-sm" type="button" data-act="f-new">Thêm xưởng</button>'}</div>
      ${ui.fEdit ? factoryForm(db) : ''}
      ${db.factories.length ? `<div class="fgrid">${cards}</div>` : '<div class="panel empty"><p>Chưa có xưởng nào.</p></div>'}`;
  }

  // ==== Đơn in: đơn shop đặt xưởng Trung Quốc, gom từ các đơn khách ====
  function linesFromOrder(o, keep) {
    return o.items.map((it, i) => {
      const old = (keep || []).find(l => l.orderId === o.id && l.itemIndex === i);
      return old || { id: P.uid('dl'), orderId: o.id, itemIndex: i, productName: it.productName, variantName: it.variantName, qty: it.qty, cny: '' };
    });
  }

  function prepareJob(db) {
    if (!ui.jEdit) { ui.jDraft = null; return; }
    if (ui.jDraft && ui.jDraft._key === ui.jEdit) return;
    if (ui.jEdit === 'new') {
      const pre = (ui.jPre || []).map(id => P.findOrder(db, id)).filter(o => o && P.printable(db, o));
      ui.jDraft = { id: P.uid('dj'), mvd: '', rate: db.settings.lastRate || '', kg: '', whId: '', note: '', lines: [].concat(...pre.map(o => linesFromOrder(o))) };
    } else {
      const j = (db.printJobs || []).find(x => x.id === ui.jEdit);
      ui.jDraft = j ? JSON.parse(JSON.stringify(j)) : null;
    }
    if (ui.jDraft) ui.jDraft._key = ui.jEdit;
    ui.jPre = null;
  }

  function jobTotalText(j) {
    const c = P.jobCost(j);
    return `Tổng <b>¥${fmt.num(c.totalCny)}</b> · quy đổi <b>${fmt.vnd(c.totalVnd)}</b> · ${fmt.num(c.qty)} sp`;
  }

  function jobForm(db) {
    const j = ui.jDraft;
    if (!j) return '';
    const b = 'data-nokeep="1"';
    const picked = new Set(j.lines.map(l => l.orderId));
    const cands = db.orders.filter(o => P.printable(db, o, ui.jEdit === 'new' ? null : j.id))
      .sort((a, b2) => (picked.has(b2.id) - picked.has(a.id)) || (P.needsPrint(db, b2) - P.needsPrint(db, a)) || b2.createdAt - a.createdAt);
    const orderRows = cands.map(o => `<label class="jo${picked.has(o.id) ? ' on' : ''}">
        <input type="checkbox" class="jo-pick" ${b} value="${esc(o.id)}"${picked.has(o.id) ? ' checked' : ''}>
        <span class="jo-main"><b>${esc(o.id)}</b> · ${esc(o.name)}<small>${o.items.map(it => esc(it.productName) + ' × ' + fmt.num(it.qty)).join(' · ')}</small></span>
        <span class="jo-tags">${P.needsPrint(db, o) ? '<span class="pill act">Chưa đặt in</span>' : P.pill(o, 'admin')}</span>
      </label>`).join('');
    const lineRows = j.lines.map(l => {
      const c = P.lineCost(l, j.rate);
      return `<tr>
        <td><a href="#don-${esc(l.orderId)}">${esc(l.orderId)}</a></td>
        <td><span class="it-name">${esc(l.productName)}</span><small>${esc(l.variantName || '')}</small></td>
        <td class="r"><input class="cell-in" ${b} data-jl="${esc(l.id)}" data-k="qty" value="${esc(fmt.num(l.qty))}" inputmode="numeric" autocomplete="off" aria-label="Số lượng in ${esc(l.productName)}"></td>
        <td class="r"><div class="unit cell-unit"><input class="cell-in" ${b} data-jl="${esc(l.id)}" data-k="cny" value="${l.cny === '' ? '' : esc(fmt.num(l.cny))}" inputmode="decimal" autocomplete="off" placeholder="0" aria-label="Đơn giá tệ ${esc(l.productName)}"><span>¥</span></div></td>
        <td class="r" id="jl-out-${esc(l.id)}">${c.unitVnd ? `${fmt.vnd(c.unitVnd)}<small>${fmt.vnd(c.totalVnd)}</small>` : '<span class="muted">—</span>'}</td>
      </tr>`;
    }).join('');
    const fld = (id, k, label, value, suffix, extra) => suffix
      ? `<div class="field"><label for="${id}">${label}</label><div class="unit"><input id="${id}" ${b} data-jf="${k}" value="${esc(value)}" inputmode="decimal" autocomplete="off"${extra || ''}><span>${suffix}</span></div></div>`
      : `<div class="field"><label for="${id}">${label}</label><input id="${id}" ${b} data-jf="${k}" value="${esc(value)}" autocomplete="off"${extra || ''}></div>`;
    return `<form id="j-form" class="panel lead" novalidate style="margin-bottom:20px">
      <div class="panel-h"><h2>${ui.jEdit === 'new' ? 'Tạo đơn in' : 'Sửa đơn in ' + esc(j.code || '')}</h2></div>
      <h3 class="sec-title">1. Chọn đơn khách</h3>
      ${cands.length ? `<div class="jo-list">${orderRows}</div>` : '<p class="muted">Không còn đơn khách nào chờ đặt in.</p>'}
      <h3 class="sec-title">2. Sản phẩm đặt in</h3>
      ${j.lines.length ? `<div class="tbl-wrap tbl-scroll"><table class="tbl jlines"><thead><tr><th>Đơn khách</th><th>Sản phẩm</th><th class="r">SL in</th><th class="r">Đơn giá tệ</th><th class="r">Quy đổi VNĐ</th></tr></thead><tbody>${lineRows}</tbody></table></div>
        <p class="jtotal" id="j-total" aria-live="polite">${jobTotalText(j)}</p>`
        : '<p class="muted">Chọn đơn khách ở trên, sản phẩm của đơn sẽ tự vào đây.</p>'}
      <p class="err" id="err-j-lines"></p>
      <h3 class="sec-title">3. Thông tin đơn in</h3>
      <div class="form-grid three">
        ${fld('jf-mvd', 'mvd', 'Mã vận đơn (không bắt buộc)', j.mvd, '', ' placeholder="Điền khi xưởng gửi mã"')}
        ${fld('jf-rate', 'rate', 'Tỷ giá', j.rate === '' ? '' : fmt.num(j.rate), '₫/¥', ' aria-describedby="err-jf-rate"')}
        ${fld('jf-kg', 'kg', 'Cân nặng', j.kg === '' ? '' : fmt.num(j.kg), 'kg', ' placeholder="Điền khi hàng về"')}
        <div class="field"><label for="jf-wh">Kho trung chuyển</label><select id="jf-wh" ${b} data-jf="whId"><option value="">Chưa chọn kho</option>${(db.logistics || []).map(w => `<option value="${esc(w.id)}"${w.id === j.whId ? ' selected' : ''}>${esc(w.name)}</option>`).join('')}</select></div>
        <div class="field" style="grid-column:span 2"><label for="jf-note">Ghi chú</label><input id="jf-note" ${b} data-jf="note" value="${esc(j.note)}" autocomplete="off"></div>
      </div>
      <p class="err" id="err-jf-rate"></p>
      <div class="actions"><button class="btn btn-cta btn-sm" type="submit">${ui.jEdit === 'new' ? 'Tạo đơn in' : 'Lưu'}</button><button class="link-btn" type="button" data-act="j-cancel">Thôi</button></div>
    </form>`;
  }

  // Cập nhật số tiền trong form mà không vẽ lại trang
  function updateJobOut() {
    const j = ui.jDraft;
    if (!j) return;
    j.lines.forEach(l => {
      const el = document.getElementById('jl-out-' + l.id);
      if (!el) return;
      const c = P.lineCost(l, j.rate);
      el.innerHTML = c.unitVnd ? `${fmt.vnd(c.unitVnd)}<small>${fmt.vnd(c.totalVnd)}</small>` : '<span class="muted">—</span>';
    });
    const t = document.getElementById('j-total');
    if (t) t.innerHTML = jobTotalText(j);
  }

  function bindJob(el) {
    const j = ui.jDraft;
    if (!j) return;
    const num = v => v.trim() === '' ? '' : (P.parseNum(v) >= 0 ? P.parseNum(v) : '');
    if (el.dataset.jl) {
      const l = j.lines.find(x => x.id === el.dataset.jl);
      if (l) l[el.dataset.k] = num(el.value);
    } else if (el.dataset.jf) {
      const k = el.dataset.jf;
      j[k] = (k === 'rate' || k === 'kg') ? num(el.value) : el.value;
    }
  }

  function viewJobs(db) {
    if (ui.jPre) { ui.jEdit = 'new'; ui.jDraft = null; }
    if (ui.jOpen) { ui.jEdit = ui.jOpen; ui.jDraft = null; ui.jOpen = null; }
    prepareJob(db);
    const jobs = (db.printJobs || []).slice().sort((a, b) => b.createdAt - a.createdAt);
    const q = ui.jq.trim().toLowerCase();
    const list = q ? jobs.filter(j => [j.code, j.mvd, j.note, (j.lines || []).map(l => l.orderId + ' ' + l.productName).join(' ')].join(' ').toLowerCase().includes(q)) : jobs;
    const whOf = id => (db.logistics || []).find(w => w.id === id);
    const totVnd = sum(jobs, j => P.jobCost(j).totalVnd);
    const totCny = sum(jobs, j => P.jobCost(j).totalCny);
    const waitKg = jobs.filter(j => !(+j.kg > 0)).length;
    const shipSum = sum(jobs, j => { const s = P.shipQuote(whOf(j.whId), j.kg); return s && s.ok ? s.cost : 0; });
    const noPrint = db.orders.filter(o => P.needsPrint(db, o)).sort((a, b) => a.createdAt - b.createdAt);
    ui.npPicked = new Set([...ui.npPicked].filter(id => noPrint.some(o => o.id === id)));

    const rows = list.map(j => {
      const c = P.jobCost(j);
      const w = whOf(j.whId);
      const sq = P.shipQuote(w, j.kg);
      const st = P.jobStatus(j);
      const orderIds = [...new Set((j.lines || []).map(l => l.orderId))];
      return `<tr>
        <td data-label="Đơn in"><b>${esc(j.code || '')}</b>${j.demo ? '<span class="tag-demo">Mẫu</span>' : ''}
          ${j.mvd ? `<span class="sub"><span id="mvd-${esc(j.id)}">${esc(j.mvd)}</span> <button class="copy-mini" type="button" data-copy-value="${esc(j.mvd)}" data-copy-target="mvd-${esc(j.id)}">Chép</button></span>` : '<span class="sub">Chưa có mã vận đơn</span>'}</td>
        <td data-label="Đơn khách">${orderIds.map(id => `<a class="jlink" href="#don-${esc(id)}">${esc(id)}</a>`).join('')}</td>
        <td data-label="Sản phẩm">${(j.lines || []).map(l => `<span class="it-line">${esc(l.productName)} <b>× ${fmt.num(l.qty)}</b> <span class="muted">¥${fmt.num(l.cny)}</span></span>`).join('')}</td>
        <td data-label="Tỷ giá" class="r">${fmt.num(j.rate)}</td>
        <td data-label="Quy đổi VNĐ" class="r"><b>${fmt.vnd(c.totalVnd)}</b><span class="sub">¥${fmt.num(c.totalCny)}</span></td>
        <td data-label="Cân nặng" class="r"><div class="unit kg-cell"><input class="jkg" data-id="${esc(j.id)}" data-nokeep="1" inputmode="decimal" autocomplete="off" value="${+j.kg > 0 ? esc(fmt.num(j.kg)) : ''}" placeholder="Chưa về" aria-label="Cân nặng ${esc(j.code || '')}"><span>kg</span></div></td>
        <td data-label="Kho trung chuyển">${w ? esc(w.name) : '<span class="muted">Chưa chọn</span>'}${sq && sq.ok ? `<span class="sub">Ship ${fmt.vnd(sq.cost)}</span>` : ''}${P.jobFeeTotal(db, j.id) ? `<span class="sub">Phụ phí chia ${fmt.vnd(P.jobFeeTotal(db, j.id))}</span>` : ''}</td>
        <td data-label="Trạng thái"><span class="pill ${st.cls}">${esc(st.label)}</span></td>
        <td class="r">${ui.jDel === j.id
          ? `<button class="btn btn-danger btn-xs" type="button" data-act="j-del-yes" data-id="${esc(j.id)}">Xóa</button> <button class="link-btn" type="button" data-act="j-del-no">Thôi</button>`
          : `<button class="btn btn-quiet btn-xs" type="button" data-act="j-edit" data-id="${esc(j.id)}">Sửa</button> <button class="link-btn" type="button" data-act="j-del-ask" data-id="${esc(j.id)}">Xóa</button>`}</td>
      </tr>`;
    }).join('');

    const noPrintBox = ui.jEdit ? '' : `<section class="panel${noPrint.length ? ' lead' : ''}" style="margin-bottom:18px">
      <div class="panel-h"><h2>Đơn khách chưa đặt in</h2><span class="muted">Đã thanh toán, đang chờ shop đặt xưởng</span></div>
      ${noPrint.length ? `<div class="jo-list">${noPrint.map(o => `<label class="jo${ui.npPicked.has(o.id) ? ' on' : ''}">
          <input type="checkbox" class="np-pick" data-nokeep="1" value="${esc(o.id)}"${ui.npPicked.has(o.id) ? ' checked' : ''}>
          <span class="jo-main"><b>${esc(o.id)}</b> · ${esc(o.name)}<small>${o.items.map(it => esc(it.productName) + ' × ' + fmt.num(it.qty)).join(' · ')}</small></span>
          <span class="jo-tags muted">${fmt.ago(o.produceStart || o.updatedAt)}</span></label>`).join('')}</div>
        <div class="actions"><button class="btn btn-cta btn-sm" type="button" data-act="j-from-np"${ui.npPicked.size ? '' : ' disabled'}>Tạo đơn in cho ${ui.npPicked.size || ''} đơn đã chọn</button>
          <button class="link-btn" type="button" data-act="np-all">Chọn tất cả</button></div>`
        : '<p class="muted">Tất cả đơn khách đã thanh toán đều đã được đặt in.</p>'}
    </section>`;

    return `<div class="page-head"><div><h1>Đơn in</h1><p>Đơn shop đặt xưởng Trung Quốc · ${jobs.length} đơn in</p></div>
        ${ui.jEdit ? '' : '<button class="btn btn-cta btn-sm" type="button" data-act="j-new">Tạo đơn in</button>'}</div>
      ${ui.jEdit ? jobForm(db) : ''}
      <div class="tiles" style="margin-bottom:18px">
        <a class="tile${noPrint.length ? ' hot' : ''}" href="#don-hang" data-filter="noprint"><span class="lbl">Đơn khách chưa đặt in</span><b>${noPrint.length}</b><span class="sub">Đã thanh toán, chờ đặt xưởng</span></a>
        <div class="tile"><span class="lbl">Tổng tiền hàng</span><b>${fmt.vnd(totVnd)}</b><span class="sub">¥${fmt.num(totCny)}</span></div>
        <div class="tile"><span class="lbl">Chưa có cân nặng</span><b>${waitKg}</b><span class="sub">Điền cân khi hàng về kho</span></div>
        <div class="tile"><span class="lbl">Phí ship ước tính</span><b>${fmt.vnd(shipSum)}</b><span class="sub">Theo bảng giá cân ở Logistics</span></div>
      </div>
      ${noPrintBox}
      <div class="toolbar"><label class="sr-only" for="j-search">Tìm đơn in</label>
        <input class="search" id="j-search" type="search" placeholder="Tìm mã đơn in, mã vận đơn, mã đơn khách, sản phẩm…" value="${esc(ui.jq)}" autocomplete="off"></div>
      ${list.length ? `<div class="tbl-wrap tbl-scroll"><table class="tbl jobs">
        <thead><tr><th>Đơn in</th><th>Đơn khách</th><th>Sản phẩm</th><th class="r">Tỷ giá</th><th class="r">Quy đổi VNĐ</th><th class="r">Cân nặng</th><th>Kho trung chuyển</th><th>Trạng thái</th><th><span class="sr-only">Thao tác</span></th></tr></thead>
        <tbody>${rows}</tbody></table></div>`
      : `<div class="panel empty"><h3>${jobs.length ? 'Không có đơn in phù hợp' : 'Chưa có đơn in nào'}</h3><p>${jobs.length ? 'Thử từ khóa khác.' : 'Chọn các đơn khách đã thanh toán ở trên để tạo đơn in.'}</p></div>`}
      ${feePanel(db)}`;
  }

  // ==== Phụ phí đơn in: chia một khoản chi chung theo cân nặng từng đơn in ====
  function prepareFee(db) {
    if (!ui.feEdit) { ui.feDraft = null; return; }
    if (ui.feDraft && ui.feDraft._key === ui.feEdit) return;
    if (ui.feEdit === 'new') ui.feDraft = { id: P.uid('jf'), name: '', amount: '', jobIds: [], note: '' };
    else {
      const f = (db.jobFees || []).find(x => x.id === ui.feEdit);
      ui.feDraft = f ? JSON.parse(JSON.stringify(f)) : null;
    }
    if (ui.feDraft) ui.feDraft._key = ui.feEdit;
  }

  function shareRows(db, f, withTotal) {
    const sh = P.feeShares(f, db);
    const rows = sh.rows.map(r => {
      const j = (db.printJobs || []).find(x => x.id === r.jobId) || {};
      return `<tr><td><b>${esc(j.code || '')}</b></td><td class="r">${r.kg ? fmt.num(r.kg) + ' kg' : '<span class="muted">Chưa có cân</span>'}</td><td class="r">${sh.ok ? fmt.num(Math.round(r.pct * 10) / 10) + '%' : '—'}</td><td class="r"><b>${sh.ok ? fmt.vnd(r.amount) : '—'}</b></td></tr>`;
    }).join('');
    const foot = withTotal ? `<tr class="tot"><td>Tổng</td><td class="r">${fmt.num(Math.round(sh.totalKg * 100) / 100)} kg</td><td class="r">${sh.ok ? '100%' : ''}</td><td class="r"><b>${fmt.vnd(sh.amount)}</b></td></tr>` : '';
    return `<table class="tbl feeshare"><thead><tr><th>Đơn in</th><th class="r">Cân nặng</th><th class="r">Tỷ lệ</th><th class="r">Phụ phí chịu</th></tr></thead><tbody>${rows}${foot}</tbody></table>`;
  }

  function feeForm(db) {
    const f = ui.feDraft;
    if (!f) return '';
    const b = 'data-nokeep="1"';
    const picked = new Set(f.jobIds);
    const jobs = (db.printJobs || []).slice().sort((a, c) => (picked.has(c.id) - picked.has(a.id)) || c.createdAt - a.createdAt);
    const jobRows = jobs.map(j => {
      const kg = +j.kg > 0;
      const dis = !kg && !picked.has(j.id);
      return `<label class="jo${picked.has(j.id) ? ' on' : ''}${dis ? ' off' : ''}">
        <input type="checkbox" class="fe-pick" ${b} value="${esc(j.id)}"${picked.has(j.id) ? ' checked' : ''}${dis ? ' disabled' : ''}>
        <span class="jo-main"><b>${esc(j.code || '')}</b>${j.mvd ? ' · ' + esc(j.mvd) : ''}<small>${(j.lines || []).map(l => esc(l.productName) + ' × ' + fmt.num(l.qty)).join(' · ')}</small></span>
        <span class="jo-tags">${kg ? '<b>' + fmt.num(j.kg) + ' kg</b>' : '<span class="muted">Chưa có cân nặng</span>'}</span></label>`;
    }).join('');
    return `<form id="fe-form" class="panel lead" novalidate style="margin-bottom:16px">
      <div class="panel-h"><h2>${ui.feEdit === 'new' ? 'Thêm phụ phí' : 'Sửa phụ phí'}</h2></div>
      <div class="form-grid">
        <div class="field"><label for="fe-name">Tên khoản phí <span class="req" aria-hidden="true">*</span></label><input id="fe-name" ${b} data-fe="name" value="${esc(f.name)}" autocomplete="off" placeholder="VD: Ship Lạng Sơn → Hà Nội" aria-describedby="err-fe-name"><p class="err" id="err-fe-name"></p></div>
        <div class="field"><label for="fe-amount">Tổng tiền cả lô <span class="req" aria-hidden="true">*</span></label><div class="unit"><input id="fe-amount" ${b} data-fe="amount" value="${f.amount === '' ? '' : esc(fmt.num(f.amount))}" inputmode="numeric" autocomplete="off" placeholder="0" aria-describedby="err-fe-amount"><span>₫</span></div><p class="err" id="err-fe-amount"></p></div>
        <div class="field full"><label for="fe-note">Ghi chú</label><input id="fe-note" ${b} data-fe="note" value="${esc(f.note || '')}" autocomplete="off" placeholder="VD: Gửi chung 1 xe, đơn vị vận chuyển ABC"></div>
      </div>
      <h3 class="sec-title">Các đơn in đi chung lô này</h3>
      ${jobs.length ? `<div class="jo-list">${jobRows}</div><p class="hint" style="margin-top:6px">Đơn in chưa có cân nặng thì chưa chọn được. Điền cân ở bảng Đơn in khi hàng về kho.</p>` : '<p class="muted">Chưa có đơn in nào.</p>'}
      <p class="err" id="err-fe-jobs"></p>
      <h3 class="sec-title">Chia theo cân nặng</h3>
      <div id="fe-out">${feeOut(db, f)}</div>
      <div class="actions"><button class="btn btn-cta btn-sm" type="submit">${ui.feEdit === 'new' ? 'Lưu phụ phí' : 'Lưu'}</button><button class="link-btn" type="button" data-act="fe-cancel">Thôi</button></div>
    </form>`;
  }
  function feeOut(db, f) {
    return f.jobIds.length ? shareRows(db, f, true) + (+f.amount > 0 ? '' : '<p class="hint" style="margin-top:6px">Nhập tổng tiền để thấy số chia.</p>') : '<p class="muted">Chọn các đơn in ở trên để xem số tiền mỗi đơn chịu.</p>';
  }
  function updateFeeOut() {
    const out = document.getElementById('fe-out');
    if (out && ui.feDraft) out.innerHTML = feeOut(P.load(), ui.feDraft);
  }

  function feePanel(db) {
    const fees = db.jobFees || [];
    const total = sum(fees, f => +f.amount);
    const cards = fees.map(f => `<div class="feecard">
        <div class="feecard-h"><div><b>${esc(f.name)}</b><span class="sub">${fmt.date(f.createdAt || Date.now())}${f.note ? ' · ' + esc(f.note) : ''}</span></div>
          <div class="r"><b>${fmt.vnd(f.amount)}</b>
            <div>${ui.feDel === f.id
              ? `<button class="btn btn-danger btn-xs" type="button" data-act="fe-del-yes" data-id="${esc(f.id)}">Xóa</button> <button class="link-btn" type="button" data-act="fe-del-no">Thôi</button>`
              : `<button class="btn btn-quiet btn-xs" type="button" data-act="fe-edit" data-id="${esc(f.id)}">Sửa</button> <button class="link-btn" type="button" data-act="fe-del-ask" data-id="${esc(f.id)}">Xóa</button>`}</div></div></div>
        <div class="tbl-wrap tbl-scroll">${shareRows(db, f, true)}</div></div>`).join('');
    return `<section class="panel" style="margin-top:20px"><div class="panel-h"><h2>Phụ phí chia theo cân nặng</h2><span class="muted">${fees.length ? fees.length + ' khoản · ' + fmt.vnd(total) : 'Ship nội địa, phí chung của cả lô'}</span></div>
      <p class="muted" style="margin-bottom:12px">Gửi 2-3 đơn in chung một công ty vận chuyển? Khi hàng về Việt Nam còn tiền ship từ kho về nhà, nhập một khoản rồi chọn các đơn in đi chung. Web chia theo tỷ lệ cân nặng từng đơn in.</p>
      ${ui.feEdit ? feeForm(db) : '<div class="actions" style="margin-top:0;margin-bottom:12px"><button class="btn btn-cta btn-sm" type="button" data-act="fe-new">Thêm phụ phí</button></div>'}
      ${cards || (ui.feEdit ? '' : '<p class="muted">Chưa có khoản phụ phí nào.</p>')}
    </section>`;
  }

  // Khung "Đơn in" trong trang chi tiết đơn khách
  function jobPanel(db, o) {
    const j = P.jobForOrder(db, o.id);
    if (j) {
      const st = P.jobStatus(j);
      const mine = (j.lines || []).filter(l => l.orderId === o.id);
      return `<section class="panel"><div class="panel-h"><h2>Đơn in ${esc(j.code || '')}</h2><span class="pill ${st.cls}">${esc(st.label)}</span></div>
        <table class="items"><tbody>${mine.map(l => { const c = P.lineCost(l, j.rate); return `<tr><td><span class="it-name">${esc(l.productName)}</span><small>${fmt.num(l.qty)} sp × ¥${fmt.num(l.cny)}</small></td><td class="r"><b>${fmt.vnd(c.totalVnd)}</b></td></tr>`; }).join('')}</tbody></table>
        <dl class="kv" style="margin-top:10px"><dt>Mã vận đơn</dt><dd>${j.mvd ? esc(j.mvd) : '<span class="muted">Chưa có</span>'}</dd>${+j.kg > 0 ? `<dt>Cân nặng lô</dt><dd>${fmt.num(j.kg)} kg</dd>` : ''}${P.feesOfJob(db, j.id).map(x => `<dt>${esc(x.fee.name)}</dt><dd>${fmt.vnd(x.amount)} <span class="muted">(${fmt.num(Math.round(x.pct * 10) / 10)}% cân)</span></dd>`).join('')}</dl>
        <div class="actions"><button class="btn btn-quiet btn-sm" type="button" data-act="j-edit-go" data-id="${esc(j.id)}">Mở đơn in</button></div></section>`;
    }
    if (!P.printable(db, o)) return '';
    return `<section class="panel${P.needsPrint(db, o) ? ' lead' : ''}"><div class="panel-h"><h2>Đơn in</h2><span class="pill ${P.needsPrint(db, o) ? 'act' : ''}">Chưa đặt in</span></div>
      <p class="muted">${o.status === 'cho_coc' ? 'Khách chưa thanh toán. Vẫn có thể đặt in trước nếu cần.' : 'Đơn đã thanh toán, đặt xưởng in để bắt đầu sản xuất.'}</p>
      <div class="actions"><button class="btn btn-cta btn-sm" type="button" data-act="j-from-order">Tạo đơn in cho đơn này</button></div></section>`;
  }

  // ==== Logistics: kho trung chuyển TQ–VN ====
  function newRate(from) { return { id: P.uid('r'), from: from == null ? '' : from, to: '', price: '' }; }

  function prepareLogistic(db) {
    if (!ui.lEdit) { ui.lDraft = null; return; }
    if (ui.lDraft && ui.lDraft._key === ui.lEdit) return;
    const w = ui.lEdit === 'new' ? null : (db.logistics || []).find(x => x.id === ui.lEdit);
    ui.lDraft = w ? JSON.parse(JSON.stringify(w)) : { id: P.uid('lg'), name: '', route: '', method: 'bo', days: '', cnAddress: '', vnAddress: '', contact: '', minCharge: '', note: '', rates: [newRate(0)] };
    ui.lDraft._key = ui.lEdit;
  }

  function logisticForm() {
    const w = ui.lDraft;
    const b = 'data-lbind="1" data-nokeep="1"';
    const fld = (id, label, k, ph, full) =>
      `<div class="field${full ? ' full' : ''}"><label for="${id}">${label}</label><input id="${id}" ${b} data-k="${k}" value="${esc(w[k])}" autocomplete="off" placeholder="${esc(ph || '')}"></div>`;
    const rows = w.rates.map((r, i) => `<div class="vrow lrow">
        <div class="field"><label for="lr-from-${r.id}">Từ</label><div class="unit"><input id="lr-from-${r.id}" ${b} data-r="${r.id}" data-k="from" value="${esc(r.from === '' ? '' : fmt.num(r.from))}" inputmode="decimal" autocomplete="off" placeholder="0"><span>kg</span></div></div>
        <div class="field"><label for="lr-to-${r.id}">Đến</label><div class="unit"><input id="lr-to-${r.id}" ${b} data-r="${r.id}" data-k="to" value="${esc(r.to === '' ? '' : fmt.num(r.to))}" inputmode="decimal" autocomplete="off" placeholder="trở lên"><span>kg</span></div></div>
        <div class="field"><label for="lr-price-${r.id}">Giá</label><div class="unit"><input id="lr-price-${r.id}" ${b} data-r="${r.id}" data-k="price" value="${esc(r.price === '' ? '' : fmt.num(r.price))}" inputmode="numeric" autocomplete="off" placeholder="0"><span>₫/kg</span></div></div>
        <button class="icon-btn" type="button" data-act="lr-rm" data-id="${r.id}" aria-label="Xóa mức giá ${i + 1}"${w.rates.length < 2 ? ' disabled' : ''}>×</button>
      </div>`).join('');
    return `<form id="l-form" class="panel" novalidate style="margin-bottom:20px">
      <div class="panel-h"><h2>${ui.lEdit === 'new' ? 'Thêm kho trung chuyển' : 'Sửa ' + esc(w.name)}</h2></div>
      <div class="form-grid three">
        <div class="field"><label for="lf-name">Tên kho <span class="req" aria-hidden="true">*</span></label><input id="lf-name" ${b} data-k="name" value="${esc(w.name)}" autocomplete="off" placeholder="VD: Kho Bằng Tường" aria-describedby="err-lf-name"><p class="err" id="err-lf-name"></p></div>
        ${fld('lf-route', 'Tuyến', 'route', 'VD: Quảng Châu → Hà Nội')}
        <div class="field"><label for="lf-method">Hình thức</label><select id="lf-method" ${b} data-k="method">${Object.keys(SHIP_METHODS).map(k => `<option value="${k}"${w.method === k ? ' selected' : ''}>${SHIP_METHODS[k].name}</option>`).join('')}</select></div>
        ${fld('lf-days', 'Thời gian', 'days', 'VD: 4–6 ngày')}
        ${fld('lf-contact', 'Liên hệ kho', 'contact', 'Zalo, WeChat, số điện thoại')}
        <div class="field"><label for="lf-min">Phí tối thiểu mỗi lô</label><div class="unit"><input id="lf-min" ${b} data-k="minCharge" value="${esc(w.minCharge === '' ? '' : fmt.num(w.minCharge))}" inputmode="numeric" autocomplete="off" placeholder="0"><span>₫</span></div></div>
        ${fld('lf-cn', 'Địa chỉ kho bên Trung Quốc', 'cnAddress', 'Địa chỉ để xưởng gửi hàng tới', true)}
        ${fld('lf-vn', 'Kho bên Việt Nam', 'vnAddress', 'VD: Kho Long Biên, Hà Nội', true)}
        <div class="field full"><label for="lf-note">Ghi chú</label><textarea id="lf-note" ${b} data-k="note" rows="2" placeholder="Cách quy đổi hàng cồng kềnh, phụ phí đóng gỗ…">${esc(w.note)}</textarea></div>
      </div>
      <h3 class="sec-title">Bảng giá cân</h3>
      <p class="hint" style="margin-bottom:10px">Mỗi dòng là một mức cân. Ô “Đến” để trống nghĩa là từ mức đó trở lên.</p>
      <div class="vrows">${rows}</div>
      <p class="err" id="err-lf-rates" style="margin-top:8px"></p>
      <div class="actions" style="margin-top:10px"><button class="btn btn-quiet btn-sm" type="button" data-act="lr-add">+ Thêm mức cân</button></div>
      <div class="actions"><button class="btn btn-cta btn-sm" type="submit">${ui.lEdit === 'new' ? 'Thêm kho' : 'Lưu kho'}</button><button class="link-btn" type="button" data-act="l-cancel">Thôi</button></div>
    </form>`;
  }

  function quoteRows(db) {
    const kg = P.parseNum(ui.lKg);
    if (!(kg > 0)) return '<p class="muted">Nhập số kg để so giá giữa các kho.</p>';
    const list = (db.logistics || []).map(w => ({ w, q: P.shipQuote(w, kg) }));
    const ok = list.filter(x => x.q && x.q.ok).sort((a, b) => a.q.cost - b.q.cost);
    const bad = list.filter(x => !x.q || !x.q.ok);
    if (!list.length) return '<p class="muted">Chưa có kho nào.</p>';
    return `<table class="items"><tbody>${ok.map((x, i) => `<tr><td><span class="it-name">${esc(x.w.name)}</span>${i === 0 && ok.length > 1 ? ' <span class="pill ok">Rẻ nhất</span>' : ''}<small>${esc(x.w.route || '')}${x.w.days ? ' · ' + esc(x.w.days) : ''}</small></td>
        <td class="r">${fmt.num(kg)} kg × ${fmt.vnd(x.q.rate)}${x.q.usedMin ? '<small>áp phí tối thiểu</small>' : ''}</td><td class="r"><b>${fmt.vnd(x.q.cost)}</b></td></tr>`).join('')}
      ${bad.map(x => `<tr><td><span class="it-name">${esc(x.w.name)}</span></td><td colspan="2" class="r muted">Bảng giá chưa có mức cho ${fmt.num(kg)} kg</td></tr>`).join('')}</tbody></table>`;
  }

  function viewLogistics(db) {
    const ws = db.logistics || [];
    const cards = ws.map(w => `<article class="panel fcard">
        <div class="fcard-top"><div><h3>${esc(w.name)}</h3><p class="muted" style="font-size:.9rem">${esc(w.route || '')}${w.route ? ' · ' : ''}${esc((SHIP_METHODS[w.method] || SHIP_METHODS.bo).name)}${w.days ? ' · ' + esc(w.days) : ''}</p></div>
          ${w.demo ? '<span class="tag-demo">Mẫu</span>' : ''}</div>
        <table class="items"><tbody>${(w.rates || []).slice().sort((a, b) => (+a.from || 0) - (+b.from || 0)).map(r =>
          `<tr><td>${esc(P.rateLabel(r))}</td><td class="r"><b>${fmt.vnd(r.price)}</b>/kg</td></tr>`).join('')}
          ${+w.minCharge ? `<tr><td class="muted">Phí tối thiểu</td><td class="r">${fmt.vnd(w.minCharge)}</td></tr>` : ''}</tbody></table>
        <dl>
          ${w.cnAddress ? `<dt>Kho TQ</dt><dd><span id="cn-${esc(w.id)}">${esc(w.cnAddress)}</span> <button class="copy-mini" type="button" data-copy-value="${esc(w.cnAddress)}" data-copy-target="cn-${esc(w.id)}">Sao chép</button></dd>` : ''}
          ${w.vnAddress ? `<dt>Kho VN</dt><dd>${esc(w.vnAddress)}</dd>` : ''}
          ${w.contact ? `<dt>Liên hệ</dt><dd>${esc(w.contact)}</dd>` : ''}
        </dl>
        ${w.note ? `<p class="muted" style="font-size:.9rem">${esc(w.note)}</p>` : ''}
        ${ui.lDel === w.id
          ? `<div class="confirm" style="margin-top:0"><p>Xóa kho ${esc(w.name)}?</p><div class="actions" style="margin-top:0">
              <button class="btn btn-danger btn-sm" type="button" data-act="l-del-yes" data-id="${esc(w.id)}">Xóa kho</button><button class="btn btn-quiet btn-sm" type="button" data-act="l-del-no">Không</button></div></div>`
          : `<div class="actions" style="margin-top:0"><button class="btn btn-quiet btn-xs" type="button" data-act="l-edit" data-id="${esc(w.id)}">Sửa</button>
              <button class="btn btn-danger btn-xs" type="button" data-act="l-del-ask" data-id="${esc(w.id)}">Xóa</button></div>`}
      </article>`).join('');
    return `<div class="page-head"><div><h1>Logistics</h1><p>${ws.length} kho trung chuyển Trung Quốc – Việt Nam · chỉ shop thấy</p></div>
        ${ui.lEdit ? '' : '<button class="btn btn-cta btn-sm" type="button" data-act="l-new">Thêm kho</button>'}</div>
      ${ui.lEdit ? logisticForm() : ''}
      <section class="panel" style="margin-bottom:20px"><div class="panel-h"><h2>Tính thử phí cân</h2></div>
        <div class="field" style="max-width:260px"><label for="lg-kg">Cân nặng lô hàng</label><div class="unit"><input id="lg-kg" data-nokeep="1" inputmode="decimal" autocomplete="off" value="${esc(ui.lKg)}" placeholder="VD: 25"><span>kg</span></div></div>
        <div id="lg-out" style="margin-top:12px" aria-live="polite">${quoteRows(db)}</div>
      </section>
      ${ws.length ? `<div class="fgrid">${cards}</div>` : '<div class="panel empty"><h3>Chưa có kho nào</h3><p>Thêm kho trung chuyển và bảng giá cân để tính phí ship cho từng đơn.</p></div>'}`;
  }

  // ==== Giao diện: avatar, màu, font, cỡ chữ, mục hiển thị trên web ====
  function prepareLook(db) {
    if (!ui.look) ui.look = P.normLook(db.settings.look);
  }

  function viewLook(db) {
    const l = ui.look;
    const initial = esc((db.settings.adminName || 'P').trim().charAt(0).toUpperCase());
    const avatar = l.avatar ? `<img src="${esc(l.avatar)}" alt="">` : initial;
    const swatches = Object.keys(P.THEMES).map(k => `<button class="swatch" type="button" data-act="lk-theme" data-v="${k}" aria-pressed="${l.theme === k}" style="--dot:${P.THEMES[k].dot}"><i></i>${esc(P.THEMES[k].name)}</button>`).join('');
    const seg = (act, items, cur) => `<div class="seg" role="group">${Object.keys(items).map(k => `<button type="button" data-act="${act}" data-v="${k}" aria-pressed="${cur === k}">${esc(items[k])}</button>`).join('')}</div>`;
    const showBox = (k, label) => `<label class="check"><input type="checkbox" data-nokeep="1" data-lshow="${k}"${l.show[k] !== false ? ' checked' : ''}>${esc(label)}</label>`;
    const catBox = c => `<label class="check"><input type="checkbox" data-nokeep="1" data-lcat="${esc(c.id)}"${l.hiddenCats.includes(c.id) ? '' : ' checked'}>${esc(c.name)}</label>`;
    const fonts = Object.keys(P.FONTS).map(k => `<option value="${k}"${l.font === k ? ' selected' : ''}>${esc(P.FONTS[k].name)}</option>`).join('');
    return `<div class="page-head"><div><h1>Giao diện</h1><p>Chỉnh màu, font, cỡ chữ và các mục hiện trên web. Trang này xem thử ngay, bấm Lưu mới áp dụng cho khách.</p></div>
        <a class="btn btn-ghost btn-sm" href="index.html" target="_blank" rel="noopener">Xem cửa hàng</a></div>
      <form id="look-form" class="panel" novalidate>
        <h2 class="sec-title">Ảnh đại diện</h2>
        <div class="look-avatar"><span class="avatar big" aria-hidden="true">${avatar}</span>
          <div><p class="hint" style="margin-bottom:8px">Hiện làm logo ở thanh ngang, chân trang, trang chủ, biểu tượng thẻ trình duyệt và góc trang quản trị. Nên dùng ảnh vuông.</p>
            <div class="actions" style="margin-top:0">
              <input id="look-avatar" type="file" accept="image/*" class="sr-only file-in" data-nokeep="1">
              <label class="btn btn-quiet btn-sm" for="look-avatar">${l.avatar ? 'Đổi ảnh' : 'Chọn ảnh'}</label>
              ${l.avatar ? '<button class="link-btn" type="button" data-act="lk-avatar-rm">Bỏ ảnh</button>' : ''}</div></div></div>
        <h2 class="sec-title">Màu chủ đạo</h2>
        <div class="swatches" role="group" aria-label="Màu chủ đạo">${swatches}</div>
        <h2 class="sec-title">Sáng hay tối</h2>
        ${seg('lk-mode', P.MODES, l.mode)}
        <h2 class="sec-title">Font chữ</h2>
        <div class="field" style="max-width:420px"><label class="sr-only" for="look-font">Font chữ</label><select id="look-font" data-nokeep="1">${fonts}</select></div>
        <p class="look-sample">Pinya Printing · In ấn tại xưởng, giao tận tay. Bảng chữ: ÀÁẠẢÃ Ơ Ư Đ 0123456789</p>
        <h2 class="sec-title">Cỡ chữ</h2>
        ${seg('lk-size', P.SIZE_NAMES, l.size)}
        <h2 class="sec-title">Mục hiển thị trên web</h2>
        ${P.SHOW_KEYS.map(([group, items]) => `<fieldset class="look-group"><legend>${esc(group)}</legend><div class="checks">${items.map(([k, label]) => showBox(k, label)).join('')}</div></fieldset>`).join('')}
        <fieldset class="look-group"><legend>Danh mục hiện trên web</legend>
          ${db.categories.length ? `<div class="checks">${db.categories.map(catBox).join('')}</div><p class="hint" style="margin-top:6px">Bỏ tích thì danh mục ẩn khỏi thanh ngang, trang chủ, chân trang và khách không mở được trang danh mục đó.</p>` : '<p class="muted">Chưa có danh mục.</p>'}</fieldset>
        <div class="actions"><button class="btn btn-cta" type="submit">Lưu giao diện</button>
          <button class="link-btn" type="button" data-act="lk-reset">Về mặc định</button>
          <button class="link-btn" type="button" data-act="lk-undo">Hoàn tác thay đổi</button></div>
      </form>`;
  }

  // ==== Cài đặt ====
  function viewSettings(db) {
    const s = db.settings;
    const f = (id, label, value, extra, full) =>
      `<div class="field${full ? ' full' : ''}"><label for="${id}">${label}</label><input id="${id}" value="${esc(value)}" autocomplete="off"${extra || ''} aria-describedby="err-${id}"><p class="err" id="err-${id}"></p></div>`;
    const demoCount = db.products.filter(p => p.demo).length + db.orders.filter(o => o.demo).length;
    const ask = ui.dataAsk;
    return `<div class="page-head"><div><h1>Cài đặt</h1><p>Thông tin cửa hàng hiện ở trang Giới thiệu, Liên hệ và chân trang.</p></div>
        <a class="btn btn-ghost btn-sm" href="index.html">Xem cửa hàng</a></div>
      <form id="s-form" class="panel" novalidate>
        <h2 class="sec-title">Cửa hàng</h2>
        <div class="form-grid">
          ${f('s-name', 'Tên shop', s.shopName)}
          ${f('s-tagline', 'Dòng giới thiệu ngắn', s.tagline, ' placeholder="VD: In ấn tại xưởng, giao tận tay"')}
          <div class="field full"><label for="s-about">Mô tả shop</label><textarea id="s-about" rows="5">${esc(s.about)}</textarea><p class="hint">Hiện ở trang Giới thiệu. Xuống dòng để tách đoạn.</p></div>
        </div>
        <h2 class="sec-title">Liên hệ</h2>
        <div class="form-grid">
          ${f('s-zalo', 'Zalo, điện thoại', fmt.phone(s.zalo), ' type="tel" inputmode="tel"')}
          ${f('s-shopmail', 'Email', s.email, ' type="email"')}
          ${f('s-hours', 'Giờ làm việc', s.hours)}
          ${f('s-address', 'Địa chỉ', s.address, ' placeholder="Bỏ trống nếu không muốn hiện"')}
          ${f('s-fb', 'Facebook', s.facebook, ' type="url" placeholder="facebook.com/tenshop"')}
          ${f('s-ig', 'Instagram', s.instagram, ' type="url" placeholder="instagram.com/tenshop"')}
        </div>
        <h2 class="sec-title">Thanh toán · khách chọn trả 100% hoặc đặt cọc</h2>
        <div class="form-grid three">
          <div class="field"><label for="s-th">Mốc giá trị đơn</label><div class="unit"><input id="s-th" inputmode="numeric" value="${esc(fmt.num(s.payThreshold))}" autocomplete="off" aria-describedby="err-s-th"><span>₫</span></div><p class="err" id="err-s-th"></p></div>
          <div class="field"><label for="s-dlow">Cọc đơn dưới mốc</label><div class="unit"><input id="s-dlow" inputmode="numeric" value="${esc(s.depositLow)}" autocomplete="off" aria-describedby="err-s-dlow"><span>%</span></div><p class="err" id="err-s-dlow"></p></div>
          <div class="field"><label for="s-dhigh">Cọc đơn từ mốc trở lên</label><div class="unit"><input id="s-dhigh" inputmode="numeric" value="${esc(s.depositHigh)}" autocomplete="off" aria-describedby="err-s-dhigh"><span>%</span></div><p class="err" id="err-s-dhigh"></p></div>
        </div>
        <p class="hint" style="margin-top:8px">Hiện tại: đơn dưới ${esc(fmt.short(s.payThreshold))} trả 100% hoặc cọc ${s.depositLow}%; đơn từ ${esc(fmt.short(s.payThreshold))} trả 100% hoặc cọc ${s.depositHigh}%.</p>
        <h2 class="sec-title">Tài khoản nhận tiền</h2>
        <div class="form-grid three">
          ${f('s-bank', 'Ngân hàng', s.bankName)}
          ${f('s-acc', 'Số tài khoản', s.bankNumber, ' inputmode="numeric"')}
          ${f('s-holder', 'Chủ tài khoản', s.bankHolder)}
        </div>
        <h2 class="sec-title">Quản trị</h2>
        <div class="form-grid">${f('s-admin', 'Tên hiển thị khi nhắn khách', s.adminName)}${f('s-email', 'Email đăng nhập', s.adminEmail, ' type="email"')}</div>
        <div class="actions"><button class="btn btn-cta" type="submit">Lưu cài đặt</button></div>
      </form>
      <section class="panel" style="margin-top:20px"><div class="panel-h"><h2>Dữ liệu chạy thử</h2></div>
        <p class="muted">${demoCount ? `Đang có ${demoCount} sản phẩm và đơn mẫu để xem thử.` : 'Không còn dữ liệu mẫu.'} Dữ liệu đang lưu trong trình duyệt này.</p>
        ${ask === 'clear' ? `<div class="confirm"><p>Xóa toàn bộ sản phẩm, đơn, khách và xưởng mẫu? Danh mục và cài đặt giữ nguyên.</p><div class="actions" style="margin-top:0">
              <button class="btn btn-danger btn-sm" type="button" data-act="clear-yes">Xóa dữ liệu mẫu</button><button class="btn btn-quiet btn-sm" type="button" data-act="data-no">Không</button></div></div>`
          : ask === 'reset' ? `<div class="confirm"><p>Xóa mọi thay đổi và khôi phục dữ liệu mẫu ban đầu?</p><div class="actions" style="margin-top:0">
              <button class="btn btn-danger btn-sm" type="button" data-act="reset-yes">Khôi phục dữ liệu mẫu</button><button class="btn btn-quiet btn-sm" type="button" data-act="data-no">Không</button></div></div>`
          : `<div class="actions">${demoCount ? '<button class="btn btn-quiet btn-sm" type="button" data-act="clear-ask">Xóa dữ liệu mẫu, bắt đầu bán thật</button>' : ''}
              <button class="link-btn" type="button" data-act="reset-ask">Khôi phục dữ liệu mẫu</button></div>`}
      </section>
      <section class="panel" style="margin-top:20px"><div class="panel-h"><h2>Phiên đăng nhập</h2></div>
        <p class="muted">Đang đăng nhập bằng ${esc(s.adminEmail)}.</p>
        <div class="actions"><button class="btn btn-quiet btn-sm" type="button" data-act="logout">Đăng xuất</button></div>
      </section>`;
  }

  // ==== Xử lý thao tác ====
  function setErr(id, msg) {
    const box = document.getElementById('err-' + id);
    if (box) box.textContent = msg || '';
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'FIELDSET') el.classList.toggle('invalid', !!msg);
    else el.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }

  function withOrder(fn) {
    const r = route();
    if (r.view !== 'order') return null;
    return P.update(d => { const o = P.findOrder(d, r.id); return o ? fn(d, o) : null; });
  }
  function done(msg) { P.ui.toast(msg); render(); }
  function toTop() { window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); }
  function addImages(files, onDone) {
    Promise.all(files.map(f => P.ui.fileToDataUrl(f).catch(() => null))).then(list => {
      const ok = list.filter(Boolean);
      if (ok.length < files.length) P.ui.toast('Có file không phải ảnh nên đã bỏ qua.');
      onDone(ok);
      render();
    });
  }

  app.addEventListener('click', e => {
    const fl = e.target.closest('[data-filter]');
    if (fl) { ui.status = fl.dataset.filter; ui.customer = null; ui.cat = 'all'; ui.q = ''; if (location.hash === '#don-hang') { e.preventDefault(); render(); } return; }

    const row = e.target.closest('tr[data-href]');
    if (row && !e.target.closest('a,button,input,label,td.pick')) { location.hash = row.dataset.href; return; }

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
    const db = P.load();
    const i = +t.dataset.i;
    switch (a) {
      case 'logout': P.setSession(ROLE, null); history.replaceState(null, '', location.pathname); render(); return;
      case 'fill-demo':
        document.getElementById('al-email').value = db.settings.adminEmail;
        document.getElementById('al-pass').value = DEMO_PASS;
        return;
      case 'status': ui.status = t.dataset.v; render(); return;
      case 'clear-customer': ui.customer = null; render(); return;
      case 'customer-orders': ui.customer = t.dataset.id; ui.status = 'all'; ui.cat = 'all'; ui.q = ''; go('don-hang'); return;
      // Sửa đơn
      case 'oe-open': ui.oEdit = true; lastRoute = ''; render(); { const n = document.getElementById('oe-name'); if (n) n.focus(); } return;
      case 'oe-cancel': ui.oEdit = false; render(); return;
      // Đơn in
      case 'j-new': ui.jEdit = 'new'; ui.jDraft = null; ui.jPre = null; ui.jDel = null; render(); toTop(); return;
      case 'j-edit': ui.jEdit = t.dataset.id; ui.jDraft = null; ui.jDel = null; render(); toTop(); return;
      case 'j-cancel': ui.jEdit = null; ui.jDraft = null; render(); return;
      case 'j-from-np': ui.jPre = [...ui.npPicked]; ui.npPicked = new Set(); render(); toTop(); return;
      case 'np-all': ui.npPicked = new Set(db.orders.filter(o => P.needsPrint(db, o)).map(o => o.id)); render(); return;
      case 'j-from-order': ui.jPre = [route().id]; go('don-in'); return;
      case 'j-edit-go': ui.jOpen = t.dataset.id; go('don-in'); return;
      case 'j-del-ask': ui.jDel = t.dataset.id; render(); return;
      case 'j-del-no': ui.jDel = null; render(); return;
      case 'j-del-yes': P.update(d => P.act.deletePrintJob(d, t.dataset.id)); ui.jDel = null; done('Đã xóa đơn in.'); return;
      // Phụ phí đơn in
      case 'fe-new': ui.feEdit = 'new'; ui.feDraft = null; ui.feDel = null; render(); { const n = document.getElementById('fe-name'); if (n) n.focus(); } return;
      case 'fe-edit': ui.feEdit = t.dataset.id; ui.feDraft = null; ui.feDel = null; render(); { const n = document.getElementById('fe-form'); if (n) n.scrollIntoView({ block: 'center' }); } return;
      case 'fe-cancel': ui.feEdit = null; ui.feDraft = null; render(); return;
      case 'fe-del-ask': ui.feDel = t.dataset.id; render(); return;
      case 'fe-del-no': ui.feDel = null; render(); return;
      case 'fe-del-yes': P.update(d => P.act.deleteJobFee(d, t.dataset.id)); ui.feDel = null; done('Đã xóa khoản phụ phí.'); return;
      // Giao diện
      case 'lk-theme': ui.look.theme = t.dataset.v; render(); return;
      case 'lk-mode': ui.look.mode = t.dataset.v; render(); return;
      case 'lk-size': ui.look.size = t.dataset.v; render(); return;
      case 'lk-avatar-rm': ui.look.avatar = ''; render(); return;
      case 'lk-reset': { const keepAvatar = ui.look.avatar; ui.look = Object.assign(P.baseLook(), { avatar: keepAvatar }); render(); return; }
      case 'lk-undo': ui.look = null; render(); P.ui.toast('Đã trả về bản đang lưu.'); return;
      // Phân loại nhanh theo số lượng
      case 'qk-toggle': ui.qk.open = !ui.qk.open; render(); return;
      case 'qk-preset': {
        const x = P.qtyPresets(db).find(y => y.id === t.dataset.id);
        if (x) { ui.qk.tiers = x.tiers.join(', '); if (x.unit) ui.qk.unit = x.unit; }
        render(); return;
      }
      case 'qk-del': P.update(d => P.act.deleteVariantPreset(d, t.dataset.id)); render(); P.ui.toast('Đã xóa mẫu.'); return;
      case 'qk-save': {
        const tiers = P.parseTiers(ui.qk.tiers);
        const name = ui.qk.pname.trim();
        if (!tiers.length) { setErr('qk', 'Nhập ít nhất một mức số lượng.'); return; }
        if (!name) { setErr('qk', 'Nhập tên cho mẫu mới.'); const n = document.getElementById('qk-pname'); if (n) n.focus(); return; }
        P.update(d => P.act.saveVariantPreset(d, { id: P.uid('q'), name, unit: ui.qk.unit.trim(), tiers }));
        ui.qk.pname = ''; render(); P.ui.toast('Đã lưu mẫu “' + name + '”. Dùng lại cho sản phẩm khác ở mục này.'); return;
      }
      case 'qk-gen': {
        const tiers = P.parseTiers(ui.qk.tiers);
        if (!tiers.length) { setErr('qk', 'Nhập ít nhất một mức số lượng.'); return; }
        const made = P.qtyVariants(tiers, ui.qk.unit, P.parseNum(ui.qk.price), ui.qk.prefix);
        const keep = ui.prod.variants.filter(v => String(v.name).trim() || v.price !== '');
        const have = new Set(keep.map(v => String(v.name).trim().toLowerCase()));
        const add = made.filter(v => !have.has(v.name.toLowerCase()));
        ui.prod.variants = keep.concat(add);
        render();
        P.ui.toast(add.length ? 'Đã tạo ' + add.length + ' phân loại.' + (add.length < made.length ? ' Bỏ ' + (made.length - add.length) + ' mức đã có.' : '') + (ui.qk.price.trim() ? '' : ' Điền giá cho từng phân loại nhé.') : 'Các phân loại này đã có trong sản phẩm.');
        return;
      }
      // Thao tác hàng loạt
      case 'bulk-ask': ui.bulkTo = document.getElementById('bulk-status').value; ui.bulkAsk = true; render(); return;
      case 'bulk-no': ui.bulkAsk = false; render(); return;
      case 'bulk-clear': ui.picked = new Set(); ui.bulkAsk = false; render(); return;
      case 'bulk-yes': {
        const ids = [...ui.picked];
        const to = ui.bulkTo;
        const n = P.update(d => ids.reduce((k, id) => { const o = P.findOrder(d, id); return o && bulkApply(d, o, to) ? k + 1 : k; }, 0));
        ui.picked = new Set(); ui.bulkAsk = false;
        done(n ? 'Đã chuyển ' + n + ' đơn sang “' + STATUSES[to].admin + '”.' : 'Các đơn đã ở trạng thái này rồi.');
        return;
      }
      // Logistics
      case 'l-new': ui.lEdit = 'new'; ui.lDraft = null; ui.lDel = null; render(); { const n = document.getElementById('lf-name'); if (n) n.focus(); } return;
      case 'l-edit': ui.lEdit = t.dataset.id; ui.lDraft = null; ui.lDel = null; render(); toTop(); { const n = document.getElementById('lf-name'); if (n) n.focus({ preventScroll: true }); } return;
      case 'l-cancel': ui.lEdit = null; ui.lDraft = null; render(); return;
      case 'lr-add': {
        const last = ui.lDraft.rates[ui.lDraft.rates.length - 1];
        ui.lDraft.rates.push(newRate(last && last.to !== '' ? last.to : ''));
        render(); return;
      }
      case 'lr-rm': if (ui.lDraft.rates.length > 1) { ui.lDraft.rates = ui.lDraft.rates.filter(r => r.id !== t.dataset.id); render(); } return;
      case 'l-del-ask': ui.lDel = t.dataset.id; render(); return;
      case 'l-del-no': ui.lDel = null; render(); return;
      case 'l-del-yes': {
        const w = (db.logistics || []).find(x => x.id === t.dataset.id);
        P.update(d => P.act.deleteLogistic(d, t.dataset.id));
        ui.lDel = null;
        done('Đã xóa ' + (w ? w.name : 'kho') + '.'); return;
      }
      // Đơn hàng
      case 'pay-ok': withOrder((d, o) => P.act.confirmPayment(d, o)); done('Đã xác nhận tiền. Đơn chuyển sang đang in.'); toTop(); return;
      case 'ship-start': {
        const method = document.getElementById('sh-method').value;
        const tracking = document.getElementById('sh-track').value.trim();
        const wh = document.getElementById('sh-wh').value;
        const kg = P.parseNum(document.getElementById('sh-kg').value) || 0;
        withOrder((d, o) => P.act.startShipping(d, o, method, tracking, wh, kg));
        done('Đã chuyển sang vận chuyển.'); toTop(); return;
      }
      case 'ship-next': withOrder((d, o) => P.act.setShipStage(d, o, Math.min(3, (o.shipping ? o.shipping.stage : 0) + 1))); done('Đã cập nhật vị trí hàng.'); return;
      case 'delivered': withOrder((d, o) => P.act.markDelivered(d, o)); done('Đã đánh dấu giao hàng.'); toTop(); return;
      case 'balance-ok': withOrder((d, o) => P.act.confirmBalance(d, o)); done('Đơn đã thu đủ.'); return;
      case 'reopen': withOrder((d, o) => P.act.reopen(d, o)); done('Đã mở lại đơn.'); return;
      case 'set-status': {
        const s = document.getElementById('ms-status').value;
        withOrder((d, o) => { if (o.status !== s) P.act.setStatus(d, o, s); });
        done('Đã đổi trạng thái.'); return;
      }
      case 'cancel-ask': ui.confirm = route().id; render(); return;
      case 'cancel-no': ui.confirm = null; render(); return;
      case 'cancel-yes': {
        const reason = (document.getElementById('cx-reason') || {}).value || '';
        withOrder((d, o) => P.act.cancel(d, o, reason.trim(), 'admin'));
        ui.confirm = null; done('Đã hủy đơn.'); return;
      }
      // Sản phẩm
      case 'pcat': ui.pcat = t.dataset.v; render(); return;
      case 'v-add': ui.prod.variants.push(newVariant()); render(); { const v = ui.prod.variants[ui.prod.variants.length - 1]; const el = document.getElementById('pv-name-' + v.id); if (el) el.focus(); } return;
      case 'v-rm': if (ui.prod.variants.length > 1) { ui.prod.variants = ui.prod.variants.filter(v => v.id !== t.dataset.id); render(); } return;
      case 'pimg-rm': ui.prod.images.splice(i, 1); render(); return;
      case 'p-del-ask': ui.prodDel = true; render(); return;
      case 'p-del-no': ui.prodDel = false; render(); return;
      case 'p-del-yes': {
        const name = ui.prod.name;
        P.update(d => P.act.deleteProduct(d, ui.prod.id));
        ui.prod = null; ui.prodDel = false;
        P.ui.toast('Đã xóa sản phẩm ' + name + '.');
        go('san-pham'); return;
      }
      // Danh mục
      case 'c-new': ui.cEdit = 'new'; ui.cDel = null; lastRoute = ''; render(); { const n = document.getElementById('cf-name'); if (n) n.focus(); } return;
      case 'c-edit': ui.cEdit = t.dataset.id; ui.cDel = null; lastRoute = ''; render(); toTop(); { const n = document.getElementById('cf-name'); if (n) n.focus({ preventScroll: true }); } return;
      case 'c-cancel': ui.cEdit = null; render(); return;
      case 'c-up': case 'c-down': {
        P.update(d => {
          const k = d.categories.findIndex(c => c.id === t.dataset.id);
          const j = a === 'c-up' ? k - 1 : k + 1;
          if (k < 0 || j < 0 || j >= d.categories.length) return;
          const tmp = d.categories[k]; d.categories[k] = d.categories[j]; d.categories[j] = tmp;
        });
        render(); return;
      }
      case 'c-del-ask': ui.cDel = t.dataset.id; render(); return;
      case 'c-del-no': ui.cDel = null; render(); return;
      case 'c-del-yes': {
        const id = t.dataset.id;
        const c = P.findCategory(db, id);
        if (db.products.some(p => p.catId === id)) { P.ui.toast('Danh mục còn sản phẩm nên chưa xóa được.'); return; }
        P.update(d => P.act.deleteCategory(d, id));
        ui.cDel = null;
        done('Đã xóa danh mục ' + (c ? c.name : '') + '.'); return;
      }
      // Xưởng
      case 'f-new': ui.fEdit = 'new'; lastRoute = ''; render(); { const n = document.getElementById('ff-name'); if (n) n.focus(); } return;
      case 'f-edit': ui.fEdit = t.dataset.id; lastRoute = ''; render(); toTop(); { const n = document.getElementById('ff-name'); if (n) n.focus({ preventScroll: true }); } return;
      case 'f-cancel': ui.fEdit = null; render(); return;
      // Dữ liệu
      case 'clear-ask': ui.dataAsk = 'clear'; render(); return;
      case 'reset-ask': ui.dataAsk = 'reset'; render(); return;
      case 'data-no': ui.dataAsk = null; render(); return;
      case 'clear-yes': P.clearDemo(); ui.dataAsk = null; ui.prod = null; lastRoute = ''; done('Đã xóa dữ liệu mẫu. Bắt đầu thêm sản phẩm thật nhé.'); return;
      case 'reset-yes': P.reset(); ui.dataAsk = null; ui.prod = null; lastRoute = ''; done('Đã khôi phục dữ liệu mẫu.'); return;
    }
  });

  app.addEventListener('keydown', e => {
    if (e.target.id === 'chat-input' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      document.getElementById('chat-form').requestSubmit();
    }
  });

  // Tìm kiếm: không vẽ lại khi bộ gõ tiếng Việt đang ghép dấu
  function onSearch(el) {
    if (el.id === 'o-search') { ui.q = el.value; render(); return true; }
    if (el.id === 'p-search') { ui.pq = el.value; render(); return true; }
    if (el.id === 'j-search') { ui.jq = el.value; render(); return true; }
    return false;
  }
  app.addEventListener('compositionend', e => { onSearch(e.target); });

  // Trình sửa sản phẩm: ghi thẳng vào bản nháp để vẽ lại không mất chữ
  function bindDraft(el) {
    if (!ui.prod || !el.dataset.bind) return;
    const k = el.dataset.k;
    const val = el.value;
    if (el.dataset.v) {
      const v = ui.prod.variants.find(x => x.id === el.dataset.v);
      if (!v) return;
      if (k === 'price') v.price = val.trim() === '' ? '' : (P.parseNum(val) || 0);
      else if (k === 'minQty') v.minQty = parseInt(val.replace(/\D/g, ''), 10) || '';
      else v[k] = val;
    } else if (k === 'leadDays') ui.prod.leadDays = parseInt(val.replace(/\D/g, ''), 10) || '';
    else ui.prod[k] = val;
  }

  // Kho trung chuyển: ghi vào bản nháp
  function bindLogistic(el) {
    const w = ui.lDraft;
    if (!w || !el.dataset.lbind) return;
    const k = el.dataset.k;
    const num = v => v.trim() === '' ? '' : (P.parseNum(v) >= 0 ? P.parseNum(v) : '');
    if (el.dataset.r) {
      const r = w.rates.find(x => x.id === el.dataset.r);
      if (r) r[k] = num(el.value);
    } else if (k === 'minCharge') w.minCharge = num(el.value);
    else w[k] = el.value;
  }

  // Phí ship ước tính khi chọn kho và cân nặng ở bước gửi hàng
  function updateShipQuote() {
    const out = document.getElementById('sh-quote');
    if (!out) return;
    const w = (P.load().logistics || []).find(x => x.id === document.getElementById('sh-wh').value);
    const kg = P.parseNum(document.getElementById('sh-kg').value);
    if (!w || !(kg > 0)) { out.textContent = 'Chọn kho và nhập cân nặng để xem phí ship theo bảng giá.'; return; }
    const q = P.shipQuote(w, kg);
    out.textContent = q && q.ok
      ? 'Phí ship ước tính: ' + fmt.vnd(q.cost) + ' (' + fmt.num(kg) + ' kg × ' + fmt.vnd(q.rate) + (q.usedMin ? ', áp phí tối thiểu' : '') + ')'
      : 'Bảng giá của ' + w.name + ' chưa có mức cho ' + fmt.num(kg) + ' kg.';
  }

  app.addEventListener('input', e => {
    const el = e.target;
    const id = el.id;
    if (id === 'o-search' || id === 'p-search' || id === 'j-search') { if (!e.isComposing) onSearch(el); return; }
    if (el.dataset.jl || el.dataset.jf) { bindJob(el); updateJobOut(); setErr('j-lines', ''); return; }
    if (el.dataset.fe && ui.feDraft) {
      const k = el.dataset.fe;
      ui.feDraft[k] = k === 'amount' ? (el.value.trim() === '' ? '' : (P.parseNum(el.value) >= 0 ? P.parseNum(el.value) : '')) : el.value;
      if (k === 'amount') updateFeeOut();
      setErr('fe-' + k, ''); return;
    }
    if (el.dataset.qk) { ui.qk[el.dataset.qk] = el.value; const out = document.getElementById('qk-out'); if (out) out.textContent = qkText(); setErr('qk', ''); return; }
    if (id === 'lg-kg') { ui.lKg = el.value; const out = document.getElementById('lg-out'); if (out) out.innerHTML = quoteRows(P.load()); return; }
    if (id === 'sh-kg') { updateShipQuote(); return; }
    if (el.dataset.lbind) { bindLogistic(el); if (id === 'lf-name') setErr('lf-name', ''); if (el.dataset.r) setErr('lf-rates', ''); return; }
    if (el.dataset.bind) bindDraft(el);
    if (id && document.getElementById('err-' + id) && document.getElementById('err-' + id).textContent) setErr(id, '');
    if (el.dataset.v) setErr('pf-variants', '');
  });

  app.addEventListener('change', e => {
    const el = e.target;
    const id = el.id;
    if (id === 'o-cat') { ui.cat = el.value; render(); return; }
    if (id === 'p-state') { ui.pstate = el.value; render(); return; }
    // Chọn đơn để đổi trạng thái hàng loạt
    if (el.classList.contains('o-pick')) {
      if (el.checked) ui.picked.add(el.dataset.id); else ui.picked.delete(el.dataset.id);
      ui.bulkAsk = false; render(); return;
    }
    if (id === 'o-all') {
      const ids = Array.from(app.querySelectorAll('.o-pick')).map(x => x.dataset.id);
      ui.picked = el.checked ? new Set(ids) : new Set();
      ui.bulkAsk = false; render(); return;
    }
    if (id === 'bulk-status') { ui.bulkTo = el.value; ui.bulkAsk = false; return; }
    // Đơn in: tích chọn đơn khách thì thêm hoặc bỏ các sản phẩm của đơn đó
    if (el.classList.contains('jo-pick') && ui.jDraft) {
      const o = P.findOrder(P.load(), el.value);
      if (!o) return;
      if (el.checked) ui.jDraft.lines = ui.jDraft.lines.concat(linesFromOrder(o));
      else ui.jDraft.lines = ui.jDraft.lines.filter(l => l.orderId !== o.id);
      setErr('j-lines', '');
      render(); return;
    }
    if (el.classList.contains('fe-pick') && ui.feDraft) {
      const set = new Set(ui.feDraft.jobIds);
      if (el.checked) set.add(el.value); else set.delete(el.value);
      ui.feDraft.jobIds = [...set];
      setErr('fe-jobs', '');
      render(); return;
    }
    if (el.dataset.fe && ui.feDraft) {
      if (el.dataset.fe === 'amount' && el.value.trim() !== '') { const n = P.parseNum(el.value); if (n >= 0) el.value = fmt.num(n); }
      return;
    }
    if (el.dataset.qk) {
      if (el.dataset.qk === 'price' && el.value.trim() !== '') { const n = P.parseNum(el.value); if (n >= 0) { el.value = fmt.num(n); ui.qk.price = fmt.num(n); } }
      return;
    }
    // Giao diện
    if (ui.look && el.dataset.lshow) { ui.look.show[el.dataset.lshow] = el.checked; P.applyLook(ui.look); return; }
    if (ui.look && el.dataset.lcat) {
      const set = new Set(ui.look.hiddenCats);
      if (el.checked) set.delete(el.dataset.lcat); else set.add(el.dataset.lcat);
      ui.look.hiddenCats = [...set]; return;
    }
    if (id === 'look-font' && ui.look) { ui.look.font = el.value; render(); return; }
    if (id === 'look-avatar' && ui.look) {
      const file = (el.files || [])[0]; el.value = '';
      if (!file) return;
      P.ui.fileToDataUrl(file, 256, 0.85).then(url => { ui.look.avatar = url; render(); }, () => P.ui.toast('File này không phải ảnh.'));
      return;
    }
    if (el.classList.contains('np-pick')) {
      if (el.checked) ui.npPicked.add(el.value); else ui.npPicked.delete(el.value);
      render(); return;
    }
    if (el.dataset.jl || el.dataset.jf) {
      bindJob(el);
      if (el.inputMode && el.value.trim() !== '') { const n = P.parseNum(el.value); if (n >= 0) el.value = fmt.num(n); }
      updateJobOut();
      return;
    }
    // Điền cân nặng ngay trên bảng Đơn in khi hàng về
    if (el.classList.contains('jkg')) {
      const kg = el.value.trim() === '' ? '' : P.parseNum(el.value);
      if (kg !== '' && !(kg >= 0)) { P.ui.toast('Cân nặng phải là số, ví dụ 12,5.'); return; }
      P.update(d => { const j = (d.printJobs || []).find(x => x.id === el.dataset.id); if (j) j.kg = kg; });
      done(kg ? 'Đã lưu cân nặng ' + fmt.num(kg) + ' kg.' : 'Đã xóa cân nặng.');
      return;
    }
    if (id === 'sh-wh') { updateShipQuote(); return; }
    if (el.dataset.lbind) {
      bindLogistic(el);
      // Định dạng lại số ngay trong ô, không vẽ lại cả trang
      if (el.inputMode && el.value.trim() !== '') { const n = P.parseNum(el.value); if (n >= 0) el.value = fmt.num(n); }
      return;
    }
    if (el.dataset.bind) {
      bindDraft(el);
      // Định dạng lại số ngay trong ô, không vẽ lại cả trang (để cú bấm "Lưu" kế tiếp không bị mất)
      if (el.dataset.k === 'price' && el.value.trim() !== '') { const n = P.parseNum(el.value); if (n >= 0) el.value = fmt.num(n); }
      return;
    }
    if (el.dataset.actRadio === 'active' && ui.prod) { ui.prod.active = el.value === '1'; return; }
    if (id === 'fac-select') {
      const v = el.value;
      withOrder((d, o) => P.act.setFactory(d, o, v));
      done('Đã đổi xưởng phụ trách.');
      return;
    }
    if (id === 'pimg-files') {
      const files = Array.from(el.files || []); el.value = '';
      addImages(files, ok => { if (ui.prod) ui.prod.images = ui.prod.images.concat(ok); });
      return;
    }
    if (id && id.indexOf('ff-cat-') === 0) setErr('ff-cats', '');
  });

  app.addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target;
    const val = id => (document.getElementById(id) || {}).value || '';

    if (f.id === 'j-form') {
      const j = ui.jDraft;
      if (!j) return;
      f.querySelectorAll('[data-jl],[data-jf]').forEach(bindJob);
      setErr('j-lines', ''); setErr('jf-rate', '');
      if (!j.lines.length) { setErr('j-lines', 'Chọn ít nhất một đơn khách để đặt in.'); return; }
      const badLine = j.lines.find(l => !(+l.qty > 0) || !(+l.cny > 0));
      if (badLine) {
        setErr('j-lines', 'Mỗi sản phẩm cần có số lượng in và đơn giá tệ.');
        const el = document.querySelector(`[data-jl="${badLine.id}"][data-k="${+badLine.qty > 0 ? 'cny' : 'qty'}"]`);
        if (el) el.focus();
        return;
      }
      if (!(+j.rate > 0)) { setErr('jf-rate', 'Nhập tỷ giá.'); document.getElementById('jf-rate').focus(); return; }
      const isNew = ui.jEdit === 'new';
      const clean = {
        id: j.id, mvd: String(j.mvd || '').trim(), rate: +j.rate, kg: j.kg === '' ? '' : +j.kg, whId: j.whId || '', note: String(j.note || '').trim(),
        lines: j.lines.map(l => ({ id: l.id, orderId: l.orderId, itemIndex: l.itemIndex, productName: l.productName, variantName: l.variantName, qty: Math.round(+l.qty), cny: +l.cny }))
      };
      let code = j.code;
      P.update(d => {
        if (!isNew) { const old = (d.printJobs || []).find(x => x.id === clean.id); if (old) delete old.demo; }
        P.act.savePrintJob(d, clean);
        code = (d.printJobs.find(x => x.id === clean.id) || {}).code;
      });
      ui.jEdit = null; ui.jDraft = null;
      const n = new Set(clean.lines.map(l => l.orderId)).size;
      done((isNew ? 'Đã tạo đơn in ' : 'Đã lưu đơn in ') + (code || '') + ' cho ' + n + ' đơn khách.');
      return;
    }

    if (f.id === 'look-form') {
      P.update(d => { d.settings.look = P.normLook(ui.look); });
      ui.look = null;
      done('Đã lưu giao diện. Cửa hàng đã cập nhật.');
      return;
    }

    if (f.id === 'fe-form') {
      const x = ui.feDraft;
      if (!x) return;
      setErr('fe-name', ''); setErr('fe-amount', ''); setErr('fe-jobs', '');
      if (!String(x.name).trim()) { setErr('fe-name', 'Nhập tên khoản phí.'); document.getElementById('fe-name').focus(); return; }
      if (!(+x.amount > 0)) { setErr('fe-amount', 'Nhập tổng tiền lớn hơn 0.'); document.getElementById('fe-amount').focus(); return; }
      if (!x.jobIds.length) { setErr('fe-jobs', 'Chọn ít nhất một đơn in.'); return; }
      const db = P.load();
      const noKg = x.jobIds.map(id => (db.printJobs || []).find(j => j.id === id)).filter(j => j && !(+j.kg > 0));
      if (noKg.length) { setErr('fe-jobs', noKg.map(j => j.code).join(', ') + ' chưa có cân nặng nên chưa chia được.'); return; }
      const clean = { id: x.id, name: String(x.name).trim(), amount: Math.round(+x.amount), jobIds: x.jobIds.slice(), note: String(x.note || '').trim() };
      const isNew = ui.feEdit === 'new';
      P.update(d => P.act.saveJobFee(d, clean));
      ui.feEdit = null; ui.feDraft = null;
      done((isNew ? 'Đã thêm phụ phí ' : 'Đã lưu phụ phí ') + clean.name + '.');
      return;
    }

    if (f.id === 'oe-form') {
      const db = P.load();
      const o = P.findOrder(db, route().id);
      if (!o) return;
      const data = {
        name: val('oe-name').trim(), phone: val('oe-phone'), social: val('oe-social').trim(), address: val('oe-address').trim(),
        city: val('oe-city'), file: val('oe-file').trim(), note: val('oe-note').trim(),
        items: o.items.map((_, i) => ({ qty: P.parseNum(val('oe-qty-' + i)), price: P.parseNum(val('oe-price-' + i)) })),
        payPct: +val('oe-pay') || o.payPct
      };
      setErr('oe-name', ''); setErr('oe-phone', '');
      if (!data.name) { setErr('oe-name', 'Nhập họ tên.'); document.getElementById('oe-name').focus(); return; }
      if (P.normPhone(data.phone).length < 9) { setErr('oe-phone', 'Số điện thoại cần ít nhất 9 chữ số.'); document.getElementById('oe-phone').focus(); return; }
      withOrder((d, x) => P.act.editOrder(d, x, data));
      ui.oEdit = false;
      lastRoute = '';
      done('Đã lưu thay đổi của đơn.');
      return;
    }

    if (f.id === 'l-form') {
      const w = ui.lDraft;
      if (!w) return;
      f.querySelectorAll('[data-lbind]').forEach(bindLogistic);
      setErr('lf-name', ''); setErr('lf-rates', '');
      let ok = true;
      if (!String(w.name).trim()) { setErr('lf-name', 'Nhập tên kho.'); ok = false; }
      const rates = w.rates.filter(r => r.price !== '' || r.from !== '' || r.to !== '');
      const badRate = !rates.length || rates.some(r => !(+r.price > 0) || (r.to !== '' && +r.to <= (+r.from || 0)));
      if (badRate) { setErr('lf-rates', 'Mỗi mức cân cần có giá, và số kg “Đến” phải lớn hơn “Từ”.'); ok = false; }
      if (!ok) { const first = document.getElementById(String(w.name).trim() ? 'lr-price-' + w.rates[0].id : 'lf-name'); if (first) first.focus(); return; }
      const clean = Object.assign({}, w, {
        name: w.name.trim(), minCharge: +w.minCharge || 0,
        rates: rates.map(r => ({ id: r.id, from: +r.from || 0, to: r.to === '' ? '' : +r.to, price: Math.round(+r.price) }))
      });
      delete clean._key;
      const isNew = ui.lEdit === 'new';
      if (!isNew) delete clean.demo;
      P.update(d => P.act.saveLogistic(d, clean));
      ui.lEdit = null; ui.lDraft = null;
      done(isNew ? 'Đã thêm ' + clean.name + '.' : 'Đã lưu ' + clean.name + '.');
      return;
    }

    if (f.id === 'login-form') {
      const email = val('al-email').trim().toLowerCase();
      const s = P.load().settings;
      setErr('al-email', ''); setErr('al-pass', '');
      if (!email) { setErr('al-email', 'Nhập email đăng nhập.'); return; }
      if (email !== String(s.adminEmail).toLowerCase() || val('al-pass') !== DEMO_PASS) { setErr('al-pass', 'Email hoặc mật khẩu chưa đúng.'); return; }
      P.setSession(ROLE, { email });
      lastRoute = '';
      render();
      return;
    }

    if (f.id === 'chat-form') {
      const inp = document.getElementById('chat-input');
      const text = inp.value.trim();
      if (!text) return;
      withOrder((d, o) => P.act.sendMessage(d, o, 'admin', text));
      inp.value = '';
      render();
      const again = document.getElementById('chat-input'); if (again) again.focus();
      return;
    }

    if (f.id === 'fee-form') {
      const fee = P.parseNum(val('fee-amt')) || 0;
      const note = val('fee-note').trim();
      withOrder((d, o) => P.act.setExtraFee(d, o, fee, note));
      lastRoute = '';
      done(fee ? 'Đã lưu phụ phí ' + fmt.vnd(fee) + '.' : 'Đã bỏ phụ phí.');
      return;
    }

    if (f.id === 'prod-form') {
      const p = ui.prod;
      if (!p) return;
      f.querySelectorAll('[data-bind]').forEach(bindDraft);
      let ok = true;
      setErr('pf-name', ''); setErr('pf-variants', '');
      if (!p.name.trim()) { setErr('pf-name', 'Nhập tên sản phẩm.'); ok = false; }
      const badV = p.variants.filter(v => !String(v.name).trim() || v.price === '' || !(v.price >= 0));
      if (badV.length) {
        setErr('pf-variants', 'Mỗi phân loại cần có tên và giá.');
        badV.forEach(v => {
          if (!String(v.name).trim()) document.getElementById('pv-name-' + v.id).setAttribute('aria-invalid', 'true');
          if (v.price === '' || !(v.price >= 0)) document.getElementById('pv-price-' + v.id).setAttribute('aria-invalid', 'true');
        });
        ok = false;
      }
      if (!ok) { const first = f.querySelector('[aria-invalid="true"]'); if (first) first.focus(); return; }
      const clean = {
        id: p.id, catId: p.catId, name: p.name.trim(), desc: String(p.desc || '').trim(), leadDays: +p.leadDays || 0,
        images: p.images, active: !!p.active,
        variants: p.variants.map(v => ({ id: v.id, name: String(v.name).trim(), price: Math.round(+v.price), minQty: Math.max(1, +v.minQty || 1) }))
      };
      const isNew = p._new;
      P.update(d => P.act.saveProduct(d, clean));
      ui.prod = null;
      P.ui.toast(isNew ? 'Đã thêm sản phẩm ' + clean.name + '.' : 'Đã lưu ' + clean.name + '.');
      go('san-pham');
      return;
    }

    if (f.id === 'c-form') {
      const name = val('cf-name').trim();
      if (!name) { setErr('cf-name', 'Nhập tên danh mục.'); document.getElementById('cf-name').focus(); return; }
      const ink = (f.querySelector('input[name="cf-ink"]:checked') || {}).value || 'c';
      const desc = val('cf-desc').trim();
      const isNew = ui.cEdit === 'new';
      P.update(d => {
        if (isNew) {
          let id = P.slugify(name), n = 2;
          while (d.categories.some(c => c.id === id)) id = P.slugify(name) + '-' + n++;
          P.act.saveCategory(d, { id, name, desc, ink });
        } else P.act.saveCategory(d, { id: ui.cEdit, name, desc, ink });
      });
      ui.cEdit = null;
      done(isNew ? 'Đã thêm danh mục ' + name + '. Danh mục đã hiện trên thanh ngang cửa hàng.' : 'Đã lưu danh mục ' + name + '.');
      return;
    }

    if (f.id === 'f-form') {
      const db = P.load();
      const name = val('ff-name').trim();
      const cats = db.categories.map(c => c.id).filter(k => { const el = document.getElementById('ff-cat-' + k); return el && el.checked; });
      setErr('ff-name', ''); setErr('ff-cats', '');
      if (!name) { setErr('ff-name', 'Nhập tên xưởng.'); document.getElementById('ff-name').focus(); return; }
      if (!cats.length) { setErr('ff-cats', 'Chọn ít nhất một danh mục.'); return; }
      const data = {
        name, cats, rating: Math.max(1, Math.min(5, P.parseNum(val('ff-rating')) || 4)),
        cn: val('ff-cn').trim(), city: val('ff-city'), contact: val('ff-contact').trim(), note: val('ff-note').trim()
      };
      const isNew = ui.fEdit === 'new';
      P.update(d => {
        if (isNew) d.factories.push(Object.assign({ id: P.uid('x') }, data));
        else { const x = P.findFactory(d, ui.fEdit); if (x) Object.assign(x, data); }
      });
      ui.fEdit = null;
      done(isNew ? 'Đã thêm xưởng ' + name + '.' : 'Đã lưu xưởng ' + name + '.');
      return;
    }

    if (f.id === 's-form') {
      const th = P.parseNum(val('s-th'));
      const dlow = P.parseNum(val('s-dlow'));
      const dhigh = P.parseNum(val('s-dhigh'));
      const email = val('s-email').trim();
      const name = val('s-name').trim();
      const bad = [];
      if (!name) bad.push(['s-name', 'Nhập tên shop.']);
      if (P.normPhone(val('s-zalo')).length < 9) bad.push(['s-zalo', 'Nhập số Zalo, ít nhất 9 chữ số.']);
      if (!(th > 0)) bad.push(['s-th', 'Nhập mốc giá trị đơn, ví dụ 1.000.000.']);
      if (!(dlow > 0 && dlow < 100)) bad.push(['s-dlow', 'Nhập tỷ lệ cọc từ 1 đến 99.']);
      if (!(dhigh > 0 && dhigh < 100)) bad.push(['s-dhigh', 'Nhập tỷ lệ cọc từ 1 đến 99.']);
      if (!/^\S+@\S+\.\S+$/.test(email)) bad.push(['s-email', 'Nhập email hợp lệ.']);
      ['s-name', 's-zalo', 's-th', 's-dlow', 's-dhigh', 's-email'].forEach(id => setErr(id, ''));
      bad.forEach(b => setErr(b[0], b[1]));
      if (bad.length) { document.getElementById(bad[0][0]).focus(); return; }
      P.update(d => Object.assign(d.settings, {
        shopName: name, tagline: val('s-tagline').trim(), about: val('s-about').trim(),
        zalo: P.normPhone(val('s-zalo')), email: val('s-shopmail').trim(), hours: val('s-hours').trim(), address: val('s-address').trim(),
        facebook: val('s-fb').trim(), instagram: val('s-ig').trim(),
        payThreshold: Math.round(th), depositLow: Math.round(dlow), depositHigh: Math.round(dhigh), bankName: val('s-bank').trim(), bankNumber: val('s-acc').trim(), bankHolder: val('s-holder').trim(),
        adminName: val('s-admin').trim() || name, adminEmail: email
      }));
      lastRoute = '';
      done('Đã lưu cài đặt. Cửa hàng đã cập nhật.');
    }
  });

  window.addEventListener('hashchange', () => {
    ui.confirm = null; ui.fEdit = null; ui.cEdit = null; ui.cDel = null; ui.dataAsk = null;
    ui.lEdit = null; ui.lDraft = null; ui.lDel = null; ui.bulkAsk = false;
    ui.jEdit = null; ui.jDraft = null; ui.jDel = null; ui.oEdit = false;
    ui.feEdit = null; ui.feDraft = null; ui.feDel = null; ui.look = null;
    if (route().view !== 'product') ui.prod = null;
    render();
    window.scrollTo(0, 0);
  });
  P.loadLogo(() => render());
  P.onChange(kind => { if (kind === 'db') render(); });
  render();
})();
