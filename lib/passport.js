'use strict';

// Passport record: a tamper-evident hash of the fields that define a lot.
// If any of these fields changes after publishing, the recomputed hash no longer
// matches the stored one, and the passport page says so. This is evidence of change,
// not a guarantee that nothing can be altered, so the app never describes it as "unalterable".
const crypto = require('crypto');

const PASSPORT_FIELDS = [
  'code', 'groupName', 'regionName', 'regency', 'harvestDate', 'process',
  'grade', 'cupScore', 'moisturePct', 'tier', 'kgIn', 'sellableKg', 'buyPricePerKg',
];

// Stable JSON: sorted keys, so the same record always gives the same string.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

function passportRecord({ lot, group, region }) {
  const record = {
    code: lot.code,
    groupName: group.name,
    regionName: region.name,
    regency: region.regency,
    harvestDate: lot.harvestDate,
    process: lot.process,
    grade: lot.grade,
    cupScore: lot.cupScore,
    moisturePct: lot.moisturePct,
    tier: lot.tier,
    kgIn: lot.kgIn,
    sellableKg: lot.sellableKg,
    buyPricePerKg: lot.buyPricePerKg,
  };
  return record;
}

function hashRecord(record) {
  const subset = {};
  for (const key of PASSPORT_FIELDS) subset[key] = record[key];
  return crypto.createHash('sha256').update(canonical(subset)).digest('hex');
}

module.exports = { passportRecord, hashRecord, canonical, PASSPORT_FIELDS };
