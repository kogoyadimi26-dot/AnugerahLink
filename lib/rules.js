'use strict';

// Aturan bisnis yang bisa diubah admin dari Pengaturan: harga beli, susut sortir, ongkir, biaya, biaya tetap, minimum pesanan, dan campuran grade.
// Nilai dasar tetap di config/business.js. Perubahan disimpan di db.settings.rules dan diterapkan ke konfigurasi yang berjalan.
// Setiap perubahan wajib disertai alasan dan dicatat di riwayat, sama seperti harga kategori.
const { ApiError } = require('./validate');
const config = require('../config/business');

const GRADES = ['reserve', 'premium', 'verified', 'local'];
const HISTORY_MAX = 30;

// Nilai dasar diambil sebelum pengaturan tersimpan diterapkan.
const BASE = {
  buyPricePerKg: config.buyPricePerKg,
  sortingLossPct: config.sortingLossPct,
  shippingPerKg: config.shippingPerKg,
  feesPerKg: config.feesPerKg,
  fixedCostsPerYear: config.fixedCostsPerYear,
  minOrderKg: config.minOrderKg,
  defaultMix: { ...config.defaultMix },
};

// Batas dan satuan tiap aturan. Persen disimpan sebagai pecahan (0,05 = 5%), tetapi diisi dan ditampilkan sebagai persen.
const DEFS = {
  buyPricePerKg: { label: 'Harga beli per kg', unit: 'Rp', min: 1000, max: 1000000, step: 1000 },
  sortingLossPct: { label: 'Susut sortir dan pengeringan', unit: '%', min: 0, max: 50, step: 1, toStore: (v) => v / 100, toInput: (v) => Math.round(v * 100) },
  shippingPerKg: { label: 'Ongkir per kg (jika berlaku)', unit: 'Rp', min: 0, max: 1000000, step: 1000 },
  feesPerKg: { label: 'Biaya per kg', unit: 'Rp', min: 0, max: 1000000, step: 100 },
  fixedCostsPerYear: { label: 'Biaya tetap per tahun (tim penuh)', unit: 'Rp', min: 0, max: 10000000000, step: 1000000 },
  minOrderKg: { label: 'Pesanan minimum per lot', unit: 'kg', min: 1, max: 10000, step: 1 },
};
const KEYS = [...Object.keys(DEFS), 'defaultMix'];

function isStep(n, step) { return Number.isInteger(n) && n % step === 0; }

// Memeriksa satu nilai dan mengembalikan nilai yang disimpan, atau melempar galat per kolom.
function checkValue(key, raw, fields) {
  const d = DEFS[key];
  const n = Number(raw);
  if (raw === '' || raw === null || raw === undefined || !Number.isFinite(n)) {
    fields[key] = `${d.label} harus berupa angka.`;
    return null;
  }
  if (n < d.min || n > d.max) {
    fields[key] = `${d.label} harus antara ${d.min} dan ${d.max}.`;
    return null;
  }
  if (!isStep(n, d.step)) {
    fields[key] = `${d.label} harus kelipatan ${d.step}.`;
    return null;
  }
  return d.toStore ? d.toStore(n) : n;
}

// Validasi isian. Mengembalikan nilai bersih (untuk disimpan) dan alasan perubahan.
function validateRules(input) {
  if (!input || typeof input !== 'object') throw new ApiError(400, 'invalid_input', 'Data aturan tidak valid.');
  const fields = {};
  const values = {};
  for (const key of Object.keys(DEFS)) {
    const v = checkValue(key, input[key], fields);
    if (v !== null) values[key] = v;
  }

  const mix = input.defaultMix || {};
  const mixPct = {};
  for (const g of GRADES) {
    const n = Number(mix[g]);
    if (mix[g] === '' || mix[g] === undefined || !Number.isInteger(n) || n < 0 || n > 100) {
      fields[`defaultMix.${g}`] = 'Persentase harus bilangan bulat 0 sampai 100.';
    } else mixPct[g] = n;
  }
  if (Object.keys(mixPct).length === GRADES.length) {
    const sum = GRADES.reduce((a, g) => a + mixPct[g], 0);
    if (sum !== 100) fields.defaultMix = `Campuran grade harus berjumlah 100% (sekarang ${sum}%).`;
    else values.defaultMix = Object.fromEntries(GRADES.map((g) => [g, mixPct[g] / 100]));
  }

  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (reason.length < 5) fields.reason = 'Tulis alasan perubahan (minimal 5 karakter).';
  if (reason.length > 300) fields.reason = 'Alasan maksimal 300 karakter.';

  if (Object.keys(fields).length) throw new ApiError(400, 'invalid_input', 'Periksa aturan yang diisi.', fields);
  return { values, reason };
}

// Nilai yang berlaku = dasar, ditimpa yang tersimpan.
function rulesFor(settings) {
  const saved = (settings && settings.rules) || {};
  const out = {};
  for (const key of KEYS) out[key] = saved[key] !== undefined ? saved[key] : BASE[key];
  out.defaultMix = { ...out.defaultMix };
  return out;
}

// Bentuk isian (persen untuk susut dan campuran).
function toForm(values) {
  const out = {};
  for (const key of Object.keys(DEFS)) {
    const d = DEFS[key];
    out[key] = d.toInput ? d.toInput(values[key]) : values[key];
  }
  out.defaultMix = Object.fromEntries(GRADES.map((g) => [g, Math.round(values.defaultMix[g] * 100)]));
  return out;
}

// Menerapkan nilai ke konfigurasi yang dipakai perhitungan.
function applyRules(settings) {
  const v = rulesFor(settings);
  for (const key of Object.keys(DEFS)) config[key] = v[key];
  config.defaultMix = { ...v.defaultMix };
}

// Perubahan antara dua kumpulan nilai (nilai simpan, bukan isian).
function changesOf(before, after) {
  const out = [];
  for (const key of KEYS) {
    const a = JSON.stringify(before[key]);
    const b = JSON.stringify(after[key]);
    if (a !== b) out.push({ key, from: before[key], to: after[key] });
  }
  return out;
}

function appendHistory(history, entry) {
  const list = Array.isArray(history) ? history : [];
  return [entry, ...list].slice(0, HISTORY_MAX);
}

module.exports = { validateRules, rulesFor, toForm, applyRules, changesOf, appendHistory, DEFS, GRADES, BASE, KEYS };
