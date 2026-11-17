'use strict';

// Tampilan seluruh aplikasi. Ubah nilai di sini, lalu semua halaman ikut berubah.
// Nilai ini diterapkan sebagai variabel CSS saat aplikasi dibuka (lihat applyTheme di public/app.js).
// Warna diambil dari logo AnugerahLink: hijau hutan, emas, dan cokelat kopi.
// Mode gelap dipakai otomatis mengikuti perangkat, atau pengunjung memilih sendiri di header.

module.exports = {
  name: 'AnugerahLink',
  light: {
    primary: '#003C18',        // hijau hutan: tombol utama dan navigasi aktif
    primaryHover: '#0E5A2C',
    primarySoft: '#E7EFE9',    // latar lembut: sorotan, baris tabel saat disentuh
    onPrimary: '#FFFFFF',      // warna teks di atas tombol utama
    heading: '#003C18',
    success: '#0E5A2C',
    accent: '#C0900C',         // emas: aksen dan garis
    accentStrong: '#E0AE3A',
    accentSoft: '#F8EFD6',
    accentInk: '#7A5A00',      // emas untuk teks di atas putih
    brown: '#60300C',          // cokelat kopi: kategori reserve
    danger: '#A3262B',
    background: '#FBF8F1',
    surface: '#FFFFFF',
    text: '#1E2A21',
    textMuted: '#56655A',
    border: '#E3DED0',
    heroFrom: '#003C18',
    heroTo: '#0E5A2C',
    heroInk: '#FFFFFF',
    footerBg: '#003C18',
    footerInk: '#D7E2D4',
  },
  dark: {
    primary: '#E0AE3A',
    primaryHover: '#F0C458',
    primarySoft: '#1E3324',
    onPrimary: '#0E1A12',
    heading: '#EEF0E6',
    success: '#7CC79A',
    accent: '#E0AE3A',
    accentStrong: '#E0AE3A',
    accentSoft: '#2A2412',
    accentInk: '#E8B04A',
    brown: '#D9A37A',
    danger: '#F08A8D',
    background: '#0E1A12',
    surface: '#162419',
    text: '#EEF0E6',
    textMuted: '#A9B5A8',
    border: '#2A3B2E',
    heroFrom: '#132A1B',
    heroTo: '#1E3324',
    heroInk: '#EEF0E6',
    footerBg: '#08120B',
    footerInk: '#D7E2D4',
  },
  radius: { sm: '8px', md: '12px', lg: '16px' },
  font: '"Inter AL", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};
