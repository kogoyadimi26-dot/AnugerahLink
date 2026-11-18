'use strict';

// Label menu dan tab yang bisa diubah admin, dengan riwayat perubahan agar bisa dikembalikan.
const { ApiError } = require('./validate');
const defaults = require('../config/labels');

const KEYS = Object.keys(defaults);
const MAX_LEN = 40;
const HISTORY_MAX = 30;

// Hanya kunci yang dikenal yang boleh disimpan. Teks wajib, maksimal 40 karakter, tanpa < atau >.
function validateLabels(input) {
  if (!input || typeof input !== 'object') throw new ApiError(400, 'invalid_input', 'Data label tidak valid.');
  const fields = {};
  const out = {};
  for (const key of Object.keys(input)) {
    if (!KEYS.includes(key)) fields[key] = 'Label ini tidak dikenal.';
  }
  for (const key of KEYS) {
    const raw = input[key];
    const v = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
    if (!v) fields[key] = 'Label tidak boleh kosong.';
    else if (v.length > MAX_LEN) fields[key] = `Maksimal ${MAX_LEN} karakter.`;
    else if (/[<>]/.test(v)) fields[key] = 'Gunakan teks biasa, tanpa tanda < atau >.';
    else out[key] = v;
  }
  if (Object.keys(fields).length) throw new ApiError(400, 'invalid_input', 'Periksa label yang diisi.', fields);
  return out;
}

// Label yang tampil = teks standar, ditimpa yang disimpan admin.
function labelsFor(settings) {
  const saved = (settings && settings.labels) || {};
  return Object.fromEntries(KEYS.map((k) => [k, saved[k] || defaults[k].text]));
}

// Riwayat: setiap penyimpanan mencatat nilai sebelum dan sesudah. Hanya bagian yang berubah yang disimpan.
function changesOf(before, after) {
  return KEYS.filter((k) => before[k] !== after[k]).map((k) => ({ key: k, from: before[k], to: after[k] }));
}

function appendHistory(history, entry) {
  const list = Array.isArray(history) ? history : [];
  return [entry, ...list].slice(0, HISTORY_MAX);
}

module.exports = { validateLabels, labelsFor, changesOf, appendHistory, defaults, KEYS, HISTORY_MAX };
