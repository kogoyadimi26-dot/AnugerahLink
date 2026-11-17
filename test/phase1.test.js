'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { LoginLimiter } = require('../lib/ratelimit');
const { productionProblems, DEFAULT_PASSWORD } = require('../lib/prodcheck');
const { createBackup, restoreBackup } = require('../lib/backup');
const { createApp } = require('../server');

// ---------- pembatas login ----------
test('login limiter: five failures lock an email for 15 minutes; success clears it', () => {
  let t = 1000000;
  const lim = new LoginLimiter({ now: () => t });
  for (let i = 0; i < 4; i++) lim.recordFailure('email', 'a@x.id');
  assert.equal(lim.retryAfter('email', 'a@x.id'), 0);
  lim.recordFailure('email', 'a@x.id');
  assert.equal(lim.retryAfter('email', 'a@x.id'), 900);
  t += 16 * 60000;
  assert.equal(lim.retryAfter('email', 'a@x.id'), 0);

  for (let i = 0; i < 3; i++) lim.recordFailure('email', 'b@x.id');
  lim.recordSuccess('email', 'b@x.id');
  for (let i = 0; i < 4; i++) lim.recordFailure('email', 'b@x.id');
  assert.equal(lim.retryAfter('email', 'b@x.id'), 0, 'success reset the count');
});

test('login limiter: old failures fall out of the 15-minute window', () => {
  let t = 0;
  const lim = new LoginLimiter({ now: () => t });
  for (let i = 0; i < 4; i++) lim.recordFailure('email', 'c@x.id');
  t += 16 * 60000;
  lim.recordFailure('email', 'c@x.id');
  assert.equal(lim.retryAfter('email', 'c@x.id'), 0);
});

test('login limiter: email and IP are counted separately', () => {
  const lim = new LoginLimiter({ now: () => 0 });
  for (let i = 0; i < 5; i++) lim.recordFailure('email', 'd@x.id');
  assert.equal(lim.retryAfter('email', 'd@x.id') > 0, true);
  assert.equal(lim.retryAfter('ip', '10.0.0.1'), 0);
});

// ---------- pemeriksaan produksi ----------
test('production check: nothing is required outside production', () => {
  assert.deepEqual(productionProblems({ NODE_ENV: 'development' }), []);
});

test('production check: refuses default, short or missing owner password and demo mode', () => {
  const bad = productionProblems({ NODE_ENV: 'production', OWNER_EMAIL: 'o@x.id', OWNER_PASSWORD: DEFAULT_PASSWORD, DEMO_ACCOUNTS: '1' });
  assert.ok(bad.some((p) => p.includes('contoh')));
  assert.ok(bad.some((p) => p.includes('DEMO_ACCOUNTS')));
  assert.ok(productionProblems({ NODE_ENV: 'production', OWNER_EMAIL: 'o@x.id', OWNER_PASSWORD: 'pendek' }).some((p) => p.includes('12 karakter')));
  assert.ok(productionProblems({ NODE_ENV: 'production' }).length >= 2);
  assert.deepEqual(productionProblems({ NODE_ENV: 'production', OWNER_EMAIL: 'o@x.id', OWNER_PASSWORD: 'kata-sandi-kuat-2026' }), []);
});

// ---------- cadangan dan pemulihan ----------
test('backup copies the database and photos, and restore brings them back', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'al-backup-'));
  try {
    const dataDir = path.join(dir, 'data');
    fs.mkdirSync(path.join(dataDir, 'photos'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'photos', 'p1.jpg'), 'x');
    const dataFile = path.join(dataDir, 'app.db');
    const conn = new DatabaseSync(dataFile);
    conn.exec(`CREATE TABLE t (v TEXT); INSERT INTO t VALUES ('asli');`);
    conn.close();

    const { dest, photoCount } = createBackup({ dataFile, backupRoot: path.join(dir, 'backups'), date: new Date(2026, 0, 2, 3, 4, 5) });
    assert.equal(photoCount, 1);
    assert.ok(fs.existsSync(path.join(dest, 'app.db')));
    assert.ok(fs.existsSync(path.join(dest, 'photos', 'p1.jpg')));

    // Data berubah, lalu dipulihkan dari cadangan.
    const c2 = new DatabaseSync(dataFile);
    c2.exec(`DELETE FROM t; INSERT INTO t VALUES ('berubah');`);
    c2.close();
    const { safetyCopy } = restoreBackup({ backupDir: dest, dataFile, date: new Date(2026, 0, 2, 3, 5, 0) });
    assert.ok(safetyCopy && fs.existsSync(path.join(safetyCopy, 'app.db')), 'old data kept in a safety copy');
    const c3 = new DatabaseSync(dataFile);
    assert.equal(c3.prepare('SELECT v FROM t').get().v, 'asli');
    c3.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- pembatas login di server ----------
test('server locks sign-in after repeated wrong passwords, even for the right password', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'al-lock-'));
  const OWNER = { email: 'kunci@test.local', password: 'kata-sandi-uji-123' };
  const app = createApp({ dataFile: path.join(tmp, 'app.db'), owner: { name: 'Uji', ...OWNER } });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const post = (password) => fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: OWNER.email, password }),
  });
  try {
    for (let i = 0; i < 5; i++) assert.equal((await post('salah-' + i)).status, 401);
    const locked = await post('salah-lagi');
    assert.equal(locked.status, 429);
    const body = await locked.json();
    assert.equal(body.error.code, 'too_many_attempts');
    assert.equal((await post(OWNER.password)).status, 429, 'right password is also refused while locked');
  } finally {
    await new Promise((r) => app.server.close(r));
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
