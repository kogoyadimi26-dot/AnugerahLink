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

// Kedua bahasa dengan teks standar; dipakai sebagai dasar tiap uji.
function standard() { return labels.defaultSet(); }

test('teks standar kedua bahasa lolos validasi dan dirapikan dari spasi berlebih', () => {
  const input = standard();
  input.id['nav.produk'] = '   Katalog   Kopi  ';
  const out = labels.validateLabelSet(input);
  assert.equal(out.id['nav.produk'], 'Katalog Kopi');
  assert.equal(out.en['nav.produk'], 'Products');
  assert.equal(Object.keys(out.en).length, Object.keys(defaults).length);
});

test('kunci yang tidak dikenal ditolak dan galatnya menyebut bahasanya', () => {
  const input = standard();
  input.en['nav.liar'] = 'Anything';
  try {
    labels.validateLabelSet(input);
    assert.fail('seharusnya ditolak');
  } catch (err) {
    assert.equal(err.status, 400);
    assert.equal(err.fields['en.nav.liar'], 'Label ini tidak dikenal.');
  }
});

test('label kosong, terlalu panjang, dan berisi < atau > ditolak di kedua bahasa', () => {
  const input = standard();
  input.id['nav.produk'] = '  ';
  input.en['nav.tentang'] = 'x'.repeat(41);
  input.id['nav.syarat'] = 'Syarat <b>';
  try {
    labels.validateLabelSet(input);
    assert.fail('seharusnya ditolak');
  } catch (err) {
    assert.equal(err.fields['id.nav.produk'], 'Label tidak boleh kosong.');
    assert.match(err.fields['en.nav.tentang'], /Maksimal 40/);
    assert.match(err.fields['id.nav.syarat'], /tanpa tanda/);
  }
});

test('publishedFor memakai teks standar untuk label yang belum diterbitkan', () => {
  const page = labels.publishedFor({ labels: { 'nav.produk': 'Belanja' } });
  assert.equal(page.id['nav.produk'], 'Belanja');
  assert.equal(page.en['nav.produk'], 'Products');
  assert.equal(page.id['nav.tentang'], 'Tentang');
  assert.equal(labels.publishedFor(undefined).id['nav.syarat'], 'Syarat');
});

test('changesOf mencatat bahasa dan hanya yang benar-benar berubah', () => {
  const before = standard();
  const after = standard();
  after.id['nav.produk'] = 'Belanja';
  after.en['admin.lots'] = 'Stock';
  assert.deepEqual(labels.changesOf(before, after), [
    { lang: 'id', key: 'nav.produk', from: 'Produk', to: 'Belanja' },
    { lang: 'en', key: 'admin.lots', from: 'Lots', to: 'Stock' },
  ]);
  assert.deepEqual(labels.changesOf(before, standard()), []);
});

test('riwayat dibatasi jumlahnya dan yang terbaru di depan', () => {
  let h = [];
  for (let i = 0; i < labels.HISTORY_MAX + 5; i++) h = labels.appendHistory(h, { n: i });
  assert.equal(h.length, labels.HISTORY_MAX);
  assert.equal(h[0].n, labels.HISTORY_MAX + 4);
});

test('semua rute label hanya untuk yang berhak', async () => {
  assert.equal((await call('GET', '/api/admin/labels')).status, 401);
  assert.equal((await call('PUT', '/api/admin/labels/draft', { body: standard() })).status, 401);
  assert.equal((await call('POST', '/api/admin/labels/publish')).status, 401);
});

test('draf belum terlihat pengunjung; terbit mengubah halaman publik dan tercatat dalam dua bahasa', async () => {
  const bad = standard();
  bad.en['nav.produk'] = '<b>x</b>';
  const rejected = await call('PUT', '/api/admin/labels/draft', { token: TOKEN, body: bad });
  assert.equal(rejected.status, 400);
  assert.ok(rejected.json.error.fields['en.nav.produk']);

  const draft = standard();
  draft.id['nav.produk'] = 'Belanja';
  draft.en['nav.produk'] = 'Shop';
  assert.equal((await call('PUT', '/api/admin/labels/draft', { token: TOKEN, body: draft })).status, 200);

  let read = await call('GET', '/api/admin/labels', { token: TOKEN });
  assert.equal(read.json.draft.id['nav.produk'], 'Belanja');
  assert.equal(read.json.published.id['nav.produk'], 'Produk');
  assert.equal((await call('GET', '/api/config')).json.labels['nav.produk'], 'Produk', 'draf belum terlihat pengunjung');

  const published = await call('POST', '/api/admin/labels/publish', { token: TOKEN });
  assert.equal(published.status, 200);
  assert.equal(published.json.published.id['nav.produk'], 'Belanja');

  const cfg = await call('GET', '/api/config');
  assert.equal(cfg.json.labels['nav.produk'], 'Belanja');
  assert.equal(cfg.json.labelsEn['nav.produk'], 'Shop');

  read = await call('GET', '/api/admin/labels', { token: TOKEN });
  assert.equal(read.json.draft, null);
  assert.equal(read.json.history.length, 1);
  const changes = read.json.history[0].changes;
  assert.ok(changes.some((c) => c.lang === 'id' && c.key === 'nav.produk' && c.from === 'Produk' && c.to === 'Belanja'));
  assert.ok(changes.some((c) => c.lang === 'en' && c.key === 'nav.produk' && c.from === 'Products' && c.to === 'Shop'));
});

test('terbitkan tanpa draf ditolak; draf yang sama dengan yang terbit tidak menambah riwayat', async () => {
  assert.equal((await call('POST', '/api/admin/labels/publish', { token: TOKEN })).status, 409);

  const same = { id: (await call('GET', '/api/config')).json.labels, en: (await call('GET', '/api/config')).json.labelsEn };
  await call('PUT', '/api/admin/labels/draft', { token: TOKEN, body: same });
  assert.equal((await call('POST', '/api/admin/labels/publish', { token: TOKEN })).status, 200);
  const read = await call('GET', '/api/admin/labels', { token: TOKEN });
  assert.equal(read.json.history.length, 1);
});

test('buang draf menghapusnya tanpa mengubah label yang terbit', async () => {
  const draft = standard();
  draft.id['nav.tentang'] = 'Profil';
  await call('PUT', '/api/admin/labels/draft', { token: TOKEN, body: draft });
  assert.equal((await call('POST', '/api/admin/labels/draft/discard', { token: TOKEN })).status, 200);
  const read = await call('GET', '/api/admin/labels', { token: TOKEN });
  assert.equal(read.json.draft, null);
  assert.equal(read.json.published.id['nav.tentang'], 'Tentang');
});

test('teks halaman boleh lebih panjang dari label menu, tetapi tetap ada batasnya', () => {
  const ok = standard();
  ok.id['home.empty_text'] = 'x'.repeat(240);
  assert.equal(labels.validateLabelSet(ok).id['home.empty_text'].length, 240);

  const tooLong = standard();
  tooLong.id['home.empty_text'] = 'x'.repeat(241);
  tooLong.id['nav.produk'] = 'x'.repeat(41);
  try {
    labels.validateLabelSet(tooLong);
    assert.fail('seharusnya ditolak');
  } catch (err) {
    assert.match(err.fields['id.home.empty_text'], /Maksimal 240/);
    assert.match(err.fields['id.nav.produk'], /Maksimal 40/);
  }
});
