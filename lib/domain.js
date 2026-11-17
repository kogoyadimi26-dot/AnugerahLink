'use strict';

// Business operations over a database object. Every function here either changes the
// object it is given (call these inside store.update) or only reads it.
const crypto = require('crypto');
const config = require('../config/business');
const pricing = require('./pricing');
const passport = require('./passport');
const { ApiError, Problems, str, oneOf, num, email, phone, isDateString } = require('./validate');

// The team marks an order delivered. The buyer then confirms receipt, which completes it.
// The team can also complete it after the claim window if the buyer never responds.
const ORDER_TRANSITIONS = {
  requested: ['confirmed', 'cancelled'],
  confirmed: ['paid', 'cancelled'],
  paid: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['completed'],
  completed: [],
  cancelled: [],
};
const ORDER_STATUS_LABELS = {
  requested: 'Diminta', confirmed: 'Dikonfirmasi', paid: 'Sudah dibayar', shipped: 'Dikirim', delivered: 'Sudah diantar', completed: 'Selesai', cancelled: 'Dibatalkan',
};
const BUYER_TYPES = ['specialty_cafe', 'premium_roaster', 'roaster', 'papua_business', 'other'];
const FEEDBACK_TAGS = ['pass-to-farmer', 'internal-quality', 'internal-logistics', 'discard'];
const ISSUES = ['none', 'unripe', 'mould', 'uneven_drying', 'defects', 'other'];
const REORDER = ['yes', 'maybe', 'no'];
const TIER_CODES = Object.keys(config.tiers);
const PUBLIC_SORTS = ['cup_desc', 'price_asc', 'price_desc', 'freshest'];

function byId(list, id) {
  return list.find((x) => x.id === id) || null;
}

function availableKg(lot) {
  if (lot.status !== 'listed') return 0;
  return Math.max(0, (lot.sellableKg || 0) - (lot.reservedKg || 0) - (lot.soldKg || 0));
}

function shippingNote(tierCode) {
  const by = config.tiers[tierCode].shippingBy;
  if (by === 'anugerah') return 'Ongkir sudah termasuk';
  if (by === 'buyer') return `Ongkir tambahan: Rp${config.shippingPerKg.toLocaleString('id-ID')}/kg`;
  return 'Diambil di Papua, tanpa kargo udara';
}

// Cocokkan teks proses dari lot dengan penjelasan di config/business.js.
function processInfo(text) {
  const norm = String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!norm) return null;
  for (const [key, def] of Object.entries(config.processes || {})) {
    if (def.match.includes(norm)) return { key, label: def.label, description: def.description };
  }
  return null;
}

// Tambahkan wilayah dari seed yang belum ada di basis data (tanpa mengubah wilayah yang sudah ada).
function ensureRegions(db, defaults) {
  let added = 0;
  for (const r of defaults) {
    if (!db.regions.some((x) => x.id === r.id)) { db.regions.push({ ...r }); added += 1; }
  }
  return added;
}

function publicLot(db, lot) {
  const region = byId(db.regions, lot.regionId) || {};
  const group = byId(db.groups, lot.groupId) || {};
  const tier = config.tiers[lot.tier];
  const avail = availableKg(lot);
  return {
    code: lot.code,
    tier: lot.tier,
    tierLabel: tier.label,
    tierDescription: tier.description,
    grade: lot.grade,
    cupScore: lot.cupScore,
    process: lot.process,
    harvestDate: lot.harvestDate,
    regionName: region.name,
    regency: region.regency,
    groupName: group.name,
    pricePerKg: tier.pricePerKg,
    shippingNote: shippingNote(lot.tier),
    shippingPerKgExtra: pricing.buyerShippingPerKg(lot.tier),
    processInfo: processInfo(lot.process),
    availableKg: avail,
    lowStock: avail > 0 && avail < config.lowStockKg,
    soldOut: avail === 0,
    sample: Boolean(lot.sample || group.sample),
    minOrderKg: config.minOrderKg,
    stepKg: config.stepKg,
  };
}

