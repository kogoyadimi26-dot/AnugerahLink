'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server');
const labels = require('../lib/labels');
const defaults = require('../config/labels');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'al-label-'));
const OWNER = { email: 'pemilik-label@test.local', password: 'kata-sandi-pemilik-123' };
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

// Semua label dengan teks standarnya; dipakai sebagai dasar tiap uji.
function standard() {
  return Object.fromEntries(Object.entries(defaults).map(([k, d]) => [k, d.text]));
}

test('label standar lolos validasi dan dirapikan dari spasi berlebih', () => {
  const input = standard();
  input['nav.produk'] = '   Katalog   Kopi  ';
  const out = labels.validateLabels(input);
  assert.equal(out['nav.produk'], 'Katalog Kopi');
  assert.equal(Object.keys(out).length, Object.keys(defaults).length);
});

test('kunci yang tidak dikenal ditolak', () => {
  const input = { ...standard(), 'nav.liar': 'Apa saja' };
  try {
    labels.validateLabels(input);
    assert.fail('seharusnya ditolak');
  } catch (err) {
    assert.equal(err.status, 400);
    assert.equal(err.fields['nav.liar'], 'Label ini tidak dikenal.');
  }
});

test('label kosong, terlalu panjang, dan berisi < atau > ditolak', () => {
  const input = standard();
  input['nav.produk'] = '  ';
  input['nav.tentang'] = 'x'.repeat(41);
  input['nav.syarat'] = 'Syarat <b>';
  try {
    labels.validateLabels(input);
    assert.fail('seharusnya ditolak');
  } catch (err) {
    assert.equal(err.fields['nav.produk'], 'Label tidak boleh kosong.');
    assert.match(err.fields['nav.tentang'], /Maksimal 40/);
    assert.match(err.fields['nav.syarat'], /tanpa tanda/);
  }
});

test('labelsFor memakai teks standar untuk label yang belum diubah', () => {
  const page = labels.labelsFor({ labels: { 'nav.produk': 'Belanja' } });
  assert.equal(page['nav.produk'], 'Belanja');
  assert.equal(page['nav.tentang'], defaults['nav.tentang'].text);
  assert.equal(labels.labelsFor(undefined)['nav.syarat'], 'Syarat');
});

test('changesOf hanya mencatat label yang benar-benar berubah', () => {
  const before = standard();
  const after = { ...before, 'nav.produk': 'Belanja' };
  assert.deepEqual(labels.changesOf(before, after), [{ key: 'nav.produk', from: 'Produk', to: 'Belanja' }]);
  assert.deepEqual(labels.changesOf(before, before), []);
});

test('riwayat dibatasi jumlahnya dan yang terbaru di depan', () => {
  let h = [];
  for (let i = 0; i < labels.HISTORY_MAX + 5; i++) h = labels.appendHistory(h, { n: i });
  assert.equal(h.length, labels.HISTORY_MAX);
  assert.equal(h[0].n, labels.HISTORY_MAX + 4);
});

test('GET dan PUT label hanya untuk yang berhak', async () => {
  assert.equal((await call('GET', '/api/admin/labels')).status, 401);
  assert.equal((await call('PUT', '/api/admin/labels', { body: standard() })).status, 401);
});

test('admin mengubah label: tampil di halaman publik dan tercatat di riwayat', async () => {
  const bad = await call('PUT', '/api/admin/labels', { token: TOKEN, body: { ...standard(), 'nav.produk': '<b>x</b>' } });
  assert.equal(bad.status, 400);

  const body = { ...standard(), 'nav.produk': 'Belanja' };
  const saved = await call('PUT', '/api/admin/labels', { token: TOKEN, body });
  assert.equal(saved.status, 200);
  assert.equal(saved.json.labels['nav.produk'], 'Belanja');

  const cfg = await call('GET', '/api/config');
  assert.equal(cfg.json.labels['nav.produk'], 'Belanja');

  const read = await call('GET', '/api/admin/labels', { token: TOKEN });
  assert.equal(read.json.history.length, 1);
  assert.deepEqual(read.json.history[0].changes, [{ key: 'nav.produk', from: 'Produk', to: 'Belanja' }]);
  assert.ok(read.json.defaults['nav.produk'], 'teks standar ikut dikirim untuk tombol kembalikan');
});

test('simpan tanpa perubahan tidak menambah riwayat', async () => {
  const body = { ...standard(), 'nav.produk': 'Belanja' };
  await call('PUT', '/api/admin/labels', { token: TOKEN, body });
  const read = await call('GET', '/api/admin/labels', { token: TOKEN });
  assert.equal(read.json.history.length, 1);
});
