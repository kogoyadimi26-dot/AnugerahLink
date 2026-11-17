'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server');
const { invoicePdf } = require('../lib/invoice');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'al-faktur-'));
const OWNER = { email: 'pemilik-faktur@test.local', password: 'kata-sandi-faktur-123' };
const BUYER = { name: 'Dewi Kopi', email: 'dewi@kafe.test', password: 'kata-sandi-dewi-1', phone: '081211112222', company: 'Kafe Dewi', buyerType: 'roaster', consent: true };
let app; let base; let STAFF; let BUYER_TOKEN; let ORDER;

test.before(async () => {
  app = createApp({ dataFile: path.join(tmp, 'app.db'), owner: { name: 'Pemilik', ...OWNER } });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${app.server.address().port}`;
  STAFF = (await json('POST', '/api/auth/login', { body: OWNER })).json.token;
  BUYER_TOKEN = (await json('POST', '/api/buyer/signup', { body: BUYER })).json.token;
  const lot = (await json('GET', '/api/lots')).json.lots.find((l) => l.availableKg >= 30);
  ORDER = (await json('POST', '/api/orders', { token: BUYER_TOKEN, body: { lines: [{ lotCode: lot.code, kg: 30 }], customer: { name: BUYER.name, company: BUYER.company, buyerType: 'roaster', phone: BUYER.phone, email: BUYER.email, city: 'Jayapura', street: 'Jl. Sentani 12', npwp: '01.234.567.8-901.000' } } })).json.order;
});
test.after(async () => {
  await new Promise((r) => app.server.close(r));
  fs.rmSync(tmp, { recursive: true, force: true });
});

async function json(method, p, { body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(base + p, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => ({})), type: res.headers.get('content-type'), buf: null };
}
async function pdf(p, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(base + p, { headers });
  return { status: res.status, type: res.headers.get('content-type'), buf: Buffer.from(await res.arrayBuffer()) };
}

test('the PDF is well formed: header, cross-reference offsets and end marker', () => {
  const buf = invoicePdf({ number: 'ALO-2611-009', status: 'requested', createdAt: '2026-11-01T00:00:00Z', customer: { name: 'Uji', email: 'u@x.id', city: 'Jayapura' }, lines: [{ lotCode: 'AL-2611-001', tierLabel: 'Premium', kg: 30, pricePerKg: 250000, lineTotal: 7500000 }], subtotal: 7500000, shipping: 0, total: 7500000 });
  const text = buf.toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4'));
  assert.ok(text.trimEnd().endsWith('%%EOF'));
  const startxref = Number(/startxref\n(\d+)/.exec(text)[1]);
  assert.ok(text.slice(startxref).startsWith('xref'));
  const offsets = [...text.slice(startxref).matchAll(/^(\d{10}) 00000 n/gm)].map((m) => Number(m[1]));
  assert.ok(offsets.length > 3);
  offsets.forEach((off, i) => {
    assert.ok(text.slice(off).startsWith(`${i + 1} 0 obj`), `object ${i + 1} at offset ${off}`);
  });
  assert.ok(text.includes('ALO-2611-009'));
  assert.ok(text.includes('BELUM LUNAS'));
});

test('a guest downloads an invoice with order number and email; a wrong email gets nothing', async () => {
  const ok = await pdf(`/api/orders/${ORDER.number}/invoice?email=${encodeURIComponent(BUYER.email)}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.type, 'application/pdf');
  assert.equal(ok.buf.slice(0, 5).toString(), '%PDF-');
  const bad = await pdf(`/api/orders/${ORDER.number}/invoice?email=orang@lain.test`);
  assert.equal(bad.status, 404);
});

test('a buyer downloads only their own invoices', async () => {
  const own = await pdf(`/api/buyer/orders/${ORDER.number}/invoice`, BUYER_TOKEN);
  assert.equal(own.status, 200);
  const none = await pdf(`/api/buyer/orders/${ORDER.number}/invoice`);
  assert.equal(none.status, 401);
  const other = (await json('POST', '/api/buyer/signup', { body: { ...BUYER, email: 'lain@kafe.test' } })).json.token;
  assert.equal((await pdf(`/api/buyer/orders/${ORDER.number}/invoice`, other)).status, 404);
});

test('NPWP is optional but must look like a tax number; it appears on the buyer profile', async () => {
  const lot = (await json('GET', '/api/lots')).json.lots.find((l) => l.availableKg >= 30);
  const bad = await json('POST', '/api/orders', { body: { lines: [{ lotCode: lot.code, kg: 30 }], customer: { name: 'Uji', buyerType: 'roaster', phone: '081211112222', email: 'npwp@x.id', city: 'Jayapura', npwp: 'salah' } } });
  assert.equal(bad.status, 400);
  assert.ok(bad.json.error.fields.npwp);
  const me = await json('PATCH', '/api/buyer/me', { token: BUYER_TOKEN, body: { name: 'Dewi Kopi', phone: BUYER.phone, company: 'Kafe Dewi', buyerType: 'roaster', npwp: '01.234.567.8-901.000' } });
  assert.equal(me.json.buyer.npwp, '01.234.567.8-901.000');
});
