'use strict';

// Angka dasbor penjualan. Fungsi murni: menerima data dan waktu, mengembalikan angka siap tampil.
const { availableKg, ORDER_STATUS_LABELS, TIER_CODES } = require('./domain');
const { deliveryEta } = require('./delivery');
const config = require('../config/business');

const DAY = 86400000;
const WIB_MS = 9 * 3600000; // Waktu Indonesia Barat: kelompokkan per hari menurut jam lokal
const RANGES = [7, 30, 90, 0]; // 0 = semua
const ACTIVE = ['requested', 'confirmed', 'paid', 'shipped', 'delivered', 'completed'];
const OPEN_HOURS_THRESHOLD = 24;
const WEEKS_COVER_WARNING = 2;
const SELL_THROUGH_INFO = 0.8;
const REVENUE_DROP_WARNING = -20;

function bucketKey(ms, range) {
  const d = new Date(ms + WIB_MS);
  const iso = d.toISOString();
  if (range === 0) return iso.slice(0, 7);
  if (range === 90) {
    const day = (d.getUTCDay() + 6) % 7; // Senin = 0
    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
    return monday.toISOString().slice(0, 10);
  }
  return iso.slice(0, 10);
}

function bucketsBetween(fromMs, toMs, range) {
  const keys = [];
  const seen = new Set();
  for (let t = fromMs; t <= toMs + DAY; t += DAY) {
    const k = bucketKey(t, range);
    if (!seen.has(k)) { seen.add(k); keys.push(k); }
  }
  return keys;
}

function sumLines(orders) {
  let kg = 0;
  for (const o of orders) for (const l of o.lines || []) kg += l.kg || 0;
  return kg;
}

