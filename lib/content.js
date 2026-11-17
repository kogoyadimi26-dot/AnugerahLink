'use strict';

// Pengaturan yang bisa diubah admin: harga per kategori dan teks situs.
// Perubahan disimpan di database (db.settings) dan langsung diterapkan ke konfigurasi yang berjalan.
const { ApiError } = require('./validate');
const business = require('../config/business');
const defaults = require('../config/content');

const BASE_PRICES = Object.fromEntries(Object.entries(business.tiers).map(([c, t]) => [c, t.pricePerKg]));
const CONTENT_KEYS = Object.keys(defaults);
const MAX_PRICE = 10000000;

// Validasi harga: bilangan bulat rupiah, kelipatan Rp1.000, antara Rp10.000 dan Rp10.000.000.
function validatePrices(input) {
  if (!input || typeof input !== 'object') throw new ApiError(400, 'invalid_input', 'Data harga tidak valid.');
  const fields = {};
  const out = {};
  for (const code of Object.keys(BASE_PRICES)) {
    const raw = input[code];
    const n = Number(raw);
    if (raw === undefined || raw === '' || !Number.isInteger(n) || n < 10000 || n > MAX_PRICE || n % 1000 !== 0) {
      fields[code] = 'Harga harus bilangan bulat kelipatan Rp1.000, antara Rp10.000 dan Rp10.000.000.';
    } else out[code] = n;
  }
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (reason.length < 5) fields.reason = 'Tulis alasan perubahan harga (minimal 5 karakter).';
  if (reason.length > 300) fields.reason = 'Alasan maksimal 300 karakter.';
  if (Object.keys(fields).length) throw new ApiError(400, 'invalid_input', 'Periksa harga dan alasan perubahan.', fields);
  return { prices: out, reason };
}

// Validasi teks situs: teks biasa, 1 sampai 300 karakter, tanpa tag HTML.
function validateContent(input) {
  if (!input || typeof input !== 'object') throw new ApiError(400, 'invalid_input', 'Data teks tidak valid.');
  const fields = {};
  const out = {};
  for (const key of CONTENT_KEYS) {
    const v = typeof input[key] === 'string' ? input[key].trim() : '';
    if (!v) fields[key] = 'Teks tidak boleh kosong.';
    else if (v.length > 300) fields[key] = 'Teks maksimal 300 karakter.';
    else if (/[<>]/.test(v)) fields[key] = 'Gunakan teks biasa, tanpa tanda < atau >.';
    else out[key] = v;
  }
  if (Object.keys(fields).length) throw new ApiError(400, 'invalid_input', 'Periksa teks yang diisi.', fields);
  return out;
}

// Konfigurasi yang berjalan = dasar + pengaturan dari database. Dipanggil saat server mulai dan setiap kali admin menyimpan.
function applySettings(settings) {
  const prices = (settings && settings.prices) || {};
  for (const code of Object.keys(BASE_PRICES)) {
    business.tiers[code].pricePerKg = prices[code] || BASE_PRICES[code];
  }
}

function contentFor(settings) {
  return { ...defaults, ...((settings && settings.content) || {}) };
}

module.exports = { validatePrices, validateContent, applySettings, contentFor, BASE_PRICES, CONTENT_KEYS, defaults };
