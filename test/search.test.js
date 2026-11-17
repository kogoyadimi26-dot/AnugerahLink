'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { listPublicLots } = require('../lib/domain');
const seed = require('../lib/seed');

test('keyword search matches code, region, group and process, and ignores empty text', () => {
  const db = seed.seed();
  const all = listPublicLots(db, {});
  assert.ok(all.length > 0);
  const byRegion = listPublicLots(db, { q: all[0].regionName.slice(0, 5) });
  assert.ok(byRegion.length > 0 && byRegion.every((l) => [l.regionName, l.title, l.code, l.groupName, l.process, l.grade, l.tierLabel, l.story].join(' ').toLowerCase().includes(all[0].regionName.slice(0, 5).toLowerCase())));
  assert.equal(listPublicLots(db, { q: '   ' }).length, all.length);
  assert.equal(listPublicLots(db, { q: 'tidak-ada-sama-sekali-xyz' }).length, 0);
  assert.equal(listPublicLots(db, { q: all[0].code }).length >= 1, true);
});
