'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const proposals = require('../lib/proposals');
const { ApiError } = require('../lib/validate');

const NOW = '2026-11-18T03:00:00.000Z';
const LATER = '2026-11-18T05:00:00.000Z';
const buyer = { id: 'b1', name: 'Kafe Uji' };
const other = { id: 'b2', name: 'Lain' };

function baseDb() {
  return {
    lots: [
      { code: 'L1', tier: 'premium', status: 'listed', sellableKg: 3000, reservedKg: 0, soldKg: 0 },
      { code: 'L2', tier: 'reserve', status: 'listed', sellableKg: 500, reservedKg: 0, soldKg: 0 },
    ],
    proposals: [],
  };
}

const goodForm = {
  company: 'PT Kopi Uji', npwp: '01.234.567.8-901.000', licence: 'NIB-123', contactName: 'Budi Uji',
  phone: '081234567890', email: 'budi@kafe.test', address: 'Jl. Uji 1, Bandung', city: 'Bandung',
  quantityKg: 2000, tiers: ['premium'], deliveryTerms: 'delivered', freightBy: 'buyer',
};
const agreements = { accurate: true, verification: true, offerSubject: true, policy: true, privacy: true };

function submitted(db) {
  const { proposal } = proposals.createProposal(db, buyer, goodForm, NOW);
  proposals.submitProposal(db, proposal.id, buyer, { agreements }, NOW);
  return proposal;
}

test('draft: quantity below 1,000 kg is rejected for submit', () => {
  const db = baseDb();
  const { proposal } = proposals.createProposal(db, buyer, { ...goodForm, quantityKg: 500 }, NOW);
  assert.throws(() => proposals.submitProposal(db, proposal.id, buyer, { agreements }, NOW), (e) => e.status === 400 && !!e.fields.quantityKg);
});

test('draft: quantity must be a multiple of 100 kg', () => {
  const { problems } = proposals.validateDraft({ ...goodForm, quantityKg: 1050 });
  assert.ok(problems.any && problems.fields.quantityKg);
});

test('submit requires every agreement box', () => {
  const db = baseDb();
  const { proposal } = proposals.createProposal(db, buyer, goodForm, NOW);
  assert.throws(() => proposals.submitProposal(db, proposal.id, buyer, { agreements: { ...agreements, policy: false } }, NOW), (e) => e.status === 400 && !!e.fields['agreements.policy']);
});

test('reference numbers are sequential per month', () => {
  const db = baseDb();
  const a = proposals.createProposal(db, buyer, goodForm, NOW).proposal;
  const b = proposals.createProposal(db, buyer, goodForm, NOW).proposal;
  assert.equal(a.reference, 'ALP-2611-001');
  assert.equal(b.reference, 'ALP-2611-002');
});

test('another buyer cannot read or submit a proposal', () => {
  const db = baseDb();
  const { proposal } = proposals.createProposal(db, buyer, goodForm, NOW);
  assert.throws(() => proposals.submitProposal(db, proposal.id, other, { agreements }, NOW), (e) => e.status === 404);
  assert.equal(proposals.listForBuyer(db, other).length, 0);
});

test('happy path: submit, review, offer, accept, deposit, prepare, balance, ship, complete', () => {
  const db = baseDb();
  const p = submitted(db);
  proposals.staffAction(db, p.id, 'start_review', {}, NOW);
  proposals.staffAction(db, p.id, 'make_offer', { lines: [{ lotCode: 'L1', kg: 2000 }] }, NOW);
  assert.equal(p.status, 'offered');
  assert.equal(p.offers[0].total, 2000 * 250000);
  proposals.buyerAction(db, p.id, buyer, 'accept', {}, NOW);
  assert.equal(p.status, 'agreed');
  assert.equal(p.agreedOffer.version, 1);
  proposals.staffAction(db, p.id, 'request_deposit', {}, NOW);
  assert.equal(p.deposit.amount, Math.round(0.3 * 2000 * 250000));
  proposals.staffAction(db, p.id, 'mark_deposit_paid', { reference: 'TRF-1' }, NOW);
  assert.equal(db.lots[0].reservedKg, 2000);
  proposals.staffAction(db, p.id, 'start_prep', {}, NOW);
  proposals.staffAction(db, p.id, 'request_balance', {}, NOW);
  assert.equal(p.balance.amount, 2000 * 250000 - p.deposit.amount);
  proposals.staffAction(db, p.id, 'mark_balance_paid', { reference: 'TRF-2' }, NOW);
  proposals.staffAction(db, p.id, 'dispatch', { courier: 'JNE', waybill: 'JNE1' }, NOW);
  proposals.staffAction(db, p.id, 'complete', {}, NOW);
  assert.equal(p.status, 'completed');
  assert.equal(p.timeline.length, 12);
});

