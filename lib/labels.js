'use strict';

// Label menu dan tab yang bisa diubah admin, dalam dua bahasa.
// Alur: admin menyimpan draf, lalu menerbitkannya. Penerbitan dicatat di riwayat dengan nilai lama dan baru.
const { ApiError } = require('./validate');
const defaults = require('../config/labels');

const KEYS = Object.keys(defaults);
const MAX_LEN = 40;
const HISTORY_MAX = 30;
const LANGS = ['id', 'en'];

// Validasi satu bahasa: setiap kunci wajib diisi, maksimal 40 karakter, tanpa < atau >.
// Galat dikirim per kolom dengan nama "id.<kunci>" atau "en.<kunci>".
function validateSet(input, lang) {
  const set = input && input[lang];
  if (!set || typeof set !== 'object') return { out: null, fields: { [lang]: 'Data label tidak lengkap.' } };
  const fields = {};
  const out = {};
  for (const key of Object.keys(set)) {
    if (!KEYS.includes(key)) fields[`${lang}.${key}`] = 'Label ini tidak dikenal.';
  }
  for (const key of KEYS) {
    const raw = set[key];
    const v = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
    const name = `${lang}.${key}`;
    if (!v) fields[name] = 'Label tidak boleh kosong.';
    else if (v.length > MAX_LEN) fields[name] = `Maksimal ${MAX_LEN} karakter.`;
    else if (/[<>]/.test(v)) fields[name] = 'Gunakan teks biasa, tanpa tanda < atau >.';
    else out[key] = v;
  }
  return { out, fields };
}

// Validasi kedua bahasa sekaligus. Body: { id: { kunci: teks }, en: { kunci: teks } }.
function validateLabelSet(input) {
  if (!input || typeof input !== 'object') throw new ApiError(400, 'invalid_input', 'Data label tidak valid.');
  const fields = {};
  const result = {};
  for (const lang of LANGS) {
    const r = validateSet(input, lang);
    Object.assign(fields, r.fields);
    result[lang] = r.out;
  }
  if (Object.keys(fields).length) throw new ApiError(400, 'invalid_input', 'Periksa label yang diisi.', fields);
  return { id: result.id, en: result.en };
}

// Label yang tampil = teks standar, ditimpa yang sudah diterbitkan.
function publishedFor(settings) {
  const s = settings || {};
  const id = s.labels || {};
  const en = s.labelsEn || {};
  return {
    id: Object.fromEntries(KEYS.map((k) => [k, id[k] || defaults[k].text])),
    en: Object.fromEntries(KEYS.map((k) => [k, en[k] || defaults[k].en])),
  };
}

// Teks yang dikirim ke halaman publik dan panel tim.
function labelsFor(settings) { return publishedFor(settings).id; }
function labelsEnFor(settings) { return publishedFor(settings).en; }

function defaultSet() {
  return { id: Object.fromEntries(KEYS.map((k) => [k, defaults[k].text])), en: Object.fromEntries(KEYS.map((k) => [k, defaults[k].en])) };
}

// Perubahan antara dua kumpulan (keduanya bahasa). Hanya yang berubah yang dicatat.
function changesOf(before, after) {
  const out = [];
  for (const lang of LANGS) {
    for (const k of KEYS) {
      if (before[lang][k] !== after[lang][k]) out.push({ lang, key: k, from: before[lang][k], to: after[lang][k] });
    }
  }
  return out;
}

function appendHistory(history, entry) {
  const list = Array.isArray(history) ? history : [];
  return [entry, ...list].slice(0, HISTORY_MAX);
}

module.exports = {
  validateLabelSet, publishedFor, labelsFor, labelsEnFor, defaultSet, changesOf, appendHistory,
  defaults, KEYS, HISTORY_MAX, LANGS,
};
