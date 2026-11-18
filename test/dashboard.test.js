'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDashboard, bucketKey } = require('../lib/dashboard');

const NOW = '2026-11-18T03:00:00.000Z';
const DAY = 86400000;
const ago = (days) => new Date(Date.parse(NOW) - days * DAY).toISOString();

function order(number, daysAgo, total, status, lines = [{ lotCode: 'L1', tier: 'premium', kg: 30 }]) {
  return { number, status, total, createdAt: ago(daysAgo), customer: { name: 'Uji', company: 'Kafe Uji' }, lines, timeline: [{ status: 'shipped', at: ago(daysAgo) }] };
}
const lots = [
  { code: 'L1', tier: 'premium', status: 'listed', sellableKg: 300, reservedKg: 0, soldKg: 120 },
  { code: 'L2', tier: 'reserve', status: 'listed', sellableKg: 100, reservedKg: 0, soldKg: 0 },
  { code: 'L3', tier: 'local', status: 'graded', sellableKg: 50, reservedKg: 0, soldKg: 0 },
];

test('KPI periode: pendapatan, pesanan, kg, dan perbandingan dengan periode sebelumnya', () => {
  const db = {
    lots,
    feedback: [{ tag: 'x' }, {}],
    orders: [
      order('A', 1, 1000, 'paid'),          // periode ini
      order('B', 10, 500, 'completed'),     // periode ini (30 hari)
      order('C', 40, 800, 'completed'),     // periode sebelumnya
      order('D', 2, 9999, 'cancelled'),     // dibatalkan: tidak dihitung
    ],
  };
  const d = buildDashboard(db, { range: 30, now: NOW });
  assert.equal(d.kpis.revenue, 1500);
  assert.equal(d.kpis.prevRevenue, 800);
  assert.equal(d.kpis.revenueChangePct, 87.5);
  assert.equal(d.kpis.orders, 2);
  assert.equal(d.kpis.kgSold, 60);
  assert.equal(d.kpis.avgOrderValue, 750);
  assert.equal(d.kpis.stockKg, 180 + 100); // L1: 300-120, L2: 100
  assert.equal(d.feedbackToReview, undefined);
  assert.equal(d.actions.find((a) => a.key === 'feedback').count, 1);
});

test('corong pesanan: hitung per status, pembatalan dipisah', () => {
  const db = { lots: [], feedback: [], orders: [order('A', 1, 100, 'paid'), order('B', 2, 50, 'cancelled'), order('C', 3, 70, 'requested')] };
  const d = buildDashboard(db, { range: 30, now: NOW });
  assert.equal(d.pipeline.stages.find((p) => p.status === 'paid').count, 1);
  assert.equal(d.pipeline.stages.find((p) => p.status === 'requested').value, 70);
  assert.equal(d.pipeline.cancelled.count, 1);
});

test('stok per tingkat: sisa, sell-through, dan perkiraan minggu stok', () => {
  const db = { lots, feedback: [], orders: [order('A', 7, 1000, 'paid', [{ lotCode: 'L1', tier: 'premium', kg: 70 }])] };
  const d = buildDashboard(db, { range: 7, now: NOW });
  const premium = d.stock.find((s) => s.tier === 'premium');
  assert.equal(premium.available, 180);
  assert.equal(premium.sellThrough, 0.4); // 120 / 300
  assert.equal(premium.soldInPeriod, 70);
  assert.ok(premium.weeksCover > 0);
  assert.equal(d.stock.find((s) => s.tier === 'local').available, 0);
});

test('wawasan: stok menipis dan pesanan belum dikonfirmasi muncul sesuai urutan', () => {
  const db = {
    lots: [{ code: 'L1', tier: 'premium', status: 'listed', sellableKg: 300, reservedKg: 0, soldKg: 0 }],
    feedback: [],
    orders: [order('A', 1, 100, 'paid', [{ lotCode: 'L1', tier: 'premium', kg: 150 }]), order('B', 0.5, 50, 'requested')],
  };
  const d = buildDashboard(db, { range: 7, now: NOW });
  const texts = d.insights.map((i) => i.text);
  assert.ok(texts.some((t) => t.includes('tinggal') && t.includes('Premium')), 'stok menipis harus muncul');
  assert.ok(!texts.some((t) => t.includes('belum dikonfirmasi')), 'pesanan baru belum lewat 24 jam');
  assert.equal(d.insights[0].severity, 'warning');
});

test('tindakan: pesanan menunggu terlalu lama dan lot menunggu diterbitkan', () => {
  const db = {
    lots: [{ code: 'G', tier: 'premium', status: 'graded', sellableKg: 10, reservedKg: 0, soldKg: 0 }, { code: 'V', tier: 'reserve', status: 'verified', sellableKg: 10, reservedKg: 0, soldKg: 0 }],
    feedback: [],
    orders: [order('OLD', 3, 100, 'requested')],
  };
  const d = buildDashboard(db, { range: 30, now: NOW });
  assert.equal(d.actions.find((a) => a.key === 'confirm').count, 1);
  assert.equal(d.actions.find((a) => a.key === 'verify').count, 1);
  assert.equal(d.actions.find((a) => a.key === 'publish').count, 1);
});

test('pesanan terbaru: lima teratas, terbaru di depan', () => {
  const orders = [1, 2, 3, 4, 5, 6, 7].map((d) => order('N' + d, d, d * 10, 'paid'));
  const d = buildDashboard({ lots: [], feedback: [], orders }, { range: 30, now: NOW });
  assert.equal(d.recentOrders.length, 5);
  assert.equal(d.recentOrders[0].number, 'N1');
});

test('tren: harian untuk 7 dan 30 hari, mingguan untuk 90 hari, bulanan untuk semua', () => {
  assert.match(bucketKey(Date.parse(NOW), 30), /^\d{4}-\d{2}-\d{2}$/);
  assert.match(bucketKey(Date.parse(NOW), 90), /^\d{4}-\d{2}-\d{2}$/);
  assert.match(bucketKey(Date.parse(NOW), 0), /^\d{4}-\d{2}$/);
  const d = buildDashboard({ lots: [], feedback: [], orders: [] }, { range: 7, now: NOW });
  assert.ok(d.series.length >= 7 && d.series.length <= 9);
  assert.equal(d.kpis.revenue, 0);
  assert.equal(d.kpis.revenueChangePct, null);
});

test('tren mingguan: 12 minggu terakhir dan bagian penjualan per tingkat', () => {
  const db = {
    lots,
    orders: [
      order('A', 1, 1000, 'paid', [{ lotCode: 'L1', tier: 'premium', kg: 30 }]),
      order('B', 10, 500, 'completed', [{ lotCode: 'L2', tier: 'reserve', kg: 10 }]),
      order('C', 100, 700, 'completed', [{ lotCode: 'L1', tier: 'premium', kg: 60 }]), // di luar 12 minggu
    ],
  };
  const d = buildDashboard(db, { range: 30, now: NOW });
  assert.equal(d.weekly.length, 12);
  assert.equal(d.weekly.reduce((a, w) => a + w.revenue, 0), 1500);
  assert.equal(d.weekly.reduce((a, w) => a + w.orders, 0), 2);
  const premium = d.mix.find((m) => m.tier === 'premium');
  const reserve = d.mix.find((m) => m.tier === 'reserve');
  assert.equal(premium.kg, 30);
  assert.equal(reserve.kg, 10);
  assert.equal(premium.pct, 75);
  assert.equal(reserve.pct, 25);
});
