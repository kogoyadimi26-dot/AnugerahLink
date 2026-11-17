# AnugerahLink: estimasi capex (v1, draft untuk pitch)

Status: estimasi awal. Angka bersumber ditandai "Sumber". Angka lain adalah asumsi dan wajib diganti dengan penawaran harga sebelum dipakai di pitch.
Kurs asumsi: Rp16.000 per US$. Perbarui sebelum dipakai.

## 1. Ringkasan

| | Rendah | Tengah | Tinggi |
|---|---|---|---|
| Subtotal (Rp juta) | 221,9 | 376,7 | 532,1 |
| Kontingensi 15% (Rp juta) | 33,3 | 56,5 | 79,8 |
| **Total capex (Rp juta)** | **255,2** | **433,2** | **611,9** |
| dari sumber, sebelum kontingensi | 58,9 | 130,2 | 202,1 |
| dari asumsi, sebelum kontingensi | 163,0 | 246,5 | 330,0 |

Sekitar 75% dari angka tengah masih asumsi. Penawaran dari pemasok adalah prioritas pertama sebelum pitch.

## 2. Rincian (Rp juta)

| Kelompok | Item | Rendah | Tengah | Tinggi | Status |
|---|---|---|---|---|---|
| Pengolahan gabah | Huller kopi kering (1 unit) | 3,8 | 3,8 | 3,8 | Sumber: harga kategori Tokopedia |
| Pengolahan gabah | Pengering mekanis 750 kg per batch (1 unit) | 32,0 | 96,0 | 160,0 | Sumber (rentang): US$2.000–10.000 |
| Pengolahan gabah | Rak/bed pengeringan 80 m² | 19,2 | 25,6 | 32,0 | Sumber (rentang): US$15–25 per m² |
| Pengolahan gabah | Atap pelindung pengering 50 m² | 50,0 | 75,0 | 100,0 | Asumsi |
| Grading & mutu | Moisture meter kopi hijau (AgraTronix 08150) | 3,9 | 4,8 | 6,3 | Sumber (rentang): US$246–395 |
| Grading & mutu | Set sieve screen | 5,0 | 7,5 | 10,0 | Asumsi |
| Grading & mutu | Timbangan presisi 0,01 g | 3,0 | 4,5 | 6,0 | Asumsi |
| Grading & mutu | Meja sortir dan nampan hitung cacat | 2,0 | 3,0 | 4,0 | Asumsi |
| Lab cupping | Sample roaster 500 g–1 kg | 40,0 | 60,0 | 80,0 | Asumsi |
| Lab cupping | Grinder lab | 8,0 | 11,5 | 15,0 | Asumsi |
| Lab cupping | Kit cupping (35 mangkuk, meja, sendok, gelas ukur, Agtron) | 10,0 | 15,0 | 20,0 | Asumsi |
| Penyimpanan | Kantong hermetik (stok awal) | 5,0 | 7,5 | 10,0 | Asumsi |
| Penyimpanan | Dehumidifier dan ventilasi ruang simpan | 10,0 | 17,5 | 25,0 | Asumsi |
| Penyimpanan | Rak dan palet | 3,0 | 4,5 | 6,0 | Asumsi |
| Operasional | Timbangan platform intake (1 ton) | 15,0 | 22,5 | 30,0 | Asumsi |
| Operasional | Laptop, tablet lapangan | 10,0 | 15,0 | 20,0 | Asumsi |
| Operasional | Lemari sampel tersimpan | 2,0 | 3,0 | 4,0 | Asumsi |

**Tidak termasuk capex** (tetapi perlu ada di pitch): modal kerja (Rp48 juta untuk dua batch dalam rencana Tahap A; sekitar Rp1 miliar untuk 10 ton per tahun), sewa gudang, izin usaha, biaya hukum, kendaraan, dan biaya pra-operasi.

## 3. Pengeringan gabah

Pilihan:

