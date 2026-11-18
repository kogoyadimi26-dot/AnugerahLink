# Proposal pesanan besar (1.000 kg ke atas): formulir untuk pembeli

Status: **DRAF. Belum ditinjau pengacara.** Jangan dipakai untuk pesanan nyata sebelum ketentuan di bagian 4 disetujui pemilik dan ditinjau pengacara.
Tanggal: 18 November 2026

Formulir ini dipakai pembeli untuk pesanan 1.000 kg ke atas. Isinya sama dengan formulir di aplikasi (`#/proposal`). Pembeli bisa mengisi di aplikasi, atau mencetak halaman ini dan mengirimkannya ke tim AnugerahLink.

---

## 1. Data perusahaan

| Kolom | Isi |
|---|---|
| Nama perusahaan | |
| Bentuk badan usaha (PT, CV, lainnya) | |
| NPWP | |
| Nomor izin usaha (NIB atau lainnya) | |
| Nama kontak | |
| Jabatan kontak | |
| Telepon / WhatsApp | |
| Email | |
| Alamat tujuan pengiriman | |
| Kota | |
| Negara | Indonesia |

Lampiran yang diminta: salinan NPWP, salinan izin usaha. Profil perusahaan opsional.

## 2. Pesanan

| Kolom | Isi |
|---|---|
| Jumlah (kg, kelipatan 100, minimal 1.000 kg) | |
| Tingkat yang diminati (centang) | ☐ Reserve ☐ Premium ☐ Standar Terverifikasi ☐ Lokal |
| Skor cupping minimal (opsional, 70 sampai 95) | |
| Proses (dicuci, honey, natural, dan lainnya; opsional) | |
| Lot tertentu atau asal kebun (opsional) | |
| Minta contoh sebelum penawaran? | ☐ Ya ☐ Tidak |
| Dibutuhkan pada (tanggal) | |
| Kemasan (karung jute, GrainPro, lainnya) | |
| Kegunaan (roasting, ekspor, lainnya) | |

## 3. Pengiriman dan pembayaran

| Kolom | Isi |
|---|---|
| Syarat pengiriman | ☐ Diantar ke alamat tujuan ☐ Diambil di Jayapura |
| Ongkir ditanggung | ☐ Pembeli ☐ AnugerahLink (dihitung terpisah, sesuai biaya) |
| Cara bayar | ☐ Transfer bank ☐ QRIS ☐ Lainnya |
| Permintaan kredit (opsional, ditinjau tim) | |

## 4. Persetujuan (wajib, centang semua)

- ☐ Data yang saya isi benar.
- ☐ Saya setuju perusahaan saya diverifikasi (identitas, referensi, dan riwayat perdagangan).
- ☐ Saya mengerti penawaran tunduk pada ketersediaan lot dan kesepakatan tertulis kedua pihak.
- ☐ Saya setuju ketentuan klaim dan pengembalian AnugerahLink.
- ☐ Saya setuju kebijakan privasi untuk data usaha saya.

Tanda tangan dan nama terang (jika dicetak): ______________________  Tanggal: __________

---

## Apa yang terjadi setelah proposal dikirim

1. **Tinjauan (2 hari kerja).** Tim memeriksa kecocokan pesanan dengan stok dan tingkat yang tersedia.
2. **Verifikasi.** Identitas perusahaan dan referensi diperiksa. Jika ada yang kurang, tim meminta informasi tambahan dan Anda bisa mengirim ulang.
3. **Penawaran tertulis.** Berisi lot, jumlah kg, harga per kg per tingkat, syarat pengiriman, jadwal pembayaran, dan masa berlaku 7 hari.
4. **Persetujuan.** Anda menyetujui, mengajukan perubahan, atau menolak. Terms disepakati saat kedua pihak menyetujui versi yang sama.
5. **Uang muka (DP) 30 persen** dibayar dalam 5 hari. Lot dicadangkan setelah DP diterima.
6. **Persiapan dan pelunasan.** Lot ditimbang, disortir, dikemas, dan diberi dokumen. Pelunasan dibayar sebelum pengiriman.
7. **Pengiriman.** Nomor resi dikirim lewat email dan WhatsApp.

Setiap langkah dikirim melalui email dan WhatsApp ke kontak yang Anda isi.

---

## 5. Ketentuan yang perlu ditinjau pengacara (draf)

Bagian ini dipakai dalam penawaran tertulis. Semua angka di sini adalah usulan awal dari rencana usaha dan belum disetujui pemilik.

- **Harga.** Sama per tingkat seperti daftar harga (tanpa diskon volume pada tahap pertama).
- **DP.** 30 persen dari total penawaran. Dapat dikembalikan hanya jika AnugerahLink yang membatalkan. Tidak dapat dikembalikan jika pembeli membatalkan setelah lot dicadangkan.
- **Kredit.** Tidak ada kredit untuk pembeli baru. Dapat dipertimbangkan setelah tiga pesanan selesai, dengan persetujuan pemilik dan batas tertentu.
- **Kualitas.** Setiap lot sesuai tingkat, grade, dan skor cupping yang tercatat pada penawaran. Klaim mengikuti ketentuan klaim AnugerahLink (48 jam setelah pengantaran, dengan uraian dan foto).
- **Pengiriman dan risiko.** Risiko berpindah sesuai syarat pengiriman yang disepakati (ambil di Jayapura, atau diantar ke alamat tujuan). Perlu dirumuskan dengan pengacara sesuai Incoterms yang dipilih.
- **Pembatalan.** Setelah kesepakatan, pembatalan hanya dengan kesepakatan tertulis kedua pihak.
- **Keterlambatan.** Jadwal pengiriman adalah perkiraan. Perlu dirumuskan batas dan kompensasinya.
- **Ekspor.** Di luar cakupan tahap pertama. Pesanan ekspor memerlukan dokumen ekspor dan geolokasi petak (EUDR).
- **Tanda tangan.** Persetujuan tertulis dilakukan dengan menyetujui versi penawaran di aplikasi. Setiap versi diberi kode (hash). Tanda tangan elektronik berbayar bisa ditambahkan nanti.
- **Hukum yang berlaku dan penyelesaian sengketa.** Perlu ditentukan oleh pengacara.
- **Data pribadi.** Data usaha dipakai untuk verifikasi dan pesanan saja, sesuai kebijakan privasi.

---

## Catatan untuk tim (hapus sebelum dikirim ke pembeli)

- Formulir ini harus selaras dengan `validateDraft` di `lib/proposals.js` dan formulir `#/proposal`. Jika ada kolom yang berubah, ubah keduanya.
- Sebelum pesanan nyata pertama, pengacara harus meninjau bagian 4 dan 5.
- Ambang 1.000 kg dan batas 999 kg untuk checkout online ada di `config/business.js` (`largeOrderMinKg`, `maxOrderKg`).
