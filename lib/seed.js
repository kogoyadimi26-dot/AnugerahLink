'use strict';

// First-run data. Regions come from the v2 plan. Groups and lots are SAMPLE data
// marked `sample: true`, so they are easy to find and delete in the back office.
// Group names are placeholders, not real farmer organisations.

function seed() {
  return {
    version: 1,
    counters: { lot: 3, order: 0, feedback: 0, group: 2 },
    regions: [
      { id: 'r-baliem', name: 'Baliem Valley', regency: 'Jayawijaya', hub: 'Wamena', rollout: 'hub' },
      { id: 'r-tiom', name: 'Tiom', regency: 'Lanny Jaya', hub: 'Wamena', rollout: 'hub' },
      { id: 'r-oksibil', name: 'Oksibil', regency: 'Pegunungan Bintang', hub: 'Oksibil, via Jayapura', rollout: 'later' },
      { id: 'r-amungme', name: 'Amungme highlands', regency: 'Mimika', hub: 'Timika', rollout: 'later' },
      { id: 'r-moanemani', name: 'Moanemani', regency: 'Dogiyai', hub: 'Nabire', rollout: 'later' },
    ],
    groups: [
      { id: 'g-1', name: 'Baliem Group 1 (sample)', regionId: 'r-baliem', contact: '', sample: true },
      { id: 'g-2', name: 'Tiom Group 1 (sample)', regionId: 'r-tiom', contact: '', sample: true },
    ],
    lots: [
      {
        id: 'l-1', code: 'AL-2611-001', groupId: 'g-1', regionId: 'r-baliem', harvestDate: '2026-08-15',
        process: 'Washed', kgIn: 300, buyPricePerKg: 120000, sellableKg: 285, reservedKg: 0, soldKg: 0,
        tier: 'premium', grade: 'SNI Grade 1', cupScore: 85, moisturePct: 11, status: 'listed',
        publishedAt: '2026-11-01T00:00:00.000Z', passportHash: null, notes: '', sample: true,
      },
      {
        id: 'l-2', code: 'AL-2611-002', groupId: 'g-2', regionId: 'r-tiom', harvestDate: '2026-08-20',
        process: 'Natural', kgIn: 200, buyPricePerKg: 120000, sellableKg: 190, reservedKg: 0, soldKg: 0,
        tier: 'reserve', grade: 'SNI Grade 1', cupScore: 87, moisturePct: 11, status: 'listed',
        publishedAt: '2026-11-01T00:00:00.000Z', passportHash: null, notes: '', sample: true,
      },
      {
        id: 'l-3', code: 'AL-2611-003', groupId: 'g-1', regionId: 'r-baliem', harvestDate: '2026-08-25',
        process: 'Washed', kgIn: 400, buyPricePerKg: 120000, sellableKg: 380, reservedKg: 0, soldKg: 0,
        tier: 'verified', grade: 'SNI Grade 2', cupScore: 82, moisturePct: 12, status: 'listed',
        publishedAt: '2026-11-01T00:00:00.000Z', passportHash: null, notes: '', sample: true,
      },
    ],
    orders: [],
    feedback: [],
  };
}

module.exports = { seed };
