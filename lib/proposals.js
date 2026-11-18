'use strict';

// Proposal pesanan besar (1.000 kg ke atas). Fungsi murni atas data basis data.
// Alur dan status: docs/app/LARGE_ORDER_PLAN.md.
const crypto = require('crypto');
const { ApiError, Problems, str, oneOf, num, email, phone } = require('./validate');
const { availableKg } = require('./domain');
const config = require('../config/business');
const notify = require('./notify');

const DAY = 86400000;
const DEPOSIT_PCT = 30;
const OFFER_VALID_DAYS = 7;
const DEPOSIT_DUE_DAYS = 5;
const STEP_KG = 100;
const TIERS = Object.keys(config.tiers);
const COLLECT = 'collect_jayapura';
const DELIVER = 'delivered';
const DELIVERY_TERMS = [COLLECT, DELIVER];
const FREIGHT_BY = ['buyer', 'anugerah'];
const AGREEMENTS = ['accurate', 'verification', 'offerSubject', 'policy', 'privacy'];

const STATUS_LABELS = {
  draft: 'Draf',
  submitted: 'Diajukan',
  in_review: 'Ditinjau',
  need_info: 'Perlu informasi',
  offered: 'Penawaran dikirim',
  negotiating: 'Negosiasi',
  agreed: 'Disepakati',
  deposit_pending: 'Menunggu DP',
  deposit_paid: 'DP diterima',
  preparing: 'Disiapkan',
  balance_pending: 'Menunggu pelunasan',
  balance_paid: 'Lunas',
  shipped: 'Dikirim',
  completed: 'Selesai',
  declined: 'Ditolak',
  expired: 'Kedaluwarsa',
  cancelled: 'Dibatalkan',
};

// Transisi yang diizinkan. Kunci: status asal, nilai: tindakan -> status tujuan.
const TRANSITIONS = {
  submitted: { start_review: 'in_review', decline: 'declined' },
  in_review: { request_info: 'need_info', make_offer: 'offered', owner_approve: 'offered', decline: 'declined' },
  need_info: { resume_review: 'in_review', decline: 'declined' },
  offered: { accept: 'agreed', counter: 'negotiating', decline: 'declined' },
  negotiating: { make_offer: 'offered', decline: 'declined' },
  agreed: { request_deposit: 'deposit_pending', cancel: 'cancelled' },
  deposit_pending: { mark_deposit_paid: 'deposit_paid', cancel: 'cancelled' },
  deposit_paid: { start_prep: 'preparing' },
  preparing: { request_balance: 'balance_pending' },
  balance_pending: { mark_balance_paid: 'balance_paid' },
  balance_paid: { dispatch: 'shipped' },
  shipped: { complete: 'completed' },
};

// Tindakan yang dilakukan pembeli (sisanya oleh staf).
const BUYER_ACTIONS = ['accept', 'counter', 'decline'];

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// Teks ringkas dari status untuk tampilan.
function statusLabel(status) { return STATUS_LABELS[status] || status; }

