'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../config/business');
const pricing = require('../lib/pricing');
const passport = require('../lib/passport');
const domain = require('../lib/domain');
const { seed } = require('../lib/seed');
const { ApiError } = require('../lib/validate');

const NOW = '2026-11-17T02:00:00.000Z';
const customer = {
  name: 'Test Buyer', company: 'Kopi Test', buyerType: 'specialty_cafe',
  phone: '+62 812 3456 7890', email: 'buyer@example.com', city: 'Jakarta', notes: '',
};

function freshDb() {
  const db = seed();
  domain.ensurePassportHashes(db);
  return db;
}

// ---------- pricing and economics ----------

test('economics with the v2 grade mix matches the v2 spreadsheet', () => {
  const e = pricing.economics({ mix: config.defaultMix });
  assert.equal(e.salesPerKgBought, 161500);
  assert.equal(e.buyPerKgBought, 120000);
  assert.equal(e.shippingPerKgBought, 5700);
  assert.equal(e.feesPerKgBought, 1900);
  assert.equal(e.grossMarginPerKgBought, 33900);
  // 400M / 33,900 = 11,799.4, rounded up to 11,800 (plan shows 11,799)
  assert.equal(e.breakEvenKgPerYear, 11800);
});

test('a line for Verified standard adds buyer-paid shipping, Premium does not', () => {
  const v = pricing.priceLine({ code: 'X', tier: 'verified' }, 30);
  const p = pricing.priceLine({ code: 'Y', tier: 'premium' }, 30);
  assert.equal(v.lineTotal, 30 * 150000);
  assert.equal(v.shippingTotal, 30 * config.shippingPerKg);
  assert.equal(p.shippingTotal, 0);
  const totals = pricing.totalsFor([v, p]);
  assert.equal(totals.total, totals.subtotal + totals.shipping);
});

test('local lots carry no shipping charge', () => {
  const l = pricing.priceLine({ code: 'Z', tier: 'local' }, 40);
  assert.equal(l.shippingTotal, 0);
  assert.equal(l.pricePerKg, 100000);
});

test('kg rules: minimum, whole numbers and step', () => {
  assert.equal(pricing.kgProblem(29), 'Pesanan minimum 30 kg.');
  assert.equal(pricing.kgProblem(30), null);
  assert.match(pricing.kgProblem(30.5), /bilangan bulat/);
});

// ---------- passport hash ----------

test('passport hash is stable across key order and changes when a field changes', () => {
  const rec = { code: 'AL-1', groupName: 'G', regionName: 'R', regency: 'Y', harvestDate: '2026-01-01', process: 'Washed', grade: 'G1', cupScore: 85, moisturePct: 11, tier: 'premium', kgIn: 100, sellableKg: 95, buyPricePerKg: 120000 };
  const shuffled = Object.fromEntries(Object.entries(rec).reverse());
  assert.equal(passport.hashRecord(rec), passport.hashRecord(shuffled));
  const changed = { ...rec, cupScore: 86 };
  assert.notEqual(passport.hashRecord(rec), passport.hashRecord(changed));
});

test('a published lot passport matches its stored hash, and fails after an edit', () => {
  const db = freshDb();
  const lot = db.lots.find((l) => l.code === 'AL-2611-001');
  assert.equal(domain.passportView(db, lot).recordMatchesHash, true);
  lot.cupScore = 90; // change a recorded field directly
  assert.equal(domain.passportView(db, lot).recordMatchesHash, false);
});

// ---------- catalogue ----------

test('public lots hide the internal fields and sort by cup score by default', () => {
  const db = freshDb();
  const lots = domain.listPublicLots(db, {});
  assert.ok(lots.length >= 2);
  assert.ok(lots[0].cupScore >= lots[1].cupScore);
  for (const l of lots) {
    assert.equal('buyPricePerKg' in l, false);
    assert.equal('reservedKg' in l, false);
    assert.equal('buyerName' in l, false);
  }
});

// ---------- orders and stock ----------

test('placing an order reserves stock; cancelling releases it', () => {
  const db = freshDb();
  const lot = db.lots.find((l) => l.code === 'AL-2611-001');
  const before = domain.availableKg(lot);
  const order = domain.createOrder(db, { customer, lines: [{ lotCode: lot.code, kg: 30 }] }, NOW);
  assert.equal(order.status, 'requested');
  assert.equal(domain.availableKg(lot), before - 30);
  domain.updateOrderStatus(db, order.id, { status: 'cancelled' }, NOW);
  assert.equal(domain.availableKg(lot), before);
});

test('orders cannot exceed stock, and the error lists the short lot', () => {
  const db = freshDb();
  const lot = db.lots.find((l) => l.code === 'AL-2611-002');
  const tooMuch = domain.availableKg(lot) + 1;
  assert.throws(
    () => domain.createOrder(db, { customer, lines: [{ lotCode: lot.code, kg: tooMuch }] }, NOW),
    (err) => err instanceof ApiError && err.status === 409 && err.fields.stockIssues[0].lotCode === lot.code,
  );
  assert.equal(lot.reservedKg, 0, 'failed order must not reserve stock');
});

