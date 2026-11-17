# Memasang AnugerahLink di server (HTTPS, pemantauan, cadangan)

Panduan ini untuk satu server Linux (misalnya VPS Ubuntu 22.04 atau 24.04, minimal 1 GB RAM).
Semua layanan berjalan di Docker: aplikasi, Caddy (HTTPS otomatis), dan cadangan harian.

## Sebelum mulai
- Domain (misalnya `toko.contoh.id`) sudah mengarah ke IP server lewat catatan A.
- Port 80 dan 443 terbuka. Port lain ditutup kecuali SSH.
- Data perusahaan sudah diisi di `config/company.js` dan `config/legal.js` (lihat daftar di bawah).

## 1. Pasang Docker
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # lalu keluar dan masuk lagi
```

## 2. Ambil kode dan siapkan pengaturan
```bash
git clone https://github.com/kogoyadimi26-dot/AnugerahLink.git
cd AnugerahLink
cp .env.example .env
nano .env          # isi DOMAIN, PUBLIC_URL, OWNER_EMAIL, OWNER_PASSWORD (12+ karakter), dan kunci lain
chmod 600 .env     # hanya pemilik file yang bisa membaca
mkdir -p data backups
sudo chown -R 1000:1000 data backups   # agar container bisa menulis
```
Jangan pernah commit file `.env` ke git.

## 3. Jalankan
```bash
docker compose up -d --build
docker compose ps                    # ketiga layanan harus "running" atau "healthy"
curl https://toko.contoh.id/healthz  # harus menjawab {"status":"ok",...}
```
Caddy mengurus sertifikat HTTPS sendiri saat pertama kali domain diakses. Bila gagal, lihat `docker compose logs caddy`.

## 4. Pemantauan
- **Uptime:** daftar di layanan pemantauan gratis (misalnya UptimeRobot) dan buat pemeriksaan HTTP ke `https://toko.contoh.id/healthz` setiap 5 menit. Atur email peringatan ke tim.
- **Status container:** `docker compose ps`. Aplikasi juga punya pemeriksaan kesehatan internal.
- **Log:** `docker compose logs -f app` (aplikasi), `docker compose logs -f caddy` (akses dan HTTPS).

## 5. Cadangan
- Cadangan dibuat otomatis setiap 24 jam ke folder `backups/`. Yang disimpan 30 hari terakhir (`BACKUP_KEEP_DAYS` di `.env`).
- **Cadangan juga harus disimpan di luar server.** Salin folder `backups/` ke penyimpanan lain setiap malam (misalnya dengan `rclone` ke penyimpanan cloud). Ini belum dipasang otomatis; tim perlu memilih penyedia dan mengaturnya.
- **Uji pemulihan** sekali setiap bulan di server lain atau di komputer Anda.

Pulihkan cadangan:
```bash
docker compose stop app
ls backups/                                   # pilih folder cadangan
docker compose run --rm backup node scripts/restore.js backups/<folder-cadangan> --yes
docker compose start app
```
Data yang ada sebelum pemulihan disimpan dulu di `data/sebelum-pulih-<waktu>`.

## 6. Memperbarui aplikasi
```bash
git pull
docker compose up -d --build
```
Data di `data/` dan `backups/` tidak ikut berubah.

## Sebelum pertama kali dipakai untuk pesanan sungguhan
- [ ] `config/company.js`: nama resmi, alamat, telepon, email, NPWP, dan rekening bank (tidak boleh ada tulisan BELUM DIISI).
- [ ] `config/legal.js`: pengacara sudah meninjau teks, lalu `reviewed: true` dan versi baru.
- [ ] `.env`: `PUBLIC_URL` sesuai domain, `MIDTRANS_ENV=production` dengan kunci produksi (setelah diuji di sandbox).
- [ ] Email dan WhatsApp: penyedia sudah dipilih dan diisi (`EMAIL_*`, `WA_*`). Tanpa ini, pesan hanya menunggu.
- [ ] Coba satu pesanan dari awal sampai selesai, unduh fakturnya, dan pulihkan satu cadangan di tempat lain.
- [ ] Ganti kata sandi pemilik setelah masuk pertama kali, dan buat akun staf untuk setiap orang.

## Catatan keamanan
- Login SSH hanya dengan kunci, bukan kata sandi. Matikan login root.
- Pembatasan percobaan masuk sudah aktif, tetapi hitungannya di memori dan hilang saat container dimulai ulang.
- Data pribadi pembeli dilindungi dengan persetujuan dan hak hapus akun. Pastikan kebijakan privasi sudah ditinjau sebelum dibuka untuk umum.
