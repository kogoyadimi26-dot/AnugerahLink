'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const d = require('./lib/domain');

const PORT = Number(process.env.PORT || 3100);
const DATA_FILE = process.env.KIOS_DATA || path.join(__dirname, 'data', 'kios.json');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const PUBLIC_DIR = path.join(__dirname, 'public');

function seedState() {
  return {
    products: [
      d.createProduct({ id: 'beras-5kg', name: 'Beras 5 kg', unit: 'karung', price: 65000,
        stock: { Jayapura: 120, Wamena: 60, Timika: 80 } }),
      d.createProduct({ id: 'minyak-1l', name: 'Minyak goreng 1 L', unit: 'botol', price: 17000,
        stock: { Jayapura: 300, Wamena: 150, Timika: 200 } }),
      d.createProduct({ id: 'gula-1kg', name: 'Gula pasir 1 kg', unit: 'bungkus', price: 16000,
        stock: { Jayapura: 200, Wamena: 90, Timika: 120 } }),
      d.createProduct({ id: 'semen-40kg', name: 'Semen 40 kg', unit: 'sak', price: 95000,
        stock: { Jayapura: 60, Wamena: 10, Timika: 40 } }),
    ],
    buyers: [
      d.createBuyer({ id: 'kios-sentani', name: 'Kios Sentani Jaya', type: 'kios', hub: 'Jayapura', phone: '', creditLimit: 500000 }),
      d.createBuyer({ id: 'sd-wamena', name: 'SD Negeri Wamena 1', type: 'sekolah', hub: 'Wamena', phone: '', creditLimit: 0 }),
    ],
    orders: [],
  };
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    const state = seedState();
    saveState(state);
    return state;
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

let state = loadState();

function send(res, status, body, type = 'application/json; charset=utf-8') {
  const payload = type.startsWith('application/json') ? JSON.stringify(body) : body;
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 100_000) {
        reject(Object.assign(new Error('Permintaan terlalu besar'), { status: 413 }));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error('JSON tidak valid'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function requireAdmin(req) {
  if (!ADMIN_TOKEN) {
    throw Object.assign(new Error('ADMIN_TOKEN belum diatur di server'), { status: 503 });
  }
  if (req.headers['x-admin-token'] !== ADMIN_TOKEN) {
    throw Object.assign(new Error('Tidak diizinkan'), { status: 401 });
  }
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8' };

function serveStatic(req, res, urlPath) {
  const file = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const full = path.normalize(path.join(PUBLIC_DIR, file));
  if (!full.startsWith(PUBLIC_DIR + path.sep)) return send(res, 404, 'Tidak ditemukan', 'text/plain');
  fs.readFile(full, (err, data) => {
    if (err) return send(res, 404, 'Tidak ditemukan', 'text/plain');
    send(res, 200, data, MIME[path.extname(full)] || 'application/octet-stream');
  });
}

async function handleApi(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]
  const [, resource, id, action] = parts;
  const method = req.method;

  if (method === 'GET' && resource === 'products' && !id) {
    return send(res, 200, state.products);
  }
  if (method === 'GET' && resource === 'buyers' && !id) {
    return send(res, 200, state.buyers);
  }
  if (method === 'GET' && resource === 'orders' && !id) {
    return send(res, 200, state.orders);
  }
  if (method === 'GET' && resource === 'summary') {
    requireAdmin(req);
    return send(res, 200, d.summary(state));
  }
  if (method === 'GET' && resource === 'config') {
    return send(res, 200, { hubs: d.HUBS, paymentMethods: d.PAYMENT_METHODS, statuses: d.STATUSES,
      buyerTypes: d.BUYER_TYPES, platformFeeBps: d.PLATFORM_FEE_BPS, deliveryFee: d.DELIVERY_FEE });
  }

  if (method === 'POST' && resource === 'buyers' && !id) {
    const body = await readBody(req);
    const buyer = d.createBuyer({ ...body, id: `b-${Date.now().toString(36)}` });
    state = { ...state, buyers: [...state.buyers, buyer] };
    saveState(state);
    return send(res, 201, buyer);
  }

  if (method === 'POST' && resource === 'orders' && !id) {
    const body = await readBody(req);
    const next = d.placeOrder(state, { ...body, orderId: `o-${Date.now().toString(36)}`,
      createdAt: new Date().toISOString() });
    state = next;
    saveState(state);
    return send(res, 201, state.orders[state.orders.length - 1]);
  }

  if (method === 'PATCH' && resource === 'orders' && id && action === 'status') {
    requireAdmin(req);
    const body = await readBody(req);
    state = d.setStatus(state, id, body.status);
    saveState(state);
    return send(res, 200, state.orders.find((o) => o.id === id));
  }

  if (method === 'POST' && resource === 'payments') {
    requireAdmin(req);
    const body = await readBody(req);
    state = d.recordPayment(state, body.buyerId, body.amount);
    saveState(state);
    return send(res, 200, state.buyers.find((b) => b.id === body.buyerId));
  }

  if (method === 'POST' && resource === 'products') {
    requireAdmin(req);
    const body = await readBody(req);
    const product = d.createProduct({ ...body, id: body.id || `p-${Date.now().toString(36)}` });
    state = { ...state, products: [...state.products, product] };
    saveState(state);
    return send(res, 201, product);
  }

  return send(res, 404, { error: 'Tidak ditemukan' });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
    } else if (req.method === 'GET') {
      serveStatic(req, res, url.pathname);
    } else {
      send(res, 405, 'Metode tidak diizinkan', 'text/plain');
    }
  } catch (err) {
    const status = err.status || 400;
    send(res, status, { error: err.message });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Kios app berjalan di http://localhost:${PORT}`);
  });
}

module.exports = { server, seedState };
