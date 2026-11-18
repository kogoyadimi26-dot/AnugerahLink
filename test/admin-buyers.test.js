'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server');
const { signupAndLogin } = require('./support/signup');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'al-admin-pembeli-'));
const OWNER = { email: 'pemilik-pembeli-staf@test.local', password: 'kata-sandi-pemilik-123' };
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

const BUYER = { name: 'Rudi Roaster', email: 'rudi@roaster.test', password: 'kata-sandi-rudi-1', phone: '081234567892', company: 'Roaster Rudi', buyerType: 'roaster', consent: true };
let BUYER_ID;

test('daftar pembeli hanya bisa dilihat staf yang sudah masuk', async () => {
  assert.equal((await call('GET', '/api/admin/buyers')).status, 401);
  const signup = await call('POST', '/api/buyer/signup', { body: BUYER });
  assert.equal(signup.status, 202);
  const list = await call('GET', '/api/admin/buyers', { token: STAFF });
  assert.equal(list.status, 200);
  const row = list.json.buyers.find((b) => b.email === BUYER.email);
  assert.ok(row);
  BUYER_ID = row.id;
  assert.equal(row.emailVerified, false);
  assert.equal(row.orderCount, 0);
  assert.equal('passwordHash' in row, false, 'hash kata sandi tidak boleh keluar');
  assert.equal(JSON.stringify(list.json).includes('Hash'), false, 'hash tidak boleh keluar');
});

test('pencarian menyaring berdasarkan nama, email, dan perusahaan', async () => {
  const byName = await call('GET', '/api/admin/buyers?q=rudi', { token: STAFF });
  assert.ok(byName.json.buyers.some((b) => b.email === BUYER.email));
  const byCompany = await call('GET', '/api/admin/buyers?q=roaster%20rudi', { token: STAFF });
  assert.ok(byCompany.json.buyers.some((b) => b.email === BUYER.email));
  const none = await call('GET', '/api/admin/buyers?q=tidakada-xyz', { token: STAFF });
  assert.equal(none.json.buyers.length, 0);
});

test('staf menandai email terverifikasi, tercatat di riwayat, dan tidak bisa diulang', async () => {
  const r = await call('POST', `/api/admin/buyers/${BUYER_ID}/verify`, { token: STAFF, body: {} });
  assert.equal(r.status, 200);
  assert.equal(r.json.buyer.emailVerified, true);
  const again = await call('POST', `/api/admin/buyers/${BUYER_ID}/verify`, { token: STAFF, body: {} });
  assert.equal(again.status, 409);
  const audit = app.store.read().audit.filter((a) => a.action.includes(`/api/admin/buyers/${BUYER_ID}/verify`));
  assert.ok(audit.length >= 1, 'tindakan staf harus tercatat');
  assert.match(audit[0].detail, /ditandai terverifikasi oleh staf/);
});

test('staf mengirim tautan atur ulang ke email pembeli, dengan batas waktu', async () => {
  const r = await call('POST', `/api/admin/buyers/${BUYER_ID}/reset`, { token: STAFF, body: {} });
  assert.equal(r.status, 200);
  const sent = app.store.read().outbox.filter((m) => m.to === BUYER.email && m.event === 'reset');
  assert.equal(sent.length, 1);
  assert.match(sent[0].body, /#\/akun\/reset\?token=[0-9a-f]{64}/);
  const again = await call('POST', `/api/admin/buyers/${BUYER_ID}/reset`, { token: STAFF, body: {} });
  assert.equal(again.status, 429);
});

test('akun yang tidak ada ditolak', async () => {
  assert.equal((await call('POST', '/api/admin/buyers/tidak-ada/verify', { token: STAFF, body: {} })).status, 404);
  assert.equal((await call('POST', '/api/admin/buyers/tidak-ada/reset', { token: STAFF, body: {} })).status, 404);
});
