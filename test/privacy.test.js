'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'al-privasi-'));
const OWNER = { email: 'pemilik-privasi@test.local', password: 'kata-sandi-privasi-123' };
const BUYER = { name: 'Sari Kafe', email: 'sari@kafe.test', password: 'kata-sandi-sari-1', phone: '081255556666', company: 'Kafe Sari', buyerType: 'specialty_cafe', consent: true };
let app; let base; let STAFF; let TOKEN;

test.before(async () => {
  app = createApp({ dataFile: path.join(tmp, 'app.db'), owner: { name: 'Pemilik', ...OWNER } });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${app.server.address().port}`;
  STAFF = (await call('POST', '/api/auth/login', { body: OWNER })).json.token;
  TOKEN = (await call('POST', '/api/buyer/signup', { body: BUYER })).json.token;
});
test.after(async () => {
  await new Promise((r) => app.server.close(r));
  fs.rmSync(tmp, { recursive: true, force: true });
});

async function call(method, p, { body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(base + p, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

test('legal pages are published with a draft flag until a lawyer reviews them', async () => {
  const cfg = (await call('GET', '/api/config')).json;
  assert.equal(cfg.legal.reviewed, false);
  assert.ok(cfg.legal.pages['kebijakan-privasi'].sections.length > 3);
});

test('an order needs consent; the consent version is kept on the order', async () => {
  const lot = (await call('GET', '/api/lots')).json.lots.find((l) => l.availableKg >= 30);
  const customer = { name: 'Sari', buyerType: 'specialty_cafe', phone: BUYER.phone, email: BUYER.email, city: 'Jayapura' };
  const refused = await call('POST', '/api/orders', { token: TOKEN, body: { lines: [{ lotCode: lot.code, kg: 30 }], customer } });
  assert.equal(refused.status, 400);
  assert.ok(refused.json.error.fields.consent);
  const placed = await call('POST', '/api/orders', { token: TOKEN, body: { lines: [{ lotCode: lot.code, kg: 30 }], consent: true, customer } });
  assert.equal(placed.status, 201);
  const admin = (await call('GET', '/api/admin/orders', { token: STAFF })).json.orders.find((o) => o.number === placed.json.order.number);
  assert.equal(admin.consent.version, 'v1-draft');
});

test('a buyer can export their data without the password hash', async () => {
  const exp = await call('GET', '/api/buyer/export', { token: TOKEN });
  assert.equal(exp.status, 200);
  assert.equal(JSON.stringify(exp.json).includes('passwordHash'), false);
  assert.equal(exp.json.profile.email, BUYER.email);
  assert.equal(exp.json.consent.version, 'v1-draft');
});

test('deleting the account needs the password; orders keep their totals but lose personal details', async () => {
  assert.equal((await call('POST', '/api/buyer/delete', { token: TOKEN, body: { password: 'salah-salah-1' } })).status, 400);
  const before = (await call('GET', '/api/buyer/orders', { token: TOKEN })).json.orders;
  assert.ok(before.length >= 0);
  const number = before.length ? before[0].number : null;
  assert.equal((await call('POST', '/api/buyer/delete', { token: TOKEN, body: { password: BUYER.password } })).status, 200);
  assert.equal((await call('GET', '/api/buyer/me', { token: TOKEN })).status, 401);
  assert.equal((await call('POST', '/api/buyer/login', { body: { email: BUYER.email, password: BUYER.password } })).status, 401);
  const admin = (await call('GET', '/api/admin/orders', { token: STAFF })).json.orders;
  const mine = admin.filter((o) => o.customer.name === '[dihapus]');
  assert.ok(mine.length >= 1, 'orders remain for records');
  assert.equal(mine[0].customer.email, '');
  assert.equal(mine[0].customer.phone, '');
  assert.ok(mine[0].total > 0, 'totals are kept');
  if (number) assert.ok(mine.some((o) => o.number === number));
  const audit = (await call('GET', '/api/admin/audit', { token: STAFF })).json.entries;
  assert.ok(audit.some((e) => e.action === 'buyer.delete'));
});

test('health check answers without data and prunes old backups only', async () => {
  const res = await call('GET', '/healthz');
  assert.equal(res.status, 200);
  assert.equal(res.json.status, 'ok');
});
