# Rencana Metabase: analitik dan laporan untuk tim dan investor

Status: rencana, belum dipasang. Tujuan: laporan analisis yang bisa dibuka tim dan investor, tanpa menyentuh database aplikasi yang sedang dipakai.

## 1. Mengapa Metabase

- **Gratis dan open source** (lisensi AGPL, versi self-hosted). Tidak ada biaya per pengguna.
- **Data tetap di server kita.** Tidak ada data pembeli yang dikirim ke layanan cloud pihak ketiga.
- **Bisa membuat laporan tanpa menulis kode**, dan bisa ditulis SQL bila perlu.
- Pilihan lain yang dipertimbangkan: Looker Studio (perlu data di Google, jadi hanya untuk data agregat), Grafana (lebih teknis, cocok untuk pemantauan), Superset (lebih berat).

## 2. Arsitektur

```
Aplikasi (live DB, data/app.db)
   │  setiap malam: salinan konsisten (VACUUM INTO, scripts/backup.js)
   ▼
Salinan laporan (data/reporting/app-report.db)   ← tanpa data pribadi (lihat bagian 4)
   │  read-only
   ▼
Metabase (Docker, hanya bisa diakses lewat HTTPS dan login)
```

- **Tidak ada koneksi Metabase ke database live.** Laporan tidak memperlambat aplikasi, dan tidak bisa mengubah data.
- Salinan laporan dibuat dari salinan cadangan malam, sehingga data paling baru sehari sebelumnya. Untuk pitch dan rapat bulanan, itu sudah cukup.

## 3. Hosting

- **Lokasi:** server yang sama dengan aplikasi, sebagai layanan Docker tambahan di `docker-compose.yml`, atau VPS terpisah bila beban bertambah.
- **Spesifikasi awal:** minimal 2 GB RAM dan 1–2 vCPU. Metabase berjalan di JVM dan butuh memori dasar yang lebih besar daripada aplikasi ini. Pemakaian bersamaan 5–10 orang masih aman di kisaran ini. Sumber panduan produksi Metabase menyebut contoh 40 pengguna bersamaan membutuhkan 3 vCPU dan 5 GB RAM. Verifikasi dengan uji beban sebelum memutuskan ukuran final.
- **Biaya server:** sudah diperkirakan di `docs/business/CAPEX_v1.md` (VPS Rp160–410 ribu per bulan). Tambahan untuk Metabase kemungkinan satu tingkat di atas server aplikasi.
- **Akses:** HTTPS lewat Caddy yang sudah dipakai aplikasi, domain terpisah (misalnya `laporan.<domain>`), dan login Metabase dengan akun per orang. Tidak ada akses publik tanpa login.

## 4. Data pribadi

Salinan cadangan berisi nama, email, telepon, alamat dan NPWP pembeli. Laporan tidak boleh memakai salinan itu langsung.

- Buat **salinan laporan yang disamarkan**: kolom pribadi (nama, email, telepon, alamat, NPWP, catatan) dihapus atau diganti kode anonim, misalnya "Pembeli 17".
- Yang tetap ada: nomor pesanan, tanggal, status, kg, harga, tier, kelompok tani, jenis pembeli dan perusahaan (jika perusahaan dipakai sebagai nama pembeli, samarkan juga).
- **Akses Metabase dibatasi** pada salinan laporan saja, dengan pengguna database read-only.
- Sebelum investor melihat laporan dengan data nyata, periksa lagi dengan penasihat hukum terkait aturan perlindungan data pribadi.

## 5. Laporan yang dibangun pertama

Untuk tim dan investor:
1. **Pendapatan per bulan** dan **kg terjual per bulan**, dengan tren.
2. **Margin per kg** per tier (Reserve, Premium, Standar Terverifikasi, Lokal), dibandingkan dengan asumsi di model.
3. **Penjualan per tier dan sell-through** per lot (persen stok yang sudah terjual).
4. **Corong pesanan**: jumlah dan nilai di setiap status (diminta sampai selesai).
5. **Titik impas**: kg terjual sejauh ini dibandingkan dengan titik impas tahunan di model.
6. **Pesanan terlambat dan waktu pengiriman** (dari data estimasi tiba).
7. **Jenis pembeli dan pembeli berulang.**
8. **Umpan balik**: skor cupping dan rating per lot.

Laporan operasional harian tetap di dasbor aplikasi, karena dasbor itu juga punya tombol tindakan.

## 6. Proses

- **Setiap malam:** cadangan dibuat (sudah ada), lalu salinan laporan yang disamarkan dibuat dari cadangan itu. Skrip ini belum ada dan perlu dibuat.
- **Setiap minggu:** tim meninjau laporan dan mencatat temuan.
- **Setiap bulan:** angka untuk investor diambil dari laporan yang sama, supaya konsisten dengan model.

## 7. Tahapan

1. **Uji lokal:** jalankan Metabase dengan Docker di komputer, hubungkan ke salinan cadangan, dan cek bahwa SQLite berfungsi (sumber pencarian belum memastikan dukungan SQLite pada versi terbaru, jadi ini harus diuji).
2. **Skrip salinan laporan:** buat salinan yang disamarkan, lengkap dengan uji (tidak boleh ada email, telepon, nama atau NPWP di salinan).
3. **Pasang di server:** tambahkan layanan Docker dan domain, lalu buat akun untuk tim.
4. **Bangun laporan 1–8**, lalu tinjau bersama tim.
5. **Dokumentasi:** cara masuk, cara membuat laporan baru, dan cara mengganti salinan.

## 8. Risiko

- **Salinan tidak sama dengan data live.** Data bisa tertinggal sehari. Ini harus ditulis di setiap laporan.
- **Penyamaran yang bocor.** Uji otomatis wajib menolak salinan yang masih memuat data pribadi.
- **Memori server.** Jika server aplikasi ikut menjalankan Metabase, pemakaian memori bisa membuat aplikasi lambat. Pisahkan bila perlu.
- **Ketergantungan pada satu orang.** Dokumentasi dan akses admin harus dimiliki lebih dari satu orang.

## 9. Keputusan yang perlu diambil

- Domain untuk laporan dan penyedia server.
- Siapa saja yang boleh masuk Metabase (tim dan investor?).
- Apakah investor akan diberi akses langsung atau hanya lewat ekspor PDF bulanan.
