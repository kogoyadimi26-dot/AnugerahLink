'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server');
const { dispatchOutbox, providerStatus } = require('../lib/notify');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'al-kirim-'));
const OWNER = { email: 'pemilik-kirim@test.local', password: 'kata-sandi-kirim-123' };
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

async function paidOrder() {
  const lot = (await call('GET', '/api/lots')).json.lots.find((l) => l.availableKg >= 30);
  const order = (await call('POST', '/api/orders', { body: { lines: [{ lotCode: lot.code, kg: 30 }], customer: { name: 'Budi Kopi', company: '', buyerType: 'roaster', phone: '081298765432', email: 'budi@roaster.test', city: 'Surabaya', street: 'Jl. Raya 1' } } })).json.order;
  const id = (await call('GET', '/api/admin/orders', { token: STAFF })).json.orders.find((o) => o.number === order.number).id;
  await call('PATCH', `/api/admin/orders/${id}`, { token: STAFF, body: { status: 'confirmed' } });
  await call('PATCH', `/api/admin/orders/${id}`, { token: STAFF, body: { status: 'paid', paymentReference: 'TRF-1' } });
  return { ...order, id };
}

test('paying queues an email and a WhatsApp message; shipping stores courier and waybill and queues the tracking text', async () => {
  const order = await paidOrder();
  const box = (await call('GET', '/api/admin/outbox', { token: STAFF })).json.items;
  assert.ok(box.some((m) => m.orderNumber === order.number && m.event === 'paid' && m.channel === 'email'));
  assert.ok(box.some((m) => m.orderNumber === order.number && m.event === 'paid' && m.channel === 'whatsapp'));

  const bad = await call('PATCH', `/api/admin/orders/${order.id}`, { token: STAFF, body: { status: 'shipped', waybill: 'AB 12/3' } });
  assert.equal(bad.status, 400, 'waybill with spaces or slashes is refused');

  const shipped = await call('PATCH', `/api/admin/orders/${order.id}`, { token: STAFF, body: { status: 'shipped', courier: 'JNE', waybill: 'JNE123456' } });
  assert.equal(shipped.status, 200);
  const track = await call('GET', `/api/orders/${order.number}?email=budi@roaster.test`);
  assert.equal(track.json.order.shipment.waybill, 'JNE123456');
  const box2 = (await call('GET', '/api/admin/outbox', { token: STAFF })).json.items;
  const msg = box2.find((m) => m.orderNumber === order.number && m.event === 'shipped' && m.channel === 'email');
  assert.ok(msg && msg.subject.includes(order.number));
});

test('without a provider, messages wait in the queue; with one, they are sent and marked', async () => {
  assert.deepEqual(providerStatus({}), { email: false, whatsapp: false });
  const store = app.store;
  const before = (store.read().outbox || []).filter((m) => m.status === 'queued').length;
  const none = await dispatchOutbox(store, {}, async () => { throw new Error('tidak boleh dipanggil'); });
  assert.equal(none.sent, 0);
  assert.equal((store.read().outbox || []).filter((m) => m.status === 'queued').length, before, 'nothing changed without a provider');

  const calls = [];
  const fakeFetch = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { ok: true, status: 200 }; };
  const env = { EMAIL_API_URL: 'https://mail.test/send', EMAIL_API_KEY: 'k', EMAIL_FROM: 'toko@anugerahlink.id', WA_API_URL: 'https://wa.test/send', WA_API_TOKEN: 't' };
  const sent = await dispatchOutbox(store, env, fakeFetch);
  assert.ok(sent.sent > 0);
  assert.ok(calls.some((c) => c.url === 'https://mail.test/send' && c.body.to[0] === 'budi@roaster.test'));
  assert.equal((store.read().outbox || []).filter((m) => m.status === 'queued' && m.channel === 'email').length, 0);
});