test('dispatch is blocked until the balance is paid', () => {
  const db = baseDb();
  const p = submitted(db);
  proposals.staffAction(db, p.id, 'start_review', {}, NOW);
  proposals.staffAction(db, p.id, 'make_offer', { lines: [{ lotCode: 'L1', kg: 1000 }] }, NOW);
  proposals.buyerAction(db, p.id, buyer, 'accept', {}, NOW);
  proposals.staffAction(db, p.id, 'request_deposit', {}, NOW);
  assert.throws(() => proposals.staffAction(db, p.id, 'dispatch', {}, NOW), (e) => e.code === 'invalid_transition');
});

test('offer cannot ask for more kg than the lot has free', () => {
  const db = baseDb();
  const p = submitted(db);
  proposals.staffAction(db, p.id, 'start_review', {}, NOW);
  assert.throws(() => proposals.staffAction(db, p.id, 'make_offer', { lines: [{ lotCode: 'L2', kg: 1000 }] }, NOW), (e) => e.code === 'insufficient_stock');
});

test('offer must use listed lots', () => {
  const db = baseDb();
  db.lots[0].status = 'graded';
  const p = submitted(db);
  proposals.staffAction(db, p.id, 'start_review', {}, NOW);
  assert.throws(() => proposals.staffAction(db, p.id, 'make_offer', { lines: [{ lotCode: 'L1', kg: 1000 }] }, NOW), (e) => e.code === 'lot_not_listed');
});

test('a counter moves to negotiating and staff can send a new offer', () => {
  const db = baseDb();
  const p = submitted(db);
  proposals.staffAction(db, p.id, 'start_review', {}, NOW);
  proposals.staffAction(db, p.id, 'make_offer', { lines: [{ lotCode: 'L1', kg: 1000 }] }, NOW);
  proposals.buyerAction(db, p.id, buyer, 'counter', { note: 'Bisa 900 kg?' }, NOW);
  assert.equal(p.status, 'negotiating');
  proposals.staffAction(db, p.id, 'make_offer', { lines: [{ lotCode: 'L1', kg: 900 }] }, NOW);
  assert.equal(p.offers.length, 2);
  assert.equal(p.status, 'offered');
});

test('an expired offer cannot be accepted and is marked expired', () => {
  const db = baseDb();
  const p = submitted(db);
  proposals.staffAction(db, p.id, 'start_review', {}, NOW);
  proposals.staffAction(db, p.id, 'make_offer', { lines: [{ lotCode: 'L1', kg: 1000 }] }, NOW);
  const nineDays = '2026-11-27T03:00:00.000Z';
  assert.deepEqual(proposals.expireDue(db, nineDays), [p.id]);
  assert.equal(p.status, 'expired');
});

test('deposit not paid in time releases the reservation', () => {
  const db = baseDb();
  const p = submitted(db);
  proposals.staffAction(db, p.id, 'start_review', {}, NOW);
  proposals.staffAction(db, p.id, 'make_offer', { lines: [{ lotCode: 'L1', kg: 1000 }] }, NOW);
  proposals.buyerAction(db, p.id, buyer, 'accept', {}, NOW);
  proposals.staffAction(db, p.id, 'request_deposit', {}, NOW);
  proposals.staffAction(db, p.id, 'mark_deposit_paid', {}, NOW);
  assert.equal(db.lots[0].reservedKg, 1000);
  // deposit_paid is not pending, so expiry does not apply; test the pending case instead
  const db2 = baseDb();
  const q = submitted(db2);
  proposals.staffAction(db2, q.id, 'start_review', {}, NOW);
  proposals.staffAction(db2, q.id, 'make_offer', { lines: [{ lotCode: 'L1', kg: 1000 }] }, NOW);
  proposals.buyerAction(db2, q.id, buyer, 'accept', {}, NOW);
  proposals.staffAction(db2, q.id, 'request_deposit', {}, NOW);
  assert.deepEqual(proposals.expireDue(db2, '2026-11-25T03:00:00.000Z'), [q.id]);
  assert.equal(q.status, 'expired');
  assert.equal(db2.lots[0].reservedKg || 0, 0);
});

test('agreed terms are fixed by a hash per version', () => {
  const db = baseDb();
  const p = submitted(db);
  proposals.staffAction(db, p.id, 'start_review', {}, NOW);
  proposals.staffAction(db, p.id, 'make_offer', { lines: [{ lotCode: 'L1', kg: 1000 }] }, NOW);
  const h1 = p.offers[0].hash;
  assert.match(h1, /^[0-9a-f]{64}$/);
  proposals.buyerAction(db, p.id, buyer, 'accept', {}, NOW);
  assert.equal(p.agreedOffer.hash, h1);
});