function listPublicLots(db, query = {}) {
  let rows = db.lots.filter((l) => l.status === 'listed');
  if (query.tier && TIER_CODES.includes(query.tier)) rows = rows.filter((l) => l.tier === query.tier);
  if (query.region) rows = rows.filter((l) => l.regionId === query.region);
  if (query.inStock !== '0') rows = rows.filter((l) => availableKg(l) > 0);
  const views = rows.map((l) => publicLot(db, l));
  const sort = PUBLIC_SORTS.includes(query.sort) ? query.sort : 'cup_desc';
  const cmp = {
    cup_desc: (a, b) => (b.cupScore || 0) - (a.cupScore || 0),
    price_asc: (a, b) => a.pricePerKg - b.pricePerKg,
    price_desc: (a, b) => b.pricePerKg - a.pricePerKg,
    freshest: (a, b) => String(b.harvestDate).localeCompare(String(a.harvestDate)),
  }[sort];
  views.sort(cmp);
  return views;
}

function passportView(db, lot) {
  const group = byId(db.groups, lot.groupId);
  const region = byId(db.regions, lot.regionId);
  const record = passport.passportRecord({ lot, group, region });
  const computed = passport.hashRecord(record);
  const stored = lot.passportHash || null;
  return {
    processInfo: processInfo(lot.process),
    record,
    hash: stored || computed,
    recomputedHash: computed,
    recordMatchesHash: stored ? stored === computed : null,
    publishedAt: lot.publishedAt,
    status: lot.status,
    sample: Boolean(lot.sample || (group && group.sample)),
    availableKg: availableKg(lot),
    shippingNote: shippingNote(lot.tier),
  };
}

// Check a cart against live stock. Returns priced lines and totals, or problems per line.
function quote(db, rawLines) {
  const problems = new Problems();
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    problems.add('lines', 'Tambahkan minimal satu lot ke pesanan.');
    problems.throwIfAny();
  }
  if (rawLines.length > 20) problems.add('lines', 'Satu pesanan maksimal 20 lot.');
  const seen = new Set();
  const lines = [];
  const stockIssues = [];
  rawLines.forEach((raw, i) => {
    const code = raw && typeof raw.lotCode === 'string' ? raw.lotCode : '';
    const kg = raw && typeof raw.kg === 'number' ? raw.kg : Number(raw && raw.kg);
    if (!code) { problems.add(`lines[${i}].lotCode`, 'Lot belum dipilih.'); return; }
    if (seen.has(code)) { problems.add(`lines[${i}].lotCode`, 'Setiap lot hanya bisa muncul sekali. Ubah jumlahnya saja.'); return; }
    seen.add(code);
    const lot = db.lots.find((l) => l.code === code);
    if (!lot || lot.status !== 'listed') { stockIssues.push({ lotCode: code, reason: 'not_available', message: 'Lot ini tidak lagi tersedia.' }); return; }
    const kgErr = pricing.kgProblem(kg);
    if (kgErr) { problems.add(`lines[${i}].kg`, kgErr); return; }
    const avail = availableKg(lot);
    if (kg > avail) {
      stockIssues.push({ lotCode: code, reason: 'short_stock', availableKg: avail, message: avail > 0 ? `Sisa ${avail} kg.` : 'Habis terjual.' });
      return;
    }
    lines.push(pricing.priceLine(lot, kg));
  });
  problems.throwIfAny();
  const totals = pricing.totalsFor(lines);
  return { lines, totals, stockIssues };
}

