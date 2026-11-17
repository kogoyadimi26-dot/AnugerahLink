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
