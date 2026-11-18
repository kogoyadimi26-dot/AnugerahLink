'use strict';

// Pesanan besar dari proposal sampai selesai: persetujuan pemilik, perjanjian PDF, dokumen pengiriman.

const test = require('node:test');
const assert = require('node:assert/strict');
const proposals = require('../lib/proposals');
const documents = require('../lib/documents');
const domain = require('../lib/domain');
const auth = require('../lib/auth');

const NOW = '2026-11-18T03:00:00.000Z';
const buyer = { id: 'b1', name: 'Kafe Uji' };
const other = { id: 'b2', name: 'Lain' };

function baseDb() {
  return {
    regions: [{ id: 'r1', name: 'Baliem Valley', regency: 'Jayawijaya' }],
    groups: [{ id: 'g1', name: 'Kelompok Tani Baliem 1' }],
    lots: [
      { code: 'L1', tier: 'premium', status: 'listed', sellableKg: 3000, reservedKg: 0, soldKg: 0, grade: 'A', cupScore: 85, harvestDate: '2026-10-01', process: 'Dicuci', regionId: 'r1', groupId: 'g1' },
      { code: 'L2', tier: 'reserve', status: 'listed', sellableKg: 500, reservedKg: 0, soldKg: 0, grade: 'A', cupScore: 87, harvestDate: '2026-10-05', process: 'Natural', regionId: 'r1', groupId: 'g1' },
    ],
    proposals: [],
  };
}

const goodForm = {
  company: 'PT Kopi Uji', npwp: '01.234.567.8-901.000', licence: 'NIB-123', contactName: 'Budi Uji', contactRole: 'Direktur',
  phone: '081234567890', email: 'budi@kafe.test', address: 'Jl. Uji 1, Bandung', city: 'Bandung', country: 'Indonesia',
  quantityKg: 2000, tiers: ['premium'], deliveryTerms: 'delivered', freightBy: 'buyer', packaging: 'Karung jute',
};
const agreements = { accurate: true, verification: true, offerSubject: true, policy: true, privacy: true };

function submitted(db) {
  const { proposal } = proposals.createProposal(db, buyer, goodForm, NOW);
  proposals.submitProposal(db, proposal.id, buyer, { agreements }, NOW);
  return proposal;
}

function pdfIsWellFormed(buf) {
  const text = buf.toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4'));
  assert.ok(text.trimEnd().endsWith('%%EOF'));
  const startxref = Number(/startxref\n(\d+)/.exec(text)[1]);
  const offsets = [...text.slice(startxref).matchAll(/^(\d{10}) 00000 n/gm)].map((m) => Number(m[1]));
  offsets.forEach((off, i) => assert.ok(text.slice(off).startsWith(`${i + 1} 0 obj`), `object ${i + 1}`));
  return text;
}

test('an offer above Rp100 million waits for the owner and stays hidden from the buyer until approved', () => {
  const db = baseDb();
  const p = submitted(db);
  proposals.staffAction(db, p.id, 'start_review', {}, NOW);
  proposals.staffAction(db, p.id, 'make_offer', { lines: [{ lotCode: 'L1', kg: 2000 }] }, NOW);
  assert.equal(p.status, 'in_review', 'a large offer does not go out on its own');
  assert.equal(p.offers[0].ownerApproval, 'pending');
  assert.equal(proposals.listForBuyer(db, buyer)[0].offers.length, 0, 'buyer cannot see an unapproved offer');
  assert.throws(() => proposals.buyerAction(db, p.id, buyer, 'accept', {}, NOW), (e) => e.code === 'invalid_transition');
  proposals.staffAction(db, p.id, 'owner_approve', {}, NOW);
  assert.equal(p.status, 'offered');
  assert.equal(p.offers[0].ownerApproval, 'approved');
  assert.equal(proposals.listForBuyer(db, buyer)[0].offers.length, 1);
  assert.throws(() => proposals.staffAction(db, p.id, 'owner_approve', {}, NOW), (e) => e.code === 'invalid_transition');
});