function nextCode(db, prefix, counterKey) {
  db.counters[counterKey] += 1;
  const now = new Date();
  const yy = String(now.getUTCFullYear()).slice(2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${prefix}-${yy}${mm}-${String(db.counters[counterKey]).padStart(3, '0')}`;
}

function createOrder(db, body, now) {
  const problems = new Problems();
  const customer = {
    name: str(problems, body.customer || {}, 'name', { min: 2, max: 80, required: true, label: 'Nama' }),
    company: str(problems, body.customer || {}, 'company', { max: 120, label: 'Perusahaan' }),
    buyerType: oneOf(problems, body.customer || {}, 'buyerType', BUYER_TYPES, { required: true, label: 'Jenis pembeli' }),
    phone: phone(problems, body.customer || {}, 'phone'),
    email: email(problems, body.customer || {}, 'email'),
    city: str(problems, body.customer || {}, 'city', { min: 2, max: 80, required: true, label: 'Kota pengiriman' }),
    notes: str(problems, body.customer || {}, 'notes', { max: 500, label: 'Catatan' }),
  };
  problems.throwIfAny();
  const { lines, totals, stockIssues } = quote(db, body.lines);
  if (stockIssues.length > 0) {
    throw new ApiError(409, 'stock_changed', 'Beberapa lot berubah sejak ditambahkan ke keranjang. Mohon periksa pesanan Anda.', { stockIssues });
  }
  // Stock was checked above inside the same update, so reserve it now.
  for (const line of lines) {
    const lot = db.lots.find((l) => l.code === line.lotCode);
    lot.reservedKg = (lot.reservedKg || 0) + line.kg;
  }
  const number = nextCode(db, 'ALO', 'order');
  const order = {
    id: crypto.randomUUID(),
    number,
    status: 'requested',
    customer,
    lines,
    subtotal: totals.subtotal,
    shipping: totals.shipping,
    total: totals.total,
    payment: { method: config.payment.method, reference: '' },
    timeline: [{ status: 'requested', at: now, note: 'Pesanan diterima. Stok dicadangkan.' }],
    createdAt: now,
    updatedAt: now,
  };
  db.orders.push(order);
  return order;
}

function publicOrder(order) {
  return {
    number: order.number,
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status],
    customerName: order.customer.name,
    company: order.customer.company,
    lines: order.lines,
    subtotal: order.subtotal,
    shipping: order.shipping,
    total: order.total,
    timeline: order.timeline,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    payment: { method: config.payment.method, bank: config.payment, reference: order.payment.reference },
    problems: (order.problems || []).map((p) => ({ message: p.message, createdAt: p.createdAt, status: p.status })),
    canConfirmReceipt: order.status === 'delivered',
    canReportProblem: ['delivered', 'completed'].includes(order.status) && withinClaimWindow(order, new Date().toISOString()),
    feedbackOpen: order.status === 'completed',
  };
}

// Hours between delivery and `nowIso`. Null if the order has no delivery entry yet.
function hoursSinceDelivery(order, nowIso) {
  const entry = order.timeline.find((t) => t.status === 'delivered');
  if (!entry) return null;
  return (Date.parse(nowIso) - Date.parse(entry.at)) / 3600000;
}

function withinClaimWindow(order, nowIso) {
  const hours = hoursSinceDelivery(order, nowIso);
  return hours !== null && hours <= config.policy.claimWindowHours;
}

// The buyer confirms they have received the order. This is the escrow-style step:
// the order is only completed after the buyer has checked it.
function confirmReceipt(order, now) {
  if (order.status !== 'delivered') {
    throw new ApiError(409, 'not_delivered', 'Penerimaan bisa dikonfirmasi setelah pesanan ditandai diantar.');
  }
  order.status = 'completed';
  order.updatedAt = now;
  order.timeline.push({ status: 'completed', at: now, note: 'Pembeli mengonfirmasi penerimaan.' });
  return order;
}

// The buyer reports a problem within the claim window. The order status does not change;
// the team reviews the report under the policy in config/business.js.
function reportProblem(order, body, now) {
  if (!['delivered', 'completed'].includes(order.status)) {
    throw new ApiError(409, 'not_delivered', 'Laporan masalah bisa dikirim setelah pesanan diantar.');
  }
  if (!withinClaimWindow(order, now)) {
    throw new ApiError(409, 'claim_window_closed', `Laporan masalah harus dikirim dalam ${config.policy.claimWindowHours} jam sejak pengantaran. Hubungi tim melalui email.`);
  }
  const problems = new Problems();
  const message = str(problems, body, 'message', { min: 10, max: 1000, required: true, label: 'Uraian masalah' });
  problems.throwIfAny();
  order.problems = order.problems || [];
  const report = { id: crypto.randomUUID(), message, createdAt: now, status: 'open' };
  order.problems.push(report);
  order.timeline.push({ status: order.status, at: now, note: 'Pembeli melaporkan masalah.' });
  order.updatedAt = now;
  return report;
}

function findOrderForBuyer(db, number, emailAddress) {
  const order = db.orders.find((o) => o.number === number);
  if (!order || !emailAddress || order.customer.email !== String(emailAddress).trim().toLowerCase()) return null;
  return order;
}

function updateOrderStatus(db, orderId, body, now) {
  const order = byId(db.orders, orderId);
  if (!order) throw new ApiError(404, 'not_found', 'Pesanan tidak ditemukan.');
  const problems = new Problems();
  const target = oneOf(problems, body, 'status', Object.keys(ORDER_STATUS_LABELS), { required: true, label: 'Status' });
  const paymentRef = str(problems, body, 'paymentReference', { max: 80, label: 'Nomor referensi bayar' });
  problems.throwIfAny();
  if (!ORDER_TRANSITIONS[order.status].includes(target)) {
    throw new ApiError(409, 'invalid_transition', `Pesanan tidak bisa berpindah dari ${ORDER_STATUS_LABELS[order.status]} ke ${ORDER_STATUS_LABELS[target]}.`);
  }
  if (target === 'paid' && !paymentRef && !order.payment.reference) {
    problems.add('paymentReference', 'Isi nomor referensi transfer sebelum menandai sudah dibayar.');
    problems.throwIfAny();
  }
  if (paymentRef) order.payment.reference = paymentRef;
  for (const line of order.lines) {
    const lot = db.lots.find((l) => l.code === line.lotCode);
    if (!lot) continue;
    if (target === 'cancelled') {
      lot.reservedKg = Math.max(0, (lot.reservedKg || 0) - line.kg);
    }
    if (target === 'shipped') {
      lot.reservedKg = Math.max(0, (lot.reservedKg || 0) - line.kg);
      lot.soldKg = (lot.soldKg || 0) + line.kg;
    }
  }
  order.status = target;
  order.updatedAt = now;
  order.timeline.push({ status: target, at: now, note: body.note ? String(body.note).slice(0, 200) : '' });
  return order;
}

// Keputusan pemeriksaan saat pembelian: lolos, dipotong harga, atau ditolak.
function intakeDecision(moisturePct, defectCount) {
  const c = config.intake;
  if (moisturePct < c.moisture.rejectBelow || moisturePct > c.moisture.rejectAbove || defectCount > c.defects.reject) {
    return { result: 'rejected', deductionPct: 100 };
  }
  if (moisturePct >= c.moisture.min && moisturePct <= c.moisture.max && defectCount <= c.defects.pass) {
    return { result: 'passed', deductionPct: 0 };
  }
  return { result: 'adjusted', deductionPct: c.deductionPct };
}

function createIntake(db, body, now) {
  const problems = new Problems();
  const groupId = str(problems, body, 'groupId', { required: true, label: 'Kelompok tani' });
  const group = byId(db.groups, groupId);
  if (groupId && !group) problems.add('groupId', 'Pilih kelompok tani.');
  const harvestDate = str(problems, body, 'harvestDate', { required: true, label: 'Tanggal panen' });
  if (harvestDate && !isDateString(harvestDate)) problems.add('harvestDate', 'Gunakan format TTTT-BB-HH.');
  const kgIn = num(problems, body, 'kgIn', { min: 1, max: 50000, integer: true, required: true, label: 'Kg diterima' });
  const buyPricePerKg = num(problems, body, 'buyPricePerKg', { min: 1000, max: 1000000, integer: true, label: 'Harga beli' }) || config.buyPricePerKg;
  const process = str(problems, body, 'process', { max: 40, label: 'Proses' });
  const notes = str(problems, body, 'notes', { max: 500, label: 'Catatan' });
  // Pemeriksaan sampel (wajib)
  const sampleId = str(problems, body, 'sampleId', { min: 1, max: 40, required: true, label: 'Nomor sampel' });
  const moisturePct = num(problems, body, 'moisturePct', { min: 5, max: 20, required: true, label: 'Kadar air %' });
  const defectCount = num(problems, body, 'defectCount', { min: 0, max: 300, integer: true, required: true, label: 'Jumlah cacat' });
  // Hasil hulling (opsional): kopi gabah dan biji hijau setelah dihulling
  const gabahKg = num(problems, body, 'gabahKg', { min: 0.1, max: 50000, label: 'Kg gabah' });
  const greenKg = num(problems, body, 'greenKg', { min: 0.1, max: 50000, label: 'Kg biji hijau' });
  if (gabahKg !== null && greenKg !== null && greenKg > gabahKg) {
    problems.add('greenKg', 'Kg biji hijau tidak boleh lebih dari kg gabah.');
  }
  problems.throwIfAny();
  const decision = intakeDecision(moisturePct, defectCount);
  const effectivePricePerKg = Math.round(buyPricePerKg * (1 - decision.deductionPct / 100));
  const amountDue = decision.result === 'rejected' ? 0 : Math.round(kgIn * effectivePricePerKg);
  const lot = {
    id: crypto.randomUUID(),
    code: nextCode(db, 'AL', 'lot'),
    groupId,
    regionId: group.regionId,
    harvestDate,
    process,
    kgIn,
    buyPricePerKg,
    sortingLossPct: config.sortingLossPct,
    sellableKg: null,
    reservedKg: 0,
    soldKg: 0,
    tier: null,
    grade: '',
    cupScore: null,
    moisturePct: null,
    status: decision.result === 'rejected' ? 'rejected' : 'received',
    intakeCheck: {
      sampleId,
      moisturePct,
      defectCount,
      sampleGrams: config.intake.sampleGrams,
      gabahKg,
      greenKg,
      yieldPct: gabahKg && greenKg ? Math.round((greenKg / gabahKg) * 1000) / 10 : null,
      result: decision.result,
      deductionPct: decision.deductionPct,
      effectivePricePerKg,
      amountDue,
      cashApproved: decision.result !== 'rejected',
      checkedAt: now,
    },
    publishedAt: null,
    passportHash: null,
    notes,
    createdAt: now,
  };
  db.lots.push(lot);
  return lot;
}

function createGroup(db, body) {
  const problems = new Problems();
  const name = str(problems, body, 'name', { min: 3, max: 80, required: true, label: 'Nama kelompok' });
  const regionId = str(problems, body, 'regionId', { required: true, label: 'Wilayah' });
  if (regionId && !byId(db.regions, regionId)) problems.add('regionId', 'Pilih wilayah.');
  const contact = str(problems, body, 'contact', { max: 200, label: 'Kontak (internal)' });
  problems.throwIfAny();
  db.counters.group += 1;
  const group = { id: `g-${db.counters.group}`, name, regionId, contact, sample: false };
  db.groups.push(group);
  return group;
}

function gradeLot(db, lotId, body) {
  const lot = byId(db.lots, lotId);
  if (!lot) throw new ApiError(404, 'not_found', 'Lot tidak ditemukan.');
  if (lot.status === 'rejected') {
    throw new ApiError(409, 'rejected_at_intake', 'Lot ditolak saat pemeriksaan pembelian. Lot ini tidak bisa dinilai atau dijual.');
  }
  if (lot.status === 'listed' || lot.status === 'withdrawn') {
    throw new ApiError(409, 'locked', 'Lot yang sudah tayang tidak bisa diubah. Tarik dulu dari penjualan, lalu ubah.');
  }
  const problems = new Problems();
  const update = {};
  const sellable = num(problems, body, 'sellableKg', { min: 1, integer: true, label: 'Kg siap jual' });
  if (sellable !== null && sellable > lot.kgIn) problems.add('sellableKg', 'Kg siap jual tidak boleh lebih dari kg diterima.');
  if (sellable !== null) update.sellableKg = sellable;
  const cup = num(problems, body, 'cupScore', { min: 60, max: 100, label: 'Skor cupping' });
  if (cup !== null) update.cupScore = cup;
  const moisture = num(problems, body, 'moisturePct', { min: 5, max: 20, label: 'Kadar air %' });
  if (moisture !== null) update.moisturePct = moisture;
  const tier = oneOf(problems, body, 'tier', TIER_CODES, { label: 'Kategori' });
  if (tier) update.tier = tier;
  const grade = str(problems, body, 'grade', { max: 40, label: 'Grade' });
  if (grade) update.grade = grade;
  const process = str(problems, body, 'process', { max: 40, label: 'Proses' });
  if (process) update.process = process;
  if (body.notes !== undefined) update.notes = str(problems, body, 'notes', { max: 500, label: 'Catatan' });
  if (body.harvestDate !== undefined) {
    const hd = str(problems, body, 'harvestDate', { required: true, label: 'Tanggal panen' });
    if (!isDateString(hd)) problems.add('harvestDate', 'Gunakan format TTTT-BB-HH.');
    else update.harvestDate = hd;
  }
  problems.throwIfAny();
  Object.assign(lot, update);
  const complete = lot.sellableKg && lot.cupScore && lot.tier && lot.grade;
  lot.status = complete ? 'graded' : 'received';
  return lot;
}

function publishLot(db, lotId, now) {
  const lot = byId(db.lots, lotId);
  if (!lot) throw new ApiError(404, 'not_found', 'Lot tidak ditemukan.');
  if (lot.status !== 'graded') {
    throw new ApiError(409, 'not_graded', 'Nilai lot dulu: tier, grade, skor cupping dan kg siap jual wajib diisi.');
  }
  const group = byId(db.groups, lot.groupId);
  const region = byId(db.regions, lot.regionId);
  lot.passportHash = passport.hashRecord(passport.passportRecord({ lot, group, region }));
  lot.status = 'listed';
  lot.publishedAt = now;
  return lot;
}

function withdrawLot(db, lotId) {
  const lot = byId(db.lots, lotId);
  if (!lot) throw new ApiError(404, 'not_found', 'Lot tidak ditemukan.');
  if (lot.status !== 'listed') throw new ApiError(409, 'not_listed', 'Hanya lot yang sudah tayang yang bisa ditarik.');
  if ((lot.reservedKg || 0) > 0) throw new ApiError(409, 'has_reservations', 'Lot ini masih punya pesanan terbuka. Selesaikan dulu sebelum menarik lot.');
  lot.status = 'withdrawn';
  return lot;
}

// Passports for lots that were listed before hashes were stored: compute once at startup.
function ensurePassportHashes(db) {
  let changed = 0;
  for (const lot of db.lots) {
    if (lot.status === 'listed' && !lot.passportHash) {
      const group = byId(db.groups, lot.groupId);
      const region = byId(db.regions, lot.regionId);
      lot.passportHash = passport.hashRecord(passport.passportRecord({ lot, group, region }));
      changed += 1;
    }
  }
  return changed;
}

function createFeedback(db, order, body, now) {
  if (order.status !== 'completed') throw new ApiError(409, 'not_completed', 'Umpan balik dibuka setelah Anda mengonfirmasi penerimaan.');
  if (db.feedback.some((f) => f.orderId === order.id)) throw new ApiError(409, 'already_sent', 'Umpan balik untuk pesanan ini sudah diterima. Terima kasih.');
  const problems = new Problems();
  const items = body.items;
  if (!Array.isArray(items) || items.length === 0) problems.add('items', 'Beri penilaian minimal satu lot.');
  const created = [];
  const orderCodes = new Set(order.lines.map((l) => l.lotCode));
  (Array.isArray(items) ? items : []).forEach((raw, i) => {
    const p = new Problems();
    const lotCode = str(p, raw || {}, 'lotCode', { required: true, label: 'Lot' });
    if (lotCode && !orderCodes.has(lotCode)) p.add('lotCode', 'Lot ini tidak ada di pesanan Anda.');
    const taste = str(p, raw || {}, 'taste', { max: 300, label: 'Catatan rasa' });
    const issues = oneOf(p, raw || {}, 'issues', ISSUES, { label: 'Masalah mutu' }) || 'none';
    const reorder = oneOf(p, raw || {}, 'reorder', REORDER, { required: true, label: 'Pesan ulang' });
    if (p.any) {
      for (const [field, msg] of Object.entries(p.fields)) problems.add(`items[${i}].${field}`, msg);
      return;
    }
    const lot = db.lots.find((l) => l.code === lotCode);
    created.push({
      id: crypto.randomUUID(),
      orderId: order.id,
      orderNumber: order.number,
      lotCode,
      groupId: lot ? lot.groupId : null,
      taste,
      issues,
      reorder,
      tag: null,
      createdAt: now,
    });
  });
  problems.throwIfAny();
  const notes = str(problems, body, 'notes', { max: 500, label: 'Catatan' });
  for (const f of created) f.notes = notes;
  db.feedback.push(...created);
  return created;
}

function tagFeedback(db, id, body) {
  const item = byId(db.feedback, id);
  if (!item) throw new ApiError(404, 'not_found', 'Umpan balik tidak ditemukan.');
  const problems = new Problems();
  const tag = oneOf(problems, body, 'tag', FEEDBACK_TAGS, { required: true, label: 'Tag' });
  problems.throwIfAny();
  item.tag = tag;
  return item;
}

// Only pass-to-farmer comments and the group's own grading reach a farmer report.
// Buyer identities and prices paid never appear here.
function farmerReport(db, groupId) {
  const group = byId(db.groups, groupId);
  if (!group) throw new ApiError(404, 'not_found', 'Kelompok tani tidak ditemukan.');
  const lots = db.lots.filter((l) => l.groupId === groupId && l.status !== 'received');
  const lotRows = lots.map((l) => ({
    code: l.code,
    harvestDate: l.harvestDate,
    tier: l.tier,
    grade: l.grade,
    cupScore: l.cupScore,
    kgIn: l.kgIn,
    sellableKg: l.sellableKg,
    soldKg: l.soldKg || 0,
  }));
  const comments = db.feedback
    .filter((f) => f.groupId === groupId && f.tag === 'pass-to-farmer')
    .map((f) => ({ lotCode: f.lotCode, taste: f.taste, issues: f.issues }));
  return { group: group.name, lots: lotRows, comments };
}

function summary(db) {
  const stockByTier = Object.fromEntries(TIER_CODES.map((t) => [t, 0]));
  const sellableByTier = Object.fromEntries(TIER_CODES.map((t) => [t, 0]));
  for (const lot of db.lots) {
    if (lot.status !== 'listed') continue;
    stockByTier[lot.tier] += availableKg(lot);
    sellableByTier[lot.tier] += lot.sellableKg || 0;
  }
  const sellableTotal = Object.values(sellableByTier).reduce((a, b) => a + b, 0);
  const mix = sellableTotal > 0
    ? Object.fromEntries(TIER_CODES.map((t) => [t, sellableByTier[t] / sellableTotal]))
    : config.defaultMix;
  const ordersByStatus = Object.fromEntries(Object.keys(ORDER_STATUS_LABELS).map((s) => [s, 0]));
  let openRevenue = 0;
  let deliveredRevenue = 0;
  for (const o of db.orders) {
    ordersByStatus[o.status] += 1;
    if (['requested', 'confirmed', 'paid'].includes(o.status)) openRevenue += o.total;
    if (['shipped', 'delivered', 'completed'].includes(o.status)) deliveredRevenue += o.total;
  }
  return {
    stockKgByTier: stockByTier,
    totalStockKg: Object.values(stockByTier).reduce((a, b) => a + b, 0),
    ordersByStatus,
    openRevenue,
    deliveredRevenue,
    feedbackToReview: db.feedback.filter((f) => !f.tag).length,
    mixUsed: mix,
    mixSource: sellableTotal > 0 ? 'listed stock' : 'assumed default',
    economics: pricing.economics({ mix }),
  };
}

module.exports = {
  ORDER_STATUS_LABELS, ORDER_TRANSITIONS, BUYER_TYPES, FEEDBACK_TAGS, ISSUES, REORDER, TIER_CODES,
  ensureRegions, processInfo, availableKg, publicLot, listPublicLots, passportView, quote, createOrder, publicOrder, findOrderForBuyer,
  updateOrderStatus, createIntake, gradeLot, publishLot, withdrawLot, ensurePassportHashes,
  createFeedback, tagFeedback, farmerReport, summary, byId, createGroup,
  confirmReceipt, reportProblem,
};
