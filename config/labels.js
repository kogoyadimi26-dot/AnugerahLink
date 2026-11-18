'use strict';

// Label menu dan tab yang bisa diubah admin. Kuncinya stabil (dipakai di HTML dan kode).
// text: teks Indonesia standar. en: teks Inggris standar. where: tempat label tampil (untuk pengelompokan di admin).
module.exports = {
  'nav.produk': { text: 'Produk', en: 'Products', where: 'Menu utama' },
  'nav.tentang': { text: 'Tentang', en: 'About', where: 'Menu utama' },
  'nav.privasi': { text: 'Kebijakan privasi', en: 'Privacy policy', where: 'Menu utama' },
  'nav.syarat': { text: 'Syarat', en: 'Terms', where: 'Menu utama' },
  'sub.cupping': { text: 'Skor cupping tertinggi', en: 'Highest cupping score', where: 'Pintasan produk' },
  'sub.panen': { text: 'Panen terbaru', en: 'Newest harvest', where: 'Pintasan produk' },
  'sub.harga': { text: 'Harga terendah', en: 'Lowest price', where: 'Pintasan produk' },
  'sub.habis': { text: 'Termasuk yang habis', en: 'Including sold out', where: 'Pintasan produk' },
  'admin.dasbor': { text: 'Dasbor', en: 'Dashboard', where: 'Menu panel tim' },
  'admin.alur': { text: 'Alur kerja', en: 'Workflow', where: 'Menu panel tim' },
  'admin.intake': { text: 'Pembelian', en: 'Purchasing', where: 'Menu panel tim' },
  'admin.lots': { text: 'Lot', en: 'Lots', where: 'Menu panel tim' },
  'admin.orders': { text: 'Pesanan', en: 'Orders', where: 'Menu panel tim' },
  'admin.proposal': { text: 'Proposal', en: 'Proposals', where: 'Menu panel tim' },
  'admin.feedback': { text: 'Feedback', en: 'Feedback', where: 'Menu panel tim' },
  'admin.users': { text: 'Pengguna', en: 'Users', where: 'Menu panel tim' },
  'admin.pembeli': { text: 'Pembeli', en: 'Buyers', where: 'Menu panel tim' },
  'admin.audit': { text: 'Riwayat', en: 'History', where: 'Menu panel tim' },
  'admin.settings': { text: 'Pengaturan', en: 'Settings', where: 'Menu panel tim' },
};
