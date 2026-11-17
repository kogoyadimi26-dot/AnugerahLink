'use strict';

// Tampilan yang bisa diubah admin dari halaman Pengaturan.
// Nilai dasar tetap di config/theme.js. Admin hanya menimpa warna tertentu dan pilihan sudut.
// Hanya warna heks (#RRGGBB) yang diterima, supaya CSS tidak bisa disisipi kode lain.
const { ApiError } = require('./validate');

const EDITABLE = ['primary', 'accent', 'background', 'text'];
const MODES = ['light', 'dark'];
const RADIUS_PRESETS = {
  tajam: { sm: '4px', md: '6px', lg: '8px' },
  ramah: { sm: '8px', md: '12px', lg: '16px' },
  bulat: { sm: '12px', md: '18px', lg: '24px' },
};
const HEX = /^#[0-9a-fA-F]{6}$/;

// Memeriksa masukan admin. Mengembalikan objek yang sudah bersih, atau melempar ApiError.
function validateOverrides(input) {
  if (!input || typeof input !== 'object') throw new ApiError(400, 'invalid_input', 'Data tampilan tidak valid.');
  if (input.reset === true) return null;
  const out = {};
  for (const mode of MODES) {
    if (input[mode] === undefined) continue;
    const src = input[mode];
    if (!src || typeof src !== 'object') throw new ApiError(400, 'invalid_input', 'Data tampilan tidak valid.');
    out[mode] = {};
    for (const key of EDITABLE) {
      if (src[key] === undefined || src[key] === '') continue;
      if (typeof src[key] !== 'string' || !HEX.test(src[key])) {
        throw new ApiError(400, 'invalid_input', `Warna ${key} harus berbentuk #RRGGBB, misalnya #003C18.`, { [key]: 'Gunakan format #RRGGBB.' });
      }
      out[mode][key] = src[key].toLowerCase();
    }
  }
  if (input.radius !== undefined) {
    if (!Object.prototype.hasOwnProperty.call(RADIUS_PRESETS, input.radius)) {
      throw new ApiError(400, 'invalid_input', 'Pilih sudut: tajam, ramah, atau bulat.');
    }
    out.radius = input.radius;
  }
  return out;
}

// Gabungkan nilai dasar (config/theme.js) dengan timpaan dari database.
function mergeTheme(base, overrides) {
  if (!overrides) return base;
  const merged = { ...base, light: { ...base.light }, dark: { ...base.dark }, radius: { ...base.radius } };
  for (const mode of MODES) {
    const o = overrides[mode];
    if (!o) continue;
    for (const key of EDITABLE) {
      if (!o[key]) continue;
      if (key === 'primary') { merged[mode].primary = o.primary; merged[mode].primaryHover = o.primary; }
      else if (key === 'accent') { merged[mode].accent = o.accent; merged[mode].accentStrong = o.accent; }
      else if (key === 'background') { merged[mode].background = o.background; }
      else if (key === 'text') { merged[mode].text = o.text; }
    }
  }
  if (overrides.radius && RADIUS_PRESETS[overrides.radius]) merged.radius = { ...RADIUS_PRESETS[overrides.radius] };
  return merged;
}

module.exports = { EDITABLE, RADIUS_PRESETS, validateOverrides, mergeTheme };
