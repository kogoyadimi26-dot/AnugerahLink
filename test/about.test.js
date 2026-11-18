'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server');
const about = require('../lib/about');
const business = require('../config/business');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'al-tentang-'));
const OWNER = { email: 'pemilik-tentang@test.local', password: 'kata-sandi-pemilik-123' };
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

// Isi lengkap yang valid, dipakai sebagai dasar tiap uji.
function sample() {
  return {
    eyebrow: 'Tentang kami',
    title: 'Kopi dari kebun Papua',
    lead: 'Kalimat pembuka.',
    mission: 'Misi kami sederhana.',
    claim: { title: 'Klaim', text: 'Setiap lot dinilai.' },
    history: ['Paragraf pertama.', 'Paragraf kedua.'],
    pillars: [{ icon: 'coin', title: 'Harga adil', text: 'Petani dibayar tunai.' }],
    news: [{ date: '18 November 2026', title: 'Panen baru', body: ['Isi berita.'] }],
  };
}

test('isi valid diterima dan dibersihkan dari spasi di tepi', () => {
  const input = sample();
  input.title = '   Kopi dari kebun Papua   ';
  const out = about.validateAbout(input);
  assert.equal(out.title, 'Kopi dari kebun Papua');
  assert.deepEqual(out.history, ['Paragraf pertama.', 'Paragraf kedua.']);
  assert.equal(out.pillars[0].icon, 'coin');
});

test('bagian wajib yang kosong ditolak dengan pesan per kolom', () => {
  const input = sample();
  input.title = '   ';
  input.claim.text = '';
  input.history = ['', '  '];
  try {
    about.validateAbout(input);
    assert.fail('seharusnya ditolak');
  } catch (err) {
    assert.equal(err.status, 400);
    assert.equal(err.fields.title, 'Wajib diisi.');
    assert.equal(err.fields.claimText, 'Wajib diisi.');
    assert.ok(err.fields.history, 'sejarah wajib punya paragraf');
  }
});

test('tanda < dan > ditolak di semua kolom teks', () => {
  const input = sample();
  input.mission = 'Misi <script>';
  input.pillars[0].text = 'Penjelasan > biasa';
  input.news[0].body = ['Isi <b>tebal</b>'];
  try {
    about.validateAbout(input);
    assert.fail('seharusnya ditolak');
  } catch (err) {
    assert.match(err.fields.mission, /tanpa tanda/);
    assert.match(err.fields['pillars.0.text'], /tanpa tanda/);
    assert.match(err.fields['news.0.body.0'], /tanpa tanda/);
  }
});

test('batas panjang dan jumlah daftar ditegakkan', () => {
  const input = sample();
  input.title = 'x'.repeat(121);
  input.history = Array.from({ length: 11 }, (_, i) => `Paragraf ${i}`);
  input.pillars = Array.from({ length: 9 }, () => ({ icon: 'check', title: 'Judul', text: 'Teks' }));
  try {
    about.validateAbout(input);
    assert.fail('seharusnya ditolak');
  } catch (err) {
    assert.match(err.fields.title, /Maksimal 120/);
    assert.match(err.fields.history, /Maksimal 10/);
    assert.match(err.fields.pillars, /Maksimal 8/);
  }
});

test('ikon yang tidak dikenal jatuh ke centang', () => {
  const input = sample();
  input.pillars[0].icon = 'bintang';
  assert.equal(about.validateAbout(input).pillars[0].icon, 'check');
});

test('teks standar lolos validasi, sehingga tombol kembalikan teks standar berfungsi', () => {
  assert.doesNotThrow(() => about.validateAbout(business.about));
});

test('aboutFor memakai teks standar bila admin belum menyimpan apa pun', () => {
  assert.deepEqual(about.aboutFor({}), business.about);
  assert.deepEqual(about.aboutFor(undefined), business.about);
});

test('aboutFor menimpa teks standar dengan yang disimpan admin', () => {
  const saved = about.validateAbout(sample());
  const page = about.aboutFor({ about: saved });
  assert.equal(page.title, 'Kopi dari kebun Papua');
  assert.equal(page.mission, 'Misi kami sederhana.');
});

test('GET dan PUT halaman Tentang hanya untuk yang berhak', async () => {
  assert.equal((await call('GET', '/api/admin/about')).status, 401);
  assert.equal((await call('PUT', '/api/admin/about', { body: sample() })).status, 401);
});

test('admin menyimpan halaman Tentang, lalu halaman publik ikut berubah', async () => {
  const bad = await call('PUT', '/api/admin/about', { token: TOKEN, body: { ...sample(), title: '<b>Judul</b>' } });
  assert.equal(bad.status, 400);
  assert.ok(bad.json.fields || bad.json.error, 'pesan kesalahan dikirim ke formulir');

  const saved = await call('PUT', '/api/admin/about', { token: TOKEN, body: sample() });
  assert.equal(saved.status, 200);

  const read = await call('GET', '/api/admin/about', { token: TOKEN });
  assert.equal(read.json.about.title, 'Kopi dari kebun Papua');
  assert.ok(read.json.defaults.title, 'teks standar ikut dikirim untuk tombol kembalikan');

  const cfg = await call('GET', '/api/config');
  assert.equal(cfg.json.about.title, 'Kopi dari kebun Papua');
});
