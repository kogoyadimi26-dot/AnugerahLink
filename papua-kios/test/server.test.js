'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kios-test-'));
process.env.KIOS_DATA = path.join(tmpDir, 'kios.json');
process.env.ADMIN_TOKEN = 'test-token';

const { server } = require('../server');

let base;
before(() => new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => {
    base = `http://127.0.0.1:${server.address().port}`;
    resolve();
  });
}));
after(() => new Promise((resolve) => {
  server.close(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    resolve();
  });
}));

async function call(method, url, body, headers = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

test('serves the storefront page', async () => {
  const res = await fetch(base + '/');
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Pesan Kios Papua/);
});

test('lists seeded products, buyers and hubs', async () => {
  const products = await call('GET', '/api/products');
  assert.equal(products.status, 200);
  assert.ok(products.data.length >= 4);
  const config = await call('GET', '/api/config');
  assert.deepEqual(config.data.hubs, ['Jayapura', 'Wamena', 'Timika']);
});

test('a buyer can place a cash order and stock falls', async () => {
  const before = await call('GET', '/api/products');
  const beras = before.data.find((p) => p.id === 'beras-5kg');
  const res = await call('POST', '/api/orders', {
    buyerId: 'kios-sentani', items: [{ productId: 'beras-5kg', qty: 2 }], paymentMethod: 'tunai',
  });
  assert.equal(res.status, 201);
  assert.equal(res.data.status, 'menunggu');
  const after = await call('GET', '/api/products');
  assert.equal(after.data.find((p) => p.id === 'beras-5kg').stock.Jayapura, beras.stock.Jayapura - 2);
});

test('back office rejects requests without the admin token', async () => {
  const res = await call('GET', '/api/summary');
  assert.equal(res.status, 401);
  const wrong = await call('GET', '/api/summary', null, { 'X-Admin-Token': 'nope' });
  assert.equal(wrong.status, 401);
});

test('admin can read summary and move an order through its statuses', async () => {
  const headers = { 'X-Admin-Token': 'test-token' };
  const summary = await call('GET', '/api/summary', null, headers);
  assert.equal(summary.status, 200);
  assert.ok(summary.data.orderCount >= 1);

  const orders = await call('GET', '/api/orders');
  const id = orders.data[orders.data.length - 1].id;
  const res = await call('PATCH', `/api/orders/${id}/status`, { status: 'dikonfirmasi' }, headers);
  assert.equal(res.data.status, 'dikonfirmasi');
});

test('credit order over the limit returns a readable error', async () => {
  const res = await call('POST', '/api/orders', {
    buyerId: 'sd-wamena', items: [{ productId: 'semen-40kg', qty: 5 }], paymentMethod: 'kredit',
  });
  assert.equal(res.status, 400);
  assert.match(res.data.error, /batas kredit/);
});

test('bad JSON gets a 400', async () => {
  const res = await fetch(base + '/api/orders', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: '{nope' });
  assert.equal(res.status, 400);
});

test('static path traversal is blocked', async () => {
  const res = await fetch(base + '/..%2Fserver.js');
  assert.notEqual(res.status, 200);
});
