'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server');
const { signupAndLogin } = require('./support/signup');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'al-verify-'));
let app; let base;

test.before(async () => {
  app = createApp({ dataFile: path.join(tmp, 'app.db'), owner: { name: 'Pemilik', email: 'pemilik-verify@test.local', password: 'kata-sandi-pemilik-123' } });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${app.server.address().port}`;
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

const SIGNUP = { name: 'Dewi Kopi', email: 'dewi@kafe.test', password: 'kata-sandi-dewi-1', phone: '081234567891', company: 'Kafe Dewi', buyerType: 'specialty_cafe', consent: true };

// Tautan dalam email di antrean. Mengembalikan token dari tautan terakhir untuk alamat ini dan jenis email.
function latestToken(email, event) {
  const items = app.store.read().outbox.filter((m) => m.to === email && m.event === event);
  const last = items[items.length - 1];
  const match = last && /token=([0-9a-f]{64})/.exec(last.body);
  return match ? match[1] : null;
}

test('signup mengirim email konfirmasi dengan tautan yang berisi token', async () => {
  const r = await call('POST', '/api/buyer/signup', { body: SIGNUP });
  assert.equal(r.status, 202);
  assert.equal(Boolean(app.store.read().buyers.find((b) => b.email === SIGNUP.email).emailVerifiedAt), false);
  const item = app.store.read().outbox.find((m) => m.to === SIGNUP.email && m.event === 'verify');
  assert.ok(item, 'email konfirmasi harus masuk antrean');
  assert.match(item.body, /#\/akun\/verifikasi\?token=[0-9a-f]{64}/);
  // Token tidak disimpan dalam bentuk asli, hanya hash.
  const stored = app.store.read().buyers.find((b) => b.email === SIGNUP.email);
  assert.ok(!JSON.stringify(stored).includes(latestToken(SIGNUP.email, 'verify')));
});

test('konfirmasi email dengan token yang benar menandai akun terverifikasi, lalu tautan tidak bisa dipakai lagi', async () => {
  const token = latestToken(SIGNUP.email, 'verify');
  const ok = await call('POST', '/api/buyer/verify/confirm', { body: { token } });
  assert.equal(ok.status, 200);
  const login = await call('POST', '/api/buyer/login', { body: { email: SIGNUP.email, password: SIGNUP.password } });
  assert.equal(login.json.buyer.emailVerified, true);
  const again = await call('POST', '/api/buyer/verify/confirm', { body: { token } });
  assert.equal(again.status, 400);
});

test('token konfirmasi palsu ditolak', async () => {
  const r = await call('POST', '/api/buyer/verify/confirm', { body: { token: 'a'.repeat(64) } });
  assert.equal(r.status, 400);
  assert.equal((await call('POST', '/api/buyer/verify/confirm', { body: {} })).status, 400);
});

test('kirim ulang konfirmasi butuh masuk dan dibatasi satu menit sekali', async () => {
  assert.equal((await call('POST', '/api/buyer/verify/send', { body: {} })).status, 401);
  const token = (await call('POST', '/api/buyer/login', { body: { email: SIGNUP.email, password: SIGNUP.password } })).json.token;
  // Akun sudah terverifikasi, jadi tidak ada email baru.
  const before = app.store.read().outbox.length;
  const r = await call('POST', '/api/buyer/verify/send', { token, body: {} });
  assert.equal(r.status, 200);
  assert.equal(app.store.read().outbox.length, before);
});

test('kirim ulang dibatasi untuk akun yang belum terverifikasi', async () => {
  const NEW = { ...SIGNUP, email: 'lusi@kafe.test', name: 'Lusi Kafe' };
  const token = (await signupAndLogin(call, NEW)).token;
  // Signup baru saja mengirim email, jadi kirim ulang langsung harus ditolak.
  assert.equal((await call('POST', '/api/buyer/verify/send', { token, body: {} })).status, 429);
  // Setelah satu menit, kirim ulang diizinkan lalu kembali dibatasi.
  app.store.update((db) => {
    const b = db.buyers.find((x) => x.email === NEW.email);
    b.emailVerify.sentAt = new Date(Date.now() - 2 * 60000).toISOString();
  });
  const before = app.store.read().outbox.length;
  assert.equal((await call('POST', '/api/buyer/verify/send', { token, body: {} })).status, 200);
  assert.equal(app.store.read().outbox.length, before + 1);
  assert.equal((await call('POST', '/api/buyer/verify/send', { token, body: {} })).status, 429);
});

test('lupa kata sandi: alamat tidak terdaftar dijawab sama dan tidak mengirim email', async () => {
  const before = app.store.read().outbox.length;
  const r = await call('POST', '/api/buyer/password/forgot', { body: { email: 'tidakada@test.local' } });
  assert.equal(r.status, 200);
  assert.match(r.json.message, /Jika email terdaftar/);
  assert.equal(app.store.read().outbox.length, before);
});

test('reset kata sandi: tautan berfungsi, sesi lama berakhir, dan tautan hanya sekali pakai', async () => {
  const other = await call('POST', '/api/buyer/login', { body: { email: SIGNUP.email, password: SIGNUP.password } });
  assert.equal(other.status, 200);
  const req = await call('POST', '/api/buyer/password/forgot', { body: { email: SIGNUP.email } });
  assert.equal(req.status, 200);
  const token = latestToken(SIGNUP.email, 'reset');
  assert.ok(token, 'email reset harus masuk antrean');

  const weak = await call('POST', '/api/buyer/password/reset', { body: { token, password: 'pendek' } });
  assert.equal(weak.status, 400);
  const done = await call('POST', '/api/buyer/password/reset', { body: { token, password: 'kata-sandi-baru-2' } });
  assert.equal(done.status, 200);

  assert.equal((await call('GET', '/api/buyer/me', { token: other.json.token })).status, 401, 'sesi lama harus berakhir');
  assert.equal((await call('POST', '/api/buyer/login', { body: { email: SIGNUP.email, password: SIGNUP.password } })).status, 401);
  assert.equal((await call('POST', '/api/buyer/login', { body: { email: SIGNUP.email, password: 'kata-sandi-baru-2' } })).status, 200);
  assert.equal((await call('POST', '/api/buyer/password/reset', { body: { token, password: 'kata-sandi-ketiga-3' } })).status, 400);
});

test('tautan reset yang sudah kedaluwarsa ditolak', async () => {
  await call('POST', '/api/buyer/password/forgot', { body: { email: 'dewi@kafe.test' } });
  const token = latestToken('dewi@kafe.test', 'reset');
  app.store.update((db) => {
    const b = db.buyers.find((x) => x.email === 'dewi@kafe.test');
    b.passwordReset.expiresAt = new Date(Date.now() - 1000).toISOString();
  });
  const r = await call('POST', '/api/buyer/password/reset', { body: { token, password: 'kata-sandi-kempat-4' } });
  assert.equal(r.status, 400);
});

test('permintaan lupa kata sandi dibatasi bila terlalu sering', async () => {
  let limited = false;
  for (let i = 0; i < 40 && !limited; i += 1) {
    const r = await call('POST', '/api/buyer/password/forgot', { body: { email: `banyak${i}@test.local` } });
    if (r.status === 429) limited = true;
  }
  assert.ok(limited, 'harus ada batas permintaan');
});