test('a sold-out or unknown lot is reported as a stock issue, not priced', () => {
  const db = freshDb();
  const q = domain.quote(db, [{ lotCode: 'AL-DOES-NOT-EXIST', kg: 30 }]);
  assert.equal(q.lines.length, 0);
  assert.equal(q.stockIssues[0].reason, 'not_available');
});

test('shipping converts the reservation to sold kg', () => {
  const db = freshDb();
  const lot = db.lots.find((l) => l.code === 'AL-2611-001');
  const order = domain.createOrder(db, { customer, lines: [{ lotCode: lot.code, kg: 30 }] }, NOW);
  domain.updateOrderStatus(db, order.id, { status: 'confirmed' }, NOW);
  domain.updateOrderStatus(db, order.id, { status: 'paid', paymentReference: 'TRF-001' }, NOW);
  domain.updateOrderStatus(db, order.id, { status: 'shipped' }, NOW);
  assert.equal(lot.soldKg, 30);
  assert.equal(lot.reservedKg, 0);
  domain.updateOrderStatus(db, order.id, { status: 'delivered' }, NOW);
  assert.equal(order.timeline.at(-1).status, 'delivered');
});

test('invalid status jumps are refused', () => {
  const db = freshDb();
  const lot = db.lots.find((l) => l.code === 'AL-2611-001');
  const order = domain.createOrder(db, { customer, lines: [{ lotCode: lot.code, kg: 30 }] }, NOW);
  assert.throws(() => domain.updateOrderStatus(db, order.id, { status: 'shipped' }, NOW), (e) => e.status === 409);
});

test('marking an order paid needs a transfer reference', () => {
  const db = freshDb();
  const lot = db.lots.find((l) => l.code === 'AL-2611-001');
  const order = domain.createOrder(db, { customer, lines: [{ lotCode: lot.code, kg: 30 }] }, NOW);
  domain.updateOrderStatus(db, order.id, { status: 'confirmed' }, NOW);
  assert.throws(() => domain.updateOrderStatus(db, order.id, { status: 'paid' }, NOW), (e) => Boolean(e.fields && e.fields.paymentReference));
});

test('customer validation reports the field', () => {
  const db = freshDb();
  const lot = db.lots.find((l) => l.code === 'AL-2611-001');
  try {
    domain.createOrder(db, { customer: { ...customer, email: 'not-an-email' }, lines: [{ lotCode: lot.code, kg: 30 }] }, NOW);
    assert.fail('expected validation error');
  } catch (e) {
    assert.equal(e.status, 400);
    assert.ok(e.fields.email);
  }
});

// ---------- grading and publishing ----------

test('intake creates a received lot; it must be graded before publishing', () => {
  const db = freshDb();
  const lot = domain.createIntake(db, { groupId: 'g-1', harvestDate: '2026-11-10', kgIn: 200, process: 'Washed' }, NOW);
  assert.equal(lot.status, 'received');
  assert.throws(() => domain.publishLot(db, lot.id, NOW), (e) => e.status === 409);
  domain.gradeLot(db, lot.id, { tier: 'premium', grade: 'SNI Grade 1', cupScore: '84', sellableKg: '190', moisturePct: '11' });
  assert.equal(lot.status, 'graded');
  domain.publishLot(db, lot.id, NOW);
  assert.equal(lot.status, 'listed');
  assert.ok(lot.passportHash);
});

test('a listed lot cannot be graded until withdrawn, and withdrawal needs no open orders', () => {
  const db = freshDb();
  const lot = db.lots.find((l) => l.code === 'AL-2611-001');
  assert.throws(() => domain.gradeLot(db, lot.id, { cupScore: 80 }), (e) => e.status === 409);
  const order = domain.createOrder(db, { customer, lines: [{ lotCode: lot.code, kg: 30 }] }, NOW);
  assert.throws(() => domain.withdrawLot(db, lot.id), (e) => e.code === 'has_reservations');
  domain.updateOrderStatus(db, order.id, { status: 'cancelled' }, NOW);
  domain.withdrawLot(db, lot.id);
  assert.equal(lot.status, 'withdrawn');
});

test('sellable kg cannot exceed kg received', () => {
  const db = freshDb();
  const lot = domain.createIntake(db, { groupId: 'g-2', harvestDate: '2026-11-10', kgIn: 100 }, NOW);
  assert.throws(() => domain.gradeLot(db, lot.id, { sellableKg: 150 }), (e) => Boolean(e.fields.sellableKg));
});

// ---------- feedback ----------

