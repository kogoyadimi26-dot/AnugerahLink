'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { listPublicLots } = require('../lib/domain');
const seed = require('../lib/seed');

test('search returns exactly the lots that match the words typed', () => {
  const db = seed.seed();
  const all = listPublicLots(db, {});
  assert.ok(all.length >= 2);
  const target = all.find((l) => l.regionName) ;
  const regionWord = target.regionName.split(' ')[0];

  const byRegion = listPublicLots(db, { q: regionWord });
  assert.ok(byRegion.length >= 1);
  assert.ok(byRegion.every((l) => [l.code, l.title, l.regionName, l.groupName, l.process, l.grade, l.tierLabel].join(' ').toLowerCase().includes(regionWord.toLowerCase())));

  const byCode = listPublicLots(db, { q: target.code });
  assert.equal(byCode.length, 1);
  assert.equal(byCode[0].code, target.code);

  assert.equal(listPublicLots(db, { q: '   ' }).length, all.length, 'blank search returns everything');
  assert.equal(listPublicLots(db, { q: 'tidak-ada-sama-sekali-xyz' }).length, 0);
});

test('every typed word must match; accents and capitals do not matter; story text is not searched', () => {
  const db = seed.seed();
  const lot = listPublicLots(db, {}).find((l) => l.regionName);
  const word = lot.regionName.split(' ')[0];
  const nameWord = (lot.groupName || '').split(' ')[0];
  if (nameWord) {
    assert.ok(listPublicLots(db, { q: `${word} ${nameWord}`.toUpperCase() }).some((l) => l.code === lot.code));
  }
  assert.equal(listPublicLots(db, { q: `${word} zzzz-tidak-ada` }).length, 0, 'an extra word that matches nothing gives no results');
  db.lots.find((l) => l.code === lot.code).story = 'kata-khusus-cerita-saja';
  assert.equal(listPublicLots(db, { q: 'kata-khusus-cerita-saja' }).length, 0, 'story text is not part of the search');
});

test('everyday product keywords work: kopi, papua, indonesia, and class descriptions', () => {
  const db = seed.seed();
  const all = listPublicLots(db, {});
  assert.equal(listPublicLots(db, { q: 'kopi' }).length, all.length, 'kopi finds every coffee lot');
  assert.equal(listPublicLots(db, { q: 'Papua' }).length, all.length, 'papua finds every coffee lot');
  assert.equal(listPublicLots(db, { q: 'kopi papua' }).length, all.length, 'two keywords together');
  assert.equal(listPublicLots(db, { q: 'kopi tiom' }).length, all.filter((l) => l.regionName === 'Tiom').length, 'kopi plus a region narrows the results');
  assert.equal(listPublicLots(db, { q: 'kakao' }).length, 0, 'kakao is not in stock');
});

test('a small typing mistake still finds the closest lots; nonsense finds nothing', () => {
  const db = seed.seed();
  const all = listPublicLots(db, {});
  const tiom = all.find((l) => l.regionName === 'Tiom');
  assert.ok(tiom, 'seed has a Tiom lot');
  assert.equal(listPublicLots(db, { q: 'tiomm' })[0].code, tiom.code, 'one extra letter still finds Tiom first');
  assert.equal(listPublicLots(db, { q: 'kopy' }).length, all.length, 'kopy is close to kopi');
  assert.equal(listPublicLots(db, { q: 'zzzzqqq' }).length, 0, 'nonsense finds nothing');
});
