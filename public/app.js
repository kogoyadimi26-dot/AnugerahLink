/* AnugerahLink: antarmuka dalam Bahasa Indonesia.
   Hash-routed, tanpa framework, tanpa permintaan ke pihak ketiga.
   Semua nilai yang ditulis ke halaman melewati esc(). */
(function () {
  'use strict';

  const main = document.getElementById('main');
  const toastEl = document.getElementById('toast');
  const state = { config: null, regions: [], cart: loadCart() };

  // ---------- utilitas ----------
  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function rp(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); }
  function kg(n) { return Number(n || 0).toLocaleString('id-ID') + ' kg'; }
  function tanggal(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? esc(iso) : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }
  // Nama proses + penjelasan singkat untuk pembeli.
  function processHtml(text, info) {
    if (!info) return esc(text || '—');
    return `${esc(info.label)}
      <details class="explain"><summary>Apa artinya?</summary><p>${esc(info.description)}</p></details>`;
  }

  function tierClass(code) { return 'tier tier-' + esc(code); }
  function tierLabel(code) { return (state.config && state.config.tiers[code] && state.config.tiers[code].label) || code; }
  const STATUS_TEKS = {
    requested: 'Diminta', confirmed: 'Dikonfirmasi', paid: 'Sudah dibayar', shipped: 'Dikirim',
    delivered: 'Sudah diantar', completed: 'Selesai', cancelled: 'Dibatalkan',
  };
  const LOT_STATUS = { received: 'Diterima', graded: 'Menunggu verifikasi', verified: 'Siap diterbitkan', listed: 'Tayang', withdrawn: 'Ditarik', rejected: 'Ditolak' };
  const CHECK_TEKS = { passed: 'Lolos', adjusted: 'Dipotong', rejected: 'Ditolak' };
  const JENIS_PEMBELI = [
    ['specialty_cafe', 'Kafe spesialti'], ['premium_roaster', 'Roaster premium'], ['roaster', 'Roaster'],
    ['papua_business', 'Kafe atau usaha di Papua'], ['other', 'Lainnya'],
  ];

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { toastEl.hidden = true; }, 4000);
  }

  function loadCart() {
    try { return JSON.parse(localStorage.getItem('al-cart') || '[]').filter((l) => l && l.lotCode && l.kg); } catch { return []; }
  }
  function saveCart() {
    try { localStorage.setItem('al-cart', JSON.stringify(state.cart)); } catch { /* penyimpanan diblokir: keranjang hanya untuk halaman ini */ }
    updateCartCount();
  }
  function updateCartCount() {
    const n = state.cart.reduce((a, l) => a + l.kg, 0);
    const badge = document.getElementById('cart-count');
    badge.hidden = n === 0;
    badge.textContent = String(n);
  }

  function adminToken() { try { return sessionStorage.getItem('al-admin') || ''; } catch { return ''; } }
  function currentUser() { try { return JSON.parse(sessionStorage.getItem('al-user') || 'null'); } catch { return null; } }
  const ROLE_PAGES = { admin: ['dashboard', 'alur', 'intake', 'lots', 'orders', 'feedback', 'users', 'audit', 'settings'], grader: ['alur', 'lots'], field_agent: ['intake', 'lots'] };
  function canDo(action) {
    const r = (currentUser() || {}).role;
    if (action === 'verify') return r === 'admin' || r === 'grader';
    if (action === 'publish') return r === 'admin';
    return false;
  }
  function allowedPages() { const u = currentUser(); return (u && ROLE_PAGES[u.role]) || []; }
  function setAdminToken(t) { try { sessionStorage.setItem('al-admin', t); } catch { /* abaikan */ } }
  function clearAdminToken() { try { sessionStorage.removeItem('al-admin'); sessionStorage.removeItem('al-user'); } catch { /* abaikan */ } }

  function session(key) { try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { return null; } }
  function setSession(key, v) { try { sessionStorage.setItem(key, JSON.stringify(v)); } catch { /* abaikan */ } }

  async function api(path, { method = 'GET', body, admin = false } = {}) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (admin) headers.Authorization = 'Bearer ' + adminToken();
    else if (buyerToken() && isBuyerPath(path)) headers.Authorization = 'Bearer ' + buyerToken();
    let res;
    try {
      res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch {
      throw { message: 'Koneksi ke server terputus. Periksa internet Anda, lalu coba lagi.', fields: {} };
    }
    let data = {};
    try { data = await res.json(); } catch { /* badan kosong */ }
    if (!res.ok) {
      const err = (data && data.error) || { message: 'Ada kendala di sisi kami. Coba lagi sebentar lagi.' };
      if (res.status === 401 && admin) { clearAdminToken(); }
      if (res.status === 401 && !admin && isBuyerPath(path)) { setBuyerToken(''); }
      throw { message: err.message, fields: err.fields || {}, status: res.status, code: err.code, extra: err };
    }
    return data;
  }

  // Halaman dalam bagian Katalog (Produk, Kategori, Tentang) diberi menu tab yang sama.
  function katalogSubnav() {
    const h = location.hash || '';
    const tabs = [['#/catalogue', 'Produk'], ['#/about', 'Tentang']];
    const active = tabs.find(([href]) => h.startsWith(href)) || tabs[0];
    return `<nav class="subnav" aria-label="Menu katalog">${tabs.map(([href, label]) => `<a href="${href}"${href === active[0] ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>`;
  }

  function setMain(html) {
    main.innerHTML = (state.section === 'katalog' ? katalogSubnav() : '') + html;
    main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  function fieldError(fields, key) {
    return fields && fields[key] ? `<p class="error" id="err-${esc(key)}">Galat: ${esc(fields[key])}</p>` : '';
  }

  // Membaca formulir menjadi objek biasa. Angka dikirim sebagai teks; server yang mengubahnya.
  function formData(form) {
    const out = {};
    for (const el of form.elements) {
      if (!el.name) continue;
      out[el.name] = el.type === 'checkbox' ? el.checked : el.value;
    }
    return out;
  }

  function showFormError(form, err) {
    const box = form.querySelector('[data-form-error]');
    if (box) { box.hidden = false; box.textContent = err.message || 'Mohon coba lagi.'; }
    if (err.fields) {
      for (const key of Object.keys(err.fields)) {
        const el = form.querySelector(`[name="${CSS.escape(key)}"]`);
        if (el) el.setAttribute('aria-invalid', 'true');
      }
    }
  }

  function busy(btn, on, labelWhileBusy) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = labelWhileBusy || 'Memproses…'; btn.disabled = true; }
    else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
  }

  function readAsDataUrl(file) {
    if (file.size > 2 * 1024 * 1024) return Promise.reject({ message: 'Foto terlalu besar. Maksimal 2 MB.', fields: {} });
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject({ message: 'Foto tidak bisa dibaca.', fields: {} });
      r.readAsDataURL(file);
    });
  }

  function passportHref(code) { return '#/passport/' + encodeURIComponent(code); }
  function lotHref(code) { return '#/lot/' + encodeURIComponent(code); }

  // ---------- toko (pembeli) ----------
  function lotCard(l) {
    const soldOut = l.soldOut;
    return `
      <article class="card lot-card" aria-labelledby="lot-${esc(l.code)}">
        ${l.coverPhotoId ? `<img class="lot-cover" src="/api/lots/${encodeURIComponent(l.code)}/photos/${encodeURIComponent(l.coverPhotoId)}" alt="Foto ${esc(l.title)}" loading="lazy">` : ''}
        <div class="btn-row" style="justify-content:space-between">
          <span class="${tierClass(l.tier)}">${esc(l.tierLabel)}</span>
          <span class="code">${esc(l.code)}</span>
        </div>
        <h3 id="lot-${esc(l.code)}"><a href="${lotHref(l.code)}" style="color:inherit;text-decoration:none">${esc(l.title)}</a></h3>
        <p class="muted">${esc(l.groupName)} · ${esc(l.process)} · ${esc(l.grade)}</p>
        <p class="price num">${rp(l.pricePerKg)} <span class="muted" style="font-size:14px;font-weight:400">per kg</span></p>
        <div class="btn-row">
          ${soldOut ? '<span class="pill bad">Habis terjual</span>' : `<span class="pill">${kg(l.availableKg)} tersedia</span>`}
          ${l.lowStock ? '<span class="pill warn">Stok menipis</span>' : ''}
        </div>
        <div class="btn-row" style="margin-top:auto">
          <a class="btn secondary small" href="${lotHref(l.code)}">Lihat lot</a>
          <a class="btn secondary small" href="${passportHref(l.code)}">Paspor</a>
        </div>
      </article>`;
  }

  function policySection() {
    const pol = state.config.policy;
    return `
      <section class="policy" aria-labelledby="policy-title">
        <div class="policy-head">
          <h2 id="policy-title">Klaim dan pengembalian</h2>
          ${pol.status !== 'approved' ? '<span class="pill warn">Draf</span>' : ''}
        </div>
        <ol class="policy-list">
          ${pol.sections.map((x, i) => `
            <li><details ${i === 0 ? 'open' : ''}>
              <summary>${esc(x.title)}</summary>
              <p>${esc(x.text)}</p>
            </details></li>`).join('')}
        </ol>
      </section>`;
  }

  async function viewHome() {
    setMain(`<p class="muted">Memuat lot…</p>`);
    const { lots } = await api('/api/lots?sort=cup_desc');
    const featured = lots.slice(0, 3);
    const tiers = state.config.tiers;
    setMain(`
      <section class="hero">
        <h1>${esc(state.config.content.homeTitle)}</h1>
        <p class="lead">${esc(state.config.content.homeLead)}</p>
        <div class="btn-row"><a class="btn" href="#/catalogue">Lihat lot tersedia</a><a class="btn secondary" href="#/about">Cara kerja kami</a></div>
      </section>
      <section aria-labelledby="how">
        <h2 id="how">Cara kami bekerja</h2>
        <div class="pillars">
          ${(state.config.about.pillars || []).map((x) => `
            <article class="pillar">
              <span class="pillar-icon">${ICONS[x.icon] || ''}</span>
              <h3>${esc(x.title)}</h3>
              <p>${esc(x.text)}</p>
            </article>`).join('')}
        </div>
      </section>
      <section aria-labelledby="values">
        <h2 id="values">Nilai kami</h2>
        <div class="pillars">
          ${(state.config.values || []).map((x) => `
            <article class="pillar">
              <span class="pillar-icon">${ICONS[x.icon] || ''}</span>
              <h3>${esc(x.title)}</h3>
              <p>${esc(x.text)}</p>
            </article>`).join('')}
        </div>
      </section>
      <section aria-labelledby="featured">
        <h2 id="featured">Lot tersedia sekarang</h2>
        ${featured.length ? `<div class="grid lots">${featured.map(lotCard).join('')}</div>` : '<div class="card"><p><strong>Belum ada lot yang siap dijual.</strong></p><p class="muted">Kami sedang menilai kopi baru dari kebun mitra. Cek lagi beberapa hari lagi ya.</p></div>'}
        <p style="margin-top:16px"><a href="#/catalogue">Lihat semua lot</a></p>
      </section>
      ${policySection()}`);
  }

  async function viewCatalogue(query) {
    const params = new URLSearchParams();
    if (query.tier) params.set('tier', query.tier);
    if (query.region) params.set('region', query.region);
    if (query.sort) params.set('sort', query.sort);
    if (query.inStock === '0') params.set('inStock', '0');
    if (query.q) params.set('q', query.q);
    const regions = state.regions || [];
    const { lots } = await api('/api/lots?' + params.toString());
    setMain(`
      <h1>${query.q ? 'Hasil untuk &ldquo;' + esc(query.q) + '&rdquo;' : 'Produk'}</h1>
      <form class="filters card" id="filters" role="search" aria-label="Saring lot">
        <div class="field"><label for="f-tier">Kategori</label>
          <select id="f-tier" name="tier"><option value="">Semua kategori</option>
            ${Object.entries(state.config.tiers).map(([c, t]) => `<option value="${esc(c)}" ${query.tier === c ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}
          </select></div>
        <div class="field"><label for="f-region">Wilayah</label>
          <select id="f-region" name="region"><option value="">Semua wilayah</option>
            ${regions.map((r) => `<option value="${esc(r.id)}" ${query.region === r.id ? 'selected' : ''}>${esc(r.name)}${r.rollout === 'later' ? ' (segera hadir)' : ''}</option>`).join('')}
          </select></div>
        <div class="field"><label for="f-sort">Urutkan</label>
          <select id="f-sort" name="sort">
            <option value="cup_desc" ${!query.sort || query.sort === 'cup_desc' ? 'selected' : ''}>Skor cupping, tertinggi dulu</option>
            <option value="price_asc" ${query.sort === 'price_asc' ? 'selected' : ''}>Harga, termurah dulu</option>
            <option value="price_desc" ${query.sort === 'price_desc' ? 'selected' : ''}>Harga, termahal dulu</option>
            <option value="freshest" ${query.sort === 'freshest' ? 'selected' : ''}>Panen, terbaru dulu</option>
          </select></div>
        <div class="field"><label class="check"><input type="checkbox" name="inStock" value="1" ${query.inStock !== '0' ? 'checked' : ''}> Hanya yang tersedia</label></div>
      </form>
      <p class="muted" role="status">${lots.length} lot ${query.inStock !== '0' ? 'tersedia' : 'terdaftar'}</p>
      ${lots.length
        ? `<div class="grid lots">${lots.map(lotCard).join('')}</div>`
        : `<div class="card"><p><strong>Belum ada lot yang cocok dengan pilihan Anda.</strong></p><p class="muted">Coba ubah saringan, atau <a href="#/catalogue">lihat semua lot</a>.</p></div>`}`);
    document.getElementById('filters').addEventListener('change', () => {
      const f = new FormData(document.getElementById('filters'));
      const q = {};
      if (f.get('tier')) q.tier = f.get('tier');
      if (f.get('region')) q.region = f.get('region');
      if (f.get('sort')) q.sort = f.get('sort');
      if (!f.get('inStock')) q.inStock = '0';
      location.hash = '#/catalogue?' + new URLSearchParams(q).toString();
    });
  }

  async function viewLot(code) {
    const { lot } = await api('/api/lots/' + encodeURIComponent(code));
    const inCart = state.cart.find((l) => l.lotCode === lot.code);
    const startKg = inCart ? inCart.kg : lot.minOrderKg;
    const maxKg = Math.max(lot.minOrderKg, Math.min(lot.availableKg, lot.maxOrderKg || lot.availableKg));
    setMain(`
      <nav aria-label="Navigasi" class="muted" style="font-size:14px"><a href="#/catalogue">Katalog</a> / ${esc(lot.code)}</nav>
      <div class="grid" style="grid-template-columns:1fr;margin-top:12px">
        <article class="card">
          <div class="btn-row" style="justify-content:space-between"><span class="${tierClass(lot.tier)}">${esc(lot.tierLabel)}</span><span class="code muted">${esc(lot.code)}</span></div>
          <h1 style="margin-top:12px">${esc(lot.title)}</h1>
          ${lot.coverPhotoId ? `<img src="/api/lots/${encodeURIComponent(lot.code)}/photos/${encodeURIComponent(lot.coverPhotoId)}" alt="Foto ${esc(lot.title)}" style="width:100%;max-height:360px;object-fit:cover;border-radius:var(--radius-lg);margin-bottom:12px">` : ''}
          ${lot.story ? `<p class="lead" style="white-space:pre-line">${esc(lot.story)}</p>` : ''}
          <p class="muted" style="margin-bottom:8px">Cupping ${esc(lot.cupScore)} · ${esc(lot.regionName)}</p>
          <dl class="kv" style="margin:16px 0">
            <dt>Kelompok tani</dt><dd>${esc(lot.groupName)}</dd>
            <dt>Kabupaten</dt><dd>${esc(lot.regency)}</dd>
            <dt>Proses</dt><dd>${processHtml(lot.process, lot.processInfo)}</dd>
            <dt>Grade</dt><dd>${esc(lot.grade)}</dd>
            <dt>Panen</dt><dd>${tanggal(lot.harvestDate)}</dd>
            <dt>Stok</dt><dd>${lot.soldOut ? '<span class="pill bad">Habis terjual</span>' : kg(lot.availableKg) + (lot.lowStock ? ' <span class="pill warn">Stok menipis</span>' : '')}</dd>
          </dl>
          <p class="price num" style="font-size:24px;font-weight:700">${rp(lot.pricePerKg)} <span class="muted" style="font-size:15px;font-weight:400">per kg</span></p>
          <p class="muted" style="font-size:14px">Minimum ${lot.minOrderKg} kg.</p>
          ${lot.soldOut ? '' : `
          <form id="add-form" style="margin-top:16px">
            <div class="field"><label for="kg">Jumlah (kg)</label>
              <div class="stepper">
                <button type="button" class="btn secondary" data-step="-${lot.stepKg}" aria-label="Kurangi">−</button>
                <input id="kg" name="kg" type="number" inputmode="numeric" min="${lot.minOrderKg}" max="${maxKg}" step="${lot.stepKg}" value="${startKg}">
                <button type="button" class="btn secondary" data-step="${lot.stepKg}" aria-label="Tambah">+</button>
              </div>
              <p class="help">Kelipatan ${lot.stepKg} kg · maks. ${kg(maxKg)} per pesanan</p>
              <p class="error" id="kg-error" hidden></p>
            </div>
            <div class="btn-row">
              <button class="btn" type="submit">${inCart ? 'Perbarui keranjang' : 'Tambah ke keranjang'}</button>
              <a class="btn secondary" href="${passportHref(lot.code)}">Lihat paspor</a>
            </div>
          </form>`}
        </article>
      </div>`);
    const form = document.getElementById('add-form');
    if (!form) return;
    const input = document.getElementById('kg');
    form.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
      input.value = String(Math.max(0, Number(input.value || 0) + Number(b.dataset.step)));
    }));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const n = Number(input.value);
      const err = document.getElementById('kg-error');
      let problem = null;
      if (!Number.isInteger(n)) problem = 'Masukkan jumlah kg berupa bilangan bulat.';
      else if (n < lot.minOrderKg) problem = `Pesanan minimum ${lot.minOrderKg} kg.`;
      else if ((n - lot.minOrderKg) % lot.stepKg !== 0) problem = `Gunakan kelipatan ${lot.stepKg} kg.`;
      else if (lot.maxOrderKg && n > lot.maxOrderKg) problem = `Maksimal ${lot.maxOrderKg} kg per lot.`;
      else if (n > lot.availableKg) problem = `Sisa ${lot.availableKg} kg.`;
      if (problem) { err.hidden = false; err.textContent = 'Galat: ' + problem; input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', 'kg-error'); return; }
      state.cart = state.cart.filter((l) => l.lotCode !== lot.code);
      state.cart.push({ lotCode: lot.code, kg: n });
      saveCart();
      toast(`${lot.code}: ${n} kg masuk keranjang`);
      location.hash = '#/cart';
    });
  }

  async function viewPassport(code) {
    let data;
    try {
      data = await api('/api/passport/' + encodeURIComponent(code));
    } catch (err) {
      setMain(`<h1>Paspor tidak ditemukan</h1><p class="muted">${esc(err.message)}</p><p><a href="#/catalogue">Kembali ke katalog</a></p>`);
      return;
    }
    const p = data.passport;
    const r = p.record;
    const match = p.recordMatchesHash;
    setMain(`
      <nav aria-label="Navigasi" class="muted" style="font-size:14px"><a href="#/catalogue">Katalog</a> / Paspor</nav>
      <h1 style="margin-top:12px">Paspor lot: ${esc(r.code)}</h1>
      <div class="grid" style="grid-template-columns:1fr">
        <section class="card" aria-labelledby="origin">
          <h2 id="origin" style="margin-top:0">Asal</h2>
          <dl class="kv">
            <dt>Wilayah</dt><dd>${esc(r.regionName)}</dd>
            <dt>Kabupaten</dt><dd>${esc(r.regency)}</dd>
            <dt>Kelompok tani</dt><dd>${esc(r.groupName)}</dd>
            <dt>Panen</dt><dd>${tanggal(r.harvestDate)}</dd>
            <dt>Proses</dt><dd>${processHtml(r.process, p.processInfo)}</dd>
          </dl>
        </section>
        <section class="card" aria-labelledby="grading">
          <h2 id="grading" style="margin-top:0">Penilaian</h2>
          <dl class="kv">
            <dt>Grade</dt><dd>${esc(r.grade)}</dd>
            <dt>Skor cupping</dt><dd>${esc(r.cupScore)}</dd>
            <dt>Kadar air</dt><dd>${esc(r.moisturePct)}%</dd>
            <dt>Tier</dt><dd><span class="${tierClass(r.tier)}">${esc(tierLabel(r.tier))}</span></dd>
            <dt>Kg diterima</dt><dd>${kg(r.kgIn)}</dd>
            <dt>Kg siap jual setelah sortir</dt><dd>${kg(r.sellableKg)}</dd>
            <dt>Harga beli di kebun</dt><dd>${rp(r.buyPricePerKg)} per kg</dd>
          </dl>
        </section>
        <section class="card" aria-labelledby="record">
          <h2 id="record" style="margin-top:0">Pemeriksaan catatan</h2>
          ${match === true
            ? '<p class="notice ok">Data sesuai dengan hash saat diterbitkan.</p>'
            : match === false
              ? '<p class="notice bad">Data tidak sesuai dengan hash saat diterbitkan. Tanyakan ke tim.</p>'
              : '<p class="notice">Kode verifikasi untuk lot ini belum tersedia. Akan muncul setelah penilaian selesai.</p>'}
          <p class="muted" style="font-size:14px">Hash dihitung dari data di atas.</p>
          <p><span class="muted">Kode hash catatan (SHA-256)</span></p>
          <p class="hash">${esc(p.hash)}</p>
          <p class="muted" style="font-size:14px">Diterbitkan ${tanggal(p.publishedAt)}. ${p.status === 'withdrawn' ? '<span class="pill warn">Ditarik dari penjualan</span>' : ''}</p>
        </section>
      </div>
      <div class="btn-row" style="margin-top:16px">
        ${p.availableKg > 0 && p.status === 'listed' ? `<a class="btn" href="${lotHref(r.code)}">Beli lot ini</a>` : ''}
        <a class="btn secondary" href="#/catalogue">Kembali ke katalog</a>
      </div>`);
  }

  async function viewCart() {
    if (state.cart.length === 0) {
      setMain(`<h1>Keranjang Anda</h1><div class="card"><p><strong>Keranjang Anda masih kosong.</strong></p><p class="muted">Pilih kopi dari katalog. Setiap lot sudah dinilai dan ada paspornya.</p><p><a class="btn" href="#/catalogue">Lihat katalog</a></p></div>`);
      return;
    }
    let quote;
    try {
      quote = await api('/api/cart/quote', { method: 'POST', body: { lines: state.cart } });
    } catch (err) {
      setMain(`<h1>Keranjang Anda</h1><p class="notice bad">${esc(err.message)}</p><p><button class="btn secondary" id="clear-cart">Kosongkan keranjang</button></p>`);
      document.getElementById('clear-cart').addEventListener('click', () => { state.cart = []; saveCart(); viewCart(); });
      return;
    }
    const issues = Object.fromEntries((quote.stockIssues || []).map((s) => [s.lotCode, s]));
    setMain(`
      <h1>Keranjang Anda</h1>
      ${quote.stockIssues && quote.stockIssues.length ? `<p class="notice">Ada lot yang berubah: ${quote.stockIssues.map((s) => esc(s.lotCode) + ' ' + esc(s.message)).join(' · ')}</p>` : ''}
      <div class="table-wrap"><table>
        <thead><tr><th>Lot</th><th>Kategori</th><th class="num">Jumlah</th><th class="num">Harga per kg</th><th class="num">Total baris</th><th><span class="muted">Hapus</span></th></tr></thead>
        <tbody>
          ${quote.lines.map((l) => `
            <tr>
              <td><a href="${lotHref(l.lotCode)}">${esc(l.lotCode)}</a>${issues[l.lotCode] ? `<br><span class="pill warn">${esc(issues[l.lotCode].message)}</span>` : ''}</td>
              <td><span class="${tierClass(l.tier)}">${esc(l.tierLabel)}</span></td>
              <td class="num">${kg(l.kg)}</td>
              <td class="num">${rp(l.pricePerKg)}</td>
              <td class="num">${rp(l.lineTotal)}${l.shippingTotal ? `<br><span class="muted" style="font-size:13px">+ ${rp(l.shippingTotal)} ongkir</span>` : ''}</td>
              <td><button class="btn danger small" data-remove="${esc(l.lotCode)}">Hapus</button></td>
            </tr>`).join('')}
        </tbody>
      </table></div>
      <div class="card" style="margin-top:16px;max-width:420px;margin-left:auto">
        <table class="summary-lines"><tbody>
          <tr><td>Subtotal</td><td class="num">${rp(quote.totals.subtotal)}</td></tr>
          <tr><td>Ongkir</td><td class="num">${quote.totals.shipping ? rp(quote.totals.shipping) : 'Termasuk atau diambil'}</td></tr>
          <tr class="total-row"><td>Total</td><td class="num">${rp(quote.totals.total)}</td></tr>
        </tbody></table>
        <p class="muted" style="font-size:14px">Pembayaran dengan transfer bank.</p>
        <div class="btn-row"><a class="btn" href="#/checkout" ${quote.stockIssues && quote.stockIssues.length ? 'aria-disabled="true" onclick="return false"' : ''}>Lanjut ke pembayaran</a><a class="btn secondary" href="#/catalogue">Lanjut belanja</a></div>
      </div>`);
    main.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => {
      state.cart = state.cart.filter((l) => l.lotCode !== b.dataset.remove);
      saveCart();
      viewCart();
    }));
  }

  // Pilihan cara bayar di halaman bayar. Pembayaran dibuat langsung setelah pesanan dibuat.
  const CARA_BAYAR = [
    ['va_bca', 'Transfer BCA (Virtual Account)', 'Nomor rekening virtual. Berlaku 24 jam.'],
    ['va_bni', 'Transfer BNI (Virtual Account)', 'Nomor rekening virtual. Berlaku 24 jam.'],
    ['qris', 'QRIS', 'Pindai dengan aplikasi bank atau dompet digital.'],
  ];

  function viewCheckout() {
    if (state.cart.length === 0) { location.hash = '#/cart'; return; }
    setMain(`
      <h1>Bayar sekarang</h1>
      <p class="muted">Pilih cara bayar dan isi data singkat. Data tambahan bisa diisi di bagian bawah bila perlu.</p>
      ${buyerToken() ? '' : '<p class="notice ok">Punya akun? <a href="#/masuk">Masuk</a> untuk memakai data tersimpan dan melihat riwayat pesanan.</p>'}
      <form id="checkout" class="card" novalidate>
        <div class="notice" data-form-error hidden role="alert"></div>
        <h2 style="margin-top:0">1. Cara bayar</h2>
        <div class="pay-options" role="radiogroup" aria-label="Cara bayar">
          ${CARA_BAYAR.map(([v, l, d], i) => `<label class="pay-option"><input type="radio" name="payMethod" value="${v}" ${i === 0 ? 'checked' : ''}><span><strong>${esc(l)}</strong><small class="muted">${esc(d)}</small></span></label>`).join('')}
        </div>
        <h2>2. Data pemesan</h2>
        <div class="form-grid">
          <div class="field"><label for="c-name">Nama <span class="muted">(wajib)</span></label>
            <input id="c-name" name="name" required minlength="2" autocomplete="name"></div>
          <div class="field"><label for="c-phone">Telepon <span class="muted">(wajib)</span></label>
            <input id="c-phone" name="phone" type="tel" required autocomplete="tel"></div>
          <div class="field"><label for="c-email">Email <span class="muted">(wajib)</span></label>
            <input id="c-email" name="email" type="email" required autocomplete="email"></div>
          <div class="field"><label for="c-city">Kota pengiriman <span class="muted">(wajib)</span></label>
            <input id="c-city" name="city" required autocomplete="address-level2"></div>
        </div>
        <details class="more" style="margin-top:8px">
          <summary>Data tambahan (opsional)</summary>
          <div class="form-grid" style="margin-top:12px">
            <div class="field"><label for="c-type">Jenis pembeli</label>
              <select id="c-type" name="buyerType">${JENIS_PEMBELI.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select></div>
            <div class="field"><label for="c-company">Nama kafe atau perusahaan</label>
              <input id="c-company" name="company" autocomplete="organization"></div>
            <div class="field"><label for="c-npwp">NPWP (untuk faktur)</label>
              <input id="c-npwp" name="npwp" maxlength="25" placeholder="00.000.000.0-000.000"></div>
            <div class="field wide"><label for="c-street">Alamat lengkap</label>
              <textarea id="c-street" name="street" maxlength="200" autocomplete="street-address"></textarea></div>
            <div class="field wide"><label for="c-notes">Catatan untuk tim</label>
              <textarea id="c-notes" name="notes" maxlength="500"></textarea></div>
          </div>
        </details>
        <div class="field" style="margin-top:16px"><label class="check"><input type="checkbox" name="consent" required> Saya setuju dengan <a href="#/kebijakan-privasi">kebijakan privasi</a> dan <a href="#/syarat">syarat penggunaan</a>.</label></div>
        <div class="btn-row"><button class="btn" type="submit" id="place">Bayar sekarang</button><a class="btn secondary" href="#/cart">Kembali ke keranjang</a></div>
      </form>`);
    const form = document.getElementById('checkout');
    if (buyerToken()) prefillCheckout();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
      form.querySelector('[data-form-error]').hidden = true;
      const f = formData(form);
      const btn = document.getElementById('place');
      busy(btn, true, 'Memproses…');
      try {
        const { order } = await api('/api/orders', {
          method: 'POST',
          body: {
            lines: state.cart,
            consent: f.consent === true,
            customer: { name: f.name, company: f.company, buyerType: f.buyerType, phone: f.phone, email: f.email, city: f.city, street: f.street, npwp: f.npwp, notes: f.notes },
          },
        });
        setSession('al-last-order', { number: order.number, email: f.email });
        setSession('al-email', f.email);
        state.cart = [];
        saveCart();
        // Langsung minta tagihan untuk cara bayar yang dipilih. Bila gagal, pembeli bisa mencoba lagi di halaman pesanan.
        // Berhasil: buka halaman lacak yang menampilkan nomor VA atau QRIS. Gagal: halaman pesanan tetap bisa mencoba lagi.
        try {
          await api(`/api/orders/${encodeURIComponent(order.number)}/payment`, { method: 'POST', body: { email: f.email, method: f.payMethod } });
          location.hash = '#/track/' + encodeURIComponent(order.number) + '?email=' + encodeURIComponent(f.email);
        } catch {
          toast('Pesanan dibuat. Silakan pilih cara bayar di halaman pesanan.');
          location.hash = '#/order/' + encodeURIComponent(order.number);
        }
      } catch (err) {
        busy(btn, false);
        if (err.code === 'stock_changed') {
          const issues = (err.extra && err.extra.error && err.extra.error.fields && err.extra.error.fields.stockIssues) || [];
          state.cart = state.cart.filter((l) => !issues.some((s) => s.lotCode === l.lotCode));
          saveCart();
          toast('Ada lot yang berubah. Mohon periksa pesanan Anda.');
          location.hash = '#/cart';
          return;
        }
        showFormError(form, err);
      }
    });
  }

  function viewOrderCreated(number) {
    const last = session('al-last-order');
    setMain(`
      <h1>Pesanan diterima</h1>
      <div class="notice ok">Pesanan <strong>${esc(number)}</strong> sudah dibuat. Stok dicadangkan untuk Anda selama kami mengonfirmasi pembayaran.</div>
      <div class="card">
        <h2 style="margin-top:0">Bayar dengan transfer bank</h2>
        <dl class="kv">
          <dt>Bank</dt><dd>${esc(state.config.payment.bank.bankName)}</dd>
          <dt>Atas nama</dt><dd>${esc(state.config.payment.bank.accountName)}</dd>
          <dt>Nomor rekening</dt><dd>${esc(state.config.payment.bank.accountNumber)}</dd>
          <dt>Referensi</dt><dd>${esc(number)}</dd>
        </dl>
        <p class="muted" style="font-size:14px;margin-top:12px">Gunakan nomor pesanan sebagai referensi.</p>
      </div>
      <div class="btn-row" style="margin-top:16px">
        ${last && last.email ? `<a class="btn" href="#/track/${encodeURIComponent(number)}">Lacak pesanan ini</a>` : '<a class="btn" href="#/track">Lacak pesanan ini</a>'}
        <a class="btn secondary" href="#/catalogue">Lanjut belanja</a>
      </div>`);
  }

  function viewTrack() {
    const email = session('al-email') || '';
    setMain(`
      <h1>Lacak pesanan Anda</h1>
      <form id="track" class="card" style="max-width:520px" novalidate>
        <div class="notice" data-form-error hidden role="alert"></div>
        <div class="field"><label for="t-number">Nomor pesanan</label><input id="t-number" name="number" required placeholder="ALO-2611-001"></div>
        <div class="field"><label for="t-email">Email yang dipakai saat memesan</label><input id="t-email" name="email" type="email" required value="${esc(email)}"></div>
        <button class="btn" type="submit">Tampilkan pesanan</button>
      </form>`);
    const form = document.getElementById('track');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = formData(form);
      try {
        setSession('al-email', f.email);
        location.hash = '#/track/' + encodeURIComponent(f.number.trim()) + '?email=' + encodeURIComponent(f.email.trim());
      } catch (err) { showFormError(form, err); }
    });
  }

  async function viewTrackDetail(number, query) {
    const email = query.email || session('al-email') || '';
    let data;
    try {
      data = await api(`/api/orders/${encodeURIComponent(number)}?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setMain(`<h1>Pesanan tidak ditemukan</h1><p class="notice bad">${esc(err.message)}</p><p><a href="#/track">Coba lagi</a></p>`);
      return;
    }
    const o = data.order;
    const steps = ['requested', 'confirmed', 'paid', 'shipped', 'delivered', 'completed'];
    const cancelled = o.status === 'cancelled';
    const done = (s) => cancelled ? false : steps.indexOf(s) <= steps.indexOf(o.status);
    setSession('al-email', email);
    setMain(`
      <nav aria-label="Navigasi" class="muted" style="font-size:14px"><a href="#/track">Lacak pesanan</a> / ${esc(o.number)}</nav>
      <h1 style="margin-top:12px">Pesanan ${esc(o.number)}</h1>
      <p><span class="pill ${cancelled ? 'bad' : 'ok'}">${esc(o.statusLabel)}</span> <span class="muted">Dibuat ${tanggal(o.createdAt)}</span></p>
      <div class="grid" style="grid-template-columns:1fr">
        <section class="card" aria-labelledby="timeline">
          <h2 id="timeline" style="margin-top:0">Status</h2>
          <ol class="timeline">
            ${steps.map((s) => {
              const isCurrent = s === o.status;
              const cls = [done(s) ? 'done' : '', isCurrent ? 'current' : ''].join(' ').trim();
              const entry = o.timeline.find((t) => t.status === s);
              return `<li class="${cls}">${esc(STATUS_TEKS[s])}${entry ? ` · <span class="muted">${tanggal(entry.at)}</span>` : ''}</li>`;
            }).join('')}
            ${cancelled ? `<li class="cancelled current">Dibatalkan ${tanggal(o.updatedAt)}</li>` : ''}
          </ol>
          <p style="margin-top:12px"><a href="/api/orders/${encodeURIComponent(o.number)}/invoice?email=${encodeURIComponent(query.email || '')}">Unduh faktur (PDF)</a></p>
          ${o.shipment && (o.shipment.courier || o.shipment.waybill) ? `<p style="margin-top:12px"><strong>Pengiriman:</strong> ${esc(o.shipment.courier || 'Kurir')}${o.shipment.waybill ? ' · No. resi <span class="num">' + esc(o.shipment.waybill) + '</span>' : ''}</p>` : ''}
          ${o.payment.reference ? `<p class="muted" style="margin-top:12px">Referensi pembayaran: ${esc(o.payment.reference)}</p>` : '<p class="muted" style="margin-top:12px">Pembayaran belum diterima.</p>'}
        </section>
        <section class="card" aria-labelledby="items">
          <h2 id="items" style="margin-top:0">Barang</h2>
          <div class="table-wrap"><table>
            <thead><tr><th>Lot</th><th>Kategori</th><th class="num">Kg</th><th class="num">Total</th></tr></thead>
            <tbody>${o.lines.map((l) => `<tr><td>${esc(l.lotCode)}</td><td>${esc(l.tierLabel)}</td><td class="num">${kg(l.kg)}</td><td class="num">${rp(l.lineTotal + l.shippingTotal)}</td></tr>`).join('')}</tbody>
          </table></div>
          <table class="summary-lines" style="margin-top:12px"><tbody>
            <tr><td>Subtotal</td><td class="num">${rp(o.subtotal)}</td></tr>
            <tr><td>Ongkir</td><td class="num">${o.shipping ? rp(o.shipping) : 'Termasuk atau diambil'}</td></tr>
            <tr class="total-row"><td>Total</td><td class="num">${rp(o.total)}</td></tr>
          </tbody></table>
        </section>
      </div>
      ${o.status === 'requested' || o.status === 'confirmed' ? `
      <section class="card" aria-labelledby="bayar" style="margin-top:16px">
        <h2 id="bayar" style="margin-top:0">Bayar sekarang</h2>
        ${(o.payments || []).filter((p) => p.status === 'pending').map((p) => p.instructions.kind === 'va' ? `
          <div class="notice ok" style="margin-bottom:12px">
            <p style="margin:0 0 4px"><strong>${esc(p.methodLabel)}</strong>. Transfer ke nomor berikut:</p>
            <p class="hash" style="font-size:18px;margin:6px 0">${esc(p.instructions.vaNumber)}</p>
            <p class="help" style="margin:0">Jumlah ${rp(p.amount)}. Berlaku sampai ${tanggal(p.instructions.expiresAt)}.</p>
          </div>` : `
          <div class="notice ok" style="margin-bottom:12px">
            <p style="margin:0 0 4px"><strong>QRIS</strong>. Pindai kode berikut dengan aplikasi bank atau dompet digital Anda:</p>
            ${p.instructions.qrUrl ? `<img src="${esc(p.instructions.qrUrl)}" alt="Kode QRIS untuk pembayaran" width="220" height="220" style="display:block;margin:8px 0;background:#fff;padding:8px;border-radius:12px">` : `<p class="hash" style="margin:6px 0">${esc(p.instructions.payload || '')}</p>`}
            <p class="help" style="margin:0">Jumlah ${rp(p.amount)}.</p>
          </div>`).join('')}
        <p class="muted" style="font-size:14px">Pilih cara bayar:</p>
        <div class="btn-row">
          <button class="btn secondary small" type="button" data-pay="va_bca">Virtual Account BCA</button>
          <button class="btn secondary small" type="button" data-pay="va_bni">Virtual Account BNI</button>
          <button class="btn secondary small" type="button" data-pay="qris">QRIS</button>
        </div>
        <p class="help" style="margin-top:10px">Pembayaran dikonfirmasi otomatis begitu masuk. Transfer bank manual tetap bisa dilakukan dengan nomor referensi pesanan.</p>
      </section>` : ''}
      ${o.canConfirmReceipt || o.canReportProblem || o.problems.length ? `
      <section class="card" aria-labelledby="receipt" style="margin-top:16px">
        <h2 id="receipt" style="margin-top:0">Pengiriman Anda</h2>
        ${o.problems.length ? `<div class="notice">${o.problems.map((p) => `<p style="margin:0 0 6px"><strong>Masalah dilaporkan ${tanggal(p.createdAt)}:</strong> ${esc(p.message)} <span class="pill">${esc(p.status)}</span></p>`).join('')}</div>` : ''}
        ${o.canConfirmReceipt ? `
          <p>Setelah kopi tiba dan sudah Anda periksa, konfirmasi penerimaan. Ini menyelesaikan pesanan dan membuka umpan balik.</p>
          <div class="btn-row"><button class="btn" id="confirm-receipt" type="button">Saya sudah menerima pesanan ini</button></div>` : ''}
        ${o.canReportProblem ? `
          <details style="margin-top:12px">
            <summary>Laporkan masalah dengan pengiriman ini</summary>
            <form id="problem-form" style="margin-top:12px" novalidate>
              <div class="notice" data-form-error hidden role="alert"></div>
              <div class="field"><label for="p-msg">Apa yang bermasalah?</label>
                <textarea id="p-msg" name="message" minlength="10" maxlength="1000" required placeholder="Contoh: 2 karung basah, contoh kopi terasa asam"></textarea>
                <p class="help">Laporkan dalam ${state.config.policy.claimWindowHours} jam sejak pengantaran. Kirim foto karung dan contoh kopi ke tim melalui email.</p></div>
              <button class="btn secondary" type="submit" id="p-send">Kirim laporan</button>
            </form>
          </details>` : ''}
      </section>` : ''}
      ${o.feedbackOpen ? `<div class="btn-row" style="margin-top:16px"><a class="btn" href="#/feedback/${encodeURIComponent(o.number)}">Bagikan umpan balik tentang pesanan Anda</a></div>` : ''}`);

    main.querySelectorAll('button[data-pay]').forEach((b) => b.addEventListener('click', async () => {
      busy(b, true, 'Membuat tagihan…');
      try {
        await api(`/api/orders/${encodeURIComponent(o.number)}/payment`, { method: 'POST', body: { email, method: b.dataset.pay } });
        toast('Tagihan dibuat');
        viewTrackDetail(number, query);
      } catch (err) { busy(b, false); toast(err.message); }
    }));
    const confirmBtn = document.getElementById('confirm-receipt');
    if (confirmBtn) confirmBtn.addEventListener('click', async () => {
      busy(confirmBtn, true, 'Mengonfirmasi…');
      try {
        await api(`/api/orders/${encodeURIComponent(o.number)}/confirm-receipt`, { method: 'POST', body: { email } });
        toast('Penerimaan dikonfirmasi. Terima kasih.');
        viewTrackDetail(number, query);
      } catch (err) { busy(confirmBtn, false); toast(err.message); }
    });
    const problemForm = document.getElementById('problem-form');
    if (problemForm) problemForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = formData(problemForm);
      const btn = document.getElementById('p-send');
      busy(btn, true, 'Mengirim…');
      try {
        await api(`/api/orders/${encodeURIComponent(o.number)}/problem`, { method: 'POST', body: { email, message: f.message } });
        toast('Laporan terkirim. Tim akan membalas melalui email.');
        viewTrackDetail(number, query);
      } catch (err) { busy(btn, false); showFormError(problemForm, err); }
    });
  }

  function viewFeedback(number) {
    const email = session('al-email') || '';
    setMain(`
      <h1>Umpan balik tentang pesanan Anda</h1>
      <p class="muted">Terima kasih sudah berbagi pendapat.</p>
      <form id="fb" class="card" novalidate>
        <div class="notice" data-form-error hidden role="alert"></div>
        <div class="field"><label for="fb-email">Email yang dipakai saat memesan</label><input id="fb-email" name="email" type="email" required value="${esc(email)}"></div>
        <div class="field"><label for="fb-number">Nomor pesanan</label><input id="fb-number" name="number" required value="${esc(number)}"></div>
        <div class="field"><label for="fb-items">Kode lot yang Anda nilai</label><input id="fb-items" name="lotCode" required placeholder="AL-2611-001"></div>
        <div class="field"><label for="fb-taste">Bagaimana rasanya?</label><textarea id="fb-taste" name="taste" maxlength="300" placeholder="Contoh: manis, bersih, agak hambar setelah dua minggu"></textarea></div>
        <div class="field"><label for="fb-issues">Ada masalah mutu?</label>
          <select id="fb-issues" name="issues">
            <option value="none">Tidak ada</option><option value="unripe">Biji belum matang</option><option value="mould">Berjamur atau berbau</option>
            <option value="uneven_drying">Pengeringan tidak merata</option><option value="defects">Cacat atau biji pecah</option><option value="other">Lainnya</option>
          </select></div>
        <div class="field"><label for="fb-reorder">Apakah Anda akan memesan lagi?</label>
          <select id="fb-reorder" name="reorder" required><option value="yes">Ya</option><option value="maybe">Mungkin</option><option value="no">Tidak</option></select></div>
        <div class="field"><label for="fb-notes">Hal lain</label><textarea id="fb-notes" name="notes" maxlength="500"></textarea></div>
        <button class="btn" type="submit" id="fb-send">Kirim umpan balik</button>
      </form>`);
    const form = document.getElementById('fb');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = formData(form);
      const btn = document.getElementById('fb-send');
      busy(btn, true, 'Mengirim…');
      try {
        await api(`/api/orders/${encodeURIComponent(f.number.trim())}/feedback`, {
          method: 'POST',
          body: { email: f.email, notes: f.notes, items: [{ lotCode: f.lotCode.trim(), taste: f.taste, issues: f.issues, reorder: f.reorder }] },
        });
        setMain(`<h1>Terima kasih</h1><p class="notice ok">Umpan balik Anda sudah diterima.</p><p><a href="#/catalogue">Kembali ke katalog</a></p>`);
      } catch (err) {
        busy(btn, false);
        showFormError(form, err);
      }
    });
  }

const ICONS = {
    coin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.2c0-1 1-1.7 2.5-1.7s2.5.7 2.5 1.7-1 1.5-2.5 1.8-2.5.8-2.5 1.8 1 1.7 2.5 1.7 2.5-.7 2.5-1.7"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>',
    passport: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="5.5" y="3.5" width="13" height="17" rx="2"/><circle cx="12" cy="10" r="2.6"/><path d="M8.5 16.5h7"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l7 2.8v5.2c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6.3z"/><path d="M9 12l2.2 2.2L15.5 10"/></svg>',
    sprout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20v-9"/><path d="M12 11c0-3.5-2.5-6-6.5-6 0 3.8 2.5 6 6.5 6z"/><path d="M12 13.5c0-2.8 2-4.8 5.5-4.8 0 3-2 4.8-5.5 4.8z"/></svg>',
    hand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 13.5l3.5-3.5h3.2c1 0 1.8.5 2.3 1.2l1.3 1.6"/><path d="M13.5 13.8l2.2-2.2h1.2a2 2 0 0 1 0 4h-3.4"/><path d="M7 10.5l4 3.8 2.8-2.8 4.2 4.2"/></svg>',
  };

  function viewAbout() {
    const a = state.config.about;
    const pol = state.config.policy;
    setMain(`
      <section class="about-hero">
        <p class="eyebrow">${esc(a.eyebrow)}</p>
        <h1>${esc(a.title)}</h1>
        <p class="lead">${esc(a.lead)}</p>
        <div class="btn-row"><a class="btn" href="#/catalogue">Lihat lot tersedia</a></div>
      </section>
      <section class="values-block" aria-labelledby="about-values">
        <h2 id="about-values">Nilai kami</h2>
        <div class="pillars">
          ${(state.config.values || []).map((x) => `
            <article class="pillar">
              <span class="pillar-icon">${ICONS[x.icon] || ''}</span>
              <h3>${esc(x.title)}</h3>
              <p>${esc(x.text)}</p>
            </article>`).join('')}
        </div>
      </section>
      <section class="pillars" aria-label="Keunggulan kami">
        ${a.pillars.map((x) => `
          <article class="pillar">
            <span class="pillar-icon">${ICONS[x.icon] || ''}</span>
            <h3>${esc(x.title)}</h3>
            <p>${esc(x.text)}</p>
          </article>`).join('')}
      </section>
      <section class="policy" aria-labelledby="policy-title">
        <div class="policy-head">
          <h2 id="policy-title">Klaim dan pengembalian</h2>
          ${pol.status !== 'approved' ? '<span class="pill warn">Draf</span>' : ''}
        </div>
        <ol class="policy-list">
          ${pol.sections.map((x, i) => `
            <li><details ${i === 0 ? 'open' : ''}>
              <summary>${esc(x.title)}</summary>
              <p>${esc(x.text)}</p>
            </details></li>`).join('')}
        </ol>
      </section>`);
  }

  // ---------- tim (admin) ----------
  function adminShell(active, body) {
    const all = [['dashboard', 'Dasbor'], ['alur', 'Alur kerja'], ['intake', 'Pembelian'], ['lots', 'Lot'], ['orders', 'Pesanan'], ['feedback', 'Umpan balik'], ['users', 'Pengguna'], ['audit', 'Riwayat'], ['settings', 'Pengaturan']];
    const pages = allowedPages();
    const links = all.filter(([k]) => pages.includes(k));
    const u = currentUser();
    return `
      <div class="admin-layout">
        <aside class="admin-side">
          <div class="admin-who">
            <strong>${u ? esc(u.name) : ''}</strong>
            <span class="muted">${u ? esc(u.roleLabel || u.role) : ''}</span>
          </div>
          <nav class="admin-nav" aria-label="Kantor belakang">
            ${links.map(([k, l]) => `<a href="#/admin/${k}" ${active === k ? 'aria-current="page"' : ''}>${l}</a>`).join('')}
          </nav>
          <button class="btn secondary small admin-out" id="admin-out" type="button">Keluar</button>
        </aside>
        <div class="admin-body">
          <h1 style="margin:0 0 16px">Kantor belakang</h1>
          ${body}
        </div>
      </div>`;
  }
  function wireSignOut() {
    const b = document.getElementById('admin-out');
    if (b) b.addEventListener('click', async () => { try { await api('/api/auth/logout', { method: 'POST', admin: true }); } catch { /* sesi sudah habis */ } clearAdminToken(); location.hash = '#/admin'; });
  }
  function adminFail(err) {
    if (err.status === 401) {
      setMain(`<h1>Masuk tim</h1><p class="notice bad">Sesi Anda sudah habis. Silakan masuk lagi untuk melanjutkan.</p>`);
      location.hash = '#/admin';
      return;
    }
    setMain(`<p class="notice bad">${esc(err.message)}</p>`);
  }

  function landingPage() {
    const pages = allowedPages();
    return pages[0] || 'lots';
  }

  function viewAdminLogin() {
    setMain(`
      <h1>Masuk tim</h1>
      <form id="login" class="card" style="max-width:420px" novalidate>
        <div class="notice" data-form-error hidden role="alert"></div>
        <div class="field"><label for="login-email">Email</label><input id="login-email" name="email" type="email" required autocomplete="username"></div>
        <div class="field"><label for="login-pass">Kata sandi</label><input id="login-pass" name="password" type="password" required autocomplete="current-password"></div>
        <button class="btn" type="submit" id="login-btn">Masuk</button>
      </form>
      ${(state.config.demoAccounts || []).length ? `
      <section class="card" style="max-width:420px;margin-top:16px" aria-label="Akun demo">
        <p class="notice">Akun demo untuk uji coba. Jangan dipakai untuk data sungguhan.</p>
        <div class="btn-row">${state.config.demoAccounts.map((d, i) => `<button class="btn secondary small" type="button" data-demo="${i}">Masuk sebagai ${esc(d.roleLabel)} (demo)</button>`).join('')}</div>
      </section>` : ''}`);
    main.querySelectorAll('button[data-demo]').forEach((b) => b.addEventListener('click', () => {
      const d = state.config.demoAccounts[Number(b.dataset.demo)];
      document.getElementById('login-email').value = d.email;
      document.getElementById('login-pass').value = d.password;
      document.getElementById('login').requestSubmit();
    }));
    document.getElementById('login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const f = formData(form);
      const btn = document.getElementById('login-btn');
      busy(btn, true, 'Memeriksa…');
      try {
        const out = await api('/api/auth/login', { method: 'POST', body: { email: f.email, password: f.password } });
        setAdminToken(out.token);
        try { sessionStorage.setItem('al-user', JSON.stringify(out.user)); } catch { /* abaikan */ }
        location.hash = '#/admin/' + landingPage();
      } catch (err) {
        busy(btn, false);
        clearAdminToken();
        showFormError(form, err);
      }
    });
  }

  // Pengguna: daftar, tambah, dan pengelolaan per orang (ubah data, reset kata sandi, aktif/nonaktif, riwayat).
  const ROLE_OPTIONS = [['admin', 'Admin'], ['grader', 'Penilai'], ['field_agent', 'Petugas lapangan']];

  async function viewAdminUsers(selectedId) {
    const { users } = await api('/api/admin/users', { admin: true });
    const me = currentUser();
    const sel = selectedId ? users.find((u) => u.id === selectedId) : null;
    const when = (iso) => (iso ? tanggal(iso) : 'Belum pernah');
    setMain(adminShell('users', `
      <h2 style="margin-top:0">Staf dan pengguna</h2>
      <div class="table-wrap"><table>
        <thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th>Status</th><th>Terakhir masuk</th><th></th></tr></thead>
        <tbody>
          ${users.map((u) => `
            <tr ${sel && sel.id === u.id ? 'style="background:var(--green-soft)"' : ''}>
              <td>${esc(u.name)}${me && me.id === u.id ? ' <span class="muted">(Anda)</span>' : ''}</td>
              <td>${esc(u.email)}</td>
              <td>${esc(u.roleLabel || u.role)}</td>
              <td><span class="pill ${u.active ? 'ok' : ''}">${u.active ? 'Aktif' : 'Nonaktif'}</span>${u.mustChangePassword ? ' <span class="pill warn">Ganti kata sandi</span>' : ''}</td>
              <td>${esc(when(u.lastSignInAt))}</td>
              <td><a class="btn secondary small" href="#/admin/users/${encodeURIComponent(u.id)}">Kelola</a></td>
            </tr>`).join('')}
        </tbody></table></div>
      ${sel ? `
      <section class="card" style="margin-top:20px" aria-labelledby="edit-user">
        <h2 id="edit-user" style="margin-top:0">Kelola ${esc(sel.name)}</h2>
        <form id="edit-form" novalidate>
          <div class="notice" data-form-error hidden role="alert"></div>
          <div class="form-grid">
            <div class="field"><label for="e-name">Nama</label><input id="e-name" name="name" required minlength="2" value="${esc(sel.name)}"></div>
            <div class="field"><label for="e-email">Email</label><input id="e-email" name="email" type="email" required value="${esc(sel.email)}"></div>
            <div class="field"><label for="e-role">Peran</label><select id="e-role" name="role">${ROLE_OPTIONS.map(([k, l]) => `<option value="${k}" ${sel.role === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
            <div class="field"><label for="e-active">Status</label><select id="e-active" name="active"><option value="true" ${sel.active ? 'selected' : ''}>Aktif</option><option value="false" ${!sel.active ? 'selected' : ''}>Nonaktif</option></select></div>
            <div class="field wide"><label for="e-pass">Reset kata sandi (opsional)</label><input id="e-pass" name="password" type="password" minlength="10" autocomplete="new-password"><p class="help">Isi hanya jika ingin mengganti kata sandi. Pengguna harus membuat kata sandi baru saat masuk berikutnya, dan sesi lamanya berakhir.</p></div>
          </div>
          <div class="btn-row"><button class="btn" type="submit" id="e-save">Simpan perubahan</button><a class="btn secondary" href="#/admin/users">Tutup</a></div>
        </form>
        <h3 style="margin-top:24px">Riwayat ${esc(sel.name)}</h3>
        <div id="activity" class="muted" style="font-size:14px">Memuat…</div>
      </section>` : ''}
      <h2>Tambah pengguna</h2>
      <form id="new-user" class="card" novalidate>
        <div class="notice" data-form-error hidden role="alert"></div>
        <div class="form-grid">
          <div class="field"><label for="u-name">Nama</label><input id="u-name" name="name" required minlength="2"></div>
          <div class="field"><label for="u-email">Email</label><input id="u-email" name="email" type="email" required></div>
          <div class="field"><label for="u-role">Peran</label><select id="u-role" name="role">${ROLE_OPTIONS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
          <div class="field"><label for="u-pass">Kata sandi awal</label><input id="u-pass" name="password" type="password" required minlength="10" autocomplete="new-password"><p class="help">Minimal 10 karakter. Pengguna akan diminta menggantinya saat masuk pertama kali.</p></div>
        </div>
        <button class="btn" type="submit" id="u-save">Tambah pengguna</button>
      </form>`));
    wireSignOut();

    if (sel) {
      const act = await api(`/api/admin/users/${encodeURIComponent(sel.id)}/activity`, { admin: true });
      const box = document.getElementById('activity');
      if (box) box.innerHTML = act.entries.length
        ? `<ul style="padding-left:18px;margin:0">${act.entries.map((x) => `<li>${tanggal(x.at)} · ${esc(x.action)} · ${esc(x.status)}</li>`).join('')}</ul>`
        : 'Belum ada riwayat.';
      document.getElementById('edit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
        form.querySelector('[data-form-error]').hidden = true;
        const f = formData(form);
        const body = { name: f.name, email: f.email, role: f.role, active: f.active === 'true' };
        if (f.password) body.password = f.password;
        const btn = document.getElementById('e-save');
        busy(btn, true, 'Menyimpan…');
        try {
          await api(`/api/admin/users/${encodeURIComponent(sel.id)}`, { method: 'PATCH', admin: true, body });
          toast(f.password ? 'Perubahan disimpan. Kata sandi baru berlaku.' : 'Perubahan disimpan');
          viewAdminUsers(sel.id);
        } catch (err) { busy(btn, false); showFormError(form, err); }
      });
    }

    document.getElementById('new-user').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
      form.querySelector('[data-form-error]').hidden = true;
      const btn = document.getElementById('u-save');
      busy(btn, true, 'Menyimpan…');
      try {
        await api('/api/admin/users', { method: 'POST', admin: true, body: formData(form) });
        toast('Pengguna ditambahkan');
        viewAdminUsers();
      } catch (err) { busy(btn, false); showFormError(form, err); }
    });
  }

  // Ganti kata sandi sendiri (wajib setelah reset oleh admin).
  function viewChangePassword() {
    setMain(`
      <h1>Buat kata sandi baru</h1>
      <p class="muted">Admin telah mengatur ulang kata sandi Anda. Silakan buat kata sandi baru untuk melanjutkan.</p>
      <form id="change-pass" class="card" style="max-width:420px" novalidate>
        <div class="notice" data-form-error hidden role="alert"></div>
        <div class="field"><label for="cp-cur">Kata sandi sementara</label><input id="cp-cur" name="current" type="password" required autocomplete="current-password"></div>
        <div class="field"><label for="cp-new">Kata sandi baru</label><input id="cp-new" name="password" type="password" required minlength="10" autocomplete="new-password"><p class="help">Minimal 10 karakter.</p></div>
        <div class="field"><label for="cp-conf">Ulangi kata sandi baru</label><input id="cp-conf" name="confirm" type="password" required minlength="10" autocomplete="new-password"></div>
        <button class="btn" type="submit" id="cp-save">Simpan kata sandi</button>
      </form>`);
    document.getElementById('change-pass').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
      form.querySelector('[data-form-error]').hidden = true;
      const f = formData(form);
      if (f.password !== f.confirm) { showFormError(form, { message: 'Kata sandi baru dan ulangannya tidak sama.', fields: { confirm: 'Tidak sama.' } }); return; }
      const btn = document.getElementById('cp-save');
      busy(btn, true, 'Menyimpan…');
      try {
        const out = await api('/api/auth/password', { method: 'POST', admin: true, body: { current: f.current, password: f.password } });
        try { sessionStorage.setItem('al-user', JSON.stringify(out.user)); } catch { /* abaikan */ }
        toast('Kata sandi berhasil diganti');
        location.hash = '#/admin/' + landingPage();
      } catch (err) { busy(btn, false); showFormError(form, err); }
    });
  }

  // Alur kerja: setiap lot di tahap mana, dan langkah berikutnya untuk peran Anda.
  async function viewWorkflow() {
    const { lots } = await api('/api/admin/lots', { admin: true });
    const stages = [
      ['received', 'Perlu dinilai', 'Nilai lot di halaman Lot. Isi grade, skor cupping, dan kg siap jual.'],
      ['graded', 'Menunggu verifikasi', 'Penilai memeriksa nilai, lalu menekan Verifikasi.'],
      ['verified', 'Siap diterbitkan', 'Admin (orang yang berbeda dari penilai) menerbitkan ke aplikasi.'],
      ['listed', 'Tayang di aplikasi', 'Lot dapat dilihat dan dipesan pembeli.'],
    ];
    const cols = stages.map(([key, title, hint]) => {
      const items = lots.filter((l) => l.status === key);
      const actions = (l) => {
        if (key === 'received') return `<a class="btn secondary small" href="#/admin/lots/${encodeURIComponent(l.id)}">Nilai</a>`;
        if (key === 'graded' && canDo('verify')) return `<button class="btn small" data-verify="${esc(l.id)}">Verifikasi</button>`;
        if (key === 'verified' && canDo('publish')) return `<button class="btn small" data-publish="${esc(l.id)}">Terbitkan ke aplikasi</button>`;
        return '';
      };
      return `
        <section class="card" aria-labelledby="st-${key}" style="min-width:0">
          <h3 id="st-${key}">${esc(title)} <span class="pill">${items.length}</span></h3>
          <p class="help" style="margin-bottom:12px">${esc(hint)}</p>
          ${items.length ? items.map((l) => `
            <div style="border-top:1px solid var(--line);padding:10px 0">
              <div><strong>${esc(l.code)}</strong> <span class="muted" style="font-size:14px">${esc(l.groupName)}</span></div>
              <div class="muted" style="font-size:13px;margin:2px 0 8px">${l.tier ? esc(tierLabel(l.tier)) + ' · Cupping ' + esc(l.cupScore || '—') : 'Belum dinilai'}${l.verifiedBy ? ' · Diverifikasi ' + esc(l.verifiedBy.name) : ''}</div>
              <div class="btn-row">${actions(l)}</div>
            </div>`).join('') : '<p class="muted" style="font-size:14px">Tidak ada lot.</p>'}
        </section>`;
    }).join('');
    setMain(adminShell('alur', `
      <h2 style="margin-top:0">Alur kerja lot</h2>
      <p class="muted" style="font-size:14px">Setiap lot melewati empat tahap. Nilai, verifikasi, lalu terbitkan. Penerbitan dilakukan orang yang berbeda dari yang memverifikasi.</p>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px">${cols}</div>`));
    wireSignOut();
    main.querySelectorAll('[data-verify]').forEach((b) => b.addEventListener('click', async () => {
      try { await api(`/api/admin/lots/${encodeURIComponent(b.dataset.verify)}/verify`, { method: 'POST', admin: true }); toast('Lot diverifikasi'); viewWorkflow(); }
      catch (err) { toast(err.message); }
    }));
    main.querySelectorAll('[data-publish]').forEach((b) => b.addEventListener('click', async () => {
      try { await api(`/api/admin/lots/${encodeURIComponent(b.dataset.publish)}/publish`, { method: 'POST', admin: true }); toast('Diterbitkan ke aplikasi'); viewWorkflow(); }
      catch (err) { toast(err.message); }
    }));
  }

  // Riwayat: siapa mengubah apa dan kapan (tanpa isi data).
  async function viewAdminAudit() {
    const { entries } = await api('/api/admin/audit', { admin: true });
    setMain(adminShell('audit', `
      <h2 style="margin-top:0">Riwayat perubahan</h2>
      <p class="muted" style="font-size:14px">200 entri terakhir. Mencatat siapa dan kapan, bukan isi data.</p>
      <div class="table-wrap"><table>
        <thead><tr><th>Waktu</th><th>Pengguna</th><th>Peran</th><th>Tindakan</th><th>Hasil</th></tr></thead>
        <tbody>
          ${entries.map((x) => `<tr><td>${tanggal(x.at)}</td><td>${esc(x.userName || '—')}</td><td>${esc((ROLE_PAGES[x.role] && x.role) || x.role || '—')}</td><td>${esc(x.action)}</td><td>${esc(x.status)}</td></tr>`).join('') || '<tr><td colspan="5">Belum ada riwayat.</td></tr>'}
        </tbody></table></div>`));
    wireSignOut();
  }

  async function viewAdminDashboard() {
    const s = await api('/api/admin/summary', { admin: true });
    const e = s.economics;
    const o = s.ordersByStatus;
    setMain(adminShell('dashboard', `
      <div class="stats">
        <div class="card stat"><div class="label">Kg tersedia (tayang)</div><div class="value">${kg(s.totalStockKg)}</div></div>
        <div class="card stat"><div class="label">Pesanan terbuka</div><div class="value">${o.requested + o.confirmed + o.paid}</div><div class="label">${o.requested} diminta · ${o.confirmed} dikonfirmasi · ${o.paid} dibayar</div></div>
        <div class="card stat"><div class="label">Nilai pesanan terbuka</div><div class="value">${rp(s.openRevenue)}</div></div>
        <div class="card stat"><div class="label">Umpan balik untuk ditandai</div><div class="value">${s.feedbackToReview}</div></div>
      </div>
      <h2>Stok per kategori</h2>
      <div class="table-wrap"><table><thead><tr><th>Kategori</th><th class="num">Kg tersedia</th></tr></thead>
        <tbody>${Object.entries(s.stockKgByTier).map(([t, k]) => `<tr><td><span class="${tierClass(t)}">${esc(tierLabel(t))}</span></td><td class="num">${kg(k)}</td></tr>`).join('')}</tbody></table></div>
      <h2>Ekonomi per kg dibeli</h2>
      
      <div class="table-wrap"><table>
        <tbody>
          <tr><td>Penjualan</td><td class="num">${rp(e.salesPerKgBought)}</td></tr>
          <tr><td>Dibayar ke petani</td><td class="num">${rp(e.buyPerKgBought)}</td></tr>
          <tr><td>Ongkir ditanggung AnugerahLink</td><td class="num">${rp(e.shippingPerKgBought)}</td></tr>
          <tr><td>Biaya: contoh, klaim, pembayaran</td><td class="num">${rp(e.feesPerKgBought)}</td></tr>
          <tr><th>Margin kotor</th><th class="num">${rp(e.grossMarginPerKgBought)} (${e.grossMarginPctOfSales}%)</th></tr>
        </tbody></table></div>
      <p style="margin-top:12px">Titik impas dengan tim penuh: <strong>${e.breakEvenKgPerYear ? e.breakEvenKgPerYear.toLocaleString('id-ID') + ' kg per tahun (' + e.breakEvenKgPerMonth.toLocaleString('id-ID') + ' kg per bulan)' : 'tidak tercapai dengan harga ini'}</strong>.</p>
      <p class="muted" style="font-size:14px">Pendapatan dari pesanan yang sudah berjalan: ${rp(s.deliveredRevenue)}.</p>
    `));
    wireSignOut();
  }

  async function viewAdminIntake() {
    const { groups } = await api('/api/admin/groups', { admin: true });
    const regions = state.regions || [];
    setMain(adminShell('intake', `
      <h2 style="margin-top:0">Catat pembelian dari kelompok tani</h2>
      <form id="intake" class="card" novalidate>
        <div class="notice" data-form-error hidden role="alert"></div>
        <div class="form-grid">
          <div class="field"><label for="i-group">Kelompok tani</label>
            <select id="i-group" name="groupId" required>
              <option value="">Pilih kelompok</option>
              ${groups.map((g) => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')}
            </select></div>
          <div class="field"><label for="i-date">Tanggal panen</label><input id="i-date" name="harvestDate" type="date" required></div>
          <div class="field"><label for="i-kg">Kg diterima</label><input id="i-kg" name="kgIn" type="number" min="1" step="1" required></div>
          <div class="field"><label for="i-price">Harga beli per kg (Rp)</label><input id="i-price" name="buyPricePerKg" type="number" min="1000" step="1000" value="${esc(state.config.buyPricePerKg || 120000)}"></div>
          <div class="field"><label for="i-process">Proses</label><input id="i-process" name="process" placeholder="Dicuci, natural, honey"></div>
          <div class="field wide"><h3 style="margin:8px 0 4px">Pemeriksaan sampel</h3></div>
          <div class="field"><label for="i-sample">Nomor sampel</label><input id="i-sample" name="sampleId" required placeholder="S-2611-001"></div>
          <div class="field"><label for="i-moist">Kadar air %</label><input id="i-moist" name="moisturePct" type="number" min="5" max="20" step="0.1" required><p class="help">Ideal 10 sampai 12.</p></div>
          <div class="field"><label for="i-defect">Cacat per 300 g</label><input id="i-defect" name="defectCount" type="number" min="0" max="300" step="1" required><p class="help">Hitung cacat dari sampel 300 g.</p></div>
          <div class="field wide"><h3 style="margin:8px 0 4px">Bukti pemeriksaan</h3></div>
          <div class="field wide"><label class="check"><input type="checkbox" name="scaleCalibrated"> Timbangan sudah dikalibrasi hari ini</label></div>
          <div class="field wide"><label class="check"><input type="checkbox" name="farmerPresent"> Petani hadir saat menimbang</label></div>
          <div class="field wide"><label class="check"><input type="checkbox" name="retainedSample"> Sampel disimpan (300 g, diberi label)</label></div>
          <div class="field"><label for="i-photo-s">Foto sampel</label><input id="i-photo-s" type="file" accept="image/jpeg,image/png"><p class="help">JPG atau PNG, maks. 2 MB.</p></div>
          <div class="field"><label for="i-photo-b">Foto karung (opsional)</label><input id="i-photo-b" type="file" accept="image/jpeg,image/png"></div>
          <div class="field"><label for="i-gabah">Kg gabah (opsional)</label><input id="i-gabah" name="gabahKg" type="number" min="0.1" step="0.1"></div>
          <div class="field"><label for="i-green">Kg biji hijau setelah hulling (opsional)</label><input id="i-green" name="greenKg" type="number" min="0.1" step="0.1"></div>
          <div class="field wide"><label for="i-notes">Catatan</label><textarea id="i-notes" name="notes"></textarea></div>
        </div>
        <div class="btn-row"><button class="btn" type="submit" id="i-save">Simpan pembelian</button></div>
      </form>
      <h2>Tambah kelompok tani</h2>
      <form id="group" class="card" novalidate>
        <div class="notice" data-form-error hidden role="alert"></div>
        <div class="form-grid">
          <div class="field"><label for="g-name">Nama kelompok</label><input id="g-name" name="name" required minlength="3" maxlength="80"></div>
          <div class="field"><label for="g-region">Wilayah</label><select id="g-region" name="regionId" required>${regions.map((r) => `<option value="${esc(r.id)}">${esc(r.name)} (${esc(r.regency)})</option>`).join('')}</select></div>
          <div class="field wide"><label for="g-contact">Kontak (hanya internal)</label><input id="g-contact" name="contact" maxlength="200"></div>
        </div>
        <button class="btn secondary" type="submit" id="g-save">Tambah kelompok</button>
      </form>`));
    wireSignOut();
    document.getElementById('intake').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
      form.querySelector('[data-form-error]').hidden = true;
      const btn = document.getElementById('i-save');
      busy(btn, true, 'Menyimpan…');
      try {
        const { lot } = await api('/api/admin/lots', { method: 'POST', admin: true, body: formData(form) });
        for (const [inputId, kind] of [['i-photo-s', 'sample'], ['i-photo-b', 'bags']]) {
          const f = document.getElementById(inputId).files[0];
          if (f) await api(`/api/admin/lots/${encodeURIComponent(lot.id)}/photos`, { method: 'POST', admin: true, body: { kind, dataUrl: await readAsDataUrl(f) } });
        }
        const c = lot.intakeCheck;
        const band = (state.config.gradeBands || []).find((b) => b.key === c.gradeKey);
        if (c.result === 'rejected') {
          toast(`${lot.code} ditolak. Tidak ada pembayaran.`);
          location.hash = '#/admin/lots';
        } else {
          toast(`${lot.code} ${band ? band.label : ''}. Bayar ${rp(c.amountDue)}.`);
          location.hash = '#/admin/lots/' + encodeURIComponent(lot.id);
        }
      } catch (err) { busy(btn, false); showFormError(form, err); if (err.status === 401) adminFail(err); }
    });
    document.getElementById('group').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
      form.querySelector('[data-form-error]').hidden = true;
      try {
        await api('/api/admin/groups', { method: 'POST', admin: true, body: formData(form) });
        toast('Kelompok ditambahkan');
        viewAdminIntake();
      } catch (err) { showFormError(form, err); }
    });
  }

  async function viewAdminLots() {
    const { lots } = await api('/api/admin/lots', { admin: true });
    setMain(adminShell('lots', `
      <h2 style="margin-top:0">Lot</h2>
      <p class="muted" style="font-size:14px">Nilai lot, lalu terbitkan.</p>
      <div class="table-wrap"><table>
        <thead><tr><th>Kode</th><th>Kelompok</th><th>Status</th><th>Kategori</th><th class="num">Cupping</th><th class="num">Siap jual</th><th class="num">Tersedia</th><th></th></tr></thead>
        <tbody>
          ${lots.map((l) => `
            <tr>
              <td>${esc(l.code)}${l.sample ? ' <span class="demo">contoh</span>' : ''}</td>
              <td>${esc(l.groupName)}</td>
              <td><span class="pill">${esc(LOT_STATUS[l.status] || l.status)}</span>${l.intakeCheck ? `<br><span class="muted" style="font-size:13px">${esc(CHECK_TEKS[l.intakeCheck.result])}${l.intakeCheck.gradeKey ? ' · Grade ' + esc(l.intakeCheck.gradeKey) : ''} · ${rp(l.intakeCheck.amountDue)}</span>` : ''}</td>
              <td>${l.tier ? `<span class="${tierClass(l.tier)}">${esc(tierLabel(l.tier))}</span>` : '—'}</td>
              <td class="num">${l.cupScore || '—'}</td>
              <td class="num">${l.sellableKg ? kg(l.sellableKg) : '—'}</td>
              <td class="num">${kg(l.availableKg)}</td>
              <td><div class="btn-row">
                ${['received', 'graded'].includes(l.status) ? `<a class="btn secondary small" href="#/admin/lots/${encodeURIComponent(l.id)}">Nilai</a>` : ''}
                ${l.status === 'graded' && canDo('verify') ? `<button class="btn small" data-verify="${esc(l.id)}">Verifikasi</button>` : ''}
                ${l.status === 'verified' && canDo('publish') ? `<button class="btn small" data-publish="${esc(l.id)}">Terbitkan ke aplikasi</button>` : ''}
                ${l.status === 'listed' && canDo('publish') ? `<button class="btn danger small" data-withdraw="${esc(l.id)}">Tarik</button>` : ''}
              </div></td>
            </tr>`).join('') || '<tr><td colspan="8">Belum ada lot. Catat pembelian di menu Pembelian.</td></tr>'}
        </tbody></table></div>`));
    wireSignOut();
    main.querySelectorAll('[data-verify]').forEach((b) => b.addEventListener('click', async () => {
      try { await api(`/api/admin/lots/${encodeURIComponent(b.dataset.verify)}/verify`, { method: 'POST', admin: true }); toast('Lot diverifikasi'); viewAdminLots(); }
      catch (err) { toast(err.message); }
    }));
    main.querySelectorAll('[data-publish]').forEach((b) => b.addEventListener('click', async () => {
      try { await api(`/api/admin/lots/${encodeURIComponent(b.dataset.publish)}/publish`, { method: 'POST', admin: true }); toast('Diterbitkan ke aplikasi. Paspor dibuat.'); viewAdminLots(); }
      catch (err) { toast(err.message); }
    }));
    main.querySelectorAll('[data-withdraw]').forEach((b) => b.addEventListener('click', async () => {
      if (!window.confirm('Tarik lot ini dari penjualan?')) return;
      try { await api(`/api/admin/lots/${encodeURIComponent(b.dataset.withdraw)}/withdraw`, { method: 'POST', admin: true }); toast('Lot ditarik'); viewAdminLots(); }
      catch (err) { toast(err.message); }
    }));
  }

  async function viewAdminGrade(id) {
    const { lots } = await api('/api/admin/lots', { admin: true });
    const lot = lots.find((l) => l.id === id);
    if (!lot) { setMain(adminShell('lots', '<p class="notice bad">Lot tidak ditemukan.</p>')); wireSignOut(); return; }
    setMain(adminShell('lots', `
      <h2 style="margin-top:0">Nilai ${esc(lot.code)} <span class="muted" style="font-size:16px">${esc(lot.groupName)} · ${kg(lot.kgIn)} diterima</span></h2>
      <form id="grade" class="card" novalidate>
        <div class="notice" data-form-error hidden role="alert"></div>
        <div class="form-grid">
          <div class="field"><label for="g-tier">Kategori</label>
            <select id="g-tier" name="tier" required><option value="">Pilih kategori</option>
              ${Object.entries(state.config.tiers).map(([c, t]) => `<option value="${c}" ${lot.tier === c ? 'selected' : ''}>${esc(t.label)} · ${rp(t.pricePerKg)}/kg</option>`).join('')}
            </select><p class="help" id="g-price">${lot.tier ? rp(state.config.tiers[lot.tier].pricePerKg) + ' per kg' : ''}</p></div>
          <div class="field"><label for="g-grade">Grade</label><input id="g-grade" name="grade" value="${esc(lot.grade || '')}" placeholder="SNI Grade 1"></div>
          <div class="field"><label for="g-cup">Skor cupping (60 sampai 100)</label><input id="g-cup" name="cupScore" type="number" min="60" max="100" step="1" value="${esc(lot.cupScore || '')}"></div>
          <div class="field"><label for="g-moist">Kadar air %</label><input id="g-moist" name="moisturePct" type="number" min="5" max="20" step="0.1" value="${esc(lot.moisturePct || '')}"></div>
          <div class="field"><label for="g-sell">Kg siap jual setelah sortir</label><input id="g-sell" name="sellableKg" type="number" min="1" step="1" value="${esc(lot.sellableKg || '')}"></div>
          <div class="field"><label for="g-process">Proses</label><input id="g-process" name="process" value="${esc(lot.process || '')}"></div>
          <div class="field wide"><label for="g-notes">Catatan</label><textarea id="g-notes" name="notes">${esc(lot.notes || '')}</textarea></div>
        </div>
        <div class="btn-row"><button class="btn" type="submit" id="g-save">Simpan penilaian</button><a class="btn secondary" href="#/admin/lots">Kembali ke lot</a></div>
      </form>
      ${(lot.photos || []).length ? `<h3 style="margin-top:20px">Foto pemeriksaan</h3><div class="btn-row">${lot.photos.map((p) => `<figure style="margin:0"><img data-photo="${esc(p.id)}" alt="Foto ${p.kind === 'sample' ? 'sampel' : 'karung'}" style="width:160px;height:120px;object-fit:cover;border-radius:10px;border:1px solid var(--line);background:var(--surface)"><figcaption class="help">${p.kind === 'sample' ? 'Sampel' : 'Karung'}</figcaption></figure>`).join('')}</div>` : ''}
      ${listingEditorHtml(lot)}`));
    wireSignOut();
    wireListingEditor(lot);
    main.querySelectorAll('img[data-photo]').forEach(async (img) => {
      try {
        const res = await fetch(`/api/admin/photos/${encodeURIComponent(img.dataset.photo)}`, { headers: { Authorization: 'Bearer ' + adminToken() } });
        if (res.ok) img.src = URL.createObjectURL(await res.blob());
      } catch { /* foto tidak tersedia */ }
    });
    const tierSel = document.getElementById('g-tier');
    tierSel.addEventListener('change', () => {
      const t = state.config.tiers[tierSel.value];
      document.getElementById('g-price').textContent = t ? rp(t.pricePerKg) + ' per kg' : '';
    });
    document.getElementById('grade').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
      form.querySelector('[data-form-error]').hidden = true;
      const btn = document.getElementById('g-save');
      busy(btn, true, 'Menyimpan…');
      try {
        await api(`/api/admin/lots/${encodeURIComponent(id)}`, { method: 'PATCH', admin: true, body: formData(form) });
        toast('Penilaian tersimpan');
        location.hash = '#/admin/lots';
      } catch (err) { busy(btn, false); showFormError(form, err); }
    });
  }

  async function viewAdminOrders() {
    const [{ orders }, box] = await Promise.all([api('/api/admin/orders', { admin: true }), api('/api/admin/outbox', { admin: true })]);
    const statuses = ['requested', 'confirmed', 'paid', 'shipped', 'delivered', 'cancelled'];
    setMain(adminShell('orders', `
      <h2 style="margin-top:0">Pesanan</h2>
      <p class="muted" style="font-size:14px">Isi referensi transfer sebelum menandai dibayar.</p>
      <div class="table-wrap"><table>
        <thead><tr><th>Pesanan</th><th>Pembeli</th><th>Status</th><th class="num">Total</th><th>Perbarui</th></tr></thead>
        <tbody>
          ${orders.map((o) => `
            <tr>
              <td>${esc(o.number)}<br><span class="muted" style="font-size:13px">${tanggal(o.createdAt)}</span></td>
              <td>${esc(o.customer.name)}${o.customer.company ? '<br><span class="muted">' + esc(o.customer.company) + '</span>' : ''}<br><span class="muted" style="font-size:13px">${esc(o.customer.email)} · ${esc(o.customer.phone)} · ${esc(o.customer.city)}</span><br><span class="muted" style="font-size:13px">${o.lines.map((l) => esc(l.lotCode) + ' ' + kg(l.kg)).join(', ')}</span></td>
              <td><span class="pill">${esc(STATUS_TEKS[o.status] || o.status)}</span>${o.payment.reference ? `<br><span class="muted" style="font-size:13px">Ref: ${esc(o.payment.reference)}</span>` : ''}${(o.problems || []).length ? `<br><span class="pill warn">Ada laporan masalah</span><br><span class="muted" style="font-size:13px">${o.problems.map((p) => esc(p.message)).join(' · ')}</span>` : ''}</td>
              <td class="num">${rp(o.total)}</td>
              <td>
                <form data-order="${esc(o.id)}" class="btn-row" style="flex-wrap:nowrap">
                  <select name="status" aria-label="Status baru untuk ${esc(o.number)}" style="min-width:120px">
                    ${statuses.map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${esc(STATUS_TEKS[s])}</option>`).join('')}
                  </select>
                  <input name="paymentReference" aria-label="Nomor referensi bayar" placeholder="Ref transfer" value="${esc(o.payment.reference || '')}" style="min-width:120px">
                  <input name="courier" aria-label="Kurir" placeholder="Kurir" value="${esc((o.shipment || {}).courier || '')}" style="min-width:100px">
                  <input name="waybill" aria-label="Nomor resi" placeholder="No. resi" value="${esc((o.shipment || {}).waybill || '')}" style="min-width:120px">
                  <button class="btn small" type="submit">Simpan</button>
                </form>
                ${(state.config.demoAccounts || []).length ? (o.payments || []).filter((p) => p.status === 'pending').map((p) => `<button class="btn secondary small" type="button" data-sim="${esc(p.providerRef || '')}" style="margin-top:6px">Simulasi bayar (demo)</button>`).join('') : ''}
                <p class="error" data-row-error hidden></p>
              </td>
            </tr>`).join('') || '<tr><td colspan="5">Belum ada pesanan.</td></tr>'}
        </tbody></table></div>
      <h2>Pesan ke pelanggan</h2>
      <p class="muted" style="font-size:14px">Email: ${box.providers.email ? 'terhubung' : 'belum diatur, pesan menunggu'} · WhatsApp: ${box.providers.whatsapp ? 'terhubung' : 'belum diatur, pesan menunggu'}</p>
      <div class="table-wrap"><table>
        <thead><tr><th>Pesanan</th><th>Kanal</th><th>Kepada</th><th>Status</th><th>Waktu</th></tr></thead>
        <tbody>${box.items.map((m) => `<tr><td>${esc(m.orderNumber)}</td><td>${esc(m.channel === 'email' ? 'Email' : 'WhatsApp')}</td><td>${esc(m.to)}</td><td><span class="pill ${m.status === 'sent' ? 'ok' : m.status === 'failed' ? 'bad' : 'warn'}">${esc({ queued: 'Menunggu', sent: 'Terkirim', failed: 'Gagal' }[m.status] || m.status)}</span>${m.lastError ? `<br><span class="muted" style="font-size:12px">${esc(m.lastError)}</span>` : ''}</td><td>${tanggal(m.createdAt)}</td></tr>`).join('') || '<tr><td colspan="5">Belum ada pesan.</td></tr>'}</tbody></table></div>`));
    wireSignOut();
    main.querySelectorAll('button[data-sim]').forEach((b) => b.addEventListener('click', async () => {
      try { await api(`/api/admin/payments/${encodeURIComponent(b.dataset.sim)}/simulate`, { method: 'POST', admin: true }); toast('Pembayaran simulasi diterima'); viewAdminOrders(); }
      catch (err) { toast(err.message); }
    }));
    main.querySelectorAll('form[data-order]').forEach((form) => form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = formData(form);
      const err = form.parentElement.querySelector('[data-row-error]');
      err.hidden = true;
      try {
        await api(`/api/admin/orders/${encodeURIComponent(form.dataset.order)}`, { method: 'PATCH', admin: true, body: f });
        toast('Pesanan diperbarui');
        viewAdminOrders();
      } catch (ex) {
        err.hidden = false;
        err.textContent = 'Galat: ' + (ex.fields && Object.values(ex.fields)[0] ? Object.values(ex.fields)[0] : ex.message);
      }
    }));
  }

  async function viewAdminFeedback() {
    const [{ feedback }, { groups }] = await Promise.all([api('/api/admin/feedback', { admin: true }), api('/api/admin/groups', { admin: true })]);
    const tags = [['pass-to-farmer', 'Teruskan ke petani'], ['internal-quality', 'Mutu internal'], ['internal-logistics', 'Logistik internal'], ['discard', 'Buang']];
    setMain(adminShell('feedback', `
      <h2 style="margin-top:0">Umpan balik</h2>
      <p class="muted" style="font-size:14px">Hanya "Teruskan ke petani" yang masuk laporan.</p>
      <div class="table-wrap"><table>
        <thead><tr><th>Pesanan · Lot</th><th>Rasa</th><th>Masalah</th><th>Pesan ulang</th><th>Tag</th></tr></thead>
        <tbody>
          ${feedback.map((f) => `
            <tr>
              <td>${esc(f.orderNumber)}<br>${esc(f.lotCode)}</td>
              <td>${esc(f.taste || '—')}${f.notes ? '<br><span class="muted" style="font-size:13px">' + esc(f.notes) + '</span>' : ''}</td>
              <td>${esc(f.issues)}</td>
              <td>${esc(f.reorder)}</td>
              <td><select data-tag="${esc(f.id)}" aria-label="Tag untuk ${esc(f.lotCode)}"><option value="">Belum ditandai</option>${tags.map(([t, l]) => `<option value="${t}" ${f.tag === t ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></td>
            </tr>`).join('') || '<tr><td colspan="5">Belum ada umpan balik.</td></tr>'}
        </tbody></table></div>
      <h2>Laporan petani</h2>
      <form id="report" class="btn-row">
        <label for="rep-group" class="sr">Kelompok tani</label>
        <select id="rep-group">${groups.map((g) => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')}</select>
        <button class="btn secondary small" type="submit">Tampilkan laporan</button>
      </form>
      <div id="report-out" style="margin-top:12px"></div>`));
    wireSignOut();
    main.querySelectorAll('select[data-tag]').forEach((sel) => sel.addEventListener('change', async () => {
      try { await api(`/api/admin/feedback/${encodeURIComponent(sel.dataset.tag)}`, { method: 'PATCH', admin: true, body: { tag: sel.value } }); toast('Tag tersimpan'); }
      catch (err) { toast(err.message); }
    }));
    document.getElementById('report').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('rep-group').value;
      const rep = await api(`/api/admin/farmer-report/${encodeURIComponent(id)}`, { admin: true });
      document.getElementById('report-out').innerHTML = `
        <div class="card">
          <h3 style="margin-top:0">${esc(rep.group)}</h3>
          <h4>Lot Anda</h4>
          <div class="table-wrap"><table><thead><tr><th>Lot</th><th>Grade</th><th class="num">Cupping</th><th>Kategori</th><th class="num">Kg terjual</th></tr></thead>
          <tbody>${rep.lots.map((l) => `<tr><td>${esc(l.code)}</td><td>${esc(l.grade)}</td><td class="num">${esc(l.cupScore)}</td><td>${esc(tierLabel(l.tier))}</td><td class="num">${kg(l.soldKg)}</td></tr>`).join('') || '<tr><td colspan="5">Belum ada lot yang dinilai.</td></tr>'}</tbody></table></div>
          <h4>Apa kata pembeli (sudah disetujui untuk dibagikan)</h4>
          <ul>${rep.comments.map((c) => `<li><strong>${esc(c.lotCode)}:</strong> ${esc(c.taste || 'Tidak ada catatan rasa')}${c.issues && c.issues !== 'none' ? ' · Masalah: ' + esc(c.issues) : ''}</li>`).join('') || '<li>Belum ada komentar yang disetujui.</li>'}</ul>
        </div>`;
    });
  }

  async function viewAdminSettings() {
    const c = await api('/api/admin/config', { admin: true });
    setMain(adminShell('settings', `
      <h2 style="margin-top:0">Aturan bisnis yang dipakai</h2>
      <div class="table-wrap"><table><tbody>
        <tr><td>Harga beli per kg</td><td class="num">${rp(c.buyPricePerKg)}</td></tr>
        <tr><td>Kehilangan sortir dan pengeringan</td><td class="num">${Math.round(c.sortingLossPct * 100)}%</td></tr>
        <tr><td>Ongkir per kg (jika berlaku)</td><td class="num">${rp(c.shippingPerKg)}</td></tr>
        <tr><td>Biaya per kg</td><td class="num">${rp(c.feesPerKg)}</td></tr>
        <tr><td>Biaya tetap per tahun (tim penuh)</td><td class="num">${rp(c.fixedCostsPerYear)}</td></tr>
        <tr><td>Pesanan minimum per lot</td><td class="num">${c.minOrderKg} kg</td></tr>
        <tr><td>Asumsi campuran grade (dipakai sebelum ada stok)</td><td class="num">${Object.entries(c.defaultMix).map(([k, v]) => esc(tierLabel(k)) + ' ' + Math.round(v * 100) + '%').join(' · ')}</td></tr>
      </tbody></table></div>
      <h2>Kategori</h2>
      <div class="table-wrap"><table><thead><tr><th>Kategori</th><th class="num">Harga per kg</th><th>Ongkir</th></tr></thead><tbody>
        ${Object.entries(c.tiers).map(([k, t]) => `<tr><td><span class="${tierClass(k)}">${esc(t.label)}</span></td><td class="num">${rp(t.pricePerKg)}</td><td>${esc(t.shippingBy === 'anugerah' ? 'Termasuk (ditanggung AnugerahLink)' : t.shippingBy === 'buyer' ? 'Pembeli membayar ' + rp(t.shippingPerKgExtra) + '/kg' : 'Diambil di Papua')}</td></tr>`).join('')}
      </tbody></table></div>
      ${priceEditorHtml(c.tiers)}
      ${contentEditorHtml(c.content || state.config.content)}
      ${themeEditorHtml(c.theme || state.config.theme)}`));
    wireSignOut();
    wireThemeEditor();
    wirePriceEditor();
    wireContentEditor();
  }

  // ---------- tampilan: admin mengubah warna dan sudut ----------
  const TEMA_KOLOM = [['primary', 'Warna utama (tombol, navigasi)'], ['accent', 'Warna aksen (emas, sorotan)'], ['background', 'Latar halaman'], ['text', 'Warna teks']];
  const SUDUT = { tajam: { sm: '4px', md: '6px', lg: '8px' }, ramah: { sm: '8px', md: '12px', lg: '16px' }, bulat: { sm: '12px', md: '18px', lg: '24px' } };
  const SUDUT_LABEL = { tajam: 'Tajam (sudut kecil)', ramah: 'Ramah (sedang)', bulat: 'Bulat (sudut besar)' };

  function themeEditorHtml(t) {
    const sudutNow = Object.keys(SUDUT).find((k) => SUDUT[k].md === t.radius.md) || 'ramah';
    const block = (mode, label) => `
      <fieldset class="theme-mode"><legend>${label}</legend>
        <div class="form-grid">
          ${TEMA_KOLOM.map(([k, lbl]) => `<div class="field"><label for="t-${mode}-${k}">${esc(lbl)}</label>
            <input type="color" id="t-${mode}-${k}" name="${mode}.${k}" value="${esc(t[mode][k])}"></div>`).join('')}
        </div>
      </fieldset>`;
    return `
      <h2>Tampilan</h2>
      <p class="muted">Warna dan sudut yang dilihat pengunjung. Perubahan langsung terlihat di halaman ini. Tekan “Simpan tampilan” agar berlaku untuk semua orang.</p>
      <form class="card" id="theme-form" novalidate>
        <div data-form-error class="notice bad" hidden></div>
        ${block('light', 'Mode terang')}
        ${block('dark', 'Mode gelap')}
        <div class="field" style="max-width:320px"><label for="t-radius">Sudut kotak dan tombol</label>
          <select id="t-radius" name="radius">${Object.keys(SUDUT).map((k) => `<option value="${k}"${k === sudutNow ? ' selected' : ''}>${esc(SUDUT_LABEL[k])}</option>`).join('')}</select>
        </div>
        <div class="btn-row">
          <button class="btn" type="submit" data-save>Simpan tampilan</button>
          <button class="btn secondary" type="button" data-reset>Kembalikan standar</button>
        </div>
      </form>`;
  }

  // Terapkan nilai dari formulir ke halaman sekarang, tanpa menyimpan.
  function previewTheme(form) {
    const t = JSON.parse(JSON.stringify(state.config.theme));
    for (const mode of ['light', 'dark']) {
      for (const [k] of TEMA_KOLOM) {
        const v = form.elements[`${mode}.${k}`].value;
        if (k === 'primary') { t[mode].primary = v; t[mode].primaryHover = v; }
        else if (k === 'accent') { t[mode].accent = v; t[mode].accentStrong = v; }
        else if (k === 'background') t[mode].background = v;
        else t[mode].text = v;
      }
    }
    t.radius = { ...SUDUT[form.elements.radius.value] };
    applyTheme(t);
  }

  function wireThemeEditor() {
    const form = document.getElementById('theme-form');
    if (!form) return;
    form.addEventListener('input', () => previewTheme(form));
    form.addEventListener('change', () => previewTheme(form));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const box = form.querySelector('[data-form-error]');
      box.hidden = true;
      const body = { radius: form.elements.radius.value };
      for (const mode of ['light', 'dark']) {
        body[mode] = {};
        for (const [k] of TEMA_KOLOM) body[mode][k] = form.elements[`${mode}.${k}`].value;
      }
      const btn = form.querySelector('[data-save]');
      busy(btn, true, 'Menyimpan…');
      try {
        const r = await api('/api/admin/theme', { method: 'PUT', body, admin: true });
        state.config.theme = r.theme;
        applyTheme(r.theme);
        toast('Tampilan disimpan. Pengunjung akan melihatnya saat membuka halaman.');
      } catch (err) {
        box.hidden = false;
        box.textContent = err.message || 'Tampilan belum bisa disimpan.';
      } finally { busy(btn, false); }
    });
    form.querySelector('[data-reset]').addEventListener('click', async () => {
      if (!confirm('Kembalikan tampilan ke standar? Warna yang sudah diubah akan hilang.')) return;
      try {
        const r = await api('/api/admin/theme', { method: 'PUT', body: { reset: true }, admin: true });
        state.config.theme = r.theme;
        applyTheme(r.theme);
        toast('Tampilan dikembalikan ke standar.');
        viewAdminSettings();
      } catch (err) { toast(err.message || 'Belum bisa dikembalikan.'); }
    });
  }

  // ---------- harga, teks situs, dan katalog lot ----------
  const KATEGORI_HARGA = ['reserve', 'premium', 'verified', 'local'];
  const TEKS_SITUS = [['homeTitle', 'Judul beranda'], ['homeLead', 'Kalimat pembuka beranda'], ['footerTagline', 'Tagline di footer']];

  function priceEditorHtml(tiers) {
    return `
      <h2>Harga per kategori</h2>
      <p class="muted">Harga ini berlaku untuk semua lot di kategori itu. Setiap perubahan wajib diberi alasan dan tercatat di Riwayat.</p>
      <form class="card" id="price-form" novalidate>
        <div class="notice bad" data-form-error hidden role="alert"></div>
        <div class="form-grid">
          ${KATEGORI_HARGA.map((c) => `<div class="field"><label for="p-${c}">${esc(tiers[c].label)} (Rp per kg)</label><input id="p-${c}" name="${c}" type="number" inputmode="numeric" min="10000" max="10000000" step="1000" value="${esc(tiers[c].pricePerKg)}"></div>`).join('')}
          <div class="field wide"><label for="p-reason">Alasan perubahan</label><textarea id="p-reason" name="reason" maxlength="300" placeholder="Contoh: harga pasar Juli turun"></textarea></div>
        </div>
        <div class="btn-row"><button class="btn" type="submit" data-save>Simpan harga</button></div>
      </form>`;
  }

  function wirePriceEditor() {
    const form = document.getElementById('price-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
      const body = formData(form);
      const btn = form.querySelector('[data-save]');
      busy(btn, true, 'Menyimpan…');
      try {
        await api('/api/admin/prices', { method: 'PUT', body, admin: true });
        state.config = await api('/api/config');
        toast('Harga disimpan dan berlaku sekarang.');
        viewAdminSettings();
      } catch (err) {
        showFormError(form, err);
      } finally { busy(btn, false); }
    });
  }

  function contentEditorHtml(content) {
    return `
      <h2>Teks beranda dan footer</h2>
      <p class="muted">Teks yang dilihat semua pengunjung. Tulis kalimat biasa, tanpa tanda &lt; atau &gt;.</p>
      <form class="card" id="content-form" novalidate>
        <div class="notice bad" data-form-error hidden role="alert"></div>
        ${TEKS_SITUS.map(([k, label]) => `<div class="field"><label for="c-${k}">${esc(label)}</label><textarea id="c-${k}" name="${k}" maxlength="300">${esc(content[k])}</textarea></div>`).join('')}
        <div class="btn-row"><button class="btn" type="submit" data-save>Simpan teks</button><button class="btn secondary" type="button" data-reset-content>Kembalikan teks standar</button></div>
      </form>`;
  }

  function wireContentEditor() {
    const form = document.getElementById('content-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
      const btn = form.querySelector('[data-save]');
      busy(btn, true, 'Menyimpan…');
      try {
        await api('/api/admin/content', { method: 'PUT', body: formData(form), admin: true });
        state.config = await api('/api/config');
        toast('Teks disimpan. Pengunjung melihatnya saat membuka halaman.');
        viewAdminSettings();
      } catch (err) {
        showFormError(form, err);
      } finally { busy(btn, false); }
    });
    form.querySelector('[data-reset-content]').addEventListener('click', async () => {
      if (!confirm('Kembalikan teks ke standar?')) return;
      try {
        const r = await api('/api/admin/content', { admin: true });
        await api('/api/admin/content', { method: 'PUT', body: r.defaults, admin: true });
        state.config = await api('/api/config');
        toast('Teks dikembalikan ke standar.');
        viewAdminSettings();
      } catch (err) { toast(err.message || 'Belum bisa dikembalikan.'); }
    });
  }

  // Tampilan katalog lot. Pembeli hanya melihat judul, cerita, dan foto sampul; foto pemeriksaan tetap privat.
  function listingEditorHtml(lot) {
    const can = canDo('publish');
    const dis = can ? '' : 'disabled';
    const photos = (lot.photos || []).filter((p) => p.kind === 'listing');
    return `
      <h2>Tampilan di katalog</h2>
      <p class="muted">Judul, cerita, dan foto yang dilihat pembeli. Foto pemeriksaan tidak pernah ditampilkan ke pembeli.</p>
      ${can ? '' : '<p class="notice">Hanya admin yang bisa mengubah tampilan katalog. Anda hanya bisa melihatnya.</p>'}
      <form id="listing" class="card" novalidate>
        <div class="notice bad" data-form-error hidden role="alert"></div>
        <div class="field"><label for="l-head">Judul (kosongkan untuk judul otomatis)</label>
          <input id="l-head" name="headline" maxlength="120" value="${esc(lot.headline || '')}" ${dis} placeholder="Contoh: Tiom natural, manis cokelat"></div>
        <div class="field"><label for="l-story">Cerita untuk pembeli</label>
          <textarea id="l-story" name="story" maxlength="1000" ${dis}>${esc(lot.story || '')}</textarea>
          <p class="help">Maksimal 1000 karakter. Tulis fakta dari kebun: asal, panen, dan cara proses.</p></div>
        <div class="field"><span class="label">Foto katalog</span>
          <div class="btn-row" style="align-items:flex-start">
            ${photos.map((p) => `<figure style="margin:0;width:160px"><img data-listing="${esc(p.id)}" alt="Foto katalog" style="width:160px;height:120px;object-fit:cover;border-radius:10px;border:1px solid var(--line);background:var(--surface)">
              <figcaption style="margin-top:6px"><label><input type="radio" name="cover" value="${esc(p.id)}" ${lot.coverPhotoId === p.id ? 'checked' : ''} ${dis}> Sampul</label>
              ${can ? `<button type="button" class="btn danger small" data-del="${esc(p.id)}" style="margin-top:6px">Hapus</button>` : ''}</figcaption></figure>`).join('') || '<p class="muted">Belum ada foto katalog.</p>'}
          </div>
          ${can ? '<input type="file" id="l-file" accept="image/jpeg,image/png" style="margin-top:10px">' : ''}
          <p class="help">JPG atau PNG, maksimal 2 MB. Pilih satu foto sebagai sampul.</p></div>
        <div class="btn-row">${can ? '<button class="btn" type="submit" data-save>Simpan tampilan</button>' : ''}</div>
      </form>`;
  }

  function wireListingEditor(lot) {
    const form = document.getElementById('listing');
    if (!form) return;
    form.querySelectorAll('img[data-listing]').forEach(async (img) => {
      try {
        const res = await fetch(`/api/admin/photos/${encodeURIComponent(img.dataset.listing)}`, { headers: { Authorization: 'Bearer ' + adminToken() } });
        if (res.ok) img.src = URL.createObjectURL(await res.blob());
      } catch { /* foto tidak tersedia */ }
    });
    if (!canDo('publish')) return;
    document.getElementById('l-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const dataUrl = await readAsDataUrl(file);
        await api(`/api/admin/lots/${encodeURIComponent(lot.id)}/photos`, { method: 'POST', admin: true, body: { kind: 'listing', dataUrl } });
        toast('Foto katalog ditambahkan.');
        viewAdminGrade(lot.id);
      } catch (err) { toast(err.message || 'Foto belum bisa diunggah.'); }
    });
    form.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Hapus foto ini dari katalog?')) return;
      try {
        await api(`/api/admin/photos/${encodeURIComponent(b.dataset.del)}`, { method: 'DELETE', admin: true });
        viewAdminGrade(lot.id);
      } catch (err) { toast(err.message || 'Foto belum bisa dihapus.'); }
    }));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
      const cover = form.querySelector('input[name="cover"]:checked');
      const btn = form.querySelector('[data-save]');
      busy(btn, true, 'Menyimpan…');
      try {
        await api(`/api/admin/lots/${encodeURIComponent(lot.id)}/listing`, { method: 'PATCH', admin: true, body: { headline: form.elements.headline.value, story: form.elements.story.value, coverPhotoId: cover ? cover.value : '' } });
        toast('Tampilan katalog disimpan.');
        viewAdminGrade(lot.id);
      } catch (err) { showFormError(form, err); } finally { busy(btn, false); }
    });
  }

  // ---------- kategori ----------
  // Kopi aktif sekarang. Kakao dan kepiting direncanakan dalam dua tahun ke depan dan belum bisa dipesan.
  const KATEGORI = [
    { key: 'kopi', nama: 'Kopi', status: 'aktif', ringkas: 'Kopi Papua dari kelompok tani di Wamena dan sekitarnya.', detail: 'Setiap lot dinilai dengan skor cupping dan grade SNI, lalu diberi paspor dengan kode verifikasi.' },
    { key: 'kakao', nama: 'Kakao', status: 'segera', ringkas: 'Direncanakan dalam dua tahun ke depan.', detail: 'Kakao belum tersedia untuk dipesan. Kami fokus menyelesaikan kopi terlebih dahulu.' },
    { key: 'kepiting', nama: 'Kepiting', status: 'segera', ringkas: 'Direncanakan dalam dua tahun ke depan.', detail: 'Kepiting belum tersedia untuk dipesan. Kami fokus menyelesaikan kopi terlebih dahulu.' },
  ];

  function viewKategoriList() {
    setMain(`
      <h1>Kategori</h1>
      <p class="lead">Saat ini kami fokus pada kopi. Kategori lain menyusul.</p>
      <div class="grid" style="margin-top:16px">
        ${KATEGORI.map((k) => `
          <article class="card">
            <div class="btn-row" style="justify-content:space-between"><h2 style="margin:0;font-size:20px">${esc(k.nama)}</h2>${k.status === 'aktif' ? '<span class="pill ok">Tersedia</span>' : '<span class="pill">Segera hadir</span>'}</div>
            <p class="muted" style="margin:10px 0">${esc(k.ringkas)}</p>
            <p>${esc(k.detail)}</p>
            <div style="margin-top:auto">${k.status === 'aktif' ? '<a class="btn small" href="#/kategori/kopi">Lihat kopi</a>' : `<a class="btn secondary small" href="#/kategori/${esc(k.key)}">Selengkapnya</a>`}</div>
          </article>`).join('')}
      </div>`);
  }

  function viewSegeraHadir(key) {
    const k = KATEGORI.find((x) => x.key === key);
    if (!k || k.status === 'aktif') { location.hash = '#/kategori'; return; }
    setMain(`
      <h1>${esc(k.nama)}</h1>
      <p class="lead">Segera hadir.</p>
      <div class="card" style="max-width:720px">
        <p>${esc(k.detail)}</p>
        <p class="muted">Rencana dua tahun ke depan. Untuk saat ini, silakan lihat <a href="#/kategori/kopi">kopi yang tersedia</a>.</p>
      </div>`);
  }

  // ---------- kebijakan ----------
  function viewLegal(key) {
    const legal = state.config.legal;
    const page = legal && legal.pages[key];
    if (!page) { setMain('<h1>Halaman tidak ditemukan</h1><p><a href="#/">Kembali ke beranda</a></p>'); return; }
    setMain(`
      <h1>${esc(page.title)}</h1>
      ${legal.reviewed ? '' : '<p class="notice">Draf. Teks ini sedang ditinjau dan belum berlaku.</p>'}
      <p class="muted">Berlaku sejak ${esc(legal.updatedAt)} · versi ${esc(legal.version)}</p>
      <div class="card" style="max-width:820px">
        ${page.sections.map((s) => `<h2 style="margin-top:20px;font-size:1.125rem">${esc(s.h)}</h2>${s.p.map((t) => `<p>${esc(t)}</p>`).join('')}`).join('')}
      </div>`);
  }

  // ---------- akun pembeli ----------
  const BUYER_PATHS = ['/api/buyer', '/api/orders'];
  function isBuyerPath(path) { return BUYER_PATHS.some((b) => path === b || path.startsWith(b + '/') || path.startsWith(b + '?')); }
  function buyerToken() { try { return localStorage.getItem('al-buyer') || ''; } catch { return ''; } }
  function setBuyerToken(t) { try { if (t) localStorage.setItem('al-buyer', t); else localStorage.removeItem('al-buyer'); } catch { /* abaikan */ } }

  function addressFieldsHtml(a) {
    return `
      <div class="form-grid">
        <div class="field"><label for="a-label">Label</label><input id="a-label" name="label" maxlength="40" value="${esc(a.label || '')}" placeholder="Kafe, Gudang"></div>
        <div class="field"><label for="a-recipient">Penerima</label><input id="a-recipient" name="recipient" required minlength="2" maxlength="80" value="${esc(a.recipient || '')}"></div>
        <div class="field"><label for="a-phone">Telepon</label><input id="a-phone" name="phone" type="tel" required value="${esc(a.phone || '')}"></div>
        <div class="field"><label for="a-postal">Kode pos</label><input id="a-postal" name="postal" inputmode="numeric" maxlength="5" value="${esc(a.postal || '')}"></div>
        <div class="field"><label for="a-city">Kota</label><input id="a-city" name="city" required minlength="2" maxlength="80" value="${esc(a.city || '')}"></div>
        <div class="field"><label for="a-province">Provinsi</label><input id="a-province" name="province" maxlength="80" value="${esc(a.province || '')}"></div>
        <div class="field wide"><label for="a-street">Alamat lengkap</label><textarea id="a-street" name="street" required minlength="5" maxlength="200">${esc(a.street || '')}</textarea></div>
        <div class="field wide"><label class="check"><input type="checkbox" name="isDefault"> Jadikan alamat utama</label></div>
      </div>`;
  }

  async function viewAccount() {
    if (!buyerToken()) return viewBuyerAuth();
    let me;
    try { me = (await api('/api/buyer/me')).buyer; } catch { setBuyerToken(''); return viewBuyerAuth(); }
    const { orders } = await api('/api/buyer/orders');
    setMain(`
      <div class="btn-row" style="justify-content:space-between;align-items:flex-end">
        <div><h1 style="margin-bottom:4px">Akun saya</h1><p class="muted" style="margin:0">Halo, ${esc(me.name)}. ${esc(me.email)}</p></div>
        <button class="btn secondary small" type="button" id="buyer-out">Keluar</button>
      </div>
      <h2>Pesanan saya</h2>
      ${orders.length ? `<div class="table-wrap"><table><thead><tr><th>Nomor</th><th>Tanggal</th><th>Status</th><th class="num">Total</th><th></th></tr></thead><tbody>
        ${orders.map((o) => `<tr><td>${esc(o.number)}</td><td>${tanggal(o.createdAt)}</td><td>${esc(o.statusLabel)}</td><td class="num">${rp(o.total)}</td><td><a href="#/track/${encodeURIComponent(o.number)}?email=${encodeURIComponent(me.email)}">Lihat</a> · <button type="button" class="btn secondary small" data-invoice="${esc(o.number)}">Faktur PDF</button></td></tr>`).join('')}
        </tbody></table></div>` : `<div class="card"><p><strong>Belum ada pesanan.</strong></p><p class="muted">Pesanan yang Anda buat saat masuk akan muncul di sini.</p><p><a class="btn" href="#/catalogue">Lihat katalog</a></p></div>`}
      <h2>Alamat tersimpan</h2>
      <div class="grid">${me.addresses.map((a) => `
        <div class="card"><div class="btn-row" style="justify-content:space-between"><strong>${esc(a.label)}</strong>${a.isDefault ? '<span class="pill ok">Utama</span>' : ''}</div>
          <p style="margin:8px 0 0">${esc(a.recipient)} · ${esc(a.phone)}</p>
          <p class="muted" style="margin:4px 0">${esc(a.street)}, ${esc(a.city)}${a.province ? ', ' + esc(a.province) : ''}${a.postal ? ' ' + esc(a.postal) : ''}</p>
          <div class="btn-row" style="margin-top:8px">
            ${a.isDefault ? '' : `<button class="btn secondary small" type="button" data-default="${esc(a.id)}">Jadikan utama</button>`}
            <button class="btn danger small" type="button" data-remove="${esc(a.id)}">Hapus</button>
          </div></div>`).join('') || '<p class="muted">Belum ada alamat tersimpan.</p>'}</div>
      <h3 style="margin-top:20px">Tambah alamat</h3>
      <form id="addr-form" class="card" novalidate><div class="notice bad" data-form-error hidden role="alert"></div>
        ${addressFieldsHtml({})}
        <div class="btn-row"><button class="btn" type="submit" data-save>Simpan alamat</button></div></form>
      <h2>Profil</h2>
      <form id="profile" class="card" novalidate><div class="notice bad" data-form-error hidden role="alert"></div>
        <div class="form-grid">
          <div class="field"><label for="pf-name">Nama</label><input id="pf-name" name="name" required minlength="2" maxlength="80" value="${esc(me.name)}"></div>
          <div class="field"><label for="pf-phone">Telepon</label><input id="pf-phone" name="phone" type="tel" required value="${esc(me.phone || '')}"></div>
          <div class="field"><label for="pf-company">Nama kafe atau perusahaan</label><input id="pf-company" name="company" maxlength="120" value="${esc(me.company || '')}"></div>
          <div class="field"><label for="pf-type">Jenis pembeli</label><select id="pf-type" name="buyerType">${JENIS_PEMBELI.map(([v, l]) => `<option value="${v}" ${me.buyerType === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
          <div class="field"><label for="pf-npwp">NPWP (opsional, untuk faktur)</label><input id="pf-npwp" name="npwp" maxlength="25" value="${esc(me.npwp || '')}" placeholder="00.000.000.0-000.000"></div>
        </div>
        <div class="btn-row"><button class="btn" type="submit" data-save>Simpan profil</button></div></form>
      <h2>Data saya</h2>
      <div class="card">
        <p>Anda berhak melihat dan mengunduh data Anda, dan menghapus akun. Riwayat transaksi tetap disimpan tanpa identitas untuk kewajiban pencatatan.</p>
        <div class="btn-row"><button class="btn secondary" type="button" id="buyer-export">Unduh data saya</button></div>
      </div>
      <h2>Ganti kata sandi</h2>
      <form id="pwd" class="card" novalidate><div class="notice bad" data-form-error hidden role="alert"></div>
        <div class="form-grid">
          <div class="field"><label for="pw-cur">Kata sandi lama</label><input id="pw-cur" name="current" type="password" required autocomplete="current-password"></div>
          <div class="field"><label for="pw-new">Kata sandi baru (minimal 8 karakter)</label><input id="pw-new" name="password" type="password" required minlength="8" autocomplete="new-password"></div>
        </div>
        <div class="btn-row"><button class="btn" type="submit" data-save>Ganti kata sandi</button></div></form>
      <h2>Hapus akun</h2>
      <form id="buyer-delete" class="card" novalidate><div class="notice bad" data-form-error hidden role="alert"></div>
        <p>Akun dan data pribadi Anda dihapus. Pesanan tetap tercatat tanpa nama, email, dan telepon. Tindakan ini tidak bisa dibatalkan.</p>
        <div class="field" style="max-width:320px"><label for="bd-pw">Kata sandi untuk konfirmasi</label><input id="bd-pw" name="password" type="password" required autocomplete="current-password"></div>
        <div class="btn-row"><button class="btn danger" type="submit" data-save>Hapus akun saya</button></div></form>`);
    wireAccount(me);
  }

  function wireAccount(me) {
    document.getElementById('buyer-out').addEventListener('click', async () => {
      try { await api('/api/buyer/logout', { method: 'POST' }); } catch { /* sesi sudah habis */ }
      setBuyerToken('');
      toast('Anda sudah keluar.');
      location.hash = '#/';
    });
    const addrForm = document.getElementById('addr-form');
    addrForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      addrForm.querySelector('[data-form-error]').hidden = true;
      const btn = addrForm.querySelector('[data-save]'); busy(btn, true, 'Menyimpan…');
      try { await api('/api/buyer/addresses', { method: 'POST', body: formData(addrForm) }); toast('Alamat disimpan.'); viewAccount(); }
      catch (err) { showFormError(addrForm, err); busy(btn, false); }
    });
    main.querySelectorAll('[data-default]').forEach((b) => b.addEventListener('click', async () => {
      try { await api('/api/buyer/addresses/' + encodeURIComponent(b.dataset.default), { method: 'PATCH', body: { ...addrBody(me, b.dataset.default), isDefault: true } }); viewAccount(); }
      catch (err) { toast(err.message || 'Belum bisa diubah.'); }
    }));
    main.querySelectorAll('[data-invoice]').forEach((b) => b.addEventListener('click', () => downloadInvoice(b.dataset.invoice, '/api/buyer/orders/' + encodeURIComponent(b.dataset.invoice) + '/invoice', true)));
    main.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Hapus alamat ini?')) return;
      try { await api('/api/buyer/addresses/' + encodeURIComponent(b.dataset.remove), { method: 'DELETE' }); viewAccount(); }
      catch (err) { toast(err.message || 'Belum bisa dihapus.'); }
    }));
    document.getElementById('buyer-export').addEventListener('click', async () => {
      try {
        const res = await fetch('/api/buyer/export', { headers: { Authorization: 'Bearer ' + buyerToken() } });
        if (!res.ok) throw new Error('Data belum bisa diunduh.');
        const url = URL.createObjectURL(await res.blob());
        const a = document.createElement('a'); a.href = url; a.download = 'data-saya.json';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (err) { toast(err.message || 'Data belum bisa diunduh.'); }
    });
    const del = document.getElementById('buyer-delete');
    del.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!confirm('Hapus akun ini secara permanen?')) return;
      del.querySelector('[data-form-error]').hidden = true;
      const btn = del.querySelector('[data-save]'); busy(btn, true, 'Menghapus…');
      try {
        await api('/api/buyer/delete', { method: 'POST', body: formData(del) });
        setBuyerToken('');
        toast('Akun Anda sudah dihapus.');
        location.hash = '#/';
      } catch (err) { showFormError(del, err); busy(btn, false); }
    });
    const profile = document.getElementById('profile');
    profile.addEventListener('submit', async (e) => {
      e.preventDefault();
      profile.querySelector('[data-form-error]').hidden = true;
      const btn = profile.querySelector('[data-save]'); busy(btn, true, 'Menyimpan…');
      try { await api('/api/buyer/me', { method: 'PATCH', body: formData(profile) }); toast('Profil disimpan.'); viewAccount(); }
      catch (err) { showFormError(profile, err); busy(btn, false); }
    });
    const pwd = document.getElementById('pwd');
    pwd.addEventListener('submit', async (e) => {
      e.preventDefault();
      pwd.querySelector('[data-form-error]').hidden = true;
      const btn = pwd.querySelector('[data-save]'); busy(btn, true, 'Menyimpan…');
      try { await api('/api/buyer/password', { method: 'POST', body: formData(pwd) }); pwd.reset(); toast('Kata sandi diganti.'); busy(btn, false); }
      catch (err) { showFormError(pwd, err); busy(btn, false); }
    });
  }

  // Unduh faktur. Pembeli memakai token akun; tamu memakai email di tautan.
  async function downloadInvoice(number, path, withToken) {
    try {
      const res = await fetch(path, { headers: withToken ? { Authorization: 'Bearer ' + buyerToken() } : {} });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error((j.error && j.error.message) || 'Faktur belum bisa diunduh.'); }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url; a.download = 'faktur-' + number + '.pdf';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { toast(err.message || 'Faktur belum bisa diunduh.'); }
  }

  // Data alamat yang sudah ada, untuk tombol "Jadikan utama". Server mengganti semua kolom yang dikirim.
  function addrBody(me, id) {
    const a = me.addresses.find((x) => x.id === id) || {};
    return { label: a.label, recipient: a.recipient, phone: a.phone, street: a.street, city: a.city, province: a.province, postal: a.postal };
  }

  // Pindah ke Akun. Bila hash sudah #/akun, router tidak dipanggil ulang, jadi halaman digambar langsung.
  function goAccount() {
    if (location.hash === '#/akun' || location.hash === '#/masuk') viewAccount();
    else location.hash = '#/akun';
  }

  function viewBuyerAuth() {
    setMain(`
      <h1>Akun pembeli</h1>
      <p class="muted">Masuk untuk menyimpan alamat dan melihat riwayat pesanan. Anda tetap bisa memesan tanpa akun.</p>
      <div class="grid" style="grid-template-columns:1fr">
        <form id="buyer-login" class="card" novalidate><h2 style="margin-top:0">Masuk</h2>
          <div class="notice bad" data-form-error hidden role="alert"></div>
          <div class="field"><label for="bl-email">Email</label><input id="bl-email" name="email" type="email" required autocomplete="email"></div>
          <div class="field"><label for="bl-pw">Kata sandi</label><input id="bl-pw" name="password" type="password" required autocomplete="current-password"></div>
          <div class="btn-row"><button class="btn" type="submit" data-save>Masuk</button></div></form>
        <form id="buyer-signup" class="card" novalidate><h2 style="margin-top:0">Daftar</h2>
          <div class="notice bad" data-form-error hidden role="alert"></div>
          <div class="form-grid">
            <div class="field"><label for="bs-name">Nama kontak</label><input id="bs-name" name="name" required minlength="2" maxlength="80" autocomplete="name"></div>
            <div class="field"><label for="bs-phone">Telepon</label><input id="bs-phone" name="phone" type="tel" required autocomplete="tel"></div>
            <div class="field"><label for="bs-email">Email</label><input id="bs-email" name="email" type="email" required autocomplete="email"></div>
            <div class="field"><label for="bs-company">Nama kafe atau perusahaan</label><input id="bs-company" name="company" maxlength="120" autocomplete="organization"></div>
            <div class="field"><label for="bs-type">Jenis pembeli</label><select id="bs-type" name="buyerType">${JENIS_PEMBELI.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select></div>
            <div class="field"><label for="bs-pw">Kata sandi (minimal 8 karakter)</label><input id="bs-pw" name="password" type="password" required minlength="8" autocomplete="new-password"></div>
          </div>
          <div class="field"><label class="check"><input type="checkbox" name="consent" required> Saya setuju dengan <a href="#/kebijakan-privasi">kebijakan privasi</a> dan <a href="#/syarat">syarat penggunaan</a>.</label></div>
          <div class="btn-row"><button class="btn" type="submit" data-save>Buat akun</button></div></form>
      </div>`);
    const login = document.getElementById('buyer-login');
    login.addEventListener('submit', async (e) => {
      e.preventDefault();
      login.querySelector('[data-form-error]').hidden = true;
      const btn = login.querySelector('[data-save]'); busy(btn, true, 'Memproses…');
      try { const r = await api('/api/buyer/login', { method: 'POST', body: formData(login) }); setBuyerToken(r.token); goAccount(); }
      catch (err) { showFormError(login, err); busy(btn, false); }
    });
    const signup = document.getElementById('buyer-signup');
    signup.addEventListener('submit', async (e) => {
      e.preventDefault();
      signup.querySelector('[data-form-error]').hidden = true;
      const f = formData(signup);
      f.consent = signup.elements.consent.checked;
      const btn = signup.querySelector('[data-save]'); busy(btn, true, 'Memproses…');
      try { const r = await api('/api/buyer/signup', { method: 'POST', body: f }); setBuyerToken(r.token); toast('Akun dibuat. Selamat datang!'); goAccount(); }
      catch (err) { showFormError(signup, err); busy(btn, false); }
    });
  }

  // Checkout untuk pembeli yang sudah masuk: isi data dari profil dan alamat utama, dan pilih alamat lain bila perlu.
  async function prefillCheckout() {
    let me;
    try { me = (await api('/api/buyer/me')).buyer; } catch { setBuyerToken(''); return; }
    const form = document.getElementById('checkout');
    if (!form) return;
    const set = (name, v) => { if (form.elements[name] && v) form.elements[name].value = v; };
    set('name', me.name); set('company', me.company); set('phone', me.phone); set('buyerType', me.buyerType); set('npwp', me.npwp);
    form.elements.email.value = me.email; form.elements.email.readOnly = true;
    if (me.addresses.length) {
      const sel = document.createElement('select');
      sel.id = 'c-addr';
      sel.innerHTML = me.addresses.map((a) => `<option value="${esc(a.id)}" ${a.isDefault ? 'selected' : ''}>${esc(a.label)} · ${esc(a.city)}</option>`).join('');
      const wrap = document.createElement('div');
      wrap.className = 'field wide';
      wrap.innerHTML = '<label for="c-addr">Alamat pengiriman</label>';
      wrap.appendChild(sel);
      form.querySelector('.form-grid').prepend(wrap);
      const apply = () => {
        const a = me.addresses.find((x) => x.id === sel.value);
        if (!a) return;
        set('city', a.city); set('street', a.street); set('phone', a.phone);
      };
      sel.addEventListener('change', apply);
      apply();
    }
  }

  // Kotak cari di header: kopi mencari di katalog; kategori lain membuka halamannya.
  function wireSearch() {
    const form = document.getElementById('search-form');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const cat = document.getElementById('search-cat').value;
      const q = document.getElementById('search-q').value.trim();
      if (cat !== 'kopi') { location.hash = '#/kategori/' + encodeURIComponent(cat); return; }
      location.hash = '#/catalogue' + (q ? '?q=' + encodeURIComponent(q) : '');
    });
  }

  // ---------- router ----------
  function parse() {
    const raw = location.hash.replace(/^#/, '') || '/';
    const [pathPart, queryPart] = raw.split('?');
    const parts = pathPart.split('/').filter(Boolean).map((p) => decodeURIComponent(p));
    const query = Object.fromEntries(new URLSearchParams(queryPart || '').entries());
    return { parts, query };
  }

  async function route() {
    const { parts, query } = parse();
    state.section = null;
    updateCartCount();
    markNav();
    try {
      if (parts.length === 0) return await viewHome();
      const [head, a, b] = parts;
      state.section = ['catalogue', 'kategori', 'about'].includes(head) ? 'katalog' : null;
      if (head === 'catalogue') return await viewCatalogue(query);
      if (head === 'lot' && a) return await viewLot(a);
      if (head === 'passport' && a) return await viewPassport(a);
      if (head === 'cart') return await viewCart();
      if (head === 'checkout') return viewCheckout();
      if (head === 'order' && a) return viewOrderCreated(a);
      if (head === 'track' && !a) return viewTrack();
      if (head === 'track' && a) return await viewTrackDetail(a, query);
      if (head === 'feedback' && a) return viewFeedback(a);
      if (head === 'about') return viewAbout();
      if (head === 'kategori' && !a) return viewKategoriList();
      if (head === 'kategori' && a === 'kopi') return await viewCatalogue(query);
      if (head === 'kategori' && a) return viewSegeraHadir(a);
      if (head === 'akun' || head === 'masuk') return await viewAccount();
      if (head === 'kebijakan-privasi' || head === 'syarat' || head === 'pengembalian') return viewLegal(head);
      if (head === 'admin') {
        if (!adminToken()) return viewAdminLogin();
        const cu = currentUser();
        if (cu && cu.mustChangePassword) return viewChangePassword();
        const pages = allowedPages();
        const sec = a || landingPage();
        if (!pages.includes(sec)) { location.hash = '#/admin/' + landingPage(); return; }
        if (sec === 'users') return await viewAdminUsers(b);
        if (sec === 'alur') return await viewWorkflow();
        if (sec === 'audit') return await viewAdminAudit();
        if (sec === 'dashboard') return await viewAdminDashboard();
        if (sec === 'intake') return await viewAdminIntake();
        if (sec === 'lots' && b) return await viewAdminGrade(b);
        if (sec === 'lots') return await viewAdminLots();
        if (sec === 'orders') return await viewAdminOrders();
        if (sec === 'feedback') return await viewAdminFeedback();
        if (sec === 'settings') return await viewAdminSettings();
        return await viewAdminDashboard();
      }
      setMain(`<h1>Halaman tidak ditemukan</h1><p><a href="#/">Kembali ke beranda</a></p>`);
    } catch (err) {
      if (err && err.status === 401) return adminFail(err);
      setMain(`<h1>Ada yang belum berjalan</h1><p class="notice bad">${esc(err && err.message ? err.message : 'Coba muat ulang halaman ini.')}</p><p><a href="#/">Kembali ke beranda</a></p>`);
    }
  }

  // Terapkan tema dari config/theme.js sebagai variabel CSS.
  function applyTheme(t) {
    const vars = (m) => `--green:${m.primary};--green-2:${m.primaryHover};--green-soft:${m.primarySoft};` +
      `--gold:${m.accent};--gold-hi:${m.accentStrong};--gold-soft:${m.accentSoft};--gold-ink:${m.accentInk};` +
      `--brown:${m.brown};--bg:${m.background};--surface:${m.surface};--ink:${m.text};--ink-muted:${m.textMuted};` +
      `--line:${m.border};--brand:${m.primary};--on-primary:${m.onPrimary};--accent:${m.success};--danger:${m.danger};` +
      `--heading:${m.heading};--hero-from:${m.heroFrom};--hero-to:${m.heroTo};--hero-ink:${m.heroInk};` +
      `--footer-bg:${m.footerBg};--footer-ink:${m.footerInk};`;
    const radius = `--radius-sm:${t.radius.sm};--radius:${t.radius.md};--radius-lg:${t.radius.lg};--font:${t.font};`;
    const css = `:root{${vars(t.light)}${radius}}` +
      `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${vars(t.dark)}}}` +
      `:root[data-theme="dark"]{${vars(t.dark)}}`;
    let el = document.getElementById('theme-vars');
    if (!el) { el = document.createElement('style'); el.id = 'theme-vars'; document.head.appendChild(el); }
    el.textContent = css;
    try { localStorage.setItem('al-theme-css', css); } catch { /* abaikan */ }
  }

  // Pilihan tema per pengunjung: Sistem (ikut perangkat), Terang, atau Gelap. Disimpan di browser ini saja.
  const THEME_MODES = { system: 'Sistem', light: 'Terang', dark: 'Gelap' };
  function currentThemeMode() {
    try { const m = localStorage.getItem('al-theme'); return THEME_MODES[m] ? m : 'system'; } catch { return 'system'; }
  }
  function setThemeMode(mode) {
    if (mode === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', mode);
    try { localStorage.setItem('al-theme', mode); } catch { /* penyimpanan diblokir: pilihan berlaku untuk halaman ini saja */ }
    paintThemeToggle();
  }
  function paintThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const mode = currentThemeMode();
    btn.textContent = 'Tema: ' + THEME_MODES[mode];
    btn.setAttribute('aria-label', 'Ganti tema. Sekarang: ' + THEME_MODES[mode]);
  }
  function wireThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const order = ['system', 'light', 'dark'];
    btn.addEventListener('click', () => {
      const next = order[(order.indexOf(currentThemeMode()) + 1) % order.length];
      setThemeMode(next);
    });
    paintThemeToggle();
  }

  // Tombol kembali ke atas di footer.
  function wireBackToTop() {
    const b = document.getElementById('back-to-top');
    if (b) b.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  // Tandai halaman aktif di navigasi.
  function markNav() {
    const raw = location.hash || '#/';
    // Kategori dan Tentang termasuk dalam Katalog, jadi tautan Katalog tetap aktif.
    const h = /^#\/(kategori|about)/.test(raw) ? '#/catalogue' : raw;
    document.querySelectorAll('.nav a').forEach((a) => {
      const href = a.getAttribute('href') || '';
      if (href && h.startsWith(href)) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  async function boot() {
    wireThemeToggle();
    wireSearch();
    wireBackToTop();
    try {
      state.config = await api('/api/config');
      applyTheme(state.config.theme);
      const tag = document.querySelector('.footer-tag');
      if (tag && state.config.content) tag.textContent = state.config.content.footerTagline;
    } catch (err) {
      setMain(`<h1>AnugerahLink</h1><p class="notice bad">${esc(err.message)}</p>`);
      return;
    }
    try {
      state.regions = await api('/api/regions');
    } catch { state.regions = []; }
    // Buka aplikasi selalu di beranda. Tautan langsung (paspor, lot, pesanan) tetap dibuka apa adanya.
    const entry = location.hash.replace(/^#/, '');
    if (entry === '' || entry === '/' || entry === '/catalogue' || entry.startsWith('/catalogue?')) {
      location.hash = '#/';
    }
    // Pratinjau tema admin hanya berlaku di halaman itu; pindah halaman mengembalikannya.
    window.addEventListener('hashchange', () => { applyTheme(state.config.theme); route(); });
    route();
  }

  boot();
})();