function buildDashboard(db, { range = 30, now = new Date().toISOString() } = {}) {
  const nowMs = Date.parse(now);
  const allOrders = db.orders || [];
  const earliest = allOrders.length ? Math.min(...allOrders.map((o) => Date.parse(o.createdAt))) : nowMs;
  const startMs = range ? nowMs - range * DAY : earliest;
  const spanDays = Math.max(1, Math.ceil((nowMs - startMs) / DAY));
  const prevStart = range ? startMs - range * DAY : null;

  const inRange = (o, from, to) => {
    const t = Date.parse(o.createdAt);
    return t >= from && t <= to;
  };
  const current = allOrders.filter((o) => o.status !== 'cancelled' && inRange(o, startMs, nowMs));
  const previous = prevStart === null ? [] : allOrders.filter((o) => o.status !== 'cancelled' && inRange(o, prevStart, startMs));

  // ---- KPI ----
  const revenue = current.reduce((a, o) => a + o.total, 0);
  const prevRevenue = previous.reduce((a, o) => a + o.total, 0);
  const revenueChangePct = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 1000) / 10 : null;
  const kgSold = sumLines(current);
  const listedLots = (db.lots || []).filter((l) => l.status === 'listed');
  const stockKg = listedLots.reduce((a, l) => a + availableKg(l), 0);
  const kgPerWeek = kgSold / (spanDays / 7);
  const kpis = {
    revenue,
    prevRevenue,
    revenueChangePct,
    orders: current.length,
    prevOrders: previous.length,
    kgSold,
    avgOrderValue: current.length ? Math.round(revenue / current.length) : 0,
    stockKg,
    weeksCover: kgPerWeek > 0 ? Math.round((stockKg / kgPerWeek) * 10) / 10 : null,
  };

  // ---- Tren ----
  const keys = bucketsBetween(startMs, nowMs, range);
  const series = keys.map((k) => ({ key: k, revenue: 0, orders: 0 }));
  const idx = new Map(keys.map((k, i) => [k, i]));
  for (const o of current) {
    const i = idx.get(bucketKey(Date.parse(o.createdAt), range));
    if (i !== undefined) { series[i].revenue += o.total; series[i].orders += 1; }
  }

  // ---- Corong pesanan (pesanan dibuat dalam periode) ----
  const pipelineOrders = allOrders.filter((o) => inRange(o, startMs, nowMs));
  const stages = ACTIVE.map((s) => {
    const list = pipelineOrders.filter((o) => o.status === s);
    return { status: s, label: ORDER_STATUS_LABELS[s], count: list.length, value: list.reduce((a, o) => a + o.total, 0) };
  });
  const cancelled = pipelineOrders.filter((o) => o.status === 'cancelled');
  const pipeline = { stages, cancelled: { count: cancelled.length, value: cancelled.reduce((a, o) => a + o.total, 0) } };

  // ---- Stok per tingkat ----
  const tierOfLot = new Map((db.lots || []).map((l) => [l.code, l.tier]));
  const soldByTierPeriod = Object.fromEntries(TIER_CODES.map((t) => [t, 0]));
  for (const o of current) for (const l of o.lines || []) {
    const t = l.tier || tierOfLot.get(l.lotCode);
    if (t) soldByTierPeriod[t] = (soldByTierPeriod[t] || 0) + (l.kg || 0);
  }
  const stock = TIER_CODES.map((t) => {
    const lots = listedLots.filter((l) => l.tier === t);
    const available = lots.reduce((a, l) => a + availableKg(l), 0);
    const sellable = lots.reduce((a, l) => a + (l.sellableKg || 0), 0);
    const sold = lots.reduce((a, l) => a + (l.soldKg || 0), 0);
    const perWeek = soldByTierPeriod[t] / (spanDays / 7);
    return {
      tier: t,
      label: config.tiers[t] ? config.tiers[t].label : t,
      available,
      sellable,
      sold,
      sellThrough: sellable > 0 ? Math.round((sold / sellable) * 1000) / 1000 : null,
      soldInPeriod: soldByTierPeriod[t],
      weeksCover: perWeek > 0 ? Math.round((available / perWeek) * 10) / 10 : null,
    };
  });

  // ---- Tindakan ----
  const feedbackToReview = (db.feedback || []).filter((f) => !f.tag).length;
  const lateOrders = allOrders.filter((o) => o.status === 'shipped' && deliveryEta(o, now).status === 'terlambat');
  const oldRequested = allOrders.filter((o) => o.status === 'requested' && nowMs - Date.parse(o.createdAt) > OPEN_HOURS_THRESHOLD * 3600000);
  const actions = [
    { key: 'confirm', label: 'Pesanan belum dikonfirmasi lebih dari 24 jam', count: oldRequested.length, severity: 'warning', href: '#/admin/pesanan' },
    { key: 'late', label: 'Pesanan terlambat dari estimasi', count: lateOrders.length, severity: 'danger', href: '#/admin/pesanan' },
    { key: 'verify', label: 'Lot menunggu verifikasi', count: (db.lots || []).filter((l) => l.status === 'graded').length, severity: 'info', href: '#/admin/lot' },
    { key: 'publish', label: 'Lot siap diterbitkan', count: (db.lots || []).filter((l) => l.status === 'verified').length, severity: 'info', href: '#/admin/lot' },
    { key: 'feedback', label: 'Umpan balik belum ditandai', count: feedbackToReview, severity: 'info', href: '#/admin/umpan-balik' },
  ].filter((a) => a.count > 0);

  // ---- Insight ----
  const insights = [];
  if (actions.find((a) => a.key === 'late')) insights.push({ severity: 'danger', text: `${lateOrders.length} pesanan terlambat dari estimasi tiba.` });
  if (actions.find((a) => a.key === 'confirm')) insights.push({ severity: 'warning', text: `${oldRequested.length} pesanan belum dikonfirmasi lebih dari 24 jam.` });
  for (const s of stock) {
    if (s.available > 0 && s.weeksCover !== null && s.weeksCover < WEEKS_COVER_WARNING) {
      insights.push({ severity: 'warning', text: `Stok ${s.label} tinggal ${s.weeksCover} minggu pada laju penjualan periode ini.` });
    }
    if (s.sellThrough !== null && s.sellThrough >= SELL_THROUGH_INFO && s.available > 0) {
      insights.push({ severity: 'info', text: `${Math.round(s.sellThrough * 100)}% stok ${s.label} sudah terjual.` });
    }
  }
  if (revenueChangePct !== null && revenueChangePct <= REVENUE_DROP_WARNING) {
    insights.push({ severity: 'warning', text: `Pendapatan turun ${Math.abs(revenueChangePct)}% dibanding periode sebelumnya.` });
  }
  if (revenueChangePct !== null && revenueChangePct > 0 && insights.length === 0) {
    insights.push({ severity: 'info', text: `Pendapatan naik ${revenueChangePct}% dibanding periode sebelumnya.` });
  }
  const order = { danger: 0, warning: 1, info: 2 };
  insights.sort((a, b) => order[a.severity] - order[b.severity]);

  // ---- Pesanan terbaru ----
  const recentOrders = [...allOrders]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 5)
    .map((o) => ({
      number: o.number,
      customer: o.customer.company || o.customer.name,
      total: o.total,
      statusLabel: ORDER_STATUS_LABELS[o.status],
      status: o.status,
      createdAt: o.createdAt,
    }));

  return {
    range,
    generatedAt: now,
    period: { from: new Date(startMs).toISOString(), to: now },
    kpis, series, pipeline, stock, insights, actions, recentOrders,
  };
}

module.exports = { buildDashboard, RANGES, bucketKey };