| | Bed/rak terbuka | Pengering mekanis | Hibrida (disarankan) |
|---|---|---|---|
| Waktu | 10–30 hari, bergantung cuaca | sekitar 1–3 hari | pra-keringkan di rak, selesaikan di mesin |
| Luas | sekitar 10–15 kg parchment/m² | 4–6 m² per batch 500 kg | rak untuk pra-keringkan, mesin dalam ruang tertutup |
| Modal | rendah | tinggi | menengah |
| Risiko | hujan memperlambat dan bisa menurunkan mutu | perlu bahan bakar dan listrik, serta perawatan | dua peralatan untuk dikelola |

**Rekomendasi:** pengering mekanis 750 kg per batch di ruang tertutup, dengan rak untuk pra-pengeringan. Ini mengurangi waktu tunggu dari beberapa minggu menjadi beberapa hari, sehingga stok bisa masuk ke jalur grading lebih cepat dan modal kerja tidak tertahan terlalu lama.

**Biaya per kg:** sebuah studi MDPI menyebut biaya pengeringan sekitar US$0,205 per kg (sebelum isolasi) dengan pengering seharga sekitar US$2.000. Angka ini perlu diuji dengan data pengering yang akan dibeli.

**Target kadar air:** 10–12% (sesuai `config/business.js`, intake). Ukur dengan moisture meter pada setiap batch.

**Sebelum membeli:** uji satu batch dari setiap kelompok tani dan catat waktu pengeringan, kadar air akhir, dan kehilangan mutu.

## 4. Masalah yang belum selesai

1. **Ukuran sampel:** `config/business.js` memakai 300 g. Protokol SCA 2004 memakai 350 g. Protokol ini sudah digantikan oleh Coffee Value Assessment (CVA). Konfirmasi dengan dokumen SCA terbaru sebelum dipakai di pitch.
2. **Ambang cupping 80 atau 85:** 80 poin adalah definisi kerja yang tidak resmi pada protokol 2004. SCA sekarang memakai CVA, yang menilai beberapa atribut dan tidak memakai satu ambang skor sebagai definisi specialty.
3. **Toleransi saringan dan batas cacat:** belum terverifikasi. Sumbernya adalah SCA Washed Arabica Green Coffee Defect Handbook (dan tabel setara cacatnya). Ambil dokumen ini langsung dari SCA.
4. **Harga Indonesia:** hanya huller yang punya harga Indonesia, dari halaman kategori. Pengering dari Indotrading tidak jelas harganya. Semua item lain perlu penawaran tertulis.

## 5. Langkah berikutnya

1. Minta penawaran tertulis untuk pengering mekanis, rak, moisture meter, sieve set, sample roaster, dan dehumidifier (minimal tiga pemasok per item).
2. Beli dokumen SCA (handbook defect dan CVA) dan perbarui `config/business.js` jika perlu.
3. Lakukan uji pengeringan satu batch dan ganti estimasi pengering dengan data nyata.
4. Perbarui tabel ini dan kurs sebelum pitch.

---

## 6. Bangunan gudang di Jayapura (capex)

Dasar hitung: luas × harga dasar per m² × indeks kemahalan konstruksi (IKK) Kota Jayapura.

- **Luas: 150 m²** (asumsi). Mencakup gudang stok, ruang pengering dan pengeringan pra-rak, ruang grading dan cupping, serta penyimpanan sampel.
- **Harga dasar: Rp2,5 / 3,5 / 4,5 juta per m²** (asumsi). Belum ada sumber harga gudang per m² untuk Jayapura. Angka ini adalah tebakan untuk bangunan baja sederhana di luar Jawa.
- **IKK Kota Jayapura: 1,2676** (sumber: Databoks, IKK Kota Jayapura 2025, 126,76 poin). Dipakai sebagai pengali karena biaya bangunan di Jayapura lebih mahal dari rata-rata nasional.
- **Hasil: Rp475 / 666 / 856 juta.** Tidak termasuk tanah, perizinan (IMB/PBG), pagar, listrik, dan air.

**Alternatif sewa:** dalam banyak kasus menyewa gudang lebih ringan untuk modal awal. Biaya sewa per bulan belum diteliti, jadi tidak dihitung di sini. Bandingkan dengan sewa sebelum memutuskan membangun.

