'use strict';

// AnugerahLink web server. Node standard library only.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { SqlStore } = require('./lib/sqlstore');
const { mergeTheme, validateOverrides } = require('./lib/theme');
const { LoginLimiter } = require('./lib/ratelimit');
const { productionProblems } = require('./lib/prodcheck');
const content = require('./lib/content');
const buyers = require('./lib/buyers');
const notify = require('./lib/notify');
const invoice = require('./lib/invoice');
const legal = require('./config/legal');
const { seed, regionDefaults } = require('./lib/seed');
const domain = require('./lib/domain');
const payments = require('./lib/payments');
const config = require('./config/business');
const { ApiError } = require('./lib/validate');
const auth = require('./lib/auth');
const { DEMO_USERS } = require('./lib/demo');

const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY = 3 * 1024 * 1024; // cukup untuk foto sampel yang sudah dikompres
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://api.sandbox.midtrans.com https://api.midtrans.com",
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

function baseHeaders(extra = {}) {
  return {
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'X-Frame-Options': 'DENY',
    ...extra,
  };
}

function send(res, status, body, headers = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, baseHeaders({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...headers,
  }));
  res.end(payload);
}

function sendError(res, err) {
  if (err instanceof ApiError) {
    send(res, err.status, { error: { code: err.code, message: err.message, fields: err.fields || undefined } }, { 'Cache-Control': 'no-store' });
    return;
  }
  console.error('[server] unexpected error:', err);
  send(res, 500, { error: { code: 'server_error', message: 'Terjadi kesalahan. Silakan coba lagi.' } });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new ApiError(413, 'too_large', 'Data permintaan terlalu besar.'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return reject(new ApiError(400, 'invalid_json', 'Kirim data dalam format objek JSON.'));
        }
        resolve(parsed);
      } catch {
        reject(new ApiError(400, 'invalid_json', 'Format data tidak valid.'));
      }
    });
    req.on('error', reject);
  });
}

function bearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}

// Pengguna yang sudah masuk dan punya izin "perm". perm null: cukup sudah masuk.
function requirePerm(req, store, perm) {
  const user = auth.userFromToken(store.read(), bearer(req), new Date().toISOString());
  if (!user) throw new ApiError(401, 'unauthorised', 'Silakan masuk terlebih dahulu.');
  if (perm && !auth.can(user.role, perm)) throw new ApiError(403, 'forbidden', 'Peran Anda tidak punya akses ke halaman ini.');
  return user;
}

function publicConfig(demoOn, settings) {
  return {
    currency: config.currency,
    minOrderKg: config.minOrderKg,
    stepKg: config.stepKg,
    lowStockKg: config.lowStockKg,
    tiers: Object.fromEntries(Object.entries(config.tiers).map(([code, t]) => [code, {
      label: t.label, pricePerKg: t.pricePerKg, description: t.description, shippingBy: t.shippingBy,
      shippingPerKgExtra: t.shippingBy === 'buyer' ? config.shippingPerKg : 0,
    }])),
    payment: { method: config.payment.method, bank: config.payment },
    policy: config.policy,
    about: config.about,
    values: config.values,
    gradeBands: config.gradeBands,
    demoAccounts: demoOn ? DEMO_USERS.map((u) => ({ name: u.name, email: u.email, role: u.role, roleLabel: auth.ROLES[u.role].label, password: u.password })) : [],
    theme: mergeTheme(require('./config/theme'), settings && settings.theme),
    content: content.contentFor(settings),
    legal,
  };
}

const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const PHOTO_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png' };
const PHOTO_TYPE = { jpg: 'image/jpeg', png: 'image/png' };

