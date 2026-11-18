'use strict';

// Masuk cepat: tautan sekali pakai lewat email, dan Google yang nonaktif tanpa kunci.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'al-masuk-'));
const OWNER = { email: 'pemilik-masuk@test.local', password: 'kata-sandi-pemilik-9' };
const BUYER = { name: 'Rina Masuk', email: 'rina-masuk@test.local', password: 'kata-sandi-masuk-1', phone: '081234567890', company: 'Kafe Masuk', buyerType: 'specialty_cafe', consent: true };
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

async function call(method, p, { body, token, headers = {} } = {}) {
  const h = { ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  const res = await fetch(base + p, { method, headers: h, redirect: 'manual', body: body !== undefined ? JSON.stringify(body) : undefined });
  return { status: res.status, headers: res.headers, json: await res.json().catch(() => ({})) };
}

function latestLoginToken(email) {
  const item = app.store.read().outbox.filter((m) => m.to === email && m.event === 'login').pop();
  const match = item && /token=([0-9a-f]{64})/.exec(item.body);
  return match ? match[1] : null;
}

test('a registered buyer gets a one-time sign-in link by email and signs in with it', async () => {
  await call('POST', '/api/buyer/signup', { body: BUYER });
  const req = await call('POST', '/api/buyer/login-link', { body: { email: BUYER.email } });
  assert.equal(req.status, 200);
  const token = latestLoginToken(BUYER.email);
  assert.ok(token, 'the link is in the outbox');

  const ok = await call('POST', '/api/buyer/login-link/consume', { body: { token } });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.buyer.email, BUYER.email);
  const cookie = [].concat(ok.headers.get('set-cookie') || '').find((c) => c && c.startsWith('al_buyer='));
  assert.ok(cookie, 'the session cookie is set');
  assert.match(cookie, /HttpOnly/);

  const again = await call('POST', '/api/buyer/login-link/consume', { body: { token } });
  assert.equal(again.status, 400, 'the same link cannot be used twice');
});

test('a link request does not reveal whether the email is registered', async () => {
  const before = app.store.read().outbox.length;
  const unknown = await call('POST', '/api/buyer/login-link', { body: { email: 'tidak-ada@test.local' } });
  assert.equal(unknown.status, 200);
  assert.equal(app.store.read().outbox.length, before, 'no email is sent for an unknown address');
  const known = await call('POST', '/api/buyer/login-link', { body: { email: BUYER.email } });
  assert.equal(known.json.message, unknown.json.message, 'same answer for both');
});

test('a made-up or expired link is refused', async () => {
  const r = await call('POST', '/api/buyer/login-link/consume', { body: { token: 'a'.repeat(64) } });
  assert.equal(r.status, 400);
});

test('Google sign-in stays off until its keys and public address are set', async () => {
  const status = await call('GET', '/api/buyer/google/status');
  assert.equal(status.status, 200);
  assert.equal(status.json.enabled, false);
  const start = await call('GET', '/api/buyer/google/start');
  assert.equal(start.status, 404);
});