// ---- Validasi formulir ----
function validateDraft(body, cfg = config) {
  const p = new Problems();
  const b = body || {};
  const f = {};
  f.company = str(p, b, 'company', { min: 2, max: 120, required: true, label: 'Nama perusahaan' });
  f.legalForm = str(p, b, 'legalForm', { max: 40, label: 'Bentuk badan usaha' });
  f.npwp = str(p, b, 'npwp', { max: 30, required: true, label: 'NPWP' });
  f.licence = str(p, b, 'licence', { max: 60, required: true, label: 'Nomor izin usaha' });
  f.contactName = str(p, b, 'contactName', { min: 2, max: 80, required: true, label: 'Nama kontak' });
  f.contactRole = str(p, b, 'contactRole', { max: 60, label: 'Jabatan' });
  f.phone = phone(p, b, 'phone');
  f.email = email(p, b, 'email');
  f.address = str(p, b, 'address', { min: 5, max: 240, required: true, label: 'Alamat tujuan' });
  f.city = str(p, b, 'city', { max: 80, required: true, label: 'Kota' });
  f.country = str(p, b, 'country', { max: 60, label: 'Negara' }) || 'Indonesia';

  const qty = Number(b.quantityKg);
  if (!Number.isFinite(qty) || qty < cfg.largeOrderMinKg) {
    p.add('quantityKg', `Jumlah minimal ${cfg.largeOrderMinKg} kg untuk proposal.`);
  } else if (qty % STEP_KG !== 0) {
    p.add('quantityKg', `Jumlah harus kelipatan ${STEP_KG} kg.`);
  }
  f.quantityKg = Number.isFinite(qty) ? qty : null;

  const tiers = Array.isArray(b.tiers) ? b.tiers : [];
  f.tiers = tiers.filter((t) => TIERS.includes(t));
  if (tiers.length && f.tiers.length !== tiers.length) p.add('tiers', 'Tingkat tidak valid.');
  if (!f.tiers.length) p.add('tiers', 'Pilih minimal satu tingkat.');

  f.minScore = b.minScore === undefined || b.minScore === '' ? null : num(p, b, 'minScore', { min: 70, max: 95, label: 'Skor cupping minimal' });
  f.processing = str(p, b, 'processing', { max: 60, label: 'Proses' });
  f.needBy = str(p, b, 'needBy', { max: 20, label: 'Dibutuhkan pada' });
  f.packaging = str(p, b, 'packaging', { max: 120, label: 'Kemasan' });
  f.intendedUse = str(p, b, 'intendedUse', { max: 240, label: 'Kegunaan' });
  f.deliveryTerms = oneOf(p, b, 'deliveryTerms', DELIVERY_TERMS, { required: true, label: 'Syarat pengiriman' });
  f.freightBy = oneOf(p, b, 'freightBy', FREIGHT_BY, { required: true, label: 'Pembayar ongkir' });
  f.paymentPref = str(p, b, 'paymentPref', { max: 60, label: 'Cara bayar' });
  return { fields: f, problems: p };
}

function checkAgreements(body) {
  const p = new Problems();
  const a = (body && body.agreements) || {};
  for (const key of AGREEMENTS) {
    if (a[key] !== true) p.add(`agreements.${key}`, 'Centang setiap persetujuan.');
  }
  return p;
}

