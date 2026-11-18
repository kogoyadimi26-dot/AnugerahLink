'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'al-pembeli-'));
const OWNER = { email: 'pemilik-pembeli@test.local', password: 'kata-sandi-pemilik-123' };
let app; let base; let STAFF;

test.before(async () => {
  app = createApp({ dataFile: path.join(tmp, 'app.db'), owner: { name: 'Pemilik', ...OWNER } });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${app.server.address().port}`;
  STAFF = (await call('POST', '/api/auth/login', { body: OWNER })).json.token;
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

const SIGNUP = { name: 'Rina Kafe', email: 'rina@kafe.test', password: 'kata-sandi-rina-1', phone: '081234567890', company: 'Kafe Rina', buyerType: 'specialty_cafe', consent: true };
const ADDR = { recipient: 'Rina', phone: '081234567890', street: 'Jl. Sentani 12, Jayapura', city: 'Jayapura', province: 'Papua', postal: '99111' };

test('sign up needs consent, a valid password and a unique email', async () => {
  assert.equal((await call('POST', '/api/buyer/signup', { body: { ...SIGNUP, consent: false } })).status, 400);
  assert.equal((await call('POST', '/api/buyer/signup', { body: { ...SIGNUP, password: 'pendek' } })).status, 400);
  const ok = await call('POST', '/api/buyer/signup', { body: SIGNUP });
  assert.equal(ok.status, 201);
  assert.ok(ok.json.token && ok.json.buyer.email === SIGNUP.email);
  assert.equal(JSON.stringify(ok.json).includes('passwordHash'), false, 'password hash never leaves the server');
  assert.equal((await call('POST', '/api/buyer/signup', { body: SIGNUP })).status, 409);
});

test('sign in works with the right password only; buyer routes need a buyer token', async () => {
  assert.equal((await call('POST', '/api/buyer/login', { body: { email: SIGNUP.email, password: 'salah-salah-1' } })).status, 401);
  const ok = await call('POST', '/api/buyer/login', { body: { email: SIGNUP.email, password: SIGNUP.password } });
  assert.equal(ok.status, 200);
  assert.equal((await call('GET', '/api/buyer/me')).status, 401);
  assert.equal((await call('GET', '/api/buyer/me', { token: STAFF })).status, 401, 'staff token is not a buyer token');
  assert.equal((await call('GET', '/api/buyer/me', { token: ok.json.token })).status, 200);
});

test('saved addresses: default switching, limit of five, and removal', async () => {
  const token = (await call('POST', '/api/buyer/login', { body: { email: SIGNUP.email, password: SIGNUP.password } })).json.token;
  const first = await call('POST', '/api/buyer/addresses', { token, body: { ...ADDR, label: 'Kafe' } });
  assert.equal(first.status, 201);
  assert.equal(first.json.address.isDefault, true, 'first address becomes the default');
  const second = await call('POST', '/api/buyer/addresses', { token, body: { ...ADDR, label: 'Gudang', isDefault: true } });
  assert.equal(second.json.address.isDefault, true);
  const me = (await call('GET', '/api/buyer/me', { token })).json.buyer;
  assert.equal(me.addresses.filter((a) => a.isDefault).length, 1);
  for (let i = 0; i < 3; i++) await call('POST', '/api/buyer/addresses', { token, body: { ...ADDR, label: 'x' + i } });
  assert.equal((await call('POST', '/api/buyer/addresses', { token, body: ADDR })).status, 409, 'sixth address refused');
  assert.equal((await call('DELETE', `/api/buyer/addresses/${first.json.address.id}`, { token })).status, 200);
});

test('orders placed while signed in are linked to the buyer and only the buyer sees them', async () => {
  const token = (await call('POST', '/api/buyer/login', { body: { email: SIGNUP.email, password: SIGNUP.password } })).json.token;
  const cfgLots = (await call('GET', '/api/lots')).json.lots;
  const lot = cfgLots.find((l) => l.availableKg >= 30);
  const body = { lines: [{ lotCode: lot.code, kg: 30 }], consent: true, customer: { name: 'Rina', company: 'Kafe Rina', buyerType: 'specialty_cafe', phone: '081234567890', email: SIGNUP.email, city: 'Jayapura', street: 'Jl. Sentani 12' } };

  const wrongEmail = await call('POST', '/api/orders', { token, body: { ...body, consent: true, customer: { ...body.customer, email: 'orang-lain@test.local' } } });
  assert.equal(wrongEmail.status, 400, 'a signed-in buyer must use the account email');

  const placed = await call('POST', '/api/orders', { token, body });
  assert.equal(placed.status, 201);
  const mine = await call('GET', '/api/buyer/orders', { token });
  assert.ok(mine.json.orders.some((o) => o.number === placed.json.order.number));

  const other = await call('POST', '/api/buyer/signup', { body: { ...SIGNUP, email: 'lain@kafe.test', name: 'Lain Kafe' } });
  const seen = await call('GET', '/api/buyer/orders', { token: other.json.token });
  assert.equal(seen.json.orders.length, 0, 'another buyer cannot see this order');
});

test('signing out ends the session; profile and password changes take effect', async () => {
  const token = (await call('POST', '/api/buyer/login', { body: { email: SIGNUP.email, password: SIGNUP.password } })).json.token;
  assert.equal((await call('PATCH', '/api/buyer/me', { token, body: { name: 'Rina Dewi', phone: '081234567890', company: 'Kafe Rina', buyerType: 'roaster' } })).json.buyer.name, 'Rina Dewi');
  assert.equal((await call('POST', '/api/buyer/password', { token, body: { current: 'salah-salah-1', password: 'kata-sandi-baru-2' } })).status, 400);
  assert.equal((await call('POST', '/api/buyer/password', { token, body: { current: SIGNUP.password, password: 'kata-sandi-baru-2' } })).status, 200);
  assert.equal((await call('POST', '/api/buyer/login', { body: { email: SIGNUP.email, password: 'kata-sandi-baru-2' } })).status, 200);
  await call('POST', '/api/buyer/logout', { token });
  assert.equal((await call('GET', '/api/buyer/me', { token })).status, 401);
});
