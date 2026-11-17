/* AnugerahLink front end. Hash-routed, no framework, no external requests.
   All values written to the page go through esc(). */
(function () {
  'use strict';

  const main = document.getElementById('main');
  const toastEl = document.getElementById('toast');
  const state = { config: null, cart: loadCart() };

  // ---------- helpers ----------
  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function rp(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); }
  function kg(n) { return Number(n || 0).toLocaleString('id-ID') + ' kg'; }
  function date(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? esc(iso) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }
  function tierClass(code) { return 'tier tier-' + esc(code); }
  function tierLabel(code) { return (state.config && state.config.tiers[code] && state.config.tiers[code].label) || code; }

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
    try { localStorage.setItem('al-cart', JSON.stringify(state.cart)); } catch { /* storage blocked: cart lives for this page only */ }
    updateCartCount();
  }
  function updateCartCount() {
    const n = state.cart.reduce((a, l) => a + l.kg, 0);
    const badge = document.getElementById('cart-count');
    badge.hidden = n === 0;
    badge.textContent = String(n);
  }

  function adminToken() { try { return sessionStorage.getItem('al-admin') || ''; } catch { return ''; } }
  function setAdminToken(t) { try { sessionStorage.setItem('al-admin', t); } catch { /* ignore */ } }
  function clearAdminToken() { try { sessionStorage.removeItem('al-admin'); } catch { /* ignore */ } }

  function session(key) { try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { return null; } }
  function setSession(key, v) { try { sessionStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } }

  async function api(path, { method = 'GET', body, admin = false } = {}) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (admin) headers.Authorization = 'Bearer ' + adminToken();
    let res;
    try {
      res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch {
      throw { message: 'Cannot reach the server. Check your connection and try again.', fields: {} };
    }
    let data = {};
    try { data = await res.json(); } catch { /* empty body */ }
    if (!res.ok) {
      const err = (data && data.error) || { message: 'Something went wrong.' };
      if (res.status === 401 && admin) { clearAdminToken(); }
      throw { message: err.message, fields: err.fields || {}, status: res.status, code: err.code, extra: err };
    }
    return data;
  }

  function setMain(html) {
    main.innerHTML = html;
    main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  function fieldError(fields, key) {
    return fields && fields[key] ? `<p class="error" id="err-${esc(key)}">Error: ${esc(fields[key])}</p>` : '';
  }
  function invalid(fields, key) { return fields && fields[key] ? ' aria-invalid="true" aria-describedby="err-' + esc(key) + '"' : ''; }

  // Read a form into a plain object. Numbers come through as strings; the server converts them.
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
    if (box) { box.hidden = false; box.textContent = err.message || 'Please try again.'; }
    if (err.fields) {
      for (const key of Object.keys(err.fields)) {
        const el = form.querySelector(`[name="${CSS.escape(key)}"]`);
        if (el) el.setAttribute('aria-invalid', 'true');
      }
    }
  }

  function busy(btn, on, labelWhileBusy) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = labelWhileBusy || 'Working…'; btn.disabled = true; }
    else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
  }

  function passportHref(code) { return '#/passport/' + encodeURIComponent(code); }
  function lotHref(code) { return '#/lot/' + encodeURIComponent(code); }

  // ---------- storefront ----------
  function lotCard(l) {
    const soldOut = l.soldOut;
    return `
      <article class="card lot-card" aria-labelledby="lot-${esc(l.code)}">
        <div class="btn-row" style="justify-content:space-between">
          <span class="${tierClass(l.tier)}">${esc(l.tierLabel)}</span>
          <span class="code">${esc(l.code)}</span>
        </div>
        <h3 id="lot-${esc(l.code)}"><a href="${lotHref(l.code)}" style="color:inherit;text-decoration:none">Cup ${esc(l.cupScore)} · ${esc(l.regionName)}</a></h3>
        <p class="muted">${esc(l.groupName)} · ${esc(l.process)} · ${esc(l.grade)}</p>
        <p class="price num">${rp(l.pricePerKg)} <span class="muted" style="font-size:14px;font-weight:400">per kg</span></p>
        <p class="muted" style="font-size:14px">${esc(l.shippingNote)}</p>
        <div class="btn-row">
          ${soldOut ? '<span class="pill bad">Sold out</span>' : `<span class="pill">${kg(l.availableKg)} in stock</span>`}
          ${l.lowStock ? '<span class="pill warn">Low stock</span>' : ''}
          ${l.sample ? '<span class="pill demo">Sample lot</span>' : ''}
        </div>
        <div class="btn-row" style="margin-top:auto">
          <a class="btn secondary small" href="${lotHref(l.code)}">View lot</a>
          <a class="btn secondary small" href="${passportHref(l.code)}">Passport</a>
        </div>
      </article>`;
  }

  async function viewHome() {
    setMain(`<p class="muted">Loading lots…</p>`);
    const { lots } = await api('/api/lots?sort=cup_desc');
    const featured = lots.slice(0, 3);
    const tiers = state.config.tiers;
    setMain(`
      <section class="hero">
        <h1>Verified Papuan coffee, bought directly from farmer groups.</h1>
        <p class="lead">Every lot is graded before it is listed, traced to the farmer group it came from, and sold with its passport. Farmers are paid in cash at the farm gate.</p>
        <div class="btn-row"><a class="btn" href="#/catalogue">Browse lots in stock</a><a class="btn secondary" href="#/about">How it works</a></div>
      </section>
      <section aria-labelledby="how">
        <h2 id="how">How it works</h2>
        <div class="steps">
          <div class="card"><h3>1. Bought</h3><p>Our field team buys from farmer groups in cash, at a published price.</p></div>
          <div class="card"><h3>2. Graded</h3><p>Our grader cups every lot and sets its grade, cup score and tier before it is listed.</p></div>
          <div class="card"><h3>3. Traced</h3><p>Each lot has a passport showing its region, group, harvest and the price paid.</p></div>
        </div>
      </section>
      <section aria-labelledby="tiers">
        <h2 id="tiers">The four tiers</h2>
        <div class="steps">
          ${Object.entries(tiers).map(([code, t]) => `
            <div class="card"><span class="${tierClass(code)}">${esc(t.label)}</span>
              <p class="price num" style="margin-top:8px;font-weight:700">${rp(t.pricePerKg)} <span class="muted" style="font-weight:400;font-size:14px">per kg</span></p>
              <p class="muted" style="font-size:14px">${esc(t.description)}</p></div>`).join('')}
        </div>
      </section>
      <section aria-labelledby="featured">
        <h2 id="featured">Lots in stock now</h2>
        ${featured.length ? `<div class="grid lots">${featured.map(lotCard).join('')}</div>` : '<p class="muted">No lots in stock right now. Check back soon.</p>'}
        <p style="margin-top:16px"><a href="#/catalogue">See all lots</a></p>
      </section>`);
  }

  async function viewCatalogue(query) {
    const params = new URLSearchParams();
    if (query.tier) params.set('tier', query.tier);
    if (query.region) params.set('region', query.region);
    if (query.sort) params.set('sort', query.sort);
    if (query.inStock === '0') params.set('inStock', '0');
    const regions = state.regions || [];
    const { lots } = await api('/api/lots?' + params.toString());
    setMain(`
      <h1>Catalogue</h1>
      <p class="muted">Every lot is graded and verified before it is listed.</p>
      <form class="filters card" id="filters" role="search" aria-label="Filter lots">
        <div class="field"><label for="f-tier">Tier</label>
          <select id="f-tier" name="tier"><option value="">All tiers</option>
            ${Object.entries(state.config.tiers).map(([c, t]) => `<option value="${esc(c)}" ${query.tier === c ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}
          </select></div>
        <div class="field"><label for="f-region">Region</label>
          <select id="f-region" name="region"><option value="">All regions</option>
            ${regions.map((r) => `<option value="${esc(r.id)}" ${query.region === r.id ? 'selected' : ''}>${esc(r.name)}${r.rollout === 'later' ? ' (coming soon)' : ''}</option>`).join('')}
          </select></div>
        <div class="field"><label for="f-sort">Sort by</label>
          <select id="f-sort" name="sort">
            <option value="cup_desc" ${!query.sort || query.sort === 'cup_desc' ? 'selected' : ''}>Cup score, high to low</option>
            <option value="price_asc" ${query.sort === 'price_asc' ? 'selected' : ''}>Price, low to high</option>
            <option value="price_desc" ${query.sort === 'price_desc' ? 'selected' : ''}>Price, high to low</option>
            <option value="freshest" ${query.sort === 'freshest' ? 'selected' : ''}>Harvest, newest first</option>
          </select></div>
        <div class="field"><label class="check"><input type="checkbox" name="inStock" value="1" ${query.inStock !== '0' ? 'checked' : ''}> In stock only</label></div>
      </form>
      <p class="muted" role="status">${lots.length} ${lots.length === 1 ? 'lot' : 'lots'} ${query.inStock !== '0' ? 'in stock' : 'listed'}</p>
      ${lots.length
        ? `<div class="grid lots">${lots.map(lotCard).join('')}</div>`
        : `<div class="card"><p>No lots match these filters.</p><p><a href="#/catalogue">Clear filters</a></p></div>`}`);
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
    const maxKg = Math.max(lot.minOrderKg, lot.availableKg);
    setMain(`
      <nav aria-label="Breadcrumb" class="muted" style="font-size:14px"><a href="#/catalogue">Catalogue</a> / ${esc(lot.code)}</nav>
      <div class="grid" style="grid-template-columns:1fr;margin-top:12px">
        <article class="card">
          <div class="btn-row" style="justify-content:space-between"><span class="${tierClass(lot.tier)}">${esc(lot.tierLabel)}</span><span class="code muted">${esc(lot.code)}</span></div>
          <h1 style="margin-top:12px">Cup ${esc(lot.cupScore)} · ${esc(lot.regionName)}</h1>
          <p class="muted">${esc(lot.tierDescription)}</p>
          <dl class="kv" style="margin:16px 0">
            <dt>Farmer group</dt><dd>${esc(lot.groupName)}</dd>
            <dt>Regency</dt><dd>${esc(lot.regency)}</dd>
            <dt>Process</dt><dd>${esc(lot.process)}</dd>
            <dt>Grade</dt><dd>${esc(lot.grade)}</dd>
            <dt>Harvest</dt><dd>${date(lot.harvestDate)}</dd>
            <dt>In stock</dt><dd>${lot.soldOut ? '<span class="pill bad">Sold out</span>' : kg(lot.availableKg) + (lot.lowStock ? ' <span class="pill warn">Low stock</span>' : '')}</dd>
          </dl>
          <p class="price num" style="font-size:24px;font-weight:700">${rp(lot.pricePerKg)} <span class="muted" style="font-size:15px;font-weight:400">per kg</span></p>
          <p class="muted" style="font-size:14px">${esc(lot.shippingNote)}. Minimum order ${lot.minOrderKg} kg.</p>
          ${lot.sample ? '<p class="demo">Sample lot for demonstration.</p>' : ''}
          ${lot.soldOut ? '' : `
          <form id="add-form" style="margin-top:16px">
            <div class="field"><label for="kg">Quantity (kg)</label>
              <div class="stepper">
                <button type="button" class="btn secondary" data-step="-${lot.stepKg}" aria-label="Less">−</button>
                <input id="kg" name="kg" type="number" inputmode="numeric" min="${lot.minOrderKg}" max="${maxKg}" step="${lot.stepKg}" value="${startKg}">
                <button type="button" class="btn secondary" data-step="${lot.stepKg}" aria-label="More">+</button>
              </div>
              <p class="help">Minimum ${lot.minOrderKg} kg, in steps of ${lot.stepKg} kg. Up to ${kg(lot.availableKg)}.</p>
              <p class="error" id="kg-error" hidden></p>
            </div>
            <div class="btn-row">
              <button class="btn" type="submit">${inCart ? 'Update cart' : 'Add to cart'}</button>
              <a class="btn secondary" href="${passportHref(lot.code)}">View passport</a>
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
      if (!Number.isInteger(n)) problem = 'Enter a whole number of kg.';
      else if (n < lot.minOrderKg) problem = `Minimum order is ${lot.minOrderKg} kg.`;
      else if ((n - lot.minOrderKg) % lot.stepKg !== 0) problem = `Use steps of ${lot.stepKg} kg.`;
      else if (n > lot.availableKg) problem = `Only ${lot.availableKg} kg left.`;
      if (problem) { err.hidden = false; err.textContent = 'Error: ' + problem; input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', 'kg-error'); return; }
      state.cart = state.cart.filter((l) => l.lotCode !== lot.code);
      state.cart.push({ lotCode: lot.code, kg: n });
      saveCart();
      toast(`${lot.code}: ${n} kg in your cart`);
      location.hash = '#/cart';
    });
  }

  async function viewPassport(code) {
    let data;
    try {
      data = await api('/api/passport/' + encodeURIComponent(code));
    } catch (err) {
      setMain(`<h1>Passport not found</h1><p class="muted">${esc(err.message)}</p><p><a href="#/catalogue">Back to catalogue</a></p>`);
      return;
    }
    const p = data.passport;
    const r = p.record;
    const match = p.recordMatchesHash;
    setMain(`
      <nav aria-label="Breadcrumb" class="muted" style="font-size:14px"><a href="#/catalogue">Catalogue</a> / Passport</nav>
      <h1 style="margin-top:12px">Lot passport: ${esc(r.code)}</h1>
      <p class="muted">A verified record of where this lot came from and how it was graded.</p>
      ${p.sample ? '<p class="demo">Sample lot for demonstration.</p>' : ''}
      <div class="grid" style="grid-template-columns:1fr">
        <section class="card" aria-labelledby="origin">
          <h2 id="origin" style="margin-top:0">Origin</h2>
          <dl class="kv">
            <dt>Region</dt><dd>${esc(r.regionName)}</dd>
            <dt>Regency</dt><dd>${esc(r.regency)}</dd>
            <dt>Farmer group</dt><dd>${esc(r.groupName)}</dd>
            <dt>Harvest</dt><dd>${date(r.harvestDate)}</dd>
            <dt>Process</dt><dd>${esc(r.process)}</dd>
          </dl>
        </section>
        <section class="card" aria-labelledby="grading">
          <h2 id="grading" style="margin-top:0">Grading</h2>
          <dl class="kv">
            <dt>Grade</dt><dd>${esc(r.grade)}</dd>
            <dt>Cup score</dt><dd>${esc(r.cupScore)}</dd>
            <dt>Moisture</dt><dd>${esc(r.moisturePct)}%</dd>
            <dt>Tier</dt><dd><span class="${tierClass(r.tier)}">${esc(tierLabel(r.tier))}</span></dd>
            <dt>Kg received</dt><dd>${kg(r.kgIn)}</dd>
            <dt>Sellable after sorting</dt><dd>${kg(r.sellableKg)}</dd>
            <dt>Farm-gate price paid</dt><dd>${rp(r.buyPricePerKg)} per kg</dd>
          </dl>
        </section>
        <section class="card" aria-labelledby="record">
          <h2 id="record" style="margin-top:0">Record check</h2>
          ${match === true
            ? '<p class="notice ok">Verified record. The fields on this page match the hash recorded when the lot was published.</p>'
            : match === false
              ? '<p class="notice bad">The record no longer matches the hash recorded at publishing. Ask the team before buying.</p>'
              : '<p class="notice">No hash is stored for this lot.</p>'}
          <p class="muted">The hash is computed from the fields above. If any of them changes after publishing, the hash changes. This shows change; it does not by itself prove that no change was ever made.</p>
          <p><span class="muted">Record hash (SHA-256)</span></p>
          <p class="hash">${esc(p.hash)}</p>
          <p class="muted" style="font-size:14px">Published ${date(p.publishedAt)}. ${p.status === 'withdrawn' ? '<span class="pill warn">Withdrawn from sale</span>' : ''}</p>
        </section>
      </div>
      <div class="btn-row" style="margin-top:16px">
        ${p.availableKg > 0 && p.status === 'listed' ? `<a class="btn" href="${lotHref(r.code)}">Buy this lot</a>` : ''}
        <a class="btn secondary" href="#/catalogue">Back to catalogue</a>
      </div>`);
  }

  async function viewCart() {
    if (state.cart.length === 0) {
      setMain(`<h1>Your cart</h1><div class="card"><p>Your cart is empty.</p><p><a class="btn" href="#/catalogue">Browse lots</a></p></div>`);
      return;
    }
    let quote;
    try {
      quote = await api('/api/cart/quote', { method: 'POST', body: { lines: state.cart } });
    } catch (err) {
      setMain(`<h1>Your cart</h1><p class="notice bad">${esc(err.message)}</p><p><button class="btn secondary" id="clear-cart">Clear cart</button></p>`);
      document.getElementById('clear-cart').addEventListener('click', () => { state.cart = []; saveCart(); viewCart(); });
      return;
    }
    const issues = Object.fromEntries((quote.stockIssues || []).map((s) => [s.lotCode, s]));
    setMain(`
      <h1>Your cart</h1>
      ${quote.stockIssues && quote.stockIssues.length ? `<p class="notice">Some lots changed: ${quote.stockIssues.map((s) => esc(s.lotCode) + ' ' + esc(s.message)).join(' · ')}</p>` : ''}
      <div class="table-wrap"><table>
        <thead><tr><th>Lot</th><th>Tier</th><th class="num">Quantity</th><th class="num">Price per kg</th><th class="num">Line total</th><th><span class="muted">Remove</span></th></tr></thead>
        <tbody>
          ${quote.lines.map((l) => `
            <tr>
              <td><a href="${lotHref(l.lotCode)}">${esc(l.lotCode)}</a>${issues[l.lotCode] ? `<br><span class="pill warn">${esc(issues[l.lotCode].message)}</span>` : ''}</td>
              <td><span class="${tierClass(l.tier)}">${esc(l.tierLabel)}</span></td>
              <td class="num">${kg(l.kg)}</td>
              <td class="num">${rp(l.pricePerKg)}</td>
              <td class="num">${rp(l.lineTotal)}${l.shippingTotal ? `<br><span class="muted" style="font-size:13px">+ ${rp(l.shippingTotal)} shipping</span>` : ''}</td>
              <td><button class="btn danger small" data-remove="${esc(l.lotCode)}">Remove</button></td>
            </tr>`).join('')}
        </tbody>
      </table></div>
      <div class="card" style="margin-top:16px;max-width:420px;margin-left:auto">
        <table class="summary-lines"><tbody>
          <tr><td>Subtotal</td><td class="num">${rp(quote.totals.subtotal)}</td></tr>
          <tr><td>Shipping</td><td class="num">${quote.totals.shipping ? rp(quote.totals.shipping) : 'Included or collected'}</td></tr>
          <tr class="total-row"><td>Total</td><td class="num">${rp(quote.totals.total)}</td></tr>
        </tbody></table>
        <p class="muted" style="font-size:14px">Prices are checked on the server. Payment is by bank transfer against an invoice.</p>
        <div class="btn-row"><a class="btn" href="#/checkout" ${quote.stockIssues && quote.stockIssues.length ? 'aria-disabled="true" onclick="return false"' : ''}>Go to checkout</a><a class="btn secondary" href="#/catalogue">Keep shopping</a></div>
      </div>`);
    main.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => {
      state.cart = state.cart.filter((l) => l.lotCode !== b.dataset.remove);
      saveCart();
      viewCart();
    }));
  }

  function viewCheckout() {
    if (state.cart.length === 0) { location.hash = '#/cart'; return; }
    const types = [['specialty_cafe', 'Specialty cafe'], ['premium_roaster', 'Premium roaster'], ['roaster', 'Roaster'], ['papua_business', 'Cafe or business in Papua'], ['other', 'Other']];
    setMain(`
      <h1>Checkout</h1>
      <p class="muted">Payment is by bank transfer against an invoice. We confirm the transfer by hand.</p>
      <form id="checkout" class="card" novalidate>
        <div class="notice" data-form-error hidden role="alert"></div>
        <h2 style="margin-top:0">Buyer</h2>
        <div class="form-grid">
          <div class="field"><label for="c-type">Buyer type</label>
            <select id="c-type" name="buyerType" required>${types.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select></div>
          <div class="field"><label for="c-company">Company or cafe name</label>
            <input id="c-company" name="company" autocomplete="organization"></div>
          <div class="field"><label for="c-name">Contact name <span class="muted">(required)</span></label>
            <input id="c-name" name="name" required autocomplete="name"></div>
          <div class="field"><label for="c-phone">Phone <span class="muted">(required)</span></label>
            <input id="c-phone" name="phone" type="tel" required autocomplete="tel"><p class="help">Include the country code if outside Indonesia.</p></div>
          <div class="field wide"><label for="c-email">Email <span class="muted">(required)</span></label>
            <input id="c-email" name="email" type="email" required autocomplete="email"><p class="help">We use this to send your order updates and to let you track your order.</p></div>
        </div>
        <h2>Delivery</h2>
        <div class="form-grid">
          <div class="field"><label for="c-city">Delivery city <span class="muted">(required)</span></label>
            <input id="c-city" name="city" required autocomplete="address-level2"></div>
          <div class="field wide"><label for="c-notes">Notes for the team</label>
            <textarea id="c-notes" name="notes" maxlength="500"></textarea></div>
        </div>
        <h2>Payment</h2>
        <p>Bank transfer against an invoice. The bank details are shown on the next page.</p>
        <div class="btn-row"><button class="btn" type="submit" id="place">Place order</button><a class="btn secondary" href="#/cart">Back to cart</a></div>
      </form>`);
    const form = document.getElementById('checkout');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
      form.querySelector('[data-form-error]').hidden = true;
      const f = formData(form);
      const btn = document.getElementById('place');
      busy(btn, true, 'Placing order…');
      try {
        const { order } = await api('/api/orders', {
          method: 'POST',
          body: {
            lines: state.cart,
            customer: { name: f.name, company: f.company, buyerType: f.buyerType, phone: f.phone, email: f.email, city: f.city, notes: f.notes },
          },
        });
        setSession('al-last-order', { number: order.number, email: f.email });
        setSession('al-email', f.email);
        state.cart = [];
        saveCart();
        location.hash = '#/order/' + encodeURIComponent(order.number);
      } catch (err) {
        busy(btn, false);
        if (err.code === 'stock_changed') {
          const issues = (err.extra && err.extra.error && err.extra.error.fields && err.extra.error.fields.stockIssues) || [];
          state.cart = state.cart.filter((l) => !issues.some((s) => s.lotCode === l.lotCode));
          saveCart();
          toast('Some lots changed. Please review your order.');
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
      <h1>Order received</h1>
      <div class="notice ok">Order <strong>${esc(number)}</strong> is placed. The stock is reserved for you while we confirm payment.</div>
      <div class="card">
        <h2 style="margin-top:0">Pay by bank transfer</h2>
        <dl class="kv">
          <dt>Bank</dt><dd>${esc(state.config.payment.bank.bankName)}</dd>
          <dt>Account name</dt><dd>${esc(state.config.payment.bank.accountName)}</dd>
          <dt>Account number</dt><dd>${esc(state.config.payment.bank.accountNumber)}</dd>
          <dt>Reference</dt><dd>${esc(number)}</dd>
        </dl>
        <p class="muted" style="font-size:14px;margin-top:12px">Bank details are placeholders until the team confirms them. Use the order number as your transfer reference.</p>
      </div>
      <div class="btn-row" style="margin-top:16px">
        ${last && last.email ? `<a class="btn" href="#/track/${encodeURIComponent(number)}">Track this order</a>` : '<a class="btn" href="#/track">Track this order</a>'}
        <a class="btn secondary" href="#/catalogue">Keep shopping</a>
      </div>`);
  }

  function viewTrack() {
    const email = session('al-email') || '';
    setMain(`
      <h1>Track your order</h1>
      <form id="track" class="card" style="max-width:520px" novalidate>
        <div class="notice" data-form-error hidden role="alert"></div>
        <div class="field"><label for="t-number">Order number</label><input id="t-number" name="number" required placeholder="ALO-2611-001"></div>
        <div class="field"><label for="t-email">Email used for the order</label><input id="t-email" name="email" type="email" required value="${esc(email)}"></div>
        <button class="btn" type="submit">Show order</button>
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
      setMain(`<h1>Order not found</h1><p class="notice bad">${esc(err.message)}</p><p><a href="#/track">Try again</a></p>`);
      return;
    }
    const o = data.order;
    const steps = ['requested', 'confirmed', 'paid', 'shipped', 'delivered'];
    const cancelled = o.status === 'cancelled';
    const done = (s) => cancelled ? false : steps.indexOf(s) <= steps.indexOf(o.status);
    setSession('al-email', email);
    setMain(`
      <nav aria-label="Breadcrumb" class="muted" style="font-size:14px"><a href="#/track">Track order</a> / ${esc(o.number)}</nav>
      <h1 style="margin-top:12px">Order ${esc(o.number)}</h1>
      <p><span class="pill ${cancelled ? 'bad' : 'ok'}">${esc(o.statusLabel)}</span> <span class="muted">Placed ${date(o.createdAt)}</span></p>
      <div class="grid" style="grid-template-columns:1fr">
        <section class="card" aria-labelledby="timeline">
          <h2 id="timeline" style="margin-top:0">Status</h2>
          <ol class="timeline">
            ${steps.map((s) => {
              const isCurrent = s === o.status;
              const cls = [done(s) ? 'done' : '', isCurrent ? 'current' : ''].join(' ').trim();
              const entry = o.timeline.find((t) => t.status === s);
              return `<li class="${cls}">${esc(s.charAt(0).toUpperCase() + s.slice(1))}${entry ? ` · <span class="muted">${date(entry.at)}</span>` : ''}</li>`;
            }).join('')}
            ${cancelled ? `<li class="cancelled current">Cancelled ${date(o.updatedAt)}</li>` : ''}
          </ol>
          ${o.payment.reference ? `<p class="muted" style="margin-top:12px">Payment reference: ${esc(o.payment.reference)}</p>` : '<p class="muted" style="margin-top:12px">Payment not yet received.</p>'}
        </section>
        <section class="card" aria-labelledby="items">
          <h2 id="items" style="margin-top:0">Items</h2>
          <div class="table-wrap"><table>
            <thead><tr><th>Lot</th><th>Tier</th><th class="num">Kg</th><th class="num">Total</th></tr></thead>
            <tbody>${o.lines.map((l) => `<tr><td>${esc(l.lotCode)}</td><td>${esc(l.tierLabel)}</td><td class="num">${kg(l.kg)}</td><td class="num">${rp(l.lineTotal + l.shippingTotal)}</td></tr>`).join('')}</tbody>
          </table></div>
          <table class="summary-lines" style="margin-top:12px"><tbody>
            <tr><td>Subtotal</td><td class="num">${rp(o.subtotal)}</td></tr>
            <tr><td>Shipping</td><td class="num">${o.shipping ? rp(o.shipping) : 'Included or collected'}</td></tr>
            <tr class="total-row"><td>Total</td><td class="num">${rp(o.total)}</td></tr>
          </tbody></table>
        </section>
      </div>
      ${o.feedbackOpen ? `<div class="btn-row" style="margin-top:16px"><a class="btn" href="#/feedback/${encodeURIComponent(o.number)}">Share feedback on your order</a></div>` : ''}`);
  }

  function viewFeedback(number) {
    const email = session('al-email') || '';
    setMain(`
      <h1>Feedback on your order</h1>
      <p class="muted">Your notes help our farmer groups improve. We never share your name or what you paid.</p>
      <form id="fb" class="card" novalidate>
        <div class="notice" data-form-error hidden role="alert"></div>
        <div class="field"><label for="fb-email">Email used for the order</label><input id="fb-email" name="email" type="email" required value="${esc(email)}"></div>
        <div class="field"><label for="fb-number">Order number</label><input id="fb-number" name="number" required value="${esc(number)}"></div>
        <div class="field"><label for="fb-items">Lot code(s) you rated</label><input id="fb-items" name="lotCode" required placeholder="AL-2611-001"><p class="help">Enter one lot code. You can send feedback for one lot at a time.</p></div>
        <div class="field"><label for="fb-taste">How did it taste?</label><textarea id="fb-taste" name="taste" maxlength="300" placeholder="For example: sweet, clean, a little flat after two weeks"></textarea></div>
        <div class="field"><label for="fb-issues">Any quality problems?</label>
          <select id="fb-issues" name="issues">
            <option value="none">None</option><option value="unripe">Unripe beans</option><option value="mould">Mould or smell</option>
            <option value="uneven_drying">Uneven drying</option><option value="defects">Defects or broken beans</option><option value="other">Other</option>
          </select></div>
        <div class="field"><label for="fb-reorder">Would you reorder?</label>
          <select id="fb-reorder" name="reorder" required><option value="yes">Yes</option><option value="maybe">Maybe</option><option value="no">No</option></select></div>
        <div class="field"><label for="fb-notes">Anything else</label><textarea id="fb-notes" name="notes" maxlength="500"></textarea></div>
        <button class="btn" type="submit" id="fb-send">Send feedback</button>
      </form>`);
    const form = document.getElementById('fb');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = formData(form);
      const btn = document.getElementById('fb-send');
      busy(btn, true, 'Sending…');
      try {
        await api(`/api/orders/${encodeURIComponent(f.number.trim())}/feedback`, {
          method: 'POST',
          body: { email: f.email, notes: f.notes, items: [{ lotCode: f.lotCode.trim(), taste: f.taste, issues: f.issues, reorder: f.reorder }] },
        });
        setMain(`<h1>Thank you</h1><p class="notice ok">Your feedback is received.</p><p><a href="#/catalogue">Back to catalogue</a></p>`);
      } catch (err) {
        busy(btn, false);
        showFormError(form, err);
      }
    });
  }

  function viewAbout() {
    setMain(`
      <h1>About AnugerahLink</h1>
      <p class="lead">AnugerahLink buys coffee from farmer groups in the Papua highlands, grades every lot, and sells it with a passport that shows where it came from.</p>
      <div class="grid" style="grid-template-columns:1fr;margin-top:16px">
        <section class="card"><h2 style="margin-top:0">How farmers are paid</h2><p>We buy in cash at the farm gate, at a published price. Farmers do not wait for payment.</p></section>
        <section class="card"><h2 style="margin-top:0">What we check</h2><p>Each lot is weighed, sorted, cupped and graded before it is listed. The grade, cup score and tier are shown on the lot page and the passport.</p></section>
        <section class="card"><h2 style="margin-top:0">What the passport means</h2><p>A passport holds the lot's recorded fields and a hash of them. If a field changes after publishing, the hash no longer matches and the passport says so. It shows change; it is not a guarantee against every possible change.</p></section>
        <section class="card"><h2 style="margin-top:0">Pricing</h2><p>Prices are per kg, delivered, by tier. Reserve and Premium include shipping. Verified standard adds shipping per kg. Local is collected in Papua.</p></section>
      </div>`);
  }

  // ---------- admin ----------
  function adminShell(active, body) {
    const links = [['dashboard', 'Dashboard'], ['intake', 'Intake'], ['lots', 'Lots'], ['orders', 'Orders'], ['feedback', 'Feedback'], ['settings', 'Settings']];
    return `
      <div class="btn-row" style="justify-content:space-between;margin-bottom:12px">
        <h1 style="margin:0">Back office</h1>
        <button class="btn secondary small" id="admin-out">Sign out</button>
      </div>
      <nav class="btn-row" aria-label="Back office" style="margin-bottom:16px">
        ${links.map(([k, l]) => `<a class="btn ${active === k ? '' : 'secondary'} small" href="#/admin/${k}" ${active === k ? 'aria-current="page"' : ''}>${l}</a>`).join('')}
      </nav>
      ${body}`;
  }
  function wireSignOut() {
    const b = document.getElementById('admin-out');
    if (b) b.addEventListener('click', () => { clearAdminToken(); location.hash = '#/admin'; });
  }
  function adminFail(err) {
    if (err.status === 401) {
      setMain(`<h1>Team sign-in</h1><p class="notice bad">Your session ended. Sign in again.</p>`);
      location.hash = '#/admin';
      return;
    }
    setMain(`<p class="notice bad">${esc(err.message)}</p>`);
  }

  function viewAdminLogin() {
    setMain(`
      <h1>Team sign-in</h1>
      <form id="login" class="card" style="max-width:420px" novalidate>
        <div class="notice" data-form-error hidden role="alert"></div>
        <div class="field"><label for="tok">Admin access code</label><input id="tok" name="token" type="password" required autocomplete="current-password"></div>
        <button class="btn" type="submit">Sign in</button>
      </form>`);
    document.getElementById('login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const f = formData(form);
      setAdminToken(f.token);
      try {
        await api('/api/admin/summary', { admin: true });
        location.hash = '#/admin/dashboard';
      } catch (err) {
        clearAdminToken();
        showFormError(form, { message: err.status === 401 ? 'That access code is not correct.' : err.message });
      }
    });
  }

  async function viewAdminDashboard() {
    const s = await api('/api/admin/summary', { admin: true });
    const e = s.economics;
    const o = s.ordersByStatus;
    setMain(adminShell('dashboard', `
      <div class="stats">
        <div class="card stat"><div class="label">Kg in stock (listed)</div><div class="value">${kg(s.totalStockKg)}</div></div>
        <div class="card stat"><div class="label">Open orders</div><div class="value">${o.requested + o.confirmed + o.paid}</div><div class="label">${o.requested} requested · ${o.confirmed} confirmed · ${o.paid} paid</div></div>
        <div class="card stat"><div class="label">Open order value</div><div class="value">${rp(s.openRevenue)}</div></div>
        <div class="card stat"><div class="label">Feedback to tag</div><div class="value">${s.feedbackToReview}</div></div>
      </div>
      <h2>Stock by tier</h2>
      <div class="table-wrap"><table><thead><tr><th>Tier</th><th class="num">Kg in stock</th></tr></thead>
        <tbody>${Object.entries(s.stockKgByTier).map(([t, k]) => `<tr><td><span class="${tierClass(t)}">${esc(tierLabel(t))}</span></td><td class="num">${kg(k)}</td></tr>`).join('')}</tbody></table></div>
      <h2>Economics per kg bought</h2>
      <p class="muted" style="font-size:14px">Grade mix: ${s.mixSource}. Figures follow the v2 plan formula. Sorting loss applies to sales, shipping and fees.</p>
      <div class="table-wrap"><table>
        <tbody>
          <tr><td>Sales</td><td class="num">${rp(e.salesPerKgBought)}</td></tr>
          <tr><td>Paid to farmers</td><td class="num">${rp(e.buyPerKgBought)}</td></tr>
          <tr><td>Shipping paid by AnugerahLink</td><td class="num">${rp(e.shippingPerKgBought)}</td></tr>
          <tr><td>Fees: samples, claims, payment</td><td class="num">${rp(e.feesPerKgBought)}</td></tr>
          <tr><th>Gross margin</th><th class="num">${rp(e.grossMarginPerKgBought)} (${e.grossMarginPctOfSales}%)</th></tr>
        </tbody></table></div>
      <p style="margin-top:12px">Break-even with the full team: <strong>${e.breakEvenKgPerYear ? e.breakEvenKgPerYear.toLocaleString('id-ID') + ' kg a year (' + e.breakEvenKgPerMonth.toLocaleString('id-ID') + ' kg a month)' : 'not reachable at these prices'}</strong>.</p>
      <p class="muted" style="font-size:14px">Income from completed orders: ${rp(s.deliveredRevenue)}.</p>
    `));
    wireSignOut();
  }

  async function viewAdminIntake() {
    const { groups } = await api('/api/admin/groups', { admin: true });
    const { regions } = { regions: state.regions || await api('/api/regions') };
    setMain(adminShell('intake', `
      <h2 style="margin-top:0">Record a purchase from a farmer group</h2>
      <form id="intake" class="card" novalidate>
        <div class="notice" data-form-error hidden role="alert"></div>
        <div class="form-grid">
          <div class="field"><label for="i-group">Farmer group</label>
            <select id="i-group" name="groupId" required>
              <option value="">Choose a group</option>
              ${groups.map((g) => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')}
            </select>
            <p class="help">Need a new group? <a href="#/admin/groups-new">Add one below</a>.</p></div>
          <div class="field"><label for="i-date">Harvest date</label><input id="i-date" name="harvestDate" type="date" required></div>
          <div class="field"><label for="i-kg">Kg received</label><input id="i-kg" name="kgIn" type="number" min="1" step="1" required></div>
          <div class="field"><label for="i-price">Buying price per kg (Rp)</label><input id="i-price" name="buyPricePerKg" type="number" min="1000" step="1000" value="${esc(state.config.buyPricePerKg || 120000)}"><p class="help">Cash paid at collection.</p></div>
          <div class="field"><label for="i-process">Process</label><input id="i-process" name="process" placeholder="Washed, natural, honey"></div>
          <div class="field wide"><label for="i-notes">Notes</label><textarea id="i-notes" name="notes"></textarea></div>
        </div>
        <div class="btn-row"><button class="btn" type="submit" id="i-save">Save intake</button></div>
      </form>
      <h2>Add a farmer group</h2>
      <form id="group" class="card" novalidate>
        <div class="notice" data-form-error hidden role="alert"></div>
        <div class="form-grid">
          <div class="field"><label for="g-name">Group name</label><input id="g-name" name="name" required minlength="3" maxlength="80"><p class="help">Use the name the group agrees to be shown publicly.</p></div>
          <div class="field"><label for="g-region">Region</label><select id="g-region" name="regionId" required>${regions.map((r) => `<option value="${esc(r.id)}">${esc(r.name)} (${esc(r.regency)})</option>`).join('')}</select></div>
          <div class="field wide"><label for="g-contact">Contact (internal only)</label><input id="g-contact" name="contact" maxlength="200"></div>
        </div>
        <button class="btn secondary" type="submit" id="g-save">Add group</button>
      </form>`));
    wireSignOut();
    document.getElementById('intake').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
      form.querySelector('[data-form-error]').hidden = true;
      const btn = document.getElementById('i-save');
      busy(btn, true, 'Saving…');
      try {
        const { lot } = await api('/api/admin/lots', { method: 'POST', admin: true, body: formData(form) });
        toast(`Saved ${lot.code}. Grade it next.`);
        location.hash = '#/admin/lots/' + encodeURIComponent(lot.id);
      } catch (err) { busy(btn, false); showFormError(form, err); if (err.status === 401) adminFail(err); }
    });
    document.getElementById('group').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
      form.querySelector('[data-form-error]').hidden = true;
      try {
        await api('/api/admin/groups', { method: 'POST', admin: true, body: formData(form) });
        toast('Group added');
        viewAdminIntake();
      } catch (err) { showFormError(form, err); }
    });
  }

  async function viewAdminLots() {
    const { lots } = await api('/api/admin/lots', { admin: true });
    setMain(adminShell('lots', `
      <h2 style="margin-top:0">Lots</h2>
      <p class="muted" style="font-size:14px">Received lots need grading. Graded lots can be published. Listed lots are locked until withdrawn.</p>
      <div class="table-wrap"><table>
        <thead><tr><th>Code</th><th>Group</th><th>Status</th><th>Tier</th><th class="num">Cup</th><th class="num">Sellable</th><th class="num">Available</th><th></th></tr></thead>
        <tbody>
          ${lots.map((l) => `
            <tr>
              <td>${esc(l.code)}${l.sample ? ' <span class="demo">sample</span>' : ''}</td>
              <td>${esc(l.groupName)}</td>
              <td><span class="pill">${esc(l.status)}</span></td>
              <td>${l.tier ? `<span class="${tierClass(l.tier)}">${esc(tierLabel(l.tier))}</span>` : '—'}</td>
              <td class="num">${l.cupScore || '—'}</td>
              <td class="num">${l.sellableKg ? kg(l.sellableKg) : '—'}</td>
              <td class="num">${kg(l.availableKg)}</td>
              <td><div class="btn-row">
                ${['received', 'graded'].includes(l.status) ? `<a class="btn secondary small" href="#/admin/lots/${encodeURIComponent(l.id)}">Grade</a>` : ''}
                ${l.status === 'graded' ? `<button class="btn small" data-publish="${esc(l.id)}">Publish</button>` : ''}
                ${l.status === 'listed' ? `<button class="btn danger small" data-withdraw="${esc(l.id)}">Withdraw</button>` : ''}
              </div></td>
            </tr>`).join('') || '<tr><td colspan="8">No lots yet. Record a purchase in Intake.</td></tr>'}
        </tbody></table></div>`));
    wireSignOut();
    main.querySelectorAll('[data-publish]').forEach((b) => b.addEventListener('click', async () => {
      try { await api(`/api/admin/lots/${encodeURIComponent(b.dataset.publish)}/publish`, { method: 'POST', admin: true }); toast('Published. Passport created.'); viewAdminLots(); }
      catch (err) { toast(err.message); }
    }));
    main.querySelectorAll('[data-withdraw]').forEach((b) => b.addEventListener('click', async () => {
      if (!window.confirm('Withdraw this lot from sale?')) return;
      try { await api(`/api/admin/lots/${encodeURIComponent(b.dataset.withdraw)}/withdraw`, { method: 'POST', admin: true }); toast('Lot withdrawn'); viewAdminLots(); }
      catch (err) { toast(err.message); }
    }));
  }

  async function viewAdminGrade(id) {
    const { lots } = await api('/api/admin/lots', { admin: true });
    const lot = lots.find((l) => l.id === id);
    if (!lot) { setMain(adminShell('lots', '<p class="notice bad">Lot not found.</p>')); wireSignOut(); return; }
    setMain(adminShell('lots', `
      <h2 style="margin-top:0">Grade ${esc(lot.code)} <span class="muted" style="font-size:16px">${esc(lot.groupName)} · ${kg(lot.kgIn)} received</span></h2>
      <form id="grade" class="card" novalidate>
        <div class="notice" data-form-error hidden role="alert"></div>
        <div class="form-grid">
          <div class="field"><label for="g-tier">Tier</label>
            <select id="g-tier" name="tier" required><option value="">Choose a tier</option>
              ${Object.entries(state.config.tiers).map(([c, t]) => `<option value="${c}" ${lot.tier === c ? 'selected' : ''}>${esc(t.label)} · ${rp(t.pricePerKg)}/kg</option>`).join('')}
            </select><p class="help" id="g-price">${lot.tier ? rp(state.config.tiers[lot.tier].pricePerKg) + ' per kg' : ''}</p></div>
          <div class="field"><label for="g-grade">Grade</label><input id="g-grade" name="grade" value="${esc(lot.grade || '')}" placeholder="SNI Grade 1"></div>
          <div class="field"><label for="g-cup">Cup score (60 to 100)</label><input id="g-cup" name="cupScore" type="number" min="60" max="100" step="1" value="${esc(lot.cupScore || '')}"></div>
          <div class="field"><label for="g-moist">Moisture %</label><input id="g-moist" name="moisturePct" type="number" min="5" max="20" step="0.1" value="${esc(lot.moisturePct || '')}"><p class="help">Target 10% to 12%.</p></div>
          <div class="field"><label for="g-sell">Sellable kg after sorting</label><input id="g-sell" name="sellableKg" type="number" min="1" step="1" value="${esc(lot.sellableKg || '')}"><p class="help">Usually about 95% of kg received. Weigh the output.</p></div>
          <div class="field"><label for="g-process">Process</label><input id="g-process" name="process" value="${esc(lot.process || '')}"></div>
          <div class="field wide"><label for="g-notes">Notes</label><textarea id="g-notes" name="notes">${esc(lot.notes || '')}</textarea></div>
        </div>
        <div class="btn-row"><button class="btn" type="submit" id="g-save">Save grading</button><a class="btn secondary" href="#/admin/lots">Back to lots</a></div>
      </form>`));
    wireSignOut();
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
      busy(btn, true, 'Saving…');
      try {
        await api(`/api/admin/lots/${encodeURIComponent(id)}`, { method: 'PATCH', admin: true, body: formData(form) });
        toast('Grading saved');
        location.hash = '#/admin/lots';
      } catch (err) { busy(btn, false); showFormError(form, err); }
    });
  }

  async function viewAdminOrders() {
    const { orders } = await api('/api/admin/orders', { admin: true });
    const statuses = ['requested', 'confirmed', 'paid', 'shipped', 'delivered', 'cancelled'];
    setMain(adminShell('orders', `
      <h2 style="margin-top:0">Orders</h2>
      <p class="muted" style="font-size:14px">Mark an order as paid only after the bank transfer is in the account. Enter the transfer reference.</p>
      <div class="table-wrap"><table>
        <thead><tr><th>Order</th><th>Buyer</th><th>Status</th><th class="num">Total</th><th>Update</th></tr></thead>
        <tbody>
          ${orders.map((o) => `
            <tr>
              <td>${esc(o.number)}<br><span class="muted" style="font-size:13px">${date(o.createdAt)}</span></td>
              <td>${esc(o.customer.name)}${o.customer.company ? '<br><span class="muted">' + esc(o.customer.company) + '</span>' : ''}<br><span class="muted" style="font-size:13px">${esc(o.customer.email)} · ${esc(o.customer.phone)} · ${esc(o.customer.city)}</span><br><span class="muted" style="font-size:13px">${o.lines.map((l) => esc(l.lotCode) + ' ' + kg(l.kg)).join(', ')}</span></td>
              <td><span class="pill">${esc(o.status)}</span>${o.payment.reference ? `<br><span class="muted" style="font-size:13px">Ref: ${esc(o.payment.reference)}</span>` : ''}</td>
              <td class="num">${rp(o.total)}</td>
              <td>
                <form data-order="${esc(o.id)}" class="btn-row" style="flex-wrap:nowrap">
                  <select name="status" aria-label="New status for ${esc(o.number)}" style="min-width:120px">
                    ${statuses.map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
                  </select>
                  <input name="paymentReference" aria-label="Payment reference" placeholder="Transfer ref" value="${esc(o.payment.reference || '')}" style="min-width:120px">
                  <button class="btn small" type="submit">Save</button>
                </form>
                <p class="error" data-row-error hidden></p>
              </td>
            </tr>`).join('') || '<tr><td colspan="5">No orders yet.</td></tr>'}
        </tbody></table></div>`));
    wireSignOut();
    main.querySelectorAll('form[data-order]').forEach((form) => form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = formData(form);
      const err = form.parentElement.querySelector('[data-row-error]');
      err.hidden = true;
      try {
        await api(`/api/admin/orders/${encodeURIComponent(form.dataset.order)}`, { method: 'PATCH', admin: true, body: f });
        toast('Order updated');
        viewAdminOrders();
      } catch (ex) {
        err.hidden = false;
        err.textContent = 'Error: ' + (ex.fields && Object.values(ex.fields)[0] ? Object.values(ex.fields)[0] : ex.message);
      }
    }));
  }

  async function viewAdminFeedback() {
    const [{ feedback }, { groups }] = await Promise.all([api('/api/admin/feedback', { admin: true }), api('/api/admin/groups', { admin: true })]);
    const tags = ['pass-to-farmer', 'internal-quality', 'internal-logistics', 'discard'];
    setMain(adminShell('feedback', `
      <h2 style="margin-top:0">Feedback</h2>
      <p class="muted" style="font-size:14px">Tag each item. Only <em>pass-to-farmer</em> items reach the farmer report. Buyer names and prices never do.</p>
      <div class="table-wrap"><table>
        <thead><tr><th>Order · Lot</th><th>Taste</th><th>Issues</th><th>Reorder</th><th>Tag</th></tr></thead>
        <tbody>
          ${feedback.map((f) => `
            <tr>
              <td>${esc(f.orderNumber)}<br>${esc(f.lotCode)}</td>
              <td>${esc(f.taste || '—')}${f.notes ? '<br><span class="muted" style="font-size:13px">' + esc(f.notes) + '</span>' : ''}</td>
              <td>${esc(f.issues)}</td>
              <td>${esc(f.reorder)}</td>
              <td><select data-tag="${esc(f.id)}" aria-label="Tag for ${esc(f.lotCode)}"><option value="">Untagged</option>${tags.map((t) => `<option ${f.tag === t ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
            </tr>`).join('') || '<tr><td colspan="5">No feedback yet.</td></tr>'}
        </tbody></table></div>
      <h2>Farmer report</h2>
      <form id="report" class="btn-row">
        <label for="rep-group" class="sr">Farmer group</label>
        <select id="rep-group">${groups.map((g) => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')}</select>
        <button class="btn secondary small" type="submit">Show report</button>
      </form>
      <div id="report-out" style="margin-top:12px"></div>`));
    wireSignOut();
    main.querySelectorAll('select[data-tag]').forEach((sel) => sel.addEventListener('change', async () => {
      try { await api(`/api/admin/feedback/${encodeURIComponent(sel.dataset.tag)}`, { method: 'PATCH', admin: true, body: { tag: sel.value } }); toast('Tag saved'); }
      catch (err) { toast(err.message); }
    }));
    document.getElementById('report').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('rep-group').value;
      const rep = await api(`/api/admin/farmer-report/${encodeURIComponent(id)}`, { admin: true });
      document.getElementById('report-out').innerHTML = `
        <div class="card">
          <h3 style="margin-top:0">${esc(rep.group)}</h3>
          <h4>Your lots</h4>
          <div class="table-wrap"><table><thead><tr><th>Lot</th><th>Grade</th><th class="num">Cup</th><th>Tier</th><th class="num">Sold kg</th></tr></thead>
          <tbody>${rep.lots.map((l) => `<tr><td>${esc(l.code)}</td><td>${esc(l.grade)}</td><td class="num">${esc(l.cupScore)}</td><td>${esc(tierLabel(l.tier))}</td><td class="num">${kg(l.soldKg)}</td></tr>`).join('') || '<tr><td colspan="5">No graded lots yet.</td></tr>'}</tbody></table></div>
          <h4>What buyers said (approved for sharing)</h4>
          <ul>${rep.comments.map((c) => `<li><strong>${esc(c.lotCode)}:</strong> ${esc(c.taste || 'No taste notes')}${c.issues && c.issues !== 'none' ? ' · Issue: ' + esc(c.issues) : ''}</li>`).join('') || '<li>No approved comments yet.</li>'}</ul>
        </div>`;
    });
  }

  async function viewAdminSettings() {
    const c = await api('/api/admin/config', { admin: true });
    setMain(adminShell('settings', `
      <h2 style="margin-top:0">Business rules in use</h2>
      <p class="muted" style="font-size:14px">These come from <code>config/business.js</code>, based on ${esc(c.source)}. The owner has not yet confirmed them.</p>
      <div class="table-wrap"><table><tbody>
        <tr><td>Buying price per kg</td><td class="num">${rp(c.buyPricePerKg)}</td></tr>
        <tr><td>Sorting and drying loss</td><td class="num">${Math.round(c.sortingLossPct * 100)}%</td></tr>
        <tr><td>Shipping per kg (where it applies)</td><td class="num">${rp(c.shippingPerKg)}</td></tr>
        <tr><td>Fees per kg</td><td class="num">${rp(c.feesPerKg)}</td></tr>
        <tr><td>Fixed costs per year (full team)</td><td class="num">${rp(c.fixedCostsPerYear)}</td></tr>
        <tr><td>Minimum order per lot</td><td class="num">${c.minOrderKg} kg</td></tr>
        <tr><td>Assumed grade mix (used until stock exists)</td><td class="num">${Object.entries(c.defaultMix).map(([k, v]) => esc(tierLabel(k)) + ' ' + Math.round(v * 100) + '%').join(' · ')}</td></tr>
      </tbody></table></div>
      <h2>Tiers</h2>
      <div class="table-wrap"><table><thead><tr><th>Tier</th><th class="num">Price per kg</th><th>Shipping</th></tr></thead><tbody>
        ${Object.entries(c.tiers).map(([k, t]) => `<tr><td><span class="${tierClass(k)}">${esc(t.label)}</span></td><td class="num">${rp(t.pricePerKg)}</td><td>${esc(t.shippingBy === 'anugerah' ? 'Included (AnugerahLink pays)' : t.shippingBy === 'buyer' ? 'Buyer pays ' + rp(t.shippingPerKgExtra) + '/kg' : 'Collected in Papua')}</td></tr>`).join('')}
      </tbody></table></div>`));
    wireSignOut();
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
    updateCartCount();
    try {
      if (parts.length === 0) return await viewHome();
      const [head, a, b] = parts;
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
      if (head === 'admin') {
        if (!adminToken()) return viewAdminLogin();
        const sec = a || 'dashboard';
        if (sec === 'dashboard') return await viewAdminDashboard();
        if (sec === 'intake') return await viewAdminIntake();
        if (sec === 'lots' && b) return await viewAdminGrade(b);
        if (sec === 'lots') return await viewAdminLots();
        if (sec === 'orders') return await viewAdminOrders();
        if (sec === 'feedback') return await viewAdminFeedback();
        if (sec === 'settings') return await viewAdminSettings();
        return await viewAdminDashboard();
      }
      setMain(`<h1>Page not found</h1><p><a href="#/">Go to the home page</a></p>`);
    } catch (err) {
      if (err && err.status === 401) return adminFail(err);
      setMain(`<h1>Something went wrong</h1><p class="notice bad">${esc(err && err.message ? err.message : 'Please try again.')}</p><p><a href="#/">Home</a></p>`);
    }
  }

  async function boot() {
    try {
      state.config = await api('/api/config');
    } catch (err) {
      setMain(`<h1>AnugerahLink</h1><p class="notice bad">${esc(err.message)}</p>`);
      return;
    }
    try {
      state.regions = await api('/api/regions');
    } catch { state.regions = []; }
    window.addEventListener('hashchange', route);
    route();
  }

  boot();
})();
