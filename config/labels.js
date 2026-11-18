'use strict';

// Label menu dan tab yang bisa diubah admin. Kuncinya stabil (dipakai di HTML dan kode);
// nilainya adalah teks standar yang dipakai bila admin belum mengubahnya.
module.exports = {
  'nav.produk': { text: 'Produk', where: 'Menu utama' },
  'nav.tentang': { text: 'Tentang', where: 'Menu utama' },
  'nav.privasi': { text: 'Kebijakan privasi', where: 'Menu utama' },
  'nav.syarat': { text: 'Syarat', where: 'Menu utama' },
  'sub.cupping': { text: 'Skor cupping tertinggi', where: 'Pintasan produk' },
  'sub.panen': { text: 'Panen terbaru', where: 'Pintasan produk' },
  'sub.harga': { text: 'Harga terendah', where: 'Pintasan produk' },
  'sub.habis': { text: 'Termasuk yang habis', where: 'Pintasan produk' },
  'admin.dasbor': { text: 'Dasbor', where: 'Menu panel tim' },
  'admin.alur': { text: 'Alur kerja', where: 'Menu panel tim' },
  'admin.intake': { text: 'Pembelian', where: 'Menu panel tim' },
  'admin.lots': { text: 'Lot', where: 'Menu panel tim' },
  'admin.orders': { text: 'Pesanan', where: 'Menu panel tim' },
  'admin.proposal': { text: 'Proposal', where: 'Menu panel tim' },
  'admin.feedback': { text: 'Feedback', where: 'Menu panel tim' },
  'admin.users': { text: 'Pengguna', where: 'Menu panel tim' },
  'admin.pembeli': { text: 'Pembeli', where: 'Menu panel tim' },
  'admin.audit': { text: 'Riwayat', where: 'Menu panel tim' },
  'admin.settings': { text: 'Pengaturan', where: 'Menu panel tim' },
};
