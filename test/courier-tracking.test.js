'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server');
const payments = require('../lib/payments');
const notify = require('../lib/notify');

const SECRET = 'uji-kurir-rahasia';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'al-kurir-'));
const OWNER = { email: 'pemilik-kurir@test.local', password: 'kata-sandi-pemilik-123' };
let app; let base; let STAFF;

test.before(async () => {
  process.env.SHIPPING_WEBHOOK_SECRET = SECRET;
  app = createApp({ dataFile: path.join(tmp, 'app.db'), owner: { name: 'Pemilik', ...OWNER } });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${app.server.address().port}`;
  STAFF = (await call('POST', '/api/auth/login', { body: OWNER })).json.token;
});
test.after(async () => {
  delete process.env.SHIPPING_WEBHOOK_SECRET;
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

// Pesanan dikirim lewat alur staf biasa, dengan nomor resi.
async function shippedOrder(email, waybill) {
  const token = (await call('POST', '/api/buyer/signup', { body: { name: 'Kurir Uji', email, password: 'kata-sandi-kurir-1', phone: '081233334444', company: 'Kafe Kurir', buyerType: 'specialty_cafe', consent: true } })).json.token;
  const lot = (await call('GET', '/api/lots')).json.lots.find((l) => l.availableKg >= 30);
  const o = (await call('POST', '/api/orders', { token, body: { lines: [{ lotCode: lot.code, kg: 30 }], consent: true, customer: { name: 'Kurir Uji', company: 'Kafe Kurir', buyerType: 'specialty_cafe', phone: '081233334444', email, city: 'Jayapura' } } })).json.order;
  const id = (await call('GET', '/api/admin/orders', { token: STAFF })).json.orders.find((x) => x.number === o.number).id;
  await call('PATCH', `/api/admin/orders/${id}`, { token: STAFF, body: { status: 'confirmed' } });
  await call('PATCH', `/api/admin/orders/${id}`, { token: STAFF, body: { status: 'paid', paymentReference: 'TRF-KURIR' } });
  const shipped = await call('PATCH', `/api/admin/orders/${id}`, { token: STAFF, body: { status: 'shipped', courier: 'JNE', waybill } });
  assert.equal(shipped.status, 200);
  return { number: o.number, id };
}

async function courierPost(body, { sign = SECRET } = {}) {
  const raw = Buffer.from(JSON.stringify(body));
  const headers = { 'Content-Type': 'application/json' };
  if (sign) headers['X-Signature'] = payments.signWebhook(raw, sign);
  const res = await fetch(base + '/api/shipping/webhook', { method: 'POST', headers, body: raw });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

test('webhook kurir menolak tanda tangan salah dan nomor resi tidak dikenal', async () => {
  await shippedOrder('kurir1@test.local', 'JNE-A1');
  assert.equal((await courierPost({ waybill: 'JNE-A1', status: 'in_transit' }, { sign: 'salah' })).status, 401);
  assert.equal((await courierPost({ waybill: 'TIDAK-ADA', status: 'in_transit' })).status, 404);
});

test('kejadian kurir dicatat, kejadian ganda diabaikan, dan pesanan tetap dikirim sampai diantar', async () => {
  const { number } = await shippedOrder('kurir2@test.local', 'JNE-B2');
  const at = '2026-11-18T09:00:00.000Z';
  const first = await courierPost({ waybill: 'JNE-B2', status: 'in_transit', at, location: 'Jayapura' });
  assert.equal(first.status, 200);
  assert.equal(first.json.duplicate, false);
  const again = await courierPost({ waybill: 'JNE-B2', status: 'in_transit', at, location: 'Jayapura' });
  assert.equal(again.json.duplicate, true);
  const order = app.store.read().orders.find((o) => o.number === number);
  assert.equal(order.status, 'shipped');
  assert.equal(order.shipment.events.length, 1);
  assert.equal(order.shipment.lastStatus, 'in_transit');
});

test('kurir melaporkan sudah diantar: pesanan berpindah ke diantar', async () => {
  const { number } = await shippedOrder('kurir3@test.local', 'JNE-C3');
  const r = await courierPost({ waybill: 'JNE-C3', status: 'delivered', at: '2026-11-18T12:00:00.000Z' });
  assert.equal(r.status, 200);
  const order = app.store.read().orders.find((o) => o.number === number);
  assert.equal(order.status, 'delivered');
});

test('pesanan terlambat: pemberitahuan dikirim sekali, dan muncul di daftar staf', async () => {
  const email = 'kurir4@test.local';
  const { number } = await shippedOrder(email, 'JNE-D4');
  // Mundurkan tanggal kirim agar sudah melewati estimasi.
  const old = new Date(Date.now() - 10 * 86400000).toISOString();
  app.store.update((db) => {
    const o = db.orders.find((x) => x.number === number);
    o.shipment.shippedAt = old;
    o.timeline.find((t) => t.status === 'shipped').at = old;
  });
  const sent1 = app.store.update((db) => notify.notifyLateOrders(db, new Date().toISOString()));
  assert.ok(sent1.includes(number));
  const again = app.store.update((db) => notify.notifyLateOrders(db, new Date().toISOString()));
  assert.equal(again.includes(number), false, 'pemberitahuan tidak dikirim dua kali');
  const mails = app.store.read().outbox.filter((m) => m.to === email && m.event === 'late');
  assert.equal(mails.length, 1);
  assert.match(mails[0].body, /terlambat/);

  const list = await call('GET', '/api/admin/late-orders', { token: STAFF });
  assert.equal(list.status, 200);
  const row = list.json.orders.find((x) => x.number === number);
  assert.ok(row);
  assert.equal(row.delay.days >= 5, true);
});

test('daftar pesanan terlambat hanya untuk staf', async () => {
  assert.equal((await call('GET', '/api/admin/late-orders')).status, 401);
});
