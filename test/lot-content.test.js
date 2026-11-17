'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server');

const OWNER = { email: 'pemilik-konten@test.local', password: 'kata-sandi-konten-123' };
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'al-konten-'));
let app; let base; let TOKEN;

test.before(async () => {
  app = createApp({ dataFile: path.join(tmp, 'app.db'), owner: { name: 'Pemilik Konten', ...OWNER } });
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
  const buf = Buffer.from(await res.arrayBuffer());
  let json = {};
  try { json = JSON.parse(buf.toString('utf8')); } catch { /* bukan JSON */ }
  return { status: res.status, json, buf, type: res.headers.get('content-type') };
}

async function lotId(code) {
  const lots = (await call('GET', '/api/admin/lots', { token: TOKEN })).json.lots;
  return lots.find((l) => l.code === code).id;
}

test('price changes need a reason, are range-checked, and reach the catalogue and audit', async () => {
  const noReason = await call('PUT', '/api/admin/prices', { token: TOKEN, body: { reserve: 320000, premium: 250000, verified: 150000, local: 100000 } });
  assert.equal(noReason.status, 400);
  assert.ok(noReason.json.error.fields.reason);

  const tooHigh = await call('PUT', '/api/admin/prices', { token: TOKEN, body: { reserve: 99000000, premium: 250000, verified: 150000, local: 100000, reason: 'uji' } });
  assert.equal(tooHigh.status, 400);
  assert.ok(tooHigh.json.error.fields.reserve);

  const ok = await call('PUT', '/api/admin/prices', { token: TOKEN, body: { reserve: 320000, premium: 250000, verified: 150000, local: 100000, reason: 'Harga pasar Juli turun' } });
  assert.equal(ok.status, 200);
  const cfg = await call('GET', '/api/config');
  assert.equal(cfg.json.tiers.reserve.pricePerKg, 320000);
  const lots = await call('GET', '/api/lots');
  assert.equal(lots.json.lots.find((l) => l.tier === 'reserve').pricePerKg, 320000);

  const audit = (await call('GET', '/api/admin/audit', { token: TOKEN })).json.entries;
  assert.ok(audit.some((e) => e.detail && e.detail.includes('Alasan: Harga pasar Juli turun') && e.detail.includes('350000 → 320000')));
});

test('site text is saved, shown on the public config, and refuses HTML', async () => {
  const html = await call('PUT', '/api/admin/content', { token: TOKEN, body: { homeTitle: '<b>Halo</b>', homeLead: 'x', footerTagline: 'y' } });
  assert.equal(html.status, 400);

  const ok = await call('PUT', '/api/admin/content', { token: TOKEN, body: { homeTitle: 'Kopi kami, dinilai dengan jujur.', homeLead: 'Dari kebun ke cangkir.', footerTagline: 'Petani dibayar tunai.' } });
  assert.equal(ok.status, 200);
  const cfg = await call('GET', '/api/config');
  assert.equal(cfg.json.content.homeTitle, 'Kopi kami, dinilai dengan jujur.');
});

test('listing photos: admin uploads, sets headline and cover; public sees only listing photos of listed lots', async () => {
  const id = await lotId('AL-2611-002');
  const up = await call('POST', `/api/admin/lots/${id}/photos`, { token: TOKEN, body: { kind: 'listing', dataUrl: PNG } });
  assert.equal(up.status, 201);
  const photoId = up.json.photo.id;

  const set = await call('PATCH', `/api/admin/lots/${id}/listing`, { token: TOKEN, body: { headline: 'Tiom natural, manis cokelat', story: 'Dipanen dari kebun keluarga di Tiom.', coverPhotoId: photoId } });
  assert.equal(set.status, 200);

  const pub = await call('GET', '/api/lots');
  const lot = pub.json.lots.find((l) => l.code === 'AL-2611-002');
  assert.equal(lot.title, 'Tiom natural, manis cokelat');
  assert.equal(lot.coverPhotoId, photoId);

  const img = await call('GET', `/api/lots/AL-2611-002/photos/${photoId}`);
  assert.equal(img.status, 200);
  assert.equal(img.type, 'image/png');

  const sample = await call('POST', `/api/admin/lots/${id}/photos`, { token: TOKEN, body: { kind: 'sample', dataUrl: PNG } });
  assert.equal((await call('GET', `/api/lots/AL-2611-002/photos/${sample.json.photo.id}`)).status, 404, 'inspection photos stay private');
  assert.equal((await call('DELETE', `/api/admin/photos/${sample.json.photo.id}`, { token: TOKEN })).status, 403);

  const bad = await call('PATCH', `/api/admin/lots/${id}/listing`, { token: TOKEN, body: { coverPhotoId: sample.json.photo.id } });
  assert.equal(bad.status, 400, 'cover must be a listing photo');

  assert.equal((await call('DELETE', `/api/admin/photos/${photoId}`, { token: TOKEN })).status, 200);
  assert.equal((await call('GET', `/api/lots/AL-2611-002/photos/${photoId}`)).status, 404);
});

test('a grader can see but cannot change prices, site text, or listing photos', async () => {
  const pw = 'penilai-konten-123';
  await call('POST', '/api/admin/users', { token: TOKEN, body: { name: 'Penilai Konten', email: 'penilai-konten@test.local', password: pw, role: 'grader' } });
  const grader = (await call('POST', '/api/auth/login', { body: { email: 'penilai-konten@test.local', password: pw } })).json.token;
  assert.equal((await call('PUT', '/api/admin/prices', { token: grader, body: { reason: 'coba coba' } })).status, 403);
  assert.equal((await call('PUT', '/api/admin/content', { token: grader, body: {} })).status, 403);
  const id = await lotId('AL-2611-001');
  assert.equal((await call('PATCH', `/api/admin/lots/${id}/listing`, { token: grader, body: {} })).status, 403);
});
