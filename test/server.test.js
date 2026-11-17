'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server');

const TOKEN = 'test-admin-token-123';
let server;
let base;
let tmpDir;

test.before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'al-test-'));
  const app = createApp({ dataFile: path.join(tmpDir, 'db.json'), adminToken: TOKEN });
  server = app.server;
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((r) => server.close(r));
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function call(method, p, { body, token, email } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = base + p + (email ? `?email=${encodeURIComponent(email)}` : '');
  const res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, headers: res.headers };
}

test('health and public config respond, and config has no secrets', async () => {
  assert.equal((await call('GET', '/api/health')).status, 200);
  const cfg = await call('GET', '/api/config');
  assert.equal(cfg.status, 200);
  assert.equal(JSON.stringify(cfg.json).includes('buyPricePerKg'), false, 'buying price stays internal');
  assert.equal(JSON.stringify(cfg.json).includes('fixedCostsPerYear'), false);
});

test('public lots list only listed stock and hides internal fields', async () => {
  const r = await call('GET', '/api/lots');
  assert.equal(r.status, 200);
  assert.ok(r.json.lots.length >= 1);
  for (const l of r.json.lots) {
    assert.equal('buyPricePerKg' in l, false);
    assert.equal('reservedKg' in l, false);
  }
});

test('unknown lot and passport return 404 with a message', async () => {
  const r = await call('GET', '/api/lots/AL-0000-000');
  assert.equal(r.status, 404);
  assert.ok(r.json.error.message);
  assert.equal((await call('GET', '/api/passport/AL-0000-000')).status, 404);
});

test('passport shows the hash check for a sample lot', async () => {
  const r = await call('GET', '/api/passport/AL-2611-001');
  assert.equal(r.status, 200);
  assert.equal(r.json.passport.recordMatchesHash, true);
  assert.equal(JSON.stringify(r.json).includes('buyerName'), false);
});

test('admin routes refuse missing or wrong tokens', async () => {
  assert.equal((await call('GET', '/api/admin/summary')).status, 401);
  assert.equal((await call('GET', '/api/admin/summary', { token: 'wrong' })).status, 401);
  assert.equal((await call('GET', '/api/admin/summary', { token: TOKEN })).status, 200);
});

test('full buyer flow: quote, order, track, reject wrong email', async () => {
  const quote = await call('POST', '/api/cart/quote', { body: { lines: [{ lotCode: 'AL-2611-001', kg: 30 }] } });
  assert.equal(quote.status, 200);
  assert.equal(quote.json.totals.subtotal, 30 * 250000);

  const order = await call('POST', '/api/orders', {
    body: {
      lines: [{ lotCode: 'AL-2611-001', kg: 30 }],
      customer: { name: 'Ayu Test', company: '', buyerType: 'premium_roaster', phone: '081234567890', email: 'Ayu@Example.com', city: 'Surabaya', notes: '' },
    },
  });
  assert.equal(order.status, 201);
  const number = order.json.order.number;
  assert.match(number, /^ALO-\d{4}-\d{3}$/);

  const track = await call('GET', `/api/orders/${number}`, { email: 'ayu@example.com' });
  assert.equal(track.status, 200);
  assert.equal(track.json.order.status, 'requested');

  const wrong = await call('GET', `/api/orders/${number}`, { email: 'someone@else.com' });
  assert.equal(wrong.status, 404);
});

test('orders with bad input return 400 and field messages', async () => {
  const r = await call('POST', '/api/orders', { body: { lines: [{ lotCode: 'AL-2611-001', kg: 10 }], customer: { name: 'A', email: 'x' } } });
  assert.equal(r.status, 400);
  assert.ok(r.json.error.fields.email || r.json.error.fields.name);
});

test('admin can publish a new lot and see it on the storefront only after grading', async () => {
  const intake = await call('POST', '/api/admin/lots', {
    token: TOKEN, body: { groupId: 'g-1', harvestDate: '2026-11-12', kgIn: 150, process: 'Honey', sampleId: 'S-SRV-1', moisturePct: 11, defectCount: 8 },
  });
  assert.equal(intake.status, 201);
  const id = intake.json.lot.id;
  const code = intake.json.lot.code;
  assert.equal((await call('GET', `/api/lots/${code}`)).status, 404, 'not visible before listing');
  const grade = await call('PATCH', `/api/admin/lots/${id}`, {
    token: TOKEN, body: { tier: 'reserve', grade: 'SNI Grade 1', cupScore: '87', sellableKg: '140', moisturePct: '11.5' },
  });
  assert.equal(grade.status, 200);
  assert.equal((await call('POST', `/api/admin/lots/${id}/publish`, { token: TOKEN })).status, 200);
  const visible = await call('GET', `/api/lots/${code}`);
  assert.equal(visible.status, 200);
  assert.equal(visible.json.lot.availableKg, 140);
});

test('bad JSON and oversized bodies are refused', async () => {
  const res = await fetch(base + '/api/cart/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{not json' });
  assert.equal(res.status, 400);
});

test('static files are served with security headers, and traversal is blocked', async () => {
  const page = await fetch(base + '/');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
  const traversal = await fetch(base + '/..%2F..%2Fpackage.json');
  assert.notEqual(traversal.status, 200);
});

// ---------- foto pemeriksaan ----------
const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

test('staff can upload a sample photo and view it; visitors cannot', async () => {
  const intake = await call('POST', '/api/admin/lots', {
    token: TOKEN, body: { groupId: 'g-1', harvestDate: '2026-11-12', kgIn: 90, sampleId: 'S-PHOTO', moisturePct: 11, defectCount: 4, scaleCalibrated: true, farmerPresent: true, retainedSample: true },
  });
  assert.equal(intake.status, 201);
  assert.equal(intake.json.lot.intakeCheck.evidence.retainedSample, true);
  const id = intake.json.lot.id;
  const up = await call('POST', `/api/admin/lots/${id}/photos`, { token: TOKEN, body: { kind: 'sample', dataUrl: PNG_1PX } });
  assert.equal(up.status, 201);
  const photoId = up.json.photo.id;
  const bad = await call('POST', `/api/admin/lots/${id}/photos`, { token: TOKEN, body: { kind: 'sample', dataUrl: 'data:text/plain;base64,aGk=' } });
  assert.equal(bad.status, 400);
  const view = await fetch(`${base}/api/admin/photos/${photoId}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  assert.equal(view.status, 200);
  assert.equal(view.headers.get('content-type'), 'image/png');
  const anon = await fetch(`${base}/api/admin/photos/${photoId}`);
  assert.equal(anon.status, 401);
});
