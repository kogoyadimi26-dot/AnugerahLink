'use strict';

// Business rules for AnugerahLink. These are the v2 plan defaults
// (docs/business/source/AnugerahLink_Business_Plan_and_Model_v2.docx).
// The owner has not confirmed them yet. Change them here, not in the code.
// All amounts are in rupiah (IDR).

module.exports = {
  currency: 'IDR',

  // Buying from farmer groups. Rp120.000 dipakai sebagai asumsi perencanaan (harga tertinggi, Grade A).
  // Rp100.000 hanya referensi lama (2022). Ganti setelah lot percobaan memberi harga nyata.
  buyPricePerKg: 120000,
  sortingLossPct: 0.05,

  // Costs per kg bought
  shippingPerKg: 20000, // Rp20,000 per kg, paid by AnugerahLink or the buyer (see tiers)
  feesPerKg: 2000, // samples, claims, payment charges

  // Fixed costs (full team) used for break-even
  // Biaya tetap per tahun (Rp). Dasar: staf Rp471 juta (6 orang, tengah) + software Rp26 juta + sewa gudang Rp119 juta
  // (150 m2, Rp60.000/m2/bulan, PPN 10%). Lihat docs/business/CAPEX_v1.md bagian 6-10. Bukan dari sumber; asumsi.
  fixedCostsPerYear: 616000000,

  // Estimasi tiba (asumsi perencanaan, perlu dikonfirmasi dengan kurir): dihitung dari tanggal dikirim.
  // Batas akhir dipakai sebagai janji agar keterlambatan tidak dihitung terlalu cepat.
  delivery: {
    transitDaysMin: 2,
    transitDaysMax: 4,
  },

  // Ordering rules
  minOrderKg: 30,
  // Maksimal kg per lot dalam satu pesanan. 300 kg dipertahankan untuk pilot (bukan dari dokumen; keputusan perencanaan).
  // Tinjau ulang bila lot sering lebih dari 300 kg atau pembeli minta satu lot penuh.
  maxOrderKg: 300,
  stepKg: 1,
  lowStockKg: 60,

  // Tiers. shippingBy: 'anugerah' = included in price, AnugerahLink pays;
  // 'buyer' = buyer pays shippingPerKg on top; 'none' = collected in Papua.
  tiers: {
    reserve: { label: 'Reserve', pricePerKg: 350000, shippingBy: 'anugerah', description: 'Kafe spesialti terbaik dan contoh ekspor. Skor cupping 86+, lot kecil.' },
    premium: { label: 'Premium', pricePerKg: 250000, shippingBy: 'anugerah', description: 'Kafe spesialti dan roaster premium. SNI Grade 1, skor cupping 84 sampai 85.' },
    verified: { label: 'Standar Terverifikasi', pricePerKg: 150000, shippingBy: 'buyer', description: 'Roaster di Jakarta dan Surabaya. SNI Grade 1 sampai 2, skor cupping 80 sampai 83.' },
    // Harga Lokal dinaikkan dari Rp100.000: pada harga beli Rp120.000, Rp100.000 rugi Rp26.900/kg.
    // Rp130.000 memberi margin tipis positif (sekitar Rp1.600/kg). Lihat test "local tier stays above break-even".
    local: { label: 'Lokal', pricePerKg: 130000, shippingBy: 'none', description: 'Kafe dan roaster di Papua. Grade 3 ke bawah, skor cupping di bawah 80.' },
  },

  // Assumed grade mix (share of sellable kg), used when there is no stock yet
  defaultMix: { reserve: 0.05, premium: 0.25, verified: 0.40, local: 0.30 },

  // Alur kerja staf: lot dinilai, diverifikasi penilai, lalu diterbitkan admin.
  workflow: {
    requireSecondPersonToPublish: true,
  },

  // Pemeriksaan saat pembelian (intake). Angka ini sudah dikonfirmasi pemilik.
  // Sampel: jumlah biji yang diperiksa per sampel (gram).
  intake: {
    sampleGrams: 300,
    moisture: { min: 10, max: 12, rejectBelow: 8, rejectAbove: 14 }, // persen
    defects: { pass: 25, reject: 60 },                               // cacat per sampel
    deductionPct: 10,                                                // (lama) potongan harga; diganti grade bands
  },

  // Grade pembelian berdasarkan jumlah cacat per sampel. Harga dibayar = payPct persen
  // dari harga beli. Angka ini default sementara dan perlu dikonfirmasi pemilik.
  gradeBands: [
    { key: 'A', label: 'Grade A', maxDefects: 25, payPct: 100 },
    { key: 'B', label: 'Grade B', maxDefects: 45, payPct: 90 },
    { key: 'C', label: 'Grade C', maxDefects: 60, payPct: 80 },
  ],

  // Penjelasan proses pengolahan untuk pembeli. "match" adalah nama yang sering dipakai
  // produsen. Tambah atau ubah di sini; halaman lot dan traceability ikut berubah.
  processes: {
    washed: {
      label: 'Dicuci (fully washed)',
      match: ['dicuci', 'washed', 'fully washed', 'full wash'],
      description: 'Kulit dan daging buah dikupas, lalu biji difermentasi dan dicuci dengan air. Hasilnya biasanya bersih dan cerah, dengan keasaman yang jelas.',
    },
    wet_hulled: {
      label: 'Giling basah (semi washed)',
      match: ['giling basah', 'wet-hulled', 'wet hulled', 'semi washed', 'semi-washed'],
      description: 'Kulit dan daging buah dikupas, lalu kulit tanduk dilepas saat biji masih basah sebelum dikeringkan. Hasilnya biasanya tubuh lebih tebal, rasa earthy, dan keasaman lebih lembut.',
    },
    natural: {
      label: 'Natural (kering)',
      match: ['natural', 'kering', 'dry'],
      description: 'Seluruh buah dikeringkan bersama biji. Hasilnya biasanya manis dan fruity, dengan rasa buah yang kuat.',
    },
    honey: {
      label: 'Honey',
      match: ['honey', 'pulped natural'],
      description: 'Kulit dikupas, tetapi sebagian lendir dibiarkan menempel saat dikeringkan. Hasilnya berada di antara dicuci dan natural: manis dengan keasaman lembut. Nama "honey" tidak berarti ada madu.',
    },
    anaerobic: {
      label: 'Anaerobik',
      match: ['anaerobik', 'anaerobic'],
      description: 'Buah difermentasi utuh di dalam tangki tertutup tanpa oksigen. Hasilnya biasanya rasa buah yang kuat dan tidak biasa. Ini metode eksperimental.',
    },
  },

  // Nilai inti perusahaan, ditampilkan di beranda. Ubah teks di sini.
  // icon: shield | sprout | hand | check
  values: [
    { icon: 'shield', title: 'Integritas', text: 'Kami hanya menjual apa yang sudah kami periksa, nilai, dan dapat kami buktikan. Berkat yang dipercayakan harus dijaga dengan jujur.' },
    { icon: 'sprout', title: 'Anugerah', text: 'Papua memiliki kekayaan alam yang masih tersembunyi. Kami menghargainya dengan membayar petani secara tunai dan adil, lalu menjaga mutunya sampai ke cangkir pembeli.' },
    { icon: 'hand', title: 'Menghubungkan', text: 'Kami membuka jalan dari kebun di pedalaman ke pasar di seluruh dunia, supaya hasil bumi Papua tidak lagi tertahan karena jauh dari pembeli.' },
    { icon: 'check', title: 'Kepercayaan', text: 'Setiap lot sesuai dengan grade, skor cupping, dan traceability-nya, sehingga petani dan pembeli dapat saling percaya.' },
  ],

  // About page content. Edit the text here; the page updates from this file.
  // icon: coin | passport | check
  about: {
    eyebrow: 'Tentang kami',
    title: 'Kopi Papua yang bisa ditelusuri',
    lead: 'AnugerahLink membeli kopi dari kelompok tani di dataran tinggi Papua, menilai setiap lot, dan menjualnya dengan traceability yang menunjukkan asalnya.',
    // Misi: satu kalimat yang menjelaskan model bisnis.
    mission: 'Membuka akses pasar bagi kopi dan hasil bumi Papua dari pedalaman: membayar petani secara tunai dan adil, menilai serta menelusuri setiap lot, lalu menghubungkannya langsung dengan pembeli, agar berkat yang Tuhan berikan bagi tanah Papua dapat dinikmati banyak orang.',
    // Sejarah singkat, hanya dari rencana usaha (November 2026). Tambahkan tonggak nyata bila sudah ada.
    history: [
      'AnugerahLink didirikan pada 17 November 2026. Namanya lahir dari keyakinan bahwa tanah dan alam Papua adalah anugerah: kekayaan yang masih tersembunyi di pedalaman.',
      'Masyarakat Papua memiliki hasil bumi yang berharga, tetapi di daerah terpencil mereka sering tidak bisa menjualnya ke pasar. Jalan yang sulit, transportasi yang mahal, infrastruktur yang terbatas, dan keterbatasan sumber daya manusia untuk mengelola hasil bumi dengan baik membuat banyak orang sulit menjangkau pembeli yang mau membayar dengan layak.',
      'AnugerahLink hadir untuk menjembatani itu. Kami membeli langsung dari kelompok tani, menilai dan menelusuri setiap lot, lalu menghubungkannya dengan roaster dan kafe. Langkah pertama kami adalah pilot 90 hari dengan 200 sampai 500 kg kopi dari Wamena dan Tiom.',
      'Kami percaya berkat ini dianugerahkan Tuhan untuk dibagikan. Tujuan kami adalah agar semakin banyak orang di dunia dapat menikmati kopi dan hasil bumi Papua, dan agar masyarakat Papua ikut menikmati hasilnya.',
    ],
    pillars: [
      { icon: 'coin', title: 'Petani dibayar tunai', text: 'Harga diumumkan di kebun dan dibayar saat pengambilan. Petani tidak perlu menunggu.' },
      { icon: 'check', title: 'Dinilai sebelum dijual', text: 'Setiap lot ditimbang, disortir dan dicupping sebelum masuk katalog.' },
      { icon: 'passport', title: 'Traceability setiap lot', text: 'Asal, grade, skor cupping dan harga yang dibayarkan, dengan kode hash untuk memastikan data tidak berubah.' },
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
