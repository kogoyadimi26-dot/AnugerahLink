'use strict';

// Visual theme for the whole app. Change a value here and every page updates:
// the app applies these values as CSS variables when it loads (see public/app.js).
// Colours are taken from the AnugerahLink logo: forest green, gold and coffee brown.

module.exports = {
  name: 'AnugerahLink',
  light: {
    primary: '#003C18',      // hijau hutan: tombol, judul, navigasi
    primaryHover: '#0E5A2C',
    primarySoft: '#E7EFE9',
    success: '#0E5A2C',
    accent: '#C0900C',       // emas: aksen, garis, sorotan
    accentStrong: '#E0AE3A',
    accentSoft: '#F8EFD6',
    accentInk: '#7A5A00',    // emas untuk teks di atas putih
    brown: '#60300C',
    background: '#FBF8F1',
    surface: '#FFFFFF',
    text: '#1E2A21',
    textMuted: '#56655A',
    border: '#E3DED0',
  },
  dark: {
    primary: '#E0AE3A',
    primaryHover: '#F0C458',
    primarySoft: '#1E3324',
    success: '#7CC79A',
    accent: '#E0AE3A',
    accentStrong: '#E0AE3A',
    accentSoft: '#2A2412',
    accentInk: '#E8B04A',
    brown: '#D9A37A',
    background: '#0E1A12',
    surface: '#162419',
    text: '#EEF0E6',
    textMuted: '#A9B5A8',
    border: '#2A3B2E',
  },
  radius: { sm: '8px', md: '12px', lg: '16px' },
  font: '"Inter AL", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};
