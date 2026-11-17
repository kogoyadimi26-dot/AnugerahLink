'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { deliveryEta, breakdown } = require('../lib/delivery');

const DAY = 86400000;
const cfg = { transitDaysMin: 2, transitDaysMax: 4 };
const SHIPPED = '2026-11-10T08:00:00.000Z';
const order = (extra = {}) => ({ status: 'shipped', timeline: [{ status: 'shipped', at: SHIPPED }], ...extra });
const at = (days) => new Date(Date.parse(SHIPPED) + days * DAY).toISOString();

test('belum dikirim: tidak ada estimasi sebelum pesanan dikirim', () => {
  const e = deliveryEta({ status: 'paid', timeline: [] }, at(1), cfg);
  assert.equal(e.status, 'belum_dikirim');
  assert.equal(e.earliest, null);
});

test('dalam perjalanan: sisa waktu sampai batas akhir perkiraan', () => {
  const e = deliveryEta(order(), at(2.5), cfg);
  assert.equal(e.status, 'dalam_perjalanan');
  assert.deepEqual(e.remaining, { days: 1, hours: 12, totalHours: 36 });
  assert.equal(e.earliest, at(2));
  assert.equal(e.latest, at(4));
});

test('terlambat saat belum diantar: hari dan jam setelah janji', () => {
  const e = deliveryEta(order(), at(4.5), cfg);
  assert.equal(e.status, 'terlambat');
  assert.deepEqual(e.delay, { days: 0, hours: 12, totalHours: 12 });
});

test('diantar tepat waktu bila sebelum batas akhir', () => {
  const o = order({ status: 'delivered', timeline: [{ status: 'shipped', at: SHIPPED }, { status: 'delivered', at: at(3) }] });
  const e = deliveryEta(o, at(3), cfg);
  assert.equal(e.status, 'tepat_waktu');
});

test('diantar terlambat: keterlambatan dihitung dari janji', () => {
  const o = order({ status: 'delivered', timeline: [{ status: 'shipped', at: SHIPPED }, { status: 'delivered', at: at(5) }] });
  const e = deliveryEta(o, at(5), cfg);
  assert.equal(e.status, 'terlambat');
  assert.equal(e.delay.days, 1);
});

test('pesanan dibatalkan tidak punya estimasi', () => {
  assert.equal(deliveryEta(order({ status: 'cancelled' }), at(1), cfg).status, 'dibatalkan');
});

test('breakdown mengubah milidetik menjadi hari dan jam', () => {
  assert.deepEqual(breakdown(25 * 3600000), { days: 1, hours: 1, totalHours: 25 });
  assert.deepEqual(breakdown(-5), { days: 0, hours: 0, totalHours: 0 });
});