function buildRoutes(ctx) {
  const { store, photoDir } = ctx;
  const limiter = ctx.limiter;
  const buyerLimiter = ctx.buyerLimiter;
  const buyerFrom = (req) => buyers.buyerFromToken(store.read(), bearer(req), new Date().toISOString());
  const needBuyer = (req) => {
    const b = buyerFrom(req);
    if (!b) throw new ApiError(401, 'unauthorized', 'Silakan masuk ke akun Anda.');
    return b;
  };
  const now = () => new Date().toISOString();
  const r = [];
  const route = (method, pattern, handler, { perm = null } = {}) => r.push({ method, pattern, handler, perm });

  // ---- Public ----
  route('GET', /^\/api\/health$/, () => ({ status: 200, body: { ok: true } }));
  route('GET', /^\/api\/config$/, () => ({ status: 200, body: publicConfig(ctx.demo, store.read().settings) }));
  route('GET', /^\/api\/regions$/, () => ({ status: 200, body: store.read().regions }));
  route('GET', /^\/api\/lots$/, (_p, _b, q) => ({ status: 200, body: { lots: domain.listPublicLots(store.read(), q) } }));
  route('GET', /^\/api\/lots\/([A-Za-z0-9-]+)$/, ([code]) => {
    const lot = store.read().lots.find((l) => l.code === code && l.status === 'listed');
    if (!lot) throw new ApiError(404, 'not_found', 'Lot ini tidak tersedia.');
    return { status: 200, body: { lot: domain.publicLot(store.read(), lot) } };
  });
  route('GET', /^\/api\/passport\/([A-Za-z0-9-]+)$/, ([code]) => {
    const lot = store.read().lots.find((l) => l.code === code && ['listed', 'withdrawn'].includes(l.status));
    if (!lot) throw new ApiError(404, 'not_found', 'Paspor lot tidak ditemukan.');
    return { status: 200, body: { passport: domain.passportView(store.read(), lot) } };
  });
  route('POST', /^\/api\/cart\/quote$/, (_p, body) => {
    const result = domain.quote(store.read(), body.lines);
    return { status: 200, body: result };
  });
  route('POST', /^\/api\/orders$/, (_p, body, _q, req) => {
    if (body.consent !== true) {
      throw new ApiError(400, 'invalid_input', 'Setujui kebijakan privasi sebelum membuat pesanan.', { consent: 'Setujui kebijakan privasi untuk memesan.' });
    }
    // Pesanan hanya dari akun pembeli. Memilih lot dan mengisi keranjang tetap tanpa akun.
    const buyer = buyerFrom(req);
    if (!buyer) throw new ApiError(401, 'auth_required', 'Buat akun atau masuk untuk memesan.');
    if (String((body.customer || {}).email || '').trim().toLowerCase() !== buyer.email) {
      throw new ApiError(400, 'invalid_input', 'Pakai email akun Anda untuk pesanan ini.', { email: 'Pakai email akun Anda.' });
    }
    const order = store.update((db) => {
      const created = domain.createOrder(db, body, now(), buyer.id);
      created.consent = { version: legal.version, givenAt: now() };
      return created;
    });
    return { status: 201, body: { order: domain.publicOrder(order) } };
  });

  // ---- Akun pembeli ----
  const accountLink = (seg, token) => `${process.env.PUBLIC_URL || ''}/#/akun/${seg}?token=${encodeURIComponent(token)}`;
  const sendVerificationEmail = (db, buyerId, at) => {
    const v = buyers.requestVerification(db, buyerId, at);
    if (!v.alreadyVerified) notify.enqueueAccountEmail(db, 'verify', v.email, accountLink('verifikasi', v.token), at);
    return v;
  };
  route('POST', /^\/api\/buyer\/signup$/, (_p, body) => {
    const r = store.update((db) => {
      const out = buyers.signupBuyer(db, body, now());
      sendVerificationEmail(db, out.buyer.id, now());
      return out;
    });
    return { status: 201, body: { token: r.token, buyer: buyers.publicBuyer(r.buyer) }, headers: { 'Cache-Control': 'no-store' } };
  });
  route('POST', /^\/api\/buyer\/login$/, (_p, body, _q, req) => {
    const email = String(body.email || '').trim().toLowerCase();
    const ip = (req && req.socket && req.socket.remoteAddress) || 'tidak-diketahui';
    const wait = Math.max(buyerLimiter.retryAfter('email', email), buyerLimiter.retryAfter('ip', ip));
    if (wait > 0) throw new ApiError(429, 'too_many_attempts', `Terlalu banyak percobaan masuk. Coba lagi dalam ${Math.ceil(wait / 60)} menit.`);
    let r;
    try {
      r = store.update((db) => buyers.loginBuyer(db, body.email, body.password, now()));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        buyerLimiter.recordFailure('email', email);
        buyerLimiter.recordFailure('ip', ip);
      }
      throw err;
    }
    buyerLimiter.recordSuccess('email', email);
    return { status: 200, body: { token: r.token, buyer: buyers.publicBuyer(r.buyer) }, headers: { 'Cache-Control': 'no-store' } };
  });
  route('POST', /^\/api\/buyer\/logout$/, (_p, _b, _q, req) => {
    store.update((db) => buyers.logoutBuyer(db, bearer(req)));
    return { status: 200, body: { ok: true } };
  });
  route('GET', /^\/api\/buyer\/me$/, (_p, _b, _q, req) => ({ status: 200, body: { buyer: buyers.publicBuyer(needBuyer(req)) }, headers: { 'Cache-Control': 'no-store' } }));
  route('PATCH', /^\/api\/buyer\/me$/, (_p, body, _q, req) => {
    const b = needBuyer(req);
    return { status: 200, body: { buyer: buyers.publicBuyer(store.update((db) => buyers.updateProfile(db, b.id, body))) } };
  });
  route('POST', /^\/api\/buyer\/password$/, (_p, body, _q, req) => {
    const b = needBuyer(req);
    store.update((db) => buyers.changePassword(db, b.id, body));
    return { status: 200, body: { ok: true } };
  });
  route('POST', /^\/api\/buyer\/verify\/send$/, (_p, _b, _q, req) => {
    const b = needBuyer(req);
    store.update((db) => sendVerificationEmail(db, b.id, now()));
    return { status: 200, body: { ok: true }, headers: { 'Cache-Control': 'no-store' } };
  });
  route('POST', /^\/api\/buyer\/verify\/confirm$/, (_p, body) => {
    store.update((db) => buyers.confirmEmail(db, body.token, now()));
    return { status: 200, body: { ok: true }, headers: { 'Cache-Control': 'no-store' } };
  });
  // Permintaan atur ulang dibatasi terpisah dari percobaan masuk: 5 permintaan per IP per jam.
  const resetLimiter = new LoginLimiter({ rules: { ip: { max: 5, windowMs: 60 * 60000, lockMs: 60 * 60000 } } });
  route('POST', /^\/api\/buyer\/password\/forgot$/, (_p, body, _q, req) => {
    const ip = (req && req.socket && req.socket.remoteAddress) || 'tidak-diketahui';
    const wait = resetLimiter.retryAfter('ip', ip);
    if (wait > 0) throw new ApiError(429, 'too_many_attempts', `Terlalu banyak permintaan. Coba lagi dalam ${Math.ceil(wait / 60)} menit.`);
    resetLimiter.recordFailure('ip', ip);
    store.update((db) => {
      const r = buyers.requestPasswordReset(db, body.email, now());
      if (r) notify.enqueueAccountEmail(db, 'reset', r.email, accountLink('reset', r.token), now());
      return true;
    });
    // Jawaban sama untuk email yang terdaftar maupun tidak.
    return { status: 200, body: { ok: true, message: 'Jika email terdaftar, tautan atur ulang sudah kami kirim.' }, headers: { 'Cache-Control': 'no-store' } };
  });
  route('POST', /^\/api\/buyer\/password\/reset$/, (_p, body) => {
    store.update((db) => buyers.resetPassword(db, body.token, body.password, now()));
    return { status: 200, body: { ok: true }, headers: { 'Cache-Control': 'no-store' } };
  });
  route('POST', /^\/api\/buyer\/addresses$/, (_p, body, _q, req) => {
    const b = needBuyer(req);
    return { status: 201, body: { address: store.update((db) => buyers.addAddress(db, b.id, body, now())) } };
  });
  route('PATCH', /^\/api\/buyer\/addresses\/([\w-]+)$/, ([addrId], body, _q, req) => {
    const b = needBuyer(req);
    return { status: 200, body: { address: store.update((db) => buyers.updateAddress(db, b.id, addrId, body)) } };
  });
  route('DELETE', /^\/api\/buyer\/addresses\/([\w-]+)$/, ([addrId], _b, _q, req) => {
    const b = needBuyer(req);
    store.update((db) => buyers.removeAddress(db, b.id, addrId));
    return { status: 200, body: { ok: true } };
  });
  route('GET', /^\/api\/buyer\/export$/, (_p, _b, _q, req) => {
    const b = needBuyer(req);
    return { status: 200, body: buyers.exportBuyer(store.read(), b.id, domain.publicOrder), headers: { 'Cache-Control': 'no-store', 'Content-Disposition': 'attachment; filename="data-saya.json"' } };
  });
  route('POST', /^\/api\/buyer\/delete$/, (_p, body, _q, req) => {
    const b = needBuyer(req);
    store.update((db) => buyers.deleteBuyer(db, b.id, body.password, now()));
    return { status: 200, body: { ok: true } };
  });
  route('GET', /^\/api\/buyer\/orders$/, (_p, _b, _q, req) => {
    const b = needBuyer(req);
    const orders = store.read().orders.filter((o) => o.buyerId === b.id).map((o) => domain.publicOrder(o));
    return { status: 200, body: { orders }, headers: { 'Cache-Control': 'no-store' } };
  });
  route('GET', /^\/api\/orders\/(ALO-\d{4}-\d{3})$/, ([number], _b, q) => {
    const order = domain.findOrderForBuyer(store.read(), number, q.email);
    if (!order) throw new ApiError(404, 'not_found', 'Tidak ada pesanan dengan nomor dan email tersebut.');
    return { status: 200, body: { order: domain.publicOrder(order) }, headers: { 'Cache-Control': 'no-store' } };
  });
  route('POST', /^\/api\/orders\/(ALO-\d{4}-\d{3})\/feedback$/, ([number], body) => {
    const order = domain.findOrderForBuyer(store.read(), number, body.email);
    if (!order) throw new ApiError(404, 'not_found', 'Tidak ada pesanan dengan nomor dan email tersebut.');
    const created = store.update((db) => {
      const o = db.orders.find((x) => x.id === order.id);
      return domain.createFeedback(db, o, body, now());
    });
    return { status: 201, body: { received: created.length } };
  });

  route('POST', /^\/api\/orders\/(ALO-\d{4}-\d{3})\/payment$/, async ([number], body) => {
    domain.assertPayable(store.read(), number, body.email, body.method);
    const order = store.read().orders.find((o) => o.number === number);
    const paymentId = require('crypto').randomUUID();
    const charge = await payments.createCharge({ paymentId, method: body.method, amount: order.total, orderNumber: number, now: now() });
    const created = store.update((db) => domain.createPayment(db, number, body.method, paymentId, charge, now()));
    const updated = store.read().orders.find((o) => o.number === number);
    return { status: 201, body: { payment: { id: created.id, method: created.method, instructions: created.instructions }, order: domain.publicOrder(updated) } };
  });
  if (ctx.demo) {
    // Hanya mode demo: anggap pembayaran sudah masuk, untuk uji coba alur.
    route('POST', /^\/api\/admin\/payments\/([\w-]+)\/simulate$/, ([providerRef]) => {
      const result = store.update((db) => domain.markPaymentPaid(db, providerRef, store.read().orders.find((o) => (o.payments || []).some((p) => p.providerRef === providerRef)).total, now()));
      return { status: 200, body: { order: domain.publicOrder(result.order), duplicate: result.duplicate } };
    }, { perm: 'orders' });
  }
  route('POST', /^\/api\/orders\/(ALO-\d{4}-\d{3})\/confirm-receipt$/, ([number], body) => {
    const order = domain.findOrderForBuyer(store.read(), number, body.email);
    if (!order) throw new ApiError(404, 'not_found', 'Tidak ada pesanan dengan nomor dan email tersebut.');
    const updated = store.update((db) => domain.confirmReceipt(db.orders.find((x) => x.id === order.id), now()));
    return { status: 200, body: { order: domain.publicOrder(updated) } };
  });
  route('POST', /^\/api\/orders\/(ALO-\d{4}-\d{3})\/problem$/, ([number], body) => {
    const order = domain.findOrderForBuyer(store.read(), number, body.email);
    if (!order) throw new ApiError(404, 'not_found', 'Tidak ada pesanan dengan nomor dan email tersebut.');
    store.update((db) => domain.reportProblem(db.orders.find((x) => x.id === order.id), body, now()));
    const updated = store.read().orders.find((x) => x.id === order.id);
    return { status: 201, body: { order: domain.publicOrder(updated) } };
  });

  route('POST', /^\/api\/auth\/login$/, (_p, body, _q, req) => {
    const email = String(body.email || '').trim().toLowerCase();
    const ip = (req && req.socket && req.socket.remoteAddress) || 'tidak-diketahui';
    const wait = Math.max(limiter.retryAfter('email', email), limiter.retryAfter('ip', ip));
    if (wait > 0) {
      const menit = Math.ceil(wait / 60);
      throw new ApiError(429, 'too_many_attempts', `Terlalu banyak percobaan masuk. Coba lagi dalam ${menit} menit.`);
    }
    let result;
    try {
      result = store.update((db) => {
        const r = auth.login(db, body.email, body.password, now());
        const u = db.users.find((x) => x.id === r.user.id);
        auth.logAudit(db, { user: u, action: 'login', status: 200, now: now() });
        return r;
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        limiter.recordFailure('email', email);
        limiter.recordFailure('ip', ip);
      }
      throw err;
    }
    limiter.recordSuccess('email', email);
    return { status: 200, body: result, headers: { 'Cache-Control': 'no-store' } };
  });
  route('POST', /^\/api\/auth\/logout$/, (_p, _b, _q, req) => {
    const token = bearer(req);
    if (token) store.update((db) => auth.logout(db, token));
    return { status: 200, body: { ok: true } };
  });
  route('POST', /^\/api\/auth\/password$/, (_p, body, _q, req) => {
    const user = requirePerm(req, store, null);
    const updated = store.update((db) => auth.changeOwnPassword(db, user.id, body.current, body.password, now()));
    return { status: 200, body: { user: auth.publicUser(updated) } };
  });
  route('GET', /^\/api\/auth\/me$/, (_p, _b, _q, req) => ({ status: 200, body: { user: auth.publicUser(requirePerm(req, store, null)) }, headers: { 'Cache-Control': 'no-store' } }));

  // ---- Admin ----
  route('GET', /^\/api\/admin\/summary$/, () => ({ status: 200, body: domain.summary(store.read()), headers: { 'Cache-Control': 'no-store' } }), { perm: 'reports' });
  route('GET', /^\/api\/admin\/config$/, () => ({
    status: 200,
    body: { ...publicConfig(false, store.read().settings), buyPricePerKg: config.buyPricePerKg, sortingLossPct: config.sortingLossPct, feesPerKg: config.feesPerKg, shippingPerKg: config.shippingPerKg, fixedCostsPerYear: config.fixedCostsPerYear, defaultMix: config.defaultMix, source: 'docs/business/source (v2 plan)' },
  }), { perm: 'reports' });
  // Tampilan: admin bisa mengubah warna dan sudut. Nilai dasar tetap di config/theme.js.
  route('GET', /^\/api\/admin\/theme$/, () => ({ status: 200, body: { overrides: store.read().settings?.theme || null, base: require('./config/theme') }, headers: { 'Cache-Control': 'no-store' } }), { perm: 'settings' });
  route('PUT', /^\/api\/admin\/theme$/, (_p, body) => {
    const overrides = validateOverrides(body);
    store.update((db) => {
      db.settings = { ...(db.settings || {}) };
      if (overrides) db.settings.theme = overrides;
      else delete db.settings.theme;
    });
    return { status: 200, body: { theme: mergeTheme(require('./config/theme'), overrides), overrides: overrides || null } };
  }, { perm: 'settings' });
  route('GET', /^\/api\/admin\/groups$/, () => ({ status: 200, body: { groups: store.read().groups } }), { perm: 'intake' });
  route('POST', /^\/api\/admin\/groups$/, (_p, body) => ({ status: 201, body: { group: store.update((db) => domain.createGroup(db, body)) } }), { perm: 'groups' });
  route('GET', /^\/api\/admin\/lots$/, () => {
    const db = store.read();
    const lots = db.lots.map((l) => ({ ...l, groupName: (domain.byId(db.groups, l.groupId) || {}).name, regionName: (domain.byId(db.regions, l.regionId) || {}).name, availableKg: domain.availableKg(l) }));
    return { status: 200, body: { lots } };
  }, { perm: 'lots.read' });
  route('POST', /^\/api\/admin\/lots$/, (_p, body) => ({ status: 201, body: { lot: store.update((db) => domain.createIntake(db, body, now())) } }), { perm: 'intake' });
  route('PATCH', /^\/api\/admin\/lots\/([\w-]+)$/, ([id], body) => ({ status: 200, body: { lot: store.update((db) => domain.gradeLot(db, id, body)) } }), { perm: 'grade' });
  route('POST', /^\/api\/admin\/lots\/([\w-]+)\/verify$/, ([id], _b, _q, req) => ({ status: 200, body: { lot: store.update((db) => domain.verifyLot(db, id, requirePerm(req, store, 'grade'), now())) } }), { perm: 'grade' });
  route('POST', /^\/api\/admin\/lots\/([\w-]+)\/publish$/, ([id], _b, _q, req) => ({ status: 200, body: { lot: store.update((db) => domain.publishLot(db, id, requirePerm(req, store, 'publish'), now())) } }), { perm: 'publish' });
  route('POST', /^\/api\/admin\/lots\/([\w-]+)\/withdraw$/, ([id]) => ({ status: 200, body: { lot: store.update((db) => domain.withdrawLot(db, id)) } }), { perm: 'publish' });
  route('GET', /^\/api\/admin\/outbox$/, () => {
    const items = (store.read().outbox || []).slice(-200).reverse().map((m) => ({ id: m.id, orderNumber: m.orderNumber, event: m.event, channel: m.channel, to: m.to, subject: m.subject, status: m.status, attempts: m.attempts, lastError: m.lastError, createdAt: m.createdAt, sentAt: m.sentAt || null }));
    return { status: 200, body: { items, providers: notify.providerStatus() }, headers: { 'Cache-Control': 'no-store' } };
  }, { perm: 'orders' });
  route('GET', /^\/api\/admin\/orders$/, () => ({ status: 200, body: { orders: store.read().orders }, headers: { 'Cache-Control': 'no-store' } }), { perm: 'orders' });
  route('PATCH', /^\/api\/admin\/orders\/([\w-]+)$/, ([id], body) => ({ status: 200, body: { order: store.update((db) => domain.updateOrderStatus(db, id, body, now())) }, headers: { 'Cache-Control': 'no-store' } }), { perm: 'orders' });
  route('GET', /^\/api\/admin\/feedback$/, () => ({ status: 200, body: { feedback: store.read().feedback } }), { perm: 'feedback' });
  route('PATCH', /^\/api\/admin\/feedback\/([\w-]+)$/, ([id], body) => ({ status: 200, body: { feedback: store.update((db) => domain.tagFeedback(db, id, body)) } }), { perm: 'feedback' });
  // Harga per kategori: satu sumber kebenaran, setiap perubahan wajib beralasan dan tercatat.
  route('GET', /^\/api\/admin\/prices$/, () => ({ status: 200, body: { prices: Object.fromEntries(Object.entries(require('./config/business').tiers).map(([c, t]) => [c, t.pricePerKg])), base: content.BASE_PRICES }, headers: { 'Cache-Control': 'no-store' } }), { perm: 'settings' });
  route('PUT', /^\/api\/admin\/prices$/, (_p, body) => {
    const { prices, reason } = content.validatePrices(body);
    const before = store.read().settings?.prices || {};
    const changed = Object.keys(prices).filter((c) => (before[c] || content.BASE_PRICES[c]) !== prices[c]);
    if (changed.length === 0) throw new ApiError(400, 'invalid_input', 'Tidak ada harga yang berubah.');
    store.update((db) => { db.settings = { ...(db.settings || {}), prices }; });
    content.applySettings(store.read().settings);
    const detail = 'Harga: ' + changed.map((c) => `${c} ${before[c] || content.BASE_PRICES[c]} → ${prices[c]}`).join(', ') + `. Alasan: ${reason}`;
    return { status: 200, body: { prices }, auditDetail: detail };
  }, { perm: 'settings' });

  // Teks situs (beranda dan footer).
  route('GET', /^\/api\/admin\/content$/, () => ({ status: 200, body: { content: content.contentFor(store.read().settings), defaults: content.defaults }, headers: { 'Cache-Control': 'no-store' } }), { perm: 'settings' });
  route('PUT', /^\/api\/admin\/content$/, (_p, body) => {
    const out = content.validateContent(body);
    store.update((db) => { db.settings = { ...(db.settings || {}), content: out }; });
    return { status: 200, body: { content: content.contentFor(store.read().settings) }, auditDetail: 'Teks situs diperbarui.' };
  }, { perm: 'settings' });

  // Tampilan katalog lot: judul, cerita, dan foto sampul (hanya admin).
  route('PATCH', /^\/api\/admin\/lots\/([\w-]+)\/listing$/, ([id], body) => {
    const lot = store.update((db) => domain.setListing(db, id, body, now()));
    return { status: 200, body: { lot: { id: lot.id, code: lot.code, headline: lot.headline, story: lot.story, coverPhotoId: lot.coverPhotoId } }, auditDetail: `Katalog ${lot.code} diperbarui.` };
  }, { perm: 'publish' });
  route('DELETE', /^\/api\/admin\/photos\/([\w-]+)$/, ([photoId]) => {
    const found = domain.findPhoto(store.read(), photoId);
    if (!found) throw new ApiError(404, 'not_found', 'Foto tidak ditemukan.');
    if (found.photo.kind !== 'listing') throw new ApiError(403, 'forbidden', 'Foto pemeriksaan tidak bisa dihapus dari sini.');
    const file = store.update((db) => domain.removePhoto(db, photoId));
    try { fs.unlinkSync(path.join(photoDir, file)); } catch { /* berkas sudah tidak ada */ }
    return { status: 200, body: { ok: true }, auditDetail: `Foto katalog ${found.lot.code} dihapus.` };
  }, { perm: 'publish' });

  route('POST', /^\/api\/admin\/lots\/([\w-]+)\/photos$/, ([id], body, _q, req) => {
    if (body.kind === 'listing') requirePerm(req, store, 'publish');
    const m = typeof body.dataUrl === 'string' ? /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(body.dataUrl) : null;
    if (!m) throw new ApiError(400, 'invalid_input', 'Foto harus berformat JPG atau PNG.', { dataUrl: 'Foto harus berformat JPG atau PNG.' });
    const bytes = Buffer.from(m[2], 'base64');
    if (bytes.length === 0 || bytes.length > PHOTO_MAX_BYTES) {
      throw new ApiError(400, 'invalid_input', 'Ukuran foto maksimal 2 MB.', { dataUrl: 'Ukuran foto maksimal 2 MB.' });
    }
    const ext = PHOTO_EXT[m[1]];
    const photoId = crypto.randomUUID();
    const file = `${photoId}.${ext}`;
    fs.mkdirSync(photoDir, { recursive: true });
    fs.writeFileSync(path.join(photoDir, file), bytes);
    const photo = store.update((db) => domain.addPhoto(db, id, body.kind, file, now()));
    return { status: 201, body: { photo: { id: photo.id, kind: photo.kind, createdAt: photo.createdAt } } };
  }, { perm: 'intake' });
  route('GET', /^\/api\/admin\/users$/, () => ({ status: 200, body: { users: store.read().users.map(auth.publicUser) }, headers: { 'Cache-Control': 'no-store' } }), { perm: 'users' });
  route('POST', /^\/api\/admin\/users$/, (_p, body) => ({ status: 201, body: { user: auth.publicUser(store.update((db) => auth.createUser(db, body, now()))) } }), { perm: 'users' });
  route('PATCH', /^\/api\/admin\/users\/([\w-]+)$/, ([id], body, _q, req) => ({ status: 200, body: { user: auth.publicUser(store.update((db) => auth.updateUser(db, id, body, requirePerm(req, store, 'users').id, now()))) } }), { perm: 'users' });
  route('GET', /^\/api\/admin\/users\/([\w-]+)\/activity$/, ([id]) => {
    if (!store.read().users.some((u) => u.id === id)) throw new ApiError(404, 'not_found', 'Pengguna tidak ditemukan.');
    return { status: 200, body: { entries: auth.activityFor(store.read(), id) }, headers: { 'Cache-Control': 'no-store' } };
  }, { perm: 'users' });
  route('GET', /^\/api\/admin\/audit$/, () => ({ status: 200, body: { entries: store.read().audit.slice(-200).reverse() }, headers: { 'Cache-Control': 'no-store' } }), { perm: 'audit' });
  route('GET', /^\/api\/admin\/farmer-report\/([\w-]+)$/, ([groupId]) => ({ status: 200, body: domain.farmerReport(store.read(), groupId) }), { perm: 'feedback' });

  return r;
}

