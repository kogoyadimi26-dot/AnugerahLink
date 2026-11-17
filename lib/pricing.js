'use strict';

// Pure pricing and economics functions. No I/O. Used by the server and tests.
const config = require('../config/business');

function tierOf(code) {
  const tier = config.tiers[code];
  if (!tier) throw new Error(`Unknown tier: ${code}`);
  return tier;
}

// Shipping charged to the buyer per kg for a tier.
function buyerShippingPerKg(tierCode) {
  return tierOf(tierCode).shippingBy === 'buyer' ? config.shippingPerKg : 0;
}

// Check a requested quantity against the minimum and the step.
function kgProblem(kg, cfg = config) {
  if (!Number.isInteger(kg)) return 'Jumlah harus berupa bilangan bulat kg.';
  if (kg < cfg.minOrderKg) return `Pesanan minimum ${cfg.minOrderKg} kg.`;
  if (cfg.maxOrderKg && kg > cfg.maxOrderKg) return `Pesanan maksimal ${cfg.maxOrderKg} kg per lot.`;
  if ((kg - cfg.minOrderKg) % cfg.stepKg !== 0) return `Jumlah harus kelipatan ${cfg.stepKg} kg.`;
  return null;
}

// Price one order line. Server-side only: the browser never supplies prices.
function priceLine(lot, kg) {
  const tier = tierOf(lot.tier);
  const shippingPerKg = buyerShippingPerKg(lot.tier);
  return {
    lotCode: lot.code,
    tier: lot.tier,
    tierLabel: tier.label,
    kg,
    pricePerKg: tier.pricePerKg,
    shippingPerKg,
    lineTotal: kg * tier.pricePerKg,
    shippingTotal: kg * shippingPerKg,
  };
}

// Totals for a list of priced lines.
function totalsFor(lines) {
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const shipping = lines.reduce((sum, l) => sum + l.shippingTotal, 0);
  return { subtotal, shipping, total: subtotal + shipping };
}

// Per-kg economics for a grade mix, matching the v2 spreadsheet.
// Sales, shipping and fees are per kg BOUGHT, so sorting loss is applied to them.
// Buying price is paid per kg bought.
function economics({
  mix = config.defaultMix,
  buyPricePerKg = config.buyPricePerKg,
  sortingLossPct = config.sortingLossPct,
  shippingPerKg = config.shippingPerKg,
  feesPerKg = config.feesPerKg,
  fixedCostsPerYear = config.fixedCostsPerYear,
  tiers = config.tiers,
} = {}) {
  const sellable = 1 - sortingLossPct;
  let blendedPrice = 0;
  let anugerahShipShare = 0;
  for (const [code, share] of Object.entries(mix)) {
    const tier = tiers[code];
    if (!tier) throw new Error(`Unknown tier in mix: ${code}`);
    blendedPrice += share * tier.pricePerKg;
    if (tier.shippingBy === 'anugerah') anugerahShipShare += share;
  }
  const salesPerKgBought = sellable * blendedPrice;
  const shippingPerKgBought = sellable * anugerahShipShare * shippingPerKg;
  const feesPerKgBought = sellable * feesPerKg;
  const grossMarginPerKgBought = salesPerKgBought - buyPricePerKg - shippingPerKgBought - feesPerKgBought;
  const breakEvenKgPerYear = grossMarginPerKgBought > 0 ? Math.ceil(fixedCostsPerYear / grossMarginPerKgBought) : null;
  return {
    blendedPricePerKgSold: Math.round(blendedPrice),
    salesPerKgBought: Math.round(salesPerKgBought),
    buyPerKgBought: buyPricePerKg,
    shippingPerKgBought: Math.round(shippingPerKgBought),
    feesPerKgBought: Math.round(feesPerKgBought),
    grossMarginPerKgBought: Math.round(grossMarginPerKgBought),
    grossMarginPctOfSales: salesPerKgBought > 0 ? Math.round((grossMarginPerKgBought / salesPerKgBought) * 100) : 0,
    breakEvenKgPerYear,
    breakEvenKgPerMonth: breakEvenKgPerYear ? Math.ceil(breakEvenKgPerYear / 12) : null,
  };
}

module.exports = { tierOf, buyerShippingPerKg, kgProblem, priceLine, totalsFor, economics };
