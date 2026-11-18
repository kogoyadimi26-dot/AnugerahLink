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

// Angka ini sengaja berbeda dari spreadsheet v2 (margin Rp33.900/kg, impas 11.800 ton) karena Lokal dinaikkan ke Rp130.000.
// Dengan Lokal Rp100.000, hasilnya tetap sama dengan spreadsheet v2 (lihat test berikut).
test('economics with the default mix uses the repriced Local tier', () => {
  const e = pricing.economics({ mix: config.defaultMix });
  assert.equal(e.salesPerKgBought, 170050);   // 95% x blended Rp179.000
  assert.equal(e.buyPerKgBought, 120000);
  assert.equal(e.shippingPerKgBought, 5700);
  assert.equal(e.feesPerKgBought, 1900);
  assert.equal(e.grossMarginPerKgBought, 42450);
  assert.equal(e.breakEvenKgPerYear, 14512);  // 616M / 42,450 = 14,511.2, rounded up
});

test('economics with the v2 Local price still matches the v2 spreadsheet', () => {
  const tiers = { ...config.tiers, local: { ...config.tiers.local, pricePerKg: 100000 } };
  const e = pricing.economics({ mix: config.defaultMix, tiers, fixedCostsPerYear: 400000000 });
  assert.equal(e.salesPerKgBought, 161500);
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
  assert.equal(l.pricePerKg, config.tiers.local.pricePerKg);
});

test('local tier stays above break-even at the planning buy price', () => {
  const e = pricing.economics({ mix: { local: 1 }, buyPricePerKg: config.buyPricePerKg });
  assert.ok(e.grossMarginPerKgBought >= 0, `Lokal rugi Rp${-e.grossMarginPerKgBought}/kg`);
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
  const lot = domain.createIntake(db, { groupId: 'g-1', harvestDate: '2026-11-10', kgIn: 200, process: 'Washed', sampleId: 'S-001', moisturePct: 11, defectCount: 10 }, NOW);
  assert.equal(lot.status, 'received');
  const grader = { id: 'u-grader', name: 'Penilai' };
  const admin = { id: 'u-admin', name: 'Admin' };
  assert.throws(() => domain.publishLot(db, lot.id, admin, NOW), (e) => e.status === 409);
  domain.gradeLot(db, lot.id, { tier: 'premium', grade: 'SNI Grade 1', cupScore: '84', sellableKg: '190', moisturePct: '11' });
  assert.equal(lot.status, 'graded');
  assert.throws(() => domain.publishLot(db, lot.id, admin, NOW), (e) => e.status === 409, 'must be verified first');
  domain.verifyLot(db, lot.id, grader, NOW);
  assert.equal(lot.status, 'verified');
  domain.publishLot(db, lot.id, admin, NOW);
  assert.equal(lot.status, 'listed');
  assert.equal(lot.publishedBy.name, 'Admin');
  assert.ok(lot.passportHash);
});

test('the person who verified a lot cannot publish it', () => {
  const db = freshDb();
  const lot = domain.createIntake(db, { groupId: 'g-1', harvestDate: '2026-11-10', kgIn: 100, process: 'Washed', sampleId: 'S-WF', moisturePct: 11, defectCount: 10 }, NOW);
  domain.gradeLot(db, lot.id, { tier: 'premium', grade: 'SNI Grade 1', cupScore: '84', sellableKg: '90', moisturePct: '11' });
  const same = { id: 'u-1', name: 'Pemilik' };
  domain.verifyLot(db, lot.id, same, NOW);
  assert.throws(() => domain.publishLot(db, lot.id, same, NOW), (e) => e.code === 'same_person');
});

