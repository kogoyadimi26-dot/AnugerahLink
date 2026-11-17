'use strict';

// Business rules for AnugerahLink. These are the v2 plan defaults
// (docs/business/source/AnugerahLink_Business_Plan_and_Model_v2.docx).
// The owner has not confirmed them yet. Change them here, not in the code.
// All amounts are in rupiah (IDR).

module.exports = {
  currency: 'IDR',

  // Buying from farmer groups
  buyPricePerKg: 120000,
  sortingLossPct: 0.05,

  // Costs per kg bought
  shippingPerKg: 20000, // Rp20,000 per kg, paid by AnugerahLink or the buyer (see tiers)
  feesPerKg: 2000, // samples, claims, payment charges

  // Fixed costs (full team) used for break-even
  fixedCostsPerYear: 400000000,

  // Ordering rules
  minOrderKg: 30,
  stepKg: 1,
  lowStockKg: 60,

  // Tiers. shippingBy: 'anugerah' = included in price, AnugerahLink pays;
  // 'buyer' = buyer pays shippingPerKg on top; 'none' = collected in Papua.
  tiers: {
    reserve: { label: 'Reserve', pricePerKg: 350000, shippingBy: 'anugerah', description: 'Top specialty cafes and export samples. Cup score 86+, small lots.' },
    premium: { label: 'Premium', pricePerKg: 250000, shippingBy: 'anugerah', description: 'Specialty cafes and premium roasters. SNI Grade 1, cup score 84 to 85.' },
    verified: { label: 'Verified standard', pricePerKg: 150000, shippingBy: 'buyer', description: 'Roasters in Jakarta and Surabaya. SNI Grade 1 to 2, cup score 80 to 83.' },
    local: { label: 'Local', pricePerKg: 100000, shippingBy: 'none', description: 'Cafes and roasters in Papua. Grade 3 and below, cup score under 80.' },
  },

  // Assumed grade mix (share of sellable kg), used when there is no stock yet
  defaultMix: { reserve: 0.05, premium: 0.25, verified: 0.40, local: 0.30 },

  // Bank transfer details are placeholders until the owner provides them.
  // The app shows them on the order page and never invents account numbers.
  payment: {
    method: 'bank_transfer_invoice',
    bankName: 'TO BE CONFIRMED BY THE TEAM',
    accountName: 'TO BE CONFIRMED BY THE TEAM',
    accountNumber: 'TO BE CONFIRMED BY THE TEAM',
  },
};