test('an offer at or below Rp100 million goes straight to the buyer', () => {
  const db = baseDb();
  const p = submitted(db);
  proposals.staffAction(db, p.id, 'start_review', {}, NOW);
  proposals.staffAction(db, p.id, 'make_offer', { lines: [{ lotCode: 'L1', kg: 300 }] }, NOW);
  assert.equal(p.status, 'offered');
  assert.equal(p.offers[0].ownerApproval, 'not_required');
  assert.equal(proposals.listForBuyer(db, buyer)[0].offers.length, 1);
});

test('only the owner role may approve; staff may prepare offers', () => {
  assert.equal(auth.can('admin', 'proposals_approve'), true);
  assert.equal(auth.can('staff', 'proposals'), true);
  assert.equal(auth.can('staff', 'proposals_approve'), false);
});

test('a large order runs from submit to completed, with an agreement and shipment documents', () => {
  const db = baseDb();
  const p = submitted(db);
  proposals.staffAction(db, p.id, 'start_review', {}, NOW);
  proposals.staffAction(db, p.id, 'make_offer', { lines: [{ lotCode: 'L1', kg: 2000 }] }, NOW);
  proposals.staffAction(db, p.id, 'owner_approve', {}, NOW);
  proposals.buyerAction(db, p.id, buyer, 'accept', {}, NOW);
  assert.equal(p.status, 'agreed');

  // Perjanjian PDF dibuat dari penawaran yang disetujui.
  const offer = proposals.agreedOfferOf(p);
  assert.equal(offer.total, 2000 * 250000);
  const agreement = documents.agreementPdf(p, offer, p.agreedOffer.at);
  const text = pdfIsWellFormed(agreement.pdf);
  assert.ok(text.includes(p.reference));
  assert.ok(text.includes('L1'));
  assert.ok(text.includes('Rp 500.000.000'));
  assert.ok(text.includes('Rp 150.000.000'), 'uang muka 30 persen');
  assert.ok(text.includes('DRAF'), 'marked draft until the lawyer reviews it');
  assert.equal(documents.agreementPdf(p, offer, p.agreedOffer.at).sha256, agreement.sha256, 'same terms give the same document hash');
  const changed = { ...offer, total: offer.total + 1 };
  assert.notEqual(documents.agreementPdf(p, changed, p.agreedOffer.at).sha256, agreement.sha256, 'changed terms give a different hash');

  proposals.staffAction(db, p.id, 'request_deposit', {}, NOW);
  proposals.staffAction(db, p.id, 'mark_deposit_paid', { reference: 'TRF-1' }, NOW);
  proposals.staffAction(db, p.id, 'start_prep', {}, NOW);
  assert.equal(p.status, 'preparing');

  // Dokumen pengiriman: kemasan, daftar lot, hasil mutu, dan pernyataan asal.
  const lots = p.lines.map((l) => ({ lotCode: l.lotCode, kg: l.kg, view: domain.publicLot(db, db.lots.find((x) => x.code === l.lotCode)) }));
  const shipment = documents.shipmentDocsPdf(p, lots, NOW);
  const shipText = pdfIsWellFormed(shipment.pdf);
  for (const heading of ['Daftar kemasan', 'Daftar lot', 'Hasil mutu', 'Pernyataan asal']) {
    assert.ok(shipText.includes(heading), `shipment document has ${heading}`);
  }
  assert.ok(shipText.includes('Baliem Valley'));
  assert.ok(shipText.includes('Kelompok Tani Baliem 1'));

  proposals.staffAction(db, p.id, 'request_balance', {}, NOW);
  proposals.staffAction(db, p.id, 'mark_balance_paid', { reference: 'TRF-2' }, NOW);
  proposals.staffAction(db, p.id, 'dispatch', { courier: 'JNE', waybill: 'JNE123' }, NOW);
  assert.equal(p.status, 'shipped');
  assert.equal(p.shipment.waybill, 'JNE123');
  proposals.staffAction(db, p.id, 'complete', {}, NOW);
  assert.equal(p.status, 'completed');
  assert.deepEqual(p.timeline.map((t) => t.status), ['draft', 'submitted', 'in_review', 'in_review', 'offered', 'agreed', 'deposit_pending', 'deposit_paid', 'preparing', 'balance_pending', 'balance_paid', 'shipped', 'completed']);
});