test('feedback opens only after delivery, once per order, and reaches farmers only when tagged', () => {
  const db = freshDb();
  const lot = db.lots.find((l) => l.code === 'AL-2611-001');
  const order = domain.createOrder(db, { customer, lines: [{ lotCode: lot.code, kg: 30 }] }, NOW);
  const body = { items: [{ lotCode: lot.code, taste: 'Sweet and clean', issues: 'none', reorder: 'yes' }] };
  assert.throws(() => domain.createFeedback(db, order, body, NOW), (e) => e.status === 409);
  domain.updateOrderStatus(db, order.id, { status: 'confirmed' }, NOW);
  domain.updateOrderStatus(db, order.id, { status: 'paid', paymentReference: 'R1' }, NOW);
  domain.updateOrderStatus(db, order.id, { status: 'shipped' }, NOW);
  domain.updateOrderStatus(db, order.id, { status: 'delivered' }, NOW);
  assert.throws(() => domain.createFeedback(db, order, body, NOW), (e) => e.status === 409, 'feedback waits for receipt');
  domain.confirmReceipt(order, NOW);
  assert.equal(order.status, 'completed');
  const [fb] = domain.createFeedback(db, order, body, NOW);
  assert.throws(() => domain.createFeedback(db, order, body, NOW), (e) => e.status === 409);

  let report = domain.farmerReport(db, 'g-1');
  assert.equal(report.comments.length, 0, 'untagged feedback must not reach the farmer');
  domain.tagFeedback(db, fb.id, { tag: 'pass-to-farmer' });
  report = domain.farmerReport(db, 'g-1');
  assert.equal(report.comments.length, 1);
  assert.equal(JSON.stringify(report).includes(customer.email), false, 'buyer details never reach the report');
  assert.equal(JSON.stringify(report).includes(customer.name), false);
});

test('feedback must name a lot on the order', () => {
  const db = freshDb();
  const lot = db.lots.find((l) => l.code === 'AL-2611-001');
  const order = domain.createOrder(db, { customer, lines: [{ lotCode: lot.code, kg: 30 }] }, NOW);
  Object.assign(order, { status: 'completed' });
  assert.throws(() => domain.createFeedback(db, order, { items: [{ lotCode: 'AL-2611-002', reorder: 'no' }] }, NOW), (e) => e.status === 400);
});

// ---------- summary ----------

test('summary uses the listed-stock mix when stock exists', () => {
  const db = freshDb();
  const s = domain.summary(db);
  assert.equal(s.mixSource, 'listed stock');
  const sum = Object.values(s.mixUsed).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
  assert.ok(s.economics.grossMarginPerKgBought !== undefined);
});

// ---------- receipt and claims ----------

test('the buyer confirms receipt only after delivery, and it completes the order', () => {
  const db = freshDb();
  const lot = db.lots.find((l) => l.code === 'AL-2611-001');
  const order = domain.createOrder(db, { customer, lines: [{ lotCode: lot.code, kg: 30 }] }, NOW);
  assert.throws(() => domain.confirmReceipt(order, NOW), (e) => e.status === 409);
  domain.updateOrderStatus(db, order.id, { status: 'confirmed' }, NOW);
  domain.updateOrderStatus(db, order.id, { status: 'paid', paymentReference: 'R2' }, NOW);
  domain.updateOrderStatus(db, order.id, { status: 'shipped' }, NOW);
  domain.updateOrderStatus(db, order.id, { status: 'delivered' }, NOW);
  assert.equal(domain.publicOrder(order).canConfirmReceipt, true);
  domain.confirmReceipt(order, NOW);
  assert.equal(order.status, 'completed');
  assert.equal(domain.publicOrder(order).feedbackOpen, true);
});

test('a problem can be reported within the claim window and does not change the status', () => {
  const db = freshDb();
  const lot = db.lots.find((l) => l.code === 'AL-2611-001');
  const order = domain.createOrder(db, { customer, lines: [{ lotCode: lot.code, kg: 30 }] }, NOW);
  domain.updateOrderStatus(db, order.id, { status: 'confirmed' }, NOW);
  domain.updateOrderStatus(db, order.id, { status: 'paid', paymentReference: 'R3' }, NOW);
  domain.updateOrderStatus(db, order.id, { status: 'shipped' }, NOW);
  domain.updateOrderStatus(db, order.id, { status: 'delivered' }, NOW);
  const inWindow = new Date(Date.parse(NOW) + 10 * 3600000).toISOString();
  domain.reportProblem(order, { message: '2 bags were wet on arrival' }, inWindow);
  assert.equal(order.status, 'delivered');
  assert.equal(order.problems.length, 1);
  const late = new Date(Date.parse(NOW) + 60 * 3600000).toISOString();
  assert.throws(() => domain.reportProblem(order, { message: 'Late complaint here' }, late), (e) => e.code === 'claim_window_closed');
});

test('a problem report needs a real description', () => {
  const db = freshDb();
  const lot = db.lots.find((l) => l.code === 'AL-2611-001');
  const order = domain.createOrder(db, { customer, lines: [{ lotCode: lot.code, kg: 30 }] }, NOW);
  Object.assign(order, { status: 'delivered' });
  order.timeline.push({ status: 'delivered', at: NOW, note: '' });
  assert.throws(() => domain.reportProblem(order, { message: 'bad' }, NOW), (e) => Boolean(e.fields && e.fields.message));
});