// Development only (npm run dev): the browser reloads when files in public/ change.
const DEV = Boolean(process.env.DEV_RELOAD);
const devClients = new Set();
function startDevWatch() {
  let timer = null;
  try {
    fs.watch(PUBLIC_DIR, { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => { for (const c of devClients) c.write('data: reload\n\n'); }, 120);
    });
  } catch (err) {
    console.warn('[dev] file watching is not available here; refresh the browser manually.', err.message);
  }
}
function serveDevReload(req, res) {
  res.writeHead(200, baseHeaders({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' }));
  res.write('retry: 1000\n\n');
  devClients.add(res);
  req.on('close', () => devClients.delete(res));
}

// Pesan dari penyedia pembayaran. Wajib tanda tangan HMAC yang benar; rahasia dari PAYMENT_WEBHOOK_SECRET.
function handlePaymentWebhook(req, res, store) {
  const mt = payments.midtransConfig();
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!mt && !secret) return sendError(res, new ApiError(503, 'not_configured', 'Pembayaran online belum dikonfigurasi.'));
  const chunks = [];
  let size = 0;
  req.on('data', (c) => {
    size += c.length;
    if (size > 64 * 1024) { req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => {
    try {
      const raw = Buffer.concat(chunks);
      if (mt) {
        // Midtrans: notifikasi dengan signature_key SHA-512. Status lain selain lunas diabaikan (200).
        const n = JSON.parse(raw.toString('utf8'));
        if (!payments.verifyMidtransNotification(n, mt.key)) throw new ApiError(401, 'bad_signature', 'Tanda tangan tidak valid.');
        if (!payments.isMidtransPaid(n)) return send(res, 200, { ok: true, ignored: true });
        const result = store.update((db) => domain.markPaymentPaid(db, String(n.order_id || ''), n.gross_amount, new Date().toISOString()));
        return send(res, 200, { ok: true, duplicate: result.duplicate });
      }
      if (!payments.verifyWebhook(raw, req.headers['x-signature'], secret)) {
        throw new ApiError(401, 'bad_signature', 'Tanda tangan tidak valid.');
      }
      const body = JSON.parse(raw.toString('utf8'));
      const result = store.update((db) => domain.markPaymentPaid(db, String(body.providerRef || ''), body.amount, new Date().toISOString()));
      send(res, 200, { ok: true, duplicate: result.duplicate });
    } catch (err) {
      sendError(res, err instanceof ApiError ? err : new ApiError(400, 'invalid_json', 'Pesan tidak valid.'));
    }
  });
}

function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? '/index.html' : pathname;
  let decoded;
  try { decoded = decodeURIComponent(rel); } catch {
    res.writeHead(400, baseHeaders({ 'Content-Type': 'text/plain; charset=utf-8' }));
    return res.end('Bad request');
  }
  const file = path.normalize(path.join(PUBLIC_DIR, decoded));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(404, baseHeaders({ 'Content-Type': 'text/plain; charset=utf-8' }));
    return res.end('Not found');
  }
  fs.stat(file, (err, stat) => {
    const target = !err && stat.isFile() ? file : null;
    if (!target) {
      res.writeHead(404, baseHeaders({ 'Content-Type': 'text/plain; charset=utf-8' }));
      return res.end('Not found');
    }
    const type = TYPES[path.extname(target)] || 'application/octet-stream';
    if (DEV && path.basename(target) === 'index.html') {
      fs.readFile(target, 'utf8', (readErr, html) => {
        if (readErr) { res.writeHead(500, baseHeaders()); return res.end(); }
        const page = html.replace('</body>', '<script src="/dev-reload.js"></script>\n</body>');
        res.writeHead(200, baseHeaders({ 'Content-Type': type, 'Cache-Control': 'no-cache' }));
        res.end(page);
      });
      return;
    }
    res.writeHead(200, baseHeaders({ 'Content-Type': type, 'Cache-Control': 'no-cache' }));
    fs.createReadStream(target).pipe(res);
  });
}

function createApp({ dataFile, owner, demo = false }) {
  const store = new SqlStore(dataFile, seed, path.join(path.dirname(dataFile), 'db.json'));
  store.load();
  if (auth.ensureOwner(store.db, owner, new Date().toISOString())) store.save(store.db);
  content.applySettings(store.db.settings);
  if (demo) {
    store.update((db) => {
      db.users = db.users || [];
      for (const d of DEMO_USERS) {
        const existing = db.users.find((u) => u.email === d.email);
        if (existing) {
          Object.assign(existing, { name: d.name, role: d.role, active: true, passwordHash: auth.hashPassword(d.password), mustChangePassword: false });
        } else {
          db.users.push({ id: require('crypto').randomUUID(), name: d.name, email: d.email, role: d.role, passwordHash: auth.hashPassword(d.password), active: true, createdAt: new Date().toISOString() });
        }
      }
    });
  }
  if (domain.ensureRegions(store.db, regionDefaults()) > 0) store.save(store.db);
  const migrated = domain.ensurePassportHashes(store.db);
  if (migrated) store.update((db) => domain.ensurePassportHashes(db));

  const photoDir = path.join(path.dirname(dataFile), 'photos');
  const routes = buildRoutes({ store, photoDir, demo, limiter: new LoginLimiter(), buyerLimiter: new LoginLimiter() });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;
    if (DEV && pathname === '/__dev/reload') return serveDevReload(req, res);
    if (pathname === '/healthz' && req.method === 'GET') {
      try {
        store.read();
        res.writeHead(200, baseHeaders({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }));
        return res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString() }));
      } catch {
        res.writeHead(503, baseHeaders({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }));
        return res.end(JSON.stringify({ status: 'error' }));
      }
    }
    if (pathname === '/api/payments/webhook' && req.method === 'POST') {
      return handlePaymentWebhook(req, res, store);
    }
    // Faktur PDF: tamu memakai nomor pesanan dan email (seperti melacak); pembeli memakai akunnya.
    const invoiceGuest = pathname.match(/^\/api\/orders\/(ALO-\d{4}-\d{3})\/invoice$/);
    const invoiceBuyer = pathname.match(/^\/api\/buyer\/orders\/(ALO-\d{4}-\d{3})\/invoice$/);
    if ((invoiceGuest || invoiceBuyer) && req.method === 'GET') {
      try {
        const db = store.read();
        let order;
        if (invoiceGuest) {
          order = domain.findOrderForBuyer(db, invoiceGuest[1], url.searchParams.get('email'));
        } else {
          const b = buyers.buyerFromToken(db, bearer(req), new Date().toISOString());
          if (!b) throw new ApiError(401, 'unauthorized', 'Silakan masuk ke akun Anda.');
          order = db.orders.find((o) => o.number === invoiceBuyer[1] && o.buyerId === b.id);
        }
        if (!order) throw new ApiError(404, 'not_found', 'Tidak ada pesanan dengan nomor dan email tersebut.');
        const pdf = invoice.invoicePdf(order, new Date().toISOString());
        res.writeHead(200, baseHeaders({ 'Content-Type': 'application/pdf', 'Content-Length': pdf.length, 'Content-Disposition': `attachment; filename="faktur-${order.number}.pdf"`, 'Cache-Control': 'private, no-store' }));
        return res.end(pdf);
      } catch (err) {
        return sendError(res, err);
      }
    }
    const publicPhoto = pathname.match(/^\/api\/lots\/([\w-]+)\/photos\/([\w-]+)$/);
    if (publicPhoto && req.method === 'GET') {
      try {
        const lot = store.read().lots.find((l) => l.code === publicPhoto[1] && l.status === 'listed');
        const photo = lot && (lot.photos || []).find((p) => p.id === publicPhoto[2] && domain.LISTING_PHOTO_KINDS.includes(p.kind));
        if (!photo) throw new ApiError(404, 'not_found', 'Foto tidak ditemukan.');
        const bytes = fs.readFileSync(path.join(photoDir, photo.file));
        const ext = path.extname(photo.file).slice(1);
        res.writeHead(200, baseHeaders({ 'Content-Type': PHOTO_TYPE[ext] || 'application/octet-stream', 'Content-Length': bytes.length, 'Cache-Control': 'public, max-age=300' }));
        return res.end(bytes);
      } catch (err) {
        return sendError(res, err);
      }
    }
    const photoMatch = pathname.match(/^\/api\/admin\/photos\/([\w-]+)$/);
    if (photoMatch && req.method === 'GET') {
      try {
        requirePerm(req, store, 'lots.read');
        const found = domain.findPhoto(store.read(), photoMatch[1]);
        if (!found) throw new ApiError(404, 'not_found', 'Foto tidak ditemukan.');
        const ext = path.extname(found.photo.file).slice(1);
        const bytes = fs.readFileSync(path.join(photoDir, found.photo.file));
        res.writeHead(200, baseHeaders({ 'Content-Type': PHOTO_TYPE[ext] || 'application/octet-stream', 'Content-Length': bytes.length, 'Cache-Control': 'private, no-store' }));
        return res.end(bytes);
      } catch (err) {
        return sendError(res, err);
      }
    }
    if (!pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, baseHeaders({ Allow: 'GET' }));
        return res.end();
      }
      return serveStatic(req, res, pathname);
    }
    const query = Object.fromEntries(url.searchParams.entries());
    try {
      const match = routes.find((rt) => rt.method === req.method && rt.pattern.test(pathname));
      if (!match) {
        const pathExists = routes.some((rt) => rt.pattern.test(pathname));
        throw new ApiError(pathExists ? 405 : 404, pathExists ? 'method_not_allowed' : 'not_found', 'Tidak ditemukan.');
      }
      const actor = match.perm ? requirePerm(req, store, match.perm) : null;
      if (actor && actor.mustChangePassword) {
        throw new ApiError(403, 'password_change_required', 'Anda harus mengganti kata sandi terlebih dahulu.');
      }
      const params = pathname.match(match.pattern).slice(1);
      const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {};
      const result = await match.handler(params, body, query, req);
      if (actor && req.method !== 'GET') {
        store.update((db) => auth.logAudit(db, { user: actor, action: `${req.method} ${pathname}`, status: result.status, now: new Date().toISOString(), detail: result.auditDetail }));
      }
      const headers = { 'Cache-Control': 'no-store', ...(result.headers || {}) };
      send(res, result.status, result.body, headers);
    } catch (err) {
      sendError(res, err);
    }
  });
  return { server, store };
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const dataFile = process.env.DATA_FILE || path.join(__dirname, 'data', 'app.db');
  const owner = {
    name: process.env.OWNER_NAME || 'Pemilik',
    email: process.env.OWNER_EMAIL || 'owner@anugerahlink.local',
    password: process.env.OWNER_PASSWORD || '',
  };
  const problems = productionProblems(process.env);
  if (problems.length) {
    console.error('[berhenti] Pengaturan belum aman untuk pengguna sungguhan:');
    for (const p of problems) console.error('  - ' + p);
    process.exit(1);
  }
  if (!owner.password) {
    owner.password = 'ganti-saya-sekarang-123';
    console.warn('[warn] OWNER_PASSWORD is not set. Using a development password. Set OWNER_EMAIL and OWNER_PASSWORD before going live.');
  }
  const demo = process.env.DEMO_ACCOUNTS === '1';
  if (demo) console.warn('[demo] Akun demo aktif. Jangan gunakan mode ini untuk data sungguhan.');
  const { server, store } = createApp({ dataFile, owner, demo });
  if (DEV) { startDevWatch(); console.log('[dev] live reload is on: the browser refreshes when public/ changes'); }
  // Pengirim pesan berkala. Tanpa penyedia yang diatur, pesan tetap menunggu.
  setInterval(() => {
    notify.dispatchOutbox(store).catch((err) => console.error('[notify] gagal mengirim:', err.message));
  }, 60000).unref();
  server.listen(port, () => console.log(`AnugerahLink running at http://localhost:${port}`));
}

module.exports = { createApp };