## 7. Software dan layanan digital (opex per tahun)

| Item | Dasar | Rendah | Tengah | Tinggi |
|---|---|---|---|---|
| VPS aplikasi | DomaiNesia Cloud VPS Turbo 2GB Rp160rb/bln; ID CloudHost Rocket VPS 4 Rp245rb/bln; Rocket VPS 7 Rp410rb/bln | 1,9 | 2,9 | 4,9 |
| Penyimpanan backup | Rp2.000/GB/bulan (Nevacloud HDD): 100 / 200 / 500 GB | 2,4 | 4,8 | 12,0 |
| Google Workspace, 6 pengguna | US$7 (tahunan) atau US$8,40 (fleksibel) per pengguna per bulan × Rp16.000 | 8,1 | 9,7 | 9,7 |
| Gateway WhatsApp dan email transaksi | Asumsi Rp300rb / 700rb / 1,5 juta per bulan | 3,6 | 8,4 | 18,0 |
| Domain .id | Rp230rb/tahun (Telkom); promo tahun pertama Rp99rb | 0,1 | 0,2 | 0,2 |
| **Total per tahun (Rp juta)** | | **16,1** | **26,0** | **44,8** |

Catatan:
- Biaya Midtrans per transaksi bersifat variabel dan tidak masuk ke angka ini.
- Harga VPS dan backup berasal dari penyedia pihak ketiga. Diskon tahunan biasanya 10–30%, tetapi belum dimasukkan.
- Pajak dan kurs belum dimasukkan. Harga Google dalam US$ dihitung dengan kurs asumsi Rp16.000.

## 8. Staf (opex per tahun)

Enam orang, sesuai rencana:

| Peran | Jumlah | Gaji rendah | Gaji tengah | Gaji tinggi | Dasar |
|---|---|---|---|---|---|
| Petugas lapangan (intake) | 2 | 4,44 | 4,80 | 5,50 | Rendah = UMP Papua 2026 |
| Penilai kualitas (grader) | 1 | 4,44 | 6,50 | 8,00 | Tengah dan tinggi asumsi |
| Admin dan verifikasi (orang kedua) | 1 | 4,44 | 5,50 | 6,50 | Tengah dan tinggi asumsi |
| Penjualan dan hubungan pembeli | 1 | 4,44 | 6,50 | 8,00 | Tengah dan tinggi asumsi |
| Operasional gudang | 1 | 4,44 | 4,80 | 5,50 | Rendah = UMP Papua 2026 |
| **Total gaji per bulan (Rp juta)** | 6 | **26,6** | **32,9** | **39,0** | |

- **UMP Papua 2026: Rp4.436.283** (SK Gubernur 100.3.3.1/KEP.409/2025). Berlaku juga untuk Kota Jayapura. Gaji di bawah angka ini tidak diperbolehkan.
- **Biaya tambahan per tahun:** kontribusi BPJS pemberi kerja 11% dan THR satu bulan gaji. Persentase BPJS adalah asumsi dan belum diverifikasi.
- **Setahun:** Rp381 / 471 / 559 juta (termasuk BPJS dan THR).
- **Tidak termasuk:** pemilik, gaji yang dibayar di luar sistem, pelatihan, dan perekrutan.

## 9. Ringkasan untuk pitch (Rp juta)

| | Rendah | Tengah | Tinggi |
|---|---|---|---|
| Capex peralatan (bagian 1–5, subtotal) | 221,9 | 376,7 | 532,1 |
| Capex bangunan gudang (bagian 6) | 475,4 | 665,5 | 855,6 |
| Subtotal capex | 697,3 | 1.042,2 | 1.387,7 |
| Kontingensi 15% | 104,6 | 156,3 | 208,2 |
| **Total capex satu kali** | **801,9** | **1.198,5** | **1.595,9** |
| Opex tahunan: staf (bagian 8) | 381,2 | 471,1 | 558,5 |
| Opex tahunan: software (bagian 7) | 16,1 | 26,0 | 44,8 |
| **Total opex per tahun** | **397,3** | **497,1** | **603,3** |
| Modal kerja (dua batch, Tahap A) | 48 | 48 | 48 |
| **Kebutuhan dana tahun pertama** (capex + opex + modal kerja) | **1.247** | **1.744** | **2.247** |

