'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server');
const rules = require('../lib/rules');
const config = require('../config/business');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'al-rules-'));
const OWNER = { email: 'pemilik-rules@test.local', password: 'kata-sandi-pemilik-123' };
let app; let base; let TOKEN;

test.before(async () => {
  app = createApp({ dataFile: path.join(tmp, 'app.db'), owner: { name: 'Pemilik', ...OWNER } });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${app.server.address().port}`;
  TOKEN = (await call('POST', '/api/auth/login', { body: OWNER })).json.token;
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

// Isi formulir dengan nilai dasar, dalam bentuk yang dikirim admin (persen untuk susut dan campuran).
function baseForm() { return { ...rules.toForm(rules.BASE), reason: 'Uji perubahan aturan' }; }

test('nilai dasar lolos validasi dan dikonversi ke pecahan untuk susut dan campuran', () => {
  const { values } = rules.validateRules(baseForm());
  assert.equal(values.sortingLossPct, 0.05);
  assert.equal(values.defaultMix.premium, 0.25);
  assert.equal(values.buyPricePerKg, 120000);
});

test('nilai di luar batas, bukan kelipatan, atau campuran tidak berjumlah 100 ditolak', () => {
  const input = baseForm();
  input.buyPricePerKg = 120500;       // bukan kelipatan Rp1.000
  input.sortingLossPct = 75;          // di atas 50%
  input.defaultMix = { reserve: 10, premium: 10, verified: 10, local: 10 }; // 40%
  try {
    rules.validateRules(input);
    assert.fail('seharusnya ditolak');
  } catch (err) {
    assert.equal(err.status, 400);
    assert.match(err.fields.buyPricePerKg, /kelipatan 1000/);
    assert.match(err.fields.sortingLossPct, /antara 0 dan 50/);
    assert.match(err.fields.defaultMix, /berjumlah 100%/);
  }
});

test('alasan wajib minimal 5 karakter', () => {
  const input = baseForm();
  input.reason = 'ok';
  assert.throws(() => rules.validateRules(input), (err) => err.status === 400 && /Tulis alasan/.test(err.fields.reason));
});

test('applyRules menerapkan nilai tersimpan ke konfigurasi yang dipakai perhitungan', () => {
  const saved = { ...rules.rulesFor({}), buyPricePerKg: 125000, minOrderKg: 40 };
  rules.applyRules({ rules: saved });
  assert.equal(config.buyPricePerKg, 125000);
  assert.equal(config.minOrderKg, 40);
  rules.applyRules({});
  assert.equal(config.buyPricePerKg, rules.BASE.buyPricePerKg);
  assert.equal(config.minOrderKg, rules.BASE.minOrderKg);
});

test('GET dan PUT aturan hanya untuk yang berhak', async () => {
  assert.equal((await call('GET', '/api/admin/rules')).status, 401);
  assert.equal((await call('PUT', '/api/admin/rules', { body: baseForm() })).status, 401);
});

test('admin mengubah aturan: berlaku, tercatat dengan alasan, dan bisa dikembalikan', async () => {
  const bad = { ...baseForm(), buyPricePerKg: 999 };
  const rejected = await call('PUT', '/api/admin/rules', { token: TOKEN, body: bad });
  assert.equal(rejected.status, 400);
  assert.ok(rejected.json.error.fields.buyPricePerKg);

  const same = await call('PUT', '/api/admin/rules', { token: TOKEN, body: baseForm() });
  assert.equal(same.status, 400, 'tanpa perubahan ditolak');

  const changed = { ...baseForm(), buyPricePerKg: 126000, reason: 'Harga beli naik' };
  const saved = await call('PUT', '/api/admin/rules', { token: TOKEN, body: changed });
  assert.equal(saved.status, 200);
  assert.equal(config.buyPricePerKg, 126000);

  const read = await call('GET', '/api/admin/rules', { token: TOKEN });
  assert.equal(read.json.form.buyPricePerKg, 126000);
  assert.equal(read.json.history.length, 1);
  assert.equal(read.json.history[0].reason, 'Harga beli naik');
  assert.deepEqual(read.json.history[0].changes, [{ key: 'buyPricePerKg', from: 120000, to: 126000 }]);

  const reset = await call('PUT', '/api/admin/rules', { token: TOKEN, body: { ...rules.toForm(rules.BASE), reason: 'Kembali ke standar' } });
  assert.equal(reset.status, 200);
  assert.equal(config.buyPricePerKg, rules.BASE.buyPricePerKg);
});
