'use strict';

// Sesi berbasis cookie, perlindungan CSRF, dan pembatas percobaan yang tersimpan di basis data.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { createApp } = require('../server');
const { LoginLimiter } = require('../lib/ratelimit');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'al-sesi-'));
const OWNER = { email: 'pemilik-sesi@test.local', password: 'kata-sandi-sesi-123' };
let app; let base;

test.before(async () => {
  app = createApp({ dataFile: path.join(tmp, 'app.db'), owner: { name: 'Pemilik', ...OWNER } });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${app.server.address().port}`;
});
test.after(async () => {
  await new Promise((r) => app.server.close(r));
  fs.rmSync(tmp, { recursive: true, force: true });
});

// Permintaan mentah, agar header Origin dan Cookie bisa diatur persis.
function send(method, p, headers = {}, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(base + p);
    const h = { ...headers };
    if (body !== undefined) h['Content-Type'] = 'application/json';
    const req = http.request({ host: u.hostname, port: u.port, path: u.pathname, method, headers: h }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let json = {};
        try { json = JSON.parse(data); } catch { /* bukan JSON */ }
        resolve({ status: res.statusCode, headers: res.headers, json });
      });
    });
    req.on('error', reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

test('staff login sets an HttpOnly, SameSite=Strict session cookie', async () => {
  const login = await send('POST', '/api/auth/login', {}, OWNER);
  assert.equal(login.status, 200);
  const cookie = [].concat(login.headers['set-cookie'] || []).find((c) => c.startsWith('al_staff='));
  assert.ok(cookie, 'al_staff cookie is set');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
});

test('a session cookie alone is enough to read, and writes need the fetch header', async () => {
  const login = await send('POST', '/api/auth/login', {}, OWNER);
  const jar = [].concat(login.headers['set-cookie']).find((c) => c.startsWith('al_staff=')).split(';')[0];

  assert.equal((await send('GET', '/api/admin/orders', { Cookie: jar })).status, 200, 'cookie reads work');
  assert.equal((await send('POST', '/api/auth/logout', { Cookie: jar })).status, 403, 'cookie write without header is refused (CSRF)');
  assert.equal((await send('POST', '/api/auth/logout', { Cookie: jar, 'X-Requested-With': 'fetch' })).status, 200, 'cookie write with header works');
  assert.equal((await send('GET', '/api/admin/orders', { Cookie: jar })).status, 401, 'logout ends the cookie session');
});

test('a request from another origin is refused even with a valid cookie', async () => {
  const login = await send('POST', '/api/auth/login', {}, OWNER);
  const jar = [].concat(login.headers['set-cookie']).find((c) => c.startsWith('al_staff=')).split(';')[0];
  const foreign = await send('GET', '/api/admin/orders', { Cookie: jar, Origin: 'https://evil.example' });
  assert.equal(foreign.status, 403);
  assert.equal(foreign.json.error.code, 'bad_origin');
  const sameOrigin = await send('GET', '/api/admin/orders', { Cookie: jar, Origin: base });
  assert.equal(sameOrigin.status, 200);
});

test('a bearer token still works without any cookie or fetch header (scripts)', async () => {
  const token = (await send('POST', '/api/auth/login', {}, OWNER)).json.token;
  assert.equal((await send('GET', '/api/admin/orders', { Authorization: `Bearer ${token}` })).status, 200);
  assert.equal((await send('POST', '/api/auth/logout', { Authorization: `Bearer ${token}` })).status, 200);
});

// Penyimpanan palsu yang sama bentuknya dengan lib/sqlstore.js: read() memberi basis data hidup, update(fn) menjalankan fn.
function memoryStore() {
  const db = { rateLimits: {} };
  return { db, read: () => db, update: (fn) => fn(db) };
}

test('login limits kept in the database still apply to a new process and expire on time', () => {
  const store = memoryStore();
  let t = Date.parse('2026-11-18T10:00:00Z');
  const before = new LoginLimiter({ store, now: () => t });
  for (let i = 0; i < 5; i++) before.recordFailure('email', 'rina@kafe.test');
  assert.ok(before.retryAfter('email', 'rina@kafe.test') > 0, 'locked after five failures');

  const restarted = new LoginLimiter({ store, now: () => t });
  assert.ok(restarted.retryAfter('email', 'rina@kafe.test') > 0, 'lock survives a restart');
  assert.ok(store.db.rateLimits['email:rina@kafe.test'], 'state is in the database, not only in memory');

  t += 16 * 60000;
  assert.equal(restarted.retryAfter('email', 'rina@kafe.test'), 0, 'lock ends after 15 minutes');
});

test('a successful sign-in clears the failure count for that email', () => {
  const store = memoryStore();
  const t = Date.parse('2026-11-18T10:00:00Z');
  const limiter = new LoginLimiter({ store, now: () => t });
  for (let i = 0; i < 4; i++) limiter.recordFailure('email', 'lusi@kafe.test');
  limiter.recordSuccess('email', 'lusi@kafe.test');
  limiter.recordFailure('email', 'lusi@kafe.test');
  assert.equal(limiter.retryAfter('email', 'lusi@kafe.test'), 0, 'one failure after success does not lock');
});
