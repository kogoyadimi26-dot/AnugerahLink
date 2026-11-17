'use strict';

// AnugerahLink web server. Node standard library only.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Store } = require('./lib/store');
const { seed, regionDefaults } = require('./lib/seed');
const domain = require('./lib/domain');
const config = require('./config/business');
const { ApiError } = require('./lib/validate');

const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY = 64 * 1024;
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
  "img-src 'self' data:",
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

function tokenOk(given, expected) {
  const a = crypto.createHash('sha256').update(String(given || '')).digest();
  const b = crypto.createHash('sha256').update(String(expected)).digest();
  return crypto.timingSafeEqual(a, b) && typeof given === 'string' && given.length > 0;
}

function requireAdmin(req, adminToken) {
  const header = req.headers.authorization || '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!tokenOk(given, adminToken)) throw new ApiError(401, 'unauthorised', 'Silakan masuk sebagai tim terlebih dahulu.');
}

function publicConfig() {
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
    theme: require('./config/theme'),
  };
}

function buildRoutes(ctx) {
  const { store, adminToken } = ctx;
  const now = () => new Date().toISOString();
  const r = [];
  const route = (method, pattern, handler, { admin = false } = {}) => r.push({ method, pattern, handler, admin });

  // ---- Public ----
  route('GET', /^\/api\/health$/, () => ({ status: 200, body: { ok: true } }));
  route('GET', /^\/api\/config$/, () => ({ status: 200, body: publicConfig() }));
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
  route('POST', /^\/api\/orders$/, (_p, body) => {
    const order = store.update((db) => domain.createOrder(db, body, now()));
    return { status: 201, body: { order: domain.publicOrder(order) } };
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

  // ---- Admin ----
  route('GET', /^\/api\/admin\/summary$/, () => ({ status: 200, body: domain.summary(store.read()), headers: { 'Cache-Control': 'no-store' } }), { admin: true });
  route('GET', /^\/api\/admin\/config$/, () => ({
    status: 200,
    body: { ...publicConfig(), buyPricePerKg: config.buyPricePerKg, sortingLossPct: config.sortingLossPct, feesPerKg: config.feesPerKg, shippingPerKg: config.shippingPerKg, fixedCostsPerYear: config.fixedCostsPerYear, defaultMix: config.defaultMix, source: 'docs/business/source (v2 plan)' },
  }), { admin: true });
  route('GET', /^\/api\/admin\/groups$/, () => ({ status: 200, body: { groups: store.read().groups } }), { admin: true });
  route('POST', /^\/api\/admin\/groups$/, (_p, body) => ({ status: 201, body: { group: store.update((db) => domain.createGroup(db, body)) } }), { admin: true });
  route('GET', /^\/api\/admin\/lots$/, () => {
    const db = store.read();
    const lots = db.lots.map((l) => ({ ...l, groupName: (domain.byId(db.groups, l.groupId) || {}).name, regionName: (domain.byId(db.regions, l.regionId) || {}).name, availableKg: domain.availableKg(l) }));
    return { status: 200, body: { lots } };
  }, { admin: true });
  route('POST', /^\/api\/admin\/lots$/, (_p, body) => ({ status: 201, body: { lot: store.update((db) => domain.createIntake(db, body, now())) } }), { admin: true });
  route('PATCH', /^\/api\/admin\/lots\/([\w-]+)$/, ([id], body) => ({ status: 200, body: { lot: store.update((db) => domain.gradeLot(db, id, body)) } }), { admin: true });
  route('POST', /^\/api\/admin\/lots\/([\w-]+)\/publish$/, ([id]) => ({ status: 200, body: { lot: store.update((db) => domain.publishLot(db, id, now())) } }), { admin: true });
  route('POST', /^\/api\/admin\/lots\/([\w-]+)\/withdraw$/, ([id]) => ({ status: 200, body: { lot: store.update((db) => domain.withdrawLot(db, id)) } }), { admin: true });
  route('GET', /^\/api\/admin\/orders$/, () => ({ status: 200, body: { orders: store.read().orders }, headers: { 'Cache-Control': 'no-store' } }), { admin: true });
  route('PATCH', /^\/api\/admin\/orders\/([\w-]+)$/, ([id], body) => ({ status: 200, body: { order: store.update((db) => domain.updateOrderStatus(db, id, body, now())) }, headers: { 'Cache-Control': 'no-store' } }), { admin: true });
  route('GET', /^\/api\/admin\/feedback$/, () => ({ status: 200, body: { feedback: store.read().feedback } }), { admin: true });
  route('PATCH', /^\/api\/admin\/feedback\/([\w-]+)$/, ([id], body) => ({ status: 200, body: { feedback: store.update((db) => domain.tagFeedback(db, id, body)) } }), { admin: true });
  route('GET', /^\/api\/admin\/farmer-report\/([\w-]+)$/, ([groupId]) => ({ status: 200, body: domain.farmerReport(store.read(), groupId) }), { admin: true });

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

function createApp({ dataFile, adminToken }) {
  const store = new Store(dataFile, seed);
  store.load();
  if (domain.ensureRegions(store.db, regionDefaults()) > 0) store.save(store.db);
  const migrated = domain.ensurePassportHashes(store.db);
  if (migrated) store.update((db) => domain.ensurePassportHashes(db));

  const routes = buildRoutes({ store, adminToken });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;
    if (DEV && pathname === '/__dev/reload') return serveDevReload(req, res);
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
      if (match.admin) requireAdmin(req, adminToken);
      const params = pathname.match(match.pattern).slice(1);
      const body = ['POST', 'PATCH'].includes(req.method) ? await readBody(req) : {};
      const result = match.handler(params, body, query, req);
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
  const dataFile = process.env.DATA_FILE || path.join(__dirname, 'data', 'db.json');
  let adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    adminToken = 'dev-only-admin-token';
    console.warn('[warn] ADMIN_TOKEN is not set. Using a development token. Set ADMIN_TOKEN before going live.');
  }
  const { server } = createApp({ dataFile, adminToken });
  if (DEV) { startDevWatch(); console.log('[dev] live reload is on: the browser refreshes when public/ changes'); }
  server.listen(port, () => console.log(`AnugerahLink running at http://localhost:${port}`));
}

module.exports = { createApp };