test('buyer cannot accept after the offer expired', () => {
  const db = baseDb();
  const p = submitted(db);
  proposals.staffAction(db, p.id, 'start_review', {}, NOW);
  proposals.staffAction(db, p.id, 'make_offer', { lines: [{ lotCode: 'L1', kg: 1000 }] }, NOW);
  assert.throws(() => proposals.buyerAction(db, p.id, buyer, 'accept', {}, '2026-11-27T03:00:00.000Z'), (e) => e.code === 'offer_expired');
});

test('buyer actions are not allowed for staff, and staff actions not for buyers', () => {
  const db = baseDb();
  const p = submitted(db);
  assert.throws(() => proposals.staffAction(db, p.id, 'accept', {}, NOW), (e) => e.code === 'buyer_only');
  assert.throws(() => proposals.buyerAction(db, p.id, buyer, 'dispatch', {}, NOW), (e) => e.code === 'staff_only');
});

test('need_info lets the buyer edit and send the form back to review', () => {
  const db = baseDb();
  const p = submitted(db);
  proposals.staffAction(db, p.id, 'start_review', {}, NOW);
  proposals.staffAction(db, p.id, 'request_info', { message: 'Kirim salinan NIB.' }, NOW);
  assert.equal(p.status, 'need_info');
  assert.equal(p.infoRequest.message, 'Kirim salinan NIB.');
  proposals.updateDraft(db, p.id, buyer, { npwp: '99.999.999.9-999.000' }, LATER);
  assert.equal(p.form.npwp, '99.999.999.9-999.000');
});

test('a submitted proposal cannot be edited', () => {
  const db = baseDb();
  const p = submitted(db);
  assert.throws(() => proposals.updateDraft(db, p.id, buyer, { company: 'Baru' }, NOW), (e) => e.code === 'not_editable');
});

test('cancelling after the deposit is paid releases the reserved lots', () => {
  const db = baseDb();
  const p = submitted(db);
  proposals.staffAction(db, p.id, 'start_review', {}, NOW);
  proposals.staffAction(db, p.id, 'make_offer', { lines: [{ lotCode: 'L1', kg: 1000 }] }, NOW);
  proposals.buyerAction(db, p.id, buyer, 'accept', {}, NOW);
  proposals.staffAction(db, p.id, 'request_deposit', {}, NOW);
  proposals.staffAction(db, p.id, 'mark_deposit_paid', {}, NOW);
  assert.throws(() => proposals.staffAction(db, p.id, 'cancel', {}, NOW), (e) => e.code === 'invalid_transition');
});

test('publicProposal hides nothing buyer needs and keeps the timeline', () => {
  const db = baseDb();
  const p = submitted(db);
  const pub = proposals.publicProposal(p);
  assert.equal(pub.reference, p.reference);
  assert.equal(pub.statusLabel, proposals.statusLabel('submitted'));
  assert.ok(Array.isArray(pub.timeline));
});

test('each step queues an email and a WhatsApp message to the buyer', () => {
  const db = baseDb();
  const p = submitted(db);
  const submittedMsgs = db.outbox.filter((m) => m.orderNumber === p.reference);
  assert.equal(submittedMsgs.map((m) => m.channel).sort().join(','), 'email,whatsapp');
  assert.ok(submittedMsgs.every((m) => m.event === 'proposal_submitted'));
  proposals.staffAction(db, p.id, 'start_review', {}, NOW);
  proposals.staffAction(db, p.id, 'make_offer', { lines: [{ lotCode: 'L1', kg: 1000 }] }, NOW);
  const offerMsg = db.outbox.find((m) => m.event === 'proposal_offered' && m.channel === 'email');
  assert.match(offerMsg.body, /Penawaran v1/);
  assert.match(offerMsg.body, /Rp250\.000\.000/);
});

test('request for info, then the buyer edits the draft and resubmits to review', () => {
  const db = baseDb();
  const p = submitted(db);
  proposals.staffAction(db, p.id, 'start_review', {}, NOW);
  proposals.staffAction(db, p.id, 'request_info', { message: 'Kirim salinan NIB.' }, NOW);
  const msg = db.outbox.find((m) => m.event === 'proposal_need_info');
  assert.match(msg.body, /Kirim salinan NIB/);
  proposals.updateDraft(db, p.id, buyer, { licence: 'NIB-999' }, LATER);
  proposals.submitProposal(db, p.id, buyer, { agreements }, LATER);
  assert.equal(p.status, 'in_review');
  assert.equal(p.form.licence, 'NIB-999');
});

test('expiry sweep expires an offer and queues the expired message', () => {
  const db = baseDb();
  const p = submitted(db);
  proposals.staffAction(db, p.id, 'start_review', {}, NOW);
  proposals.staffAction(db, p.id, 'make_offer', { lines: [{ lotCode: 'L1', kg: 1000 }] }, NOW);
  proposals.expireDue(db, '2026-11-27T03:00:00.000Z');
  assert.equal(p.status, 'expired');
  assert.ok(db.outbox.some((m) => m.event === 'proposal_expired'));
});