// ---- Pembuatan dan pengeditan ----
function nextReference(db, now) {
  const d = new Date(now);
  const yymm = `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  const seq = (db.proposals || []).filter((x) => x.reference.startsWith(`ALP-${yymm}`)).length + 1;
  return `ALP-${yymm}-${String(seq).padStart(3, '0')}`;
}

function createProposal(db, buyer, body, now, cfg = config) {
  const { fields, problems } = validateDraft({ ...(body || {}) }, cfg);
  // Draf boleh tidak lengkap; validasi penuh dilakukan saat diajukan.
  db.proposals = db.proposals || [];
  const p = {
    id: crypto.randomUUID(),
    reference: nextReference(db, now),
    buyerId: buyer.id,
    status: 'draft',
    form: fields,
    agreements: {},
    lines: [],
    offers: [],
    checks: {},
    timeline: [{ at: now, status: 'draft', by: 'buyer' }],
    createdAt: now,
    updatedAt: now,
  };
  db.proposals.push(p);
  return { proposal: p, problems: problems.any ? problems.fields : null };
}

function updateDraft(db, id, buyer, body, now, cfg = config) {
  const p = findOwned(db, id, buyer);
  if (p.status !== 'draft' && p.status !== 'need_info') {
    throw new ApiError(409, 'not_editable', 'Proposal ini tidak bisa diubah pada status ini.');
  }
  const { fields, problems } = validateDraft({ ...p.form, ...(body || {}) }, cfg);
  p.form = fields;
  p.updatedAt = now;
  return { proposal: p, problems: problems.any ? problems.fields : null };
}

function submitProposal(db, id, buyer, body, now, cfg = config) {
  const p = findOwned(db, id, buyer);
  if (p.status !== 'draft' && p.status !== 'need_info') throw new ApiError(409, 'not_submittable', 'Proposal ini sudah diajukan.');
  const { fields, problems } = validateDraft({ ...p.form, ...(body || {}) }, cfg);
  const agree = checkAgreements(body);
  for (const [k, v] of Object.entries(agree.fields)) problems.add(k, v);
  if (problems.any) {
    throw new ApiError(400, 'invalid_input', 'Mohon lengkapi kolom yang disorot.', problems.fields);
  }
  p.form = fields;
  p.agreements = Object.fromEntries(AGREEMENTS.map((k) => [k, true]));
  p.submittedAt = now;
  move(db, p, p.submittedOnce ? 'in_review' : 'submitted', 'buyer', now);
  p.submittedOnce = true;
  return p;
}

function findOwned(db, id, buyer) {
  const p = (db.proposals || []).find((x) => x.id === id && x.buyerId === buyer.id);
  if (!p) throw new ApiError(404, 'not_found', 'Proposal tidak ditemukan.');
  return p;
}

// Pembeli tidak melihat penawaran yang belum disetujui pemilik.
function listForBuyer(db, buyer) {
  return (db.proposals || []).filter((x) => x.buyerId === buyer.id).map((x) => {
    const v = publicProposal(x);
    return { ...v, offers: v.offers.filter((o) => o.ownerApproval !== 'pending') };
  });
}

// Penawaran yang disepakati kedua pihak; null bila perjanjian belum dibuat.
function agreedOfferOf(p) {
  if (!p.agreedOffer) return null;
  return p.offers.find((o) => o.version === p.agreedOffer.version) || null;
}

function publicProposal(p) {
  return {
    id: p.id, reference: p.reference, status: p.status, statusLabel: statusLabel(p.status),
    form: p.form, lines: p.lines, offers: p.offers.map(publicOffer), deposit: p.deposit || null,
    balance: p.balance || null, shipment: p.shipment || null,
    submittedAt: p.submittedAt || null, createdAt: p.createdAt, updatedAt: p.updatedAt,
    timeline: p.timeline,
    infoRequest: p.infoRequest || null,
  };
}

function publicOffer(o) {
  return { version: o.version, lines: o.lines, total: o.total, deliveryTerms: o.deliveryTerms, validUntil: o.validUntil, status: o.status, hash: o.hash, createdAt: o.createdAt, respondedAt: o.respondedAt || null, ownerApproval: o.ownerApproval || 'not_required' };
}

// ---- Perubahan status ----
function move(db, p, to, by, now) {
  p.status = to;
  p.updatedAt = now;
  p.timeline.push({ at: now, status: to, by });
  if (db) notify.enqueueProposal(db, p, to, now);
}

function assertTransition(p, action) {
  const next = (TRANSITIONS[p.status] || {})[action];
  if (!next) throw new ApiError(409, 'invalid_transition', `Tindakan "${action}" tidak bisa dilakukan saat status ${statusLabel(p.status)}.`);
  return next;
}

function staffAction(db, id, action, payload, now, cfg = config) {
  const p = (db.proposals || []).find((x) => x.id === id);
  if (!p) throw new ApiError(404, 'not_found', 'Proposal tidak ditemukan.');
  if (BUYER_ACTIONS.includes(action)) throw new ApiError(400, 'buyer_only', 'Tindakan ini dilakukan oleh pembeli.');
  const next = assertTransition(p, action);
  const data = payload || {};
  let pendingOwner = false; // penawaran di atas ambang menunggu pemilik; proposal tetap in_review

  if (action === 'request_info') {
    const msg = String(data.message || '').trim();
    if (msg.length < 5) throw new ApiError(400, 'invalid_input', 'Tulis informasi yang dibutuhkan.', { message: 'Tulis informasi yang dibutuhkan.' });
    p.infoRequest = { message: msg, at: now };
  }

  if (action === 'make_offer') {
    const hasManual = Array.isArray(data.lines) && data.lines.length > 0;
    const lines = hasManual ? offerLines(db, data.lines, cfg) : allocateLines(db, data.tier || (p.form.tiers || [])[0], data.kg || p.form.quantityKg, cfg);
    const total = lines.reduce((a, l) => a + l.amount, 0);
    const version = p.offers.length + 1;
    pendingOwner = total > cfg.ownerApprovalIdr;
    const offer = {
      version, lines, total,
      deliveryTerms: p.form.deliveryTerms,
      validUntil: new Date(Date.parse(now) + OFFER_VALID_DAYS * DAY).toISOString(),
      status: 'open', createdAt: now,
      ownerApproval: pendingOwner ? 'pending' : 'not_required',
      hash: sha256(JSON.stringify({ version, lines, total, deliveryTerms: p.form.deliveryTerms })),
    };
    p.offers.push(offer);
    p.lines = lines;
  }

  if (action === 'owner_approve') {
    const offer = p.offers[p.offers.length - 1];
    if (!offer || offer.ownerApproval !== 'pending') throw new ApiError(409, 'no_pending_approval', 'Tidak ada penawaran yang menunggu persetujuan pemilik.');
    offer.ownerApproval = 'approved';
    offer.approvedAt = now;
  }

  if (action === 'request_deposit') {
    const total = p.agreedOffer.total;
    p.deposit = { amount: Math.round((total * DEPOSIT_PCT) / 100), pct: DEPOSIT_PCT, dueAt: new Date(Date.parse(now) + DEPOSIT_DUE_DAYS * DAY).toISOString(), paidAt: null };
  }

  if (action === 'mark_deposit_paid') {
    // Cadangkan kg pada lot sesuai penawaran yang disepakati.
    reserveLots(db, p);
    p.deposit.paidAt = now;
    p.deposit.reference = String(data.reference || '').slice(0, 80) || null;
  }

  if (action === 'request_balance') {
    const total = p.agreedOffer.total;
    p.balance = { amount: total - p.deposit.amount, dueAt: null, paidAt: null };
  }
  if (action === 'mark_balance_paid') {
    p.balance.paidAt = now;
    p.balance.reference = String(data.reference || '').slice(0, 80) || null;
  }

  if (action === 'dispatch') {
    p.shipment = { courier: String(data.courier || '').slice(0, 60) || null, waybill: String(data.waybill || '').slice(0, 60) || null, shippedAt: now };
  }

  if (action === 'cancel') {
    releaseLots(db, p);
  }

  move(db, p, pendingOwner ? 'in_review' : next, 'staff', now);
  return p;
}

function currentOffer(p) {
  const o = p.offers[p.offers.length - 1];
  if (!o || o.status !== 'open') throw new ApiError(409, 'no_open_offer', 'Tidak ada penawaran yang aktif.');
  return o;
}

// Buyer response (accept, counter, decline) on the latest open offer.
function buyerAction(db, id, buyer, action, body, now) {
  const p = findOwned(db, id, buyer);
  if (!BUYER_ACTIONS.includes(action)) throw new ApiError(400, 'staff_only', 'Tindakan ini dilakukan oleh staf.');
  if (p.status !== 'offered') throw new ApiError(409, 'invalid_transition', 'Belum ada penawaran untuk direspons.');
  return staffActionAsBuyer(db, p, action, body, now);
}

function staffActionAsBuyer(db, p, action, body, now) {
  const next = assertTransition(p, action);
  const data = body || {};
  if (action === 'accept') {
    const offer = currentOffer(p);
    if (Date.parse(offer.validUntil) < Date.parse(now)) throw new ApiError(409, 'offer_expired', 'Penawaran ini sudah kedaluwarsa.');
    offer.status = 'accepted';
    offer.respondedAt = now;
    p.agreedOffer = { version: offer.version, hash: offer.hash, total: offer.total, at: now };
  } else if (action === 'counter') {
    const offer = currentOffer(p);
    offer.status = 'countered';
    offer.respondedAt = now;
    p.counterNote = String(data.note || '').slice(0, 500);
  } else if (action === 'decline') {
    const offer = currentOffer(p);
    offer.status = 'declined';
    offer.respondedAt = now;
    p.declineReason = String(data.reason || '').slice(0, 300) || null;
  }
  move(db, p, next, 'buyer', now);
  return p;
}

// Harga per kg per tingkat dari konfigurasi; lot harus ada, berstatus tayang, dan stok cukup.
// Pilih lot dari stok sesuai tingkat sampai jumlah kg terpenuhi. Lot dengan sisa stok terbesar dulu.
function allocateLines(db, tier, kgWanted, cfg = config) {
  const want = Number(kgWanted);
  if (!tier || !cfg.tiers[tier]) throw new ApiError(400, 'invalid_input', 'Pilih tingkat untuk penawaran.', { tier: 'Pilih tingkat.' });
  if (!Number.isFinite(want) || want <= 0) throw new ApiError(400, 'invalid_input', 'Isi jumlah kg untuk penawaran.', { kg: 'Isi jumlah kg.' });
  const pool = (db.lots || []).filter((l) => l.status === 'listed' && l.tier === tier && availableKg(l) > 0)
    .sort((a, b) => availableKg(b) - availableKg(a));
  const free = pool.reduce((a, l) => a + availableKg(l), 0);
  if (free < want) {
    throw new ApiError(409, 'insufficient_stock', `Stok ${cfg.tiers[tier].label} hanya ${free} kg, kurang ${want - free} kg. Turunkan jumlah atau pilih tingkat lain.`);
  }
  let left = want;
  const lines = [];
  for (const lot of pool) {
    if (left <= 0) break;
    const take = Math.min(left, availableKg(lot));
    lines.push({ lotCode: lot.code, tier, kg: take, pricePerKg: cfg.tiers[tier].pricePerKg, amount: take * cfg.tiers[tier].pricePerKg });
    left -= take;
  }
  return lines;
}

function offerLines(db, raw, cfg = config) {
  if (!Array.isArray(raw) || raw.length === 0) throw new ApiError(400, 'invalid_input', 'Isi minimal satu lot untuk penawaran.', { lines: 'Isi minimal satu lot.' });
  const lots = db.lots || [];
  return raw.map((r) => {
    const lot = lots.find((l) => l.code === r.lotCode);
    if (!lot) throw new ApiError(400, 'unknown_lot', `Lot ${r.lotCode} tidak ditemukan.`);
    if (lot.status !== 'listed') throw new ApiError(409, 'lot_not_listed', `Lot ${lot.code} belum tayang.`);
    const kg = Number(r.kg);
    if (!Number.isFinite(kg) || kg <= 0) throw new ApiError(400, 'invalid_input', `Jumlah kg untuk ${lot.code} tidak valid.`);
    const free = availableKg(lot);
    if (kg > free) throw new ApiError(409, 'insufficient_stock', `Stok ${lot.code} hanya ${free} kg.`);
    const tier = lot.tier;
    const pricePerKg = cfg.tiers[tier] ? cfg.tiers[tier].pricePerKg : 0;
    return { lotCode: lot.code, tier, kg, pricePerKg, amount: kg * pricePerKg };
  });
}

function reserveLots(db, p) {
  for (const l of p.agreedOffer && p.lines ? p.lines : []) {
    const lot = (db.lots || []).find((x) => x.code === l.lotCode);
    if (!lot) continue;
    if (availableKg(lot) < l.kg) throw new ApiError(409, 'insufficient_stock', `Stok ${lot.code} tidak cukup untuk dicadangkan.`);
    lot.reservedKg = (lot.reservedKg || 0) + l.kg;
    lot.reservedFor = lot.reservedFor || [];
    lot.reservedFor.push({ proposalId: p.id, kg: l.kg });
  }
}

function releaseLots(db, p) {
  for (const lot of db.lots || []) {
    const hit = (lot.reservedFor || []).filter((r) => r.proposalId === p.id);
    if (!hit.length) continue;
    const kg = hit.reduce((a, r) => a + r.kg, 0);
    lot.reservedKg = Math.max(0, (lot.reservedKg || 0) - kg);
    lot.reservedFor = lot.reservedFor.filter((r) => r.proposalId !== p.id);
  }
}

// Penawaran yang lewat masa berlaku dan DP yang lewat jatuh tempo: tandai kedaluwarsa, lepas cadangan.
function expireDue(db, now) {
  const changed = [];
  for (const p of db.proposals || []) {
    if (p.status === 'offered') {
      const o = p.offers[p.offers.length - 1];
      if (o && o.status === 'open' && Date.parse(o.validUntil) < Date.parse(now)) {
        o.status = 'expired';
        move(db, p, 'expired', 'system', now);
        changed.push(p.id);
      }
    }
    if (p.status === 'deposit_pending' && p.deposit && Date.parse(p.deposit.dueAt) < Date.parse(now)) {
      releaseLots(db, p);
      move(db, p, 'expired', 'system', now);
      changed.push(p.id);
    }
  }
  return changed;
}

module.exports = {
  allocateLines, STATUS_LABELS, TRANSITIONS, DEPOSIT_PCT, OFFER_VALID_DAYS, DEPOSIT_DUE_DAYS,
  statusLabel, validateDraft, createProposal, updateDraft, submitProposal, listForBuyer,
  publicProposal, staffAction, buyerAction, expireDue, sha256, agreedOfferOf,
};