test('dispatch is blocked until the balance is paid', () => {
  const db = baseDb();
  const p = submitted(db);
  proposals.staffAction(db, p.id, 'start_review', {}, NOW);
  proposals.staffAction(db, p.id, 'make_offer', { lines: [{ lotCode: 'L1', kg: 2000 }] }, NOW);
  proposals.staffAction(db, p.id, 'owner_approve', {}, NOW);
  proposals.buyerAction(db, p.id, buyer, 'accept', {}, NOW);
  proposals.staffAction(db, p.id, 'request_deposit', {}, NOW);
  proposals.staffAction(db, p.id, 'mark_deposit_paid', { reference: 'TRF-1' }, NOW);
  proposals.staffAction(db, p.id, 'start_prep', {}, NOW);
  assert.throws(() => proposals.staffAction(db, p.id, 'dispatch', {}, NOW), (e) => e.code === 'invalid_transition');
});

test('a long shipment document runs onto more than one page', () => {
  const lots = Array.from({ length: 80 }, (_, i) => ({ lotCode: `AL-${i}`, kg: 1000, view: { regionName: 'Baliem', groupName: 'Kelompok', grade: 'A', cupScore: 85, process: 'Dicuci', harvestDate: '2026-10-01' } }));
  const p = { reference: 'ALP-TEST-1', form: { company: 'PT Uji', address: 'Jl. Uji', city: 'Bandung', packaging: 'Karung jute' } };
  const doc = documents.shipmentDocsPdf(p, lots, NOW);
  const text = pdfIsWellFormed(doc.pdf);
  const count = Number(/\/Count (\d+)/.exec(text)[1]);
  assert.ok(count >= 2, `expected several pages, got ${count}`);
});

test('agreement and shipment document routes need sign-in, and owner approval needs the owner role', async () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const http = require('node:http');
  const { createApp } = require('../server');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'al-pesanan-'));
  const OWNER = { email: 'pemilik-besar@test.local', password: 'kata-sandi-besar-123' };
  const app = createApp({ dataFile: path.join(tmp, 'app.db'), owner: { name: 'Pemilik', ...OWNER } });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const send = (method, p, headers = {}, body) => new Promise((resolve, reject) => {
    const u = new URL(base + p);
    const h = { ...headers };
    if (body !== undefined) h['Content-Type'] = 'application/json';
    const req = http.request({ host: u.hostname, port: u.port, path: u.pathname, method, headers: h }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
  try {
    assert.equal((await send('GET', '/api/buyer/proposals/abc/agreement')).status, 401);
    assert.equal((await send('GET', '/api/admin/proposals/abc/agreement')).status, 401);
    assert.equal((await send('GET', '/api/admin/proposals/abc/shipment-docs')).status, 401);

    const login = await send('POST', '/api/auth/login', {}, OWNER);
    const token = JSON.parse(login.data).token;
    const asOwner = { Authorization: `Bearer ${token}` };
    assert.equal((await send('GET', '/api/admin/proposals/nope/agreement', asOwner)).status, 404, 'owner reaches the route; unknown proposal is 404');
    assert.equal((await send('POST', '/api/admin/proposals/nope/action', asOwner, { action: 'owner_approve' })).status, 404);
  } finally {
    await new Promise((r) => app.server.close(r));
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