## 10. Yang perlu diperhatikan

1. **Biaya tetap naik dari asumsi di config.** `config/business.js` memakai `fixedCostsPerYear: 400.000.000`. Opex staf dan software saja sudah Rp397–603 juta per tahun, belum termasuk penyusutan gudang. Dengan margin tengah Rp42.450/kg, titik impas naik dari 9,4 menjadi sekitar 11,7 ton per tahun (tengah). Angka ini perlu diperbarui di config.
2. **Gudang adalah pilihan besar.** Membangun menambah Rp475–856 juta. Sewa bisa jauh lebih kecil dan belum diteliti.
3. **Sumber:** UMP dan IKK bersumber. Harga gudang per m², BPJS, gateway WhatsApp, dan penyimpanan backup belum bersumber atau hanya dari penyedia pihak ketiga.

## 11. Keputusan dasar: sewa gudang (update)

Dasar yang dipakai di `config/business.js`: **sewa**, bukan membangun. Alasannya: biaya awal lebih kecil, modal tetap tersedia untuk stok, dan tidak ada risiko harga tanah atau konstruksi selama pilot.

Dasar sewa (asumsi, belum ada penawaran untuk Jayapura):
- Luas 150 m², Rp40 / 60 / 80 ribu per m² per bulan (rendah / tengah / tinggi).
- PPN 10% atas sewa (sumber: sewagudang.net).
- Hasil: **Rp79 / 119 / 158 juta per tahun**.

### Perbandingan (Rp juta)

| | Sewa (dasar) | Bangun |
|---|---|---|
| Capex peralatan (bagian 1–5, termasuk kontingensi) | 255 / 433 / 612 | 255 / 433 / 612 |
| Capex gudang (bagian 6, termasuk kontingensi) | 0 | 547 / 765 / 984 |
| **Total capex** | **255 / 433 / 612** | **802 / 1.199 / 1.596** |
| Biaya sewa per tahun | 79 / 119 / 158 | 0 |
| Opex per tahun (staf + software + sewa) | **477 / 616 / 762** | 397 / 497 / 603 |
| **Kebutuhan dana tahun pertama** (capex + opex + modal kerja Rp48 juta) | **780 / 1.097 / 1.422** | 1.247 / 1.744 / 2.247 |
| **Titik impas per tahun** (margin Rp42.450/kg) | **11.225 / 14.512 / 17.944 kg** | 9.360 / 11.711 / 14.213 kg |

Catatan:
- Titik impas tengah untuk sewa memakai `fixedCostsPerYear: 616.000.000` di config (staf Rp471 juta, software Rp26 juta, sewa Rp119 juta). Angka rendah dan tinggi dari tabel di atas, bukan dari config.
- Titik impas di atas memakai margin tengah Rp42.450/kg, yang bergantung pada harga Local Rp130.000/kg (lihat bagian 4).

### Perbandingan lima tahun

- Sewa tengah, lima tahun tanpa kenaikan harga: **Rp594 juta**.
- Bangun tengah (sudah termasuk kontingensi): **Rp765 juta**, belum termasuk tanah, perizinan, pemeliharaan, dan penyusutan.
- Dengan asumsi ini, sewa lebih murah selama sekitar 6 tahun. Setelah itu membangun bisa lebih murah, tetapi hanya jika lokasi memang tetap dibutuhkan.

### Yang belum diketahui

- Penawaran sewa riil di Jayapura. Harga Rp40–80 ribu per m² adalah asumsi dari harga di kota lain. Saat listing Jayapura tidak ditemukan, angka ini perlu dikonfirmasi dengan agen properti setempat.
- Kenaikan harga sewa per tahun.
- Biaya listrik, air, dan keamanan gudang.
