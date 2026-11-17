'use strict';

// Business rules for AnugerahLink. These are the v2 plan defaults
// (docs/business/source/AnugerahLink_Business_Plan_and_Model_v2.docx).
// The owner has not confirmed them yet. Change them here, not in the code.
// All amounts are in rupiah (IDR).

module.exports = {
  currency: 'IDR',

  // Buying from farmer groups
  buyPricePerKg: 120000,
  sortingLossPct: 0.05,

  // Costs per kg bought
  shippingPerKg: 20000, // Rp20,000 per kg, paid by AnugerahLink or the buyer (see tiers)
  feesPerKg: 2000, // samples, claims, payment charges

  // Fixed costs (full team) used for break-even
  fixedCostsPerYear: 400000000,

  // Ordering rules
  minOrderKg: 30,
  stepKg: 1,
  lowStockKg: 60,

  // Tiers. shippingBy: 'anugerah' = included in price, AnugerahLink pays;
  // 'buyer' = buyer pays shippingPerKg on top; 'none' = collected in Papua.
  tiers: {
    reserve: { label: 'Reserve', pricePerKg: 350000, shippingBy: 'anugerah', description: 'Kafe spesialti terbaik dan contoh ekspor. Skor cupping 86+, lot kecil.' },
    premium: { label: 'Premium', pricePerKg: 250000, shippingBy: 'anugerah', description: 'Kafe spesialti dan roaster premium. SNI Grade 1, skor cupping 84 sampai 85.' },
    verified: { label: 'Standar Terverifikasi', pricePerKg: 150000, shippingBy: 'buyer', description: 'Roaster di Jakarta dan Surabaya. SNI Grade 1 sampai 2, skor cupping 80 sampai 83.' },
    local: { label: 'Lokal', pricePerKg: 100000, shippingBy: 'none', description: 'Kafe dan roaster di Papua. Grade 3 ke bawah, skor cupping di bawah 80.' },
  },

  // Assumed grade mix (share of sellable kg), used when there is no stock yet
  defaultMix: { reserve: 0.05, premium: 0.25, verified: 0.40, local: 0.30 },

  // About page content. Edit the text here; the page updates from this file.
  // icon: coin | passport | check
  about: {
    eyebrow: 'Tentang kami',
    title: 'Kopi Papua yang bisa ditelusuri',
    lead: 'AnugerahLink membeli kopi dari kelompok tani di dataran tinggi Papua, menilai setiap lot, dan menjualnya dengan paspor yang menunjukkan asalnya.',
    pillars: [
      { icon: 'coin', title: 'Petani dibayar tunai', text: 'Harga diumumkan di kebun dan dibayar saat pengambilan. Petani tidak perlu menunggu.' },
      { icon: 'check', title: 'Dinilai sebelum dijual', text: 'Setiap lot ditimbang, disortir dan dicupping sebelum masuk katalog.' },
      { icon: 'passport', title: 'Paspor setiap lot', text: 'Asal, grade, skor cupping dan harga yang dibayarkan, dengan kode hash untuk memastikan data tidak berubah.' },
    ],
  },

  // Claims and returns. Status 'draft' means the owner has not approved these terms yet.
  // The About page shows the draft notice until status is changed to 'approved'.
  policy: {
    status: 'draft',
    claimWindowHours: 48,
    sections: [
      { title: 'Yang kami jamin', text: 'Setiap lot sesuai tier, grade dan skor cupping di daftar jual, serta berat pada pesanan Anda.' },
      { title: 'Pemeriksaan saat tiba', text: 'Periksa karung saat tiba: jumlah, berat dan kemasan. Catat kerusakan sebelum karung dibuka.' },
      { title: 'Melaporkan masalah', text: 'Laporkan masalah dari halaman pesanan Anda dalam 48 jam sejak pengantaran, disertai uraian. Kirim foto karung dan contoh kopi ke tim melalui email.' },
      { title: 'Tindakan kami', text: 'Tim meninjau setiap klaim dalam [3 hari kerja, PERLU DIKONFIRMASI]. Solusinya berupa penggantian dari lot lain, kredit untuk pesanan berikutnya, atau pengembalian dana untuk lot yang dipersoalkan, sesuai kesepakatan dengan Anda.' },
      { title: 'Setelah 48 jam', text: 'Klaim yang terlambat ditangani kasus per kasus. Hubungi tim segera setelah Anda melihat masalah.' },
      { title: 'Pembatalan', text: 'Anda dapat membatalkan sebelum kami mengirim. Ketentuan pengembalian dana untuk pesanan yang sudah dibayar: [PERLU DIKONFIRMASI].' },
      { title: 'Pengembalian barang', text: 'Kami tidak menerima kopi kembali karena selera rasa tidak cocok. Klaim untuk lot yang tidak sesuai daftar jual ditangani seperti di atas.' },
    ],
  },

  // Bank transfer details are placeholders until the owner provides them.
  // The app shows them on the order page and never invents account numbers.
  payment: {
    method: 'bank_transfer_invoice',
    bankName: 'TO BE CONFIRMED BY THE TEAM',
    accountName: 'TO BE CONFIRMED BY THE TEAM',
    accountNumber: 'TO BE CONFIRMED BY THE TEAM',
  },
};