test('a verified lot is locked against grading changes', () => {
  const db = freshDb();
  const lot = domain.createIntake(db, { groupId: 'g-1', harvestDate: '2026-11-10', kgIn: 100, process: 'Washed', sampleId: 'S-LK', moisturePct: 11, defectCount: 10 }, NOW);
  domain.gradeLot(db, lot.id, { tier: 'premium', grade: 'SNI Grade 1', cupScore: '84', sellableKg: '90', moisturePct: '11' });
  domain.verifyLot(db, lot.id, { id: 'u-1', name: 'Penilai' }, NOW);
  assert.throws(() => domain.gradeLot(db, lot.id, { cupScore: 80 }), (e) => e.status === 409);
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
  const lot = domain.createIntake(db, { groupId: 'g-2', harvestDate: '2026-11-10', kgIn: 100, sampleId: 'S-002', moisturePct: 11, defectCount: 10 }, NOW);
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

// ---------- pemeriksaan saat pembelian ----------

test('a lot that passes intake is paid at the full price', () => {
  const db = freshDb();
  const lot = domain.createIntake(db, { groupId: 'g-1', harvestDate: '2026-11-10', kgIn: 100, sampleId: 'S-10', moisturePct: 11, defectCount: 12 }, NOW);
  assert.equal(lot.intakeCheck.result, 'passed');
  assert.equal(lot.intakeCheck.amountDue, 100 * 120000);
  assert.equal(lot.intakeCheck.cashApproved, true);
  assert.equal(lot.status, 'received');
});

test('a lot with too many defects is paid at the reduced price', () => {
  const db = freshDb();
  const lot = domain.createIntake(db, { groupId: 'g-1', harvestDate: '2026-11-10', kgIn: 100, sampleId: 'S-11', moisturePct: 11, defectCount: 40 }, NOW);
  assert.equal(lot.intakeCheck.result, 'adjusted');
  assert.equal(lot.intakeCheck.effectivePricePerKg, Math.round(120000 * 0.9));
  assert.equal(lot.intakeCheck.amountDue, 100 * Math.round(120000 * 0.9));
});

test('a lot with bad moisture is rejected: no cash, cannot be graded or listed', () => {
  const db = freshDb();
  const lot = domain.createIntake(db, { groupId: 'g-1', harvestDate: '2026-11-10', kgIn: 100, sampleId: 'S-12', moisturePct: 16, defectCount: 5 }, NOW);
  assert.equal(lot.status, 'rejected');
  assert.equal(lot.intakeCheck.cashApproved, false);
  assert.equal(lot.intakeCheck.amountDue, 0);
  assert.throws(() => domain.gradeLot(db, lot.id, { tier: 'local', grade: 'G3', cupScore: 70, sellableKg: 90 }), (e) => e.code === 'rejected_at_intake');
});

test('intake needs a sample number and a valid moisture and defect count', () => {
  const db = freshDb();
  try {
    domain.createIntake(db, { groupId: 'g-1', harvestDate: '2026-11-10', kgIn: 100 }, NOW);
    assert.fail('expected validation error');
  } catch (e) {
    assert.equal(e.status, 400);
    assert.ok(e.fields.sampleId && e.fields.moisturePct && e.fields.defectCount);
  }
});

test('hulling yield is recorded when gabah and green weights are given', () => {
  const db = freshDb();
  const lot = domain.createIntake(db, { groupId: 'g-1', harvestDate: '2026-11-10', kgIn: 100, sampleId: 'S-13', moisturePct: 11, defectCount: 5, gabahKg: 50, greenKg: 40 }, NOW);
  assert.equal(lot.intakeCheck.yieldPct, 80);
  assert.throws(() => domain.createIntake(db, { groupId: 'g-1', harvestDate: '2026-11-10', kgIn: 100, sampleId: 'S-14', moisturePct: 11, defectCount: 5, gabahKg: 10, greenKg: 20 }, NOW), (e) => Boolean(e.fields && e.fields.greenKg));
});

test('a single lot line cannot exceed the maximum order size', () => {
  const db = freshDb();
  const lot = db.lots.find((l) => l.code === 'AL-2611-001');
  assert.ok(config.maxOrderKg > 0, 'maxOrderKg is configured');
  assert.throws(() => domain.quote(db, [{ lotCode: lot.code, kg: config.maxOrderKg + 1 }]), (e) => e.status === 400);
});

test('grade bands set the price: defects 26 to 45 pay 90%, 46 to 60 pay 80%', () => {
  const db = freshDb();
  const b = domain.createIntake(db, { groupId: 'g-1', harvestDate: '2026-11-10', kgIn: 100, sampleId: 'S-20', moisturePct: 11, defectCount: 30 }, NOW);
  assert.equal(b.intakeCheck.gradeKey, 'B');
  assert.equal(b.intakeCheck.payPct, 90);
  const c = domain.createIntake(db, { groupId: 'g-1', harvestDate: '2026-11-10', kgIn: 100, sampleId: 'S-21', moisturePct: 11, defectCount: 50 }, NOW);
  assert.equal(c.intakeCheck.gradeKey, 'C');
  assert.equal(c.intakeCheck.amountDue, 100 * 120000 * 0.8);
});

test('moisture outside target keeps a lot out of grade A', () => {
  const db = freshDb();
  const lot = domain.createIntake(db, { groupId: 'g-1', harvestDate: '2026-11-10', kgIn: 100, sampleId: 'S-22', moisturePct: 9, defectCount: 5 }, NOW);
  assert.equal(lot.intakeCheck.gradeKey, 'B');
  assert.equal(lot.intakeCheck.result, 'adjusted');
});

test('intake records the three field checks', () => {
  const db = freshDb();
  const lot = domain.createIntake(db, { groupId: 'g-1', harvestDate: '2026-11-10', kgIn: 100, sampleId: 'S-23', moisturePct: 11, defectCount: 5, scaleCalibrated: true, farmerPresent: 'true', retainedSample: false }, NOW);
  assert.deepEqual(lot.intakeCheck.evidence, { scaleCalibrated: true, farmerPresent: true, retainedSample: false });
});

test('online limit is 999 kg and the proposal threshold starts at 1,000 kg', () => {
  assert.equal(config.maxOrderKg, 999);
  assert.equal(config.largeOrderMinKg, 1000);
  assert.ok(config.maxOrderKg < config.largeOrderMinKg);
});
