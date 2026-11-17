'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'al-verify-passport-'));
let app; let base;

test.before(async () => {
  app = createApp({ dataFile: path.join(tmp, 'app.db'), owner: { name: 'Pemilik', email: 'pemilik-verifikasi@test.local', password: 'kata-sandi-pemilik-123' } });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${app.server.address().port}`;
});
test.after(async () => {
  await new Promise((r) => app.server.close(r));
  fs.rmSync(tmp, { recursive: true, force: true });
});

async function call(method, p) {
  const res = await fetch(base + p, { method });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

test('pemeriksaan publik: hash yang benar cocok, hash salah tidak cocok', async () => {
  const passport = (await call('GET', '/api/passport/AL-2611-001')).json.passport;
  const ok = await call('GET', `/api/verify?code=AL-2611-001&hash=${passport.hash}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.json.result, 'cocok');
  const wrong = await call('GET', `/api/verify?code=AL-2611-001&hash=${'0'.repeat(64)}`);
  assert.equal(wrong.json.result, 'tidak_cocok');
});

test('pemeriksaan publik: kode huruf kecil dan spasi tetap dikenali', async () => {
  const passport = (await call('GET', '/api/passport/AL-2611-001')).json.passport;
  const r = await call('GET', `/api/verify?code=%20al-2611-001%20&hash=${passport.hash.toUpperCase()}`);
  assert.equal(r.json.result, 'cocok');
});

test('pemeriksaan publik: data yang berubah setelah diterbitkan terdeteksi', async () => {
  const passport = (await call('GET', '/api/passport/AL-2611-001')).json.passport;
  app.store.update((db) => {
    const lot = db.lots.find((l) => l.code === 'AL-2611-001');
    lot.cupScore = 60;
  });
  const r = await call('GET', `/api/verify?code=AL-2611-001&hash=${passport.hash}`);
  assert.equal(r.json.result, 'data_berubah');
  app.store.update((db) => {
    db.lots.find((l) => l.code === 'AL-2611-001').cupScore = 85;
  });
});

test('kode yang tidak diterbitkan atau tidak dikenal ditolak', async () => {
  assert.equal((await call('GET', '/api/verify?code=TIDAK-ADA&hash=abc')).status, 404);
  assert.equal((await call('GET', '/api/verify?hash=abc')).status, 404);
});
