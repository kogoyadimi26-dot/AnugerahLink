# AnugerahLink web app

Storefront for verified Papuan coffee, plus a back office for the team. Plain Node.js (no dependencies) and a static front end.

Read first: `PLAN.md` (what it does and why), `DESIGN.md` (look and layout), `BENCHMARKS.md` (what we took from Alibaba, Tokopedia, Amazon and agritech platforms).

## Run it

```bash
OWNER_EMAIL='pemilik@contoh.com' OWNER_PASSWORD='kata-sandi-yang-panjang' npm start
```

Open http://localhost:3000 and sign in with the owner account. The first run creates `data/app.db` (SQLite) with sample regions, groups and lots (marked "sample" everywhere). An existing `data/db.json` is imported once and renamed to `db.json.migrated`.

Without `OWNER_PASSWORD` the app uses a development password and prints a warning. Do not run it that way where other people can reach it.

**Roles.** The owner adds team members under Pengguna. Admin: everything. Penilai (grader): view lots, grade, publish, withdraw. Petugas lapangan (field agent): record purchases and photos, view lots. Every change is recorded under Riwayat (who, when, what, not the data itself).

Options: `PORT` (default 3000), `DATA_FILE` (default `data/app.db`), `OWNER_NAME`, `OWNER_EMAIL`, `OWNER_PASSWORD`.

## Test

```bash
npm test
```

Covers pricing and the v2 economics, passport hashing, stock reservation and release, order status rules, validation, feedback filtering and the farmer report, and the HTTP API.

## Where things are

| Path | What it is |
|---|---|
| `config/business.js` | Business rules (prices, shipping, fees, minimum order, bank details placeholders). Change numbers here. |
| `lib/pricing.js` | Line pricing, totals, per-kg economics and break-even. Pure functions. |
| `lib/domain.js` | Orders, stock reservation, intake, grading, publishing, feedback, farmer report, dashboard summary. |
| `lib/passport.js` | Passport record and SHA-256 hash of the recorded fields. |
| `lib/validate.js` | Input checks that return field-level messages. |
| `lib/store.js` | JSON file store with atomic writes. |
| `lib/seed.js` | First-run data (regions from v2; sample groups and lots). |
| `server.js` | HTTP server, routes, admin token check, security headers, static files. |
| `public/` | Front end: `index.html`, `styles.css`, `app.js` (hash router, storefront and back office). |
| `test/` | Node test runner suites. |

## Decisions to know

- **Payments:** bank transfer against an invoice, confirmed by hand in the back office. No payment gateway is connected. Bank details are placeholders until the owner provides them.
- **Stock:** reserved when an order is placed, released on cancel, and moved to sold when shipped.
- **Passport:** shows a hash of the recorded fields and whether the current fields still match it. It says "verified record", not "unalterable". QR image rendering is not built yet; the passport URL is ready for an encoder.
- **Feedback:** only verified buyers can send it, once per order, after delivery. Only items the team tags `pass-to-farmer` reach the farmer report, with no buyer names or prices paid.
- **Admin access:** one shared token, kept in `sessionStorage` for the browser session. Separate logins come later.
- **Content Security Policy:** scripts and images are same-origin only. Inline styles are allowed (`style-src 'self' 'unsafe-inline'`) because the pages use a few inline style attributes. Moving them to classes would allow a stricter policy.
- **Storage:** a JSON file is fine for pilot volume. Move to a real database before several people use the back office at once.

## Open items

- Business numbers are the v2 defaults and need the owner's confirmation (see `PLAN.md` section 12).
- "Closs" from the benchmark request did not match any platform in search. Confirm the name.
- Bank details, group contacts and real farmer group names are placeholders.

## Online payment (virtual account and QRIS)

Buyers choose Virtual Account BCA or BNI, or QRIS, on the order page. Payments use Midtrans Core API.

**Environment variables**
- `MIDTRANS_SERVER_KEY`: the server key from the Midtrans dashboard. Use the sandbox key (starts with `SB-Mid-server-`) for testing. Without it, the app uses a local simulator.
- `MIDTRANS_ENV`: `sandbox` (default) or `production`.

Keys go in environment variables only, never in the code or in chat.

**Testing with a tunnel**
Midtrans must reach the webhook over public HTTPS, and your Mac's `localhost` is not public. Use a tunnel such as ngrok:

```bash
ngrok http 3000
```

In the Midtrans sandbox dashboard, set the Payment Notification URL to `https://<tunnel-address>/api/payments/webhook`.

**Notes**
- Notifications are verified with the SHA-512 signature from Midtrans. Only settlement (or capture with fraud status accept) marks an order paid. Other statuses are acknowledged and ignored.
- A payment that arrives after an order was cancelled is flagged for the team.
- Refunds are done in the Midtrans dashboard for now.
- The exact response fields from Midtrans should be checked against the sandbox on first use.


## Sebelum dipakai untuk data sungguhan

- Atur `NODE_ENV=production`, `OWNER_EMAIL`, dan `OWNER_PASSWORD` (minimal 12 karakter). Server menolak mulai bila kata sandi masih contoh atau `DEMO_ACCOUNTS=1`.
- Pembatas masuk: 5 kegagalan per email dalam 15 menit mengunci email itu selama 15 menit. Hitungan ini disimpan di memori dan hilang saat server dimulai ulang.
- Cadangan: `node scripts/backup.js` membuat salinan database dan foto di folder `backups/`. Bisa dijalankan saat server berjalan.
- Pemulihan: hentikan server, lalu `node scripts/restore.js backups/<folder> --yes`. Data yang ada disimpan dulu di `data/sebelum-pulih-<waktu>`.


## Mengelola katalog (untuk admin)

- **Harga per kategori:** menu Pengaturan → "Harga per kategori". Ubah angka, tulis alasan, lalu simpan. Harga berlaku untuk semua lot di kategori itu, dan perubahan tercatat di Riwayat beserta alasannya.
- **Teks beranda dan footer:** Pengaturan → "Teks beranda dan footer". Teks standar bisa dikembalikan dengan satu tombol.
- **Tampilan lot di katalog:** buka lot (menu Lot → Nilai), lalu bagian "Tampilan di katalog": judul, cerita untuk pembeli, unggah foto katalog (JPG atau PNG, maksimal 2 MB), pilih satu foto sebagai sampul, lalu simpan.
- **Foto pemeriksaan** (sampel dan karung) hanya untuk tim dan tidak pernah tampil ke pembeli.
- **Tayang:** lot tetap harus diverifikasi dan diterbitkan seperti biasa. Penilai bisa melihat tampilan katalog tetapi tidak bisa mengubahnya.
- Setiap perubahan dicatat di Riwayat (siapa, kapan, dan apa yang berubah).
