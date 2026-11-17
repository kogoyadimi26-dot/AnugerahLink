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
