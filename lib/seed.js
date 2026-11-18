'use strict';

// First-run data. Regions come from the v2 plan. Groups and lots are SAMPLE data
// marked `sample: true`, so they are easy to find and delete in the back office.
// Group names are placeholders, not real farmer organisations.

function seed() {
  return {
    version: 1,
    counters: { lot: 6, order: 0, feedback: 0, group: 2 },
    regions: [
      { id: 'r-baliem', name: 'Baliem Valley', regency: 'Jayawijaya', hub: 'Wamena', rollout: 'hub' },
      { id: 'r-tiom', name: 'Tiom', regency: 'Lanny Jaya', hub: 'Wamena', rollout: 'hub' },
      { id: 'r-oksibil', name: 'Oksibil', regency: 'Pegunungan Bintang', hub: 'Oksibil, via Jayapura', rollout: 'later' },
      { id: 'r-amungme', name: 'Amungme highlands', regency: 'Mimika', hub: 'Timika', rollout: 'later' },
      { id: 'r-moanemani', name: 'Moanemani', regency: 'Dogiyai', hub: 'Nabire', rollout: 'later' },
      { id: 'r-tolikara', name: 'Tolikara', regency: 'Tolikara', hub: 'Wamena (rencana, perlu dikonfirmasi)', rollout: 'later' },
      { id: 'r-intan-jaya', name: 'Intan Jaya', regency: 'Intan Jaya', hub: 'Timika (rencana, perlu dikonfirmasi)', rollout: 'later' },
      { id: 'r-paniai', name: 'Paniai', regency: 'Paniai', hub: 'Nabire (rencana, perlu dikonfirmasi)', rollout: 'later' },
    ],
    groups: [
      { id: 'g-1', name: 'Kelompok Tani Baliem 1', regionId: 'r-baliem', contact: '', sample: true },
      { id: 'g-2', name: 'Kelompok Tani Tiom 1', regionId: 'r-tiom', contact: '', sample: true },
    ],
    lots: [
      {
        id: 'l-1', code: 'AL-2611-001', groupId: 'g-1', regionId: 'r-baliem', harvestDate: '2026-08-15',
        process: 'Dicuci', kgIn: 300, buyPricePerKg: 120000, sellableKg: 285, reservedKg: 0, soldKg: 0,
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
        process: 'Dicuci', kgIn: 400, buyPricePerKg: 120000, sellableKg: 380, reservedKg: 0, soldKg: 0,
        tier: 'verified', grade: 'SNI Grade 2', cupScore: 82, moisturePct: 12, status: 'listed',
        publishedAt: '2026-11-01T00:00:00.000Z', passportHash: null, notes: '', sample: true,
      },
      // Sample lots for large-order testing (1, 2 and 5 tons).
      {
        id: 'l-4', code: 'AL-2611-004', groupId: 'g-2', regionId: 'r-tiom', harvestDate: '2026-09-01',
        process: 'Natural', kgIn: 1200, buyPricePerKg: 120000, sellableKg: 1000, reservedKg: 0, soldKg: 0,
        tier: 'verified', grade: 'SNI Grade 2', cupScore: 82, moisturePct: 11, status: 'listed',
        publishedAt: '2026-11-01T00:00:00.000Z', passportHash: null, notes: '', sample: true,
      },
      {
        id: 'l-5', code: 'AL-2611-005', groupId: 'g-1', regionId: 'r-baliem', harvestDate: '2026-09-05',
        process: 'Dicuci', kgIn: 2400, buyPricePerKg: 120000, sellableKg: 2000, reservedKg: 0, soldKg: 0,
        tier: 'premium', grade: 'SNI Grade 1', cupScore: 85, moisturePct: 11, status: 'listed',
        publishedAt: '2026-11-01T00:00:00.000Z', passportHash: null, notes: '', sample: true,
      },
      {
        id: 'l-6', code: 'AL-2611-006', groupId: 'g-2', regionId: 'r-tiom', harvestDate: '2026-09-10',
        process: 'Giling basah', kgIn: 6000, buyPricePerKg: 120000, sellableKg: 5000, reservedKg: 0, soldKg: 0,
        tier: 'local', grade: 'SNI Grade 3', cupScore: 78, moisturePct: 12, status: 'listed',
        publishedAt: '2026-11-01T00:00:00.000Z', passportHash: null, notes: '', sample: true,
      },
    ],
    orders: [],
    feedback: [],
  };
}

// Wilayah yang harus ada di setiap basis data. Dipakai juga untuk menambah wilayah baru
// ke basis data yang sudah ada.
function regionDefaults() {
  return seed().regions;
}

module.exports = { seed, regionDefaults };
