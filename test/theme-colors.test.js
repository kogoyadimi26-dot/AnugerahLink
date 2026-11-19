'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateOverrides, mergeTheme } = require('../lib/theme');
const base = require('../config/theme');

test('warna kategori dan menu diterima jika berbentuk #RRGGBB', () => {
  const out = validateOverrides({ light: { tierReserve: '#A03020', navBg: '#112233' } });
  assert.equal(out.light.tierReserve, '#a03020');
  assert.equal(out.light.navBg, '#112233');
});

test('warna kategori yang bukan heks ditolak', () => {
  assert.throws(() => validateOverrides({ dark: { tierLocal: 'red' } }), (err) => err.status === 400 && /tierLocal/.test(err.message));
  assert.throws(() => validateOverrides({ light: { navInk: 'url(x)' } }), (err) => err.status === 400);
});

test('mergeTheme menerapkan warna kategori dan menu tanpa mengubah warna lain', () => {
  const merged = mergeTheme(base, { light: { tierPremium: '#1A2B3C', navBg: '#010203' } });
  assert.equal(merged.light.tierPremium, '#1A2B3C');
  assert.equal(merged.light.navBg, '#010203');
  assert.equal(merged.light.primary, base.light.primary);
  assert.equal(merged.dark.tierPremium, base.dark.tierPremium);
});

test('tanpa timpaan, tema sama dengan nilai dasar', () => {
  assert.equal(mergeTheme(base, null), base);
});
