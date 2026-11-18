'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const payments = require('../lib/payments');
const buyers = require('../lib/buyers');
const backup = require('../lib/backup');
const { ApiError } = require('../lib/validate');

const SECRET = 'rahasia-uji-123';
const BODY = Buffer.from('{"providerRef":"sbx-1","amount":100}');

test('webhook: a fresh, correctly signed message is accepted', () => {
  const now = Date.now();
  const ts = Math.floor(now / 1000);
  const sig = payments.signWebhook(BODY, SECRET, ts);
  assert.equal(payments.verifyWebhook(BODY, sig, SECRET, String(ts), now), true);
});

test('webhook: a replayed message older than the window is refused', () => {
  const now = Date.now();
  const old = Math.floor(now / 1000) - payments.WEBHOOK_MAX_AGE_SECONDS - 60;
  const sig = payments.signWebhook(BODY, SECRET, old);
  assert.equal(payments.verifyWebhook(BODY, sig, SECRET, String(old), now), false);
});

test('webhook: a message dated in the far future is refused too', () => {
  const now = Date.now();
  const future = Math.floor(now / 1000) + payments.WEBHOOK_MAX_AGE_SECONDS + 60;
  const sig = payments.signWebhook(BODY, SECRET, future);
  assert.equal(payments.verifyWebhook(BODY, sig, SECRET, String(future), now), false);
});

test('webhook: a changed body, a changed timestamp, or a missing timestamp is refused', () => {
  const now = Date.now();
  const ts = Math.floor(now / 1000);
  const sig = payments.signWebhook(BODY, SECRET, ts);
  assert.equal(payments.verifyWebhook(Buffer.from('{"amount":1}'), sig, SECRET, String(ts), now), false, 'tampered body');
  assert.equal(payments.verifyWebhook(BODY, sig, SECRET, String(ts + 1), now), false, 'timestamp not covered by the signature');
  assert.equal(payments.verifyWebhook(BODY, sig, SECRET, undefined, now), false, 'missing timestamp');
  assert.equal(payments.verifyWebhook(BODY, sig, SECRET, '12abc', now), false, 'timestamp must be digits');
});

test('webhook: malformed signatures are refused without throwing', () => {
  const ts = Math.floor(Date.now() / 1000);
  assert.equal(payments.verifyWebhook(BODY, 'deadbeef', SECRET, String(ts)), false, 'too short');
  assert.equal(payments.verifyWebhook(BODY, 'zz'.repeat(32), SECRET, String(ts)), false, 'not hex');
  assert.equal(payments.verifyWebhook(BODY, 'a'.repeat(64), '', String(ts)), false, 'no secret configured');
});

test('password: the buyer minimum is now 10 characters', () => {
  const now = new Date().toISOString();
  const body = { name: 'Budi Uji', email: 'pendek@test.local', phone: '081234567890', company: 'Kafe', buyerType: 'roaster', password: 'sembilan9', consent: true };
  assert.throws(() => buyers.signupBuyer({ buyers: [] }, body, now), (e) => e instanceof ApiError && e.fields && e.fields.password === 'Kata sandi minimal 10 karakter.');
  const ok = buyers.signupBuyer({ buyers: [] }, { ...body, password: 'sepuluh-10' }, now);
  assert.ok(ok.buyer && ok.token);
});

test('backup: a destination that could break out of the SQL string is refused', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bk-'));
  const dataFile = path.join(root, 'app.db');
  fs.writeFileSync(dataFile, 'placeholder');
  const bad = path.join(root, "nakal'; DROP TABLE records; --");
  assert.throws(() => backup.createBackup({ dataFile, backupRoot: bad }), /karakter yang tidak diizinkan/);
  assert.equal(fs.existsSync(bad), false, 'nothing is created for a refused destination');
  fs.rmSync(root, { recursive: true, force: true });
});
