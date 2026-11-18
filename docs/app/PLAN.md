# AnugerahLink Web App: Plan

Status: plan for review, built in the same branch.
Date: 2026-11-17.
Based on: `docs/business/source/AnugerahLink_Business_Plan_and_Model_v2.docx`, the v2 model spreadsheet, and `docs/business/ANUGERAHLINK_CONTEXT.md`.

---

## 1. Goal

Build a web storefront where buyers see every graded, verified Papuan coffee lot in stock, and buy it directly, the way an e-commerce site works. Behind it, an internal back office records purchases from farmers, grades lots, publishes stock, manages orders, and tracks buyer feedback.

The app must:
- let buyers browse, filter and buy lots by tier, region and quantity;
- give every lot a passport page with its origin, grade, cup score and the farm-gate price paid;
- take orders and track them to delivery;
- let the team run the business from one place: intake, grading, stock, orders, feedback, unit economics.

It does not:
- process card payments itself (see section 7);
- include farmer accounts or a farmer app (v2 puts farmers in a later phase);
- include cacao or mud crab (Year 3 in v2).

## 2. Users

| Role | Who | Main jobs |
|---|---|---|
| Buyer | Specialty cafes, premium roasters, Papua cafes (v2 buyer segments) | Browse, filter, add to cart, check out, track order, leave feedback |
| Admin (ops) | Founder and office | Manage orders, stock, publishing, feedback tags, economics |
| Field agent | Collects from farmer groups | Record purchases (intake) |
| Q grader | Cups and grades lots | Enter grade, cup score, moisture, sellable kg |

Phase 1 has one admin role with a shared access token. Field agents and graders use the same back office. Separate logins come later (section 9).

## 3. Scope of this build (Version 1 per v2 section 7)

**In:**
1. Public storefront: home, catalogue with filters, lot page, passport page, cart, checkout, order confirmation, order tracking.
2. Buyer feedback form after delivery (per order).
3. Back office: dashboard with unit economics, intake, grading and publishing, orders, feedback with tagging and per-group farmer report, settings view for prices and tiers.
4. Data store: JSON file, atomic writes. Seeded with the v2 regions and sample lots so the app runs on first start.
5. Tests for pricing, validation, stock reservation, order status flow, feedback filtering and the passport hash.

**Deliberately out of scope:**
- Vouchers, promotion codes, flash sales and coupon stacking. Prices are fixed by tier, so every buyer pays the same price for the same lot.
- Consumer (household) buyers. The storefront sells to business buyers only: cafes, roasters and businesses.

**Out (later phases, v2 section 7):**
- Buyer accounts, saved addresses, repeat-order shortcuts (Version 2)
- Export buyer pages, EUDR geolocation download (Version 3)
- Real payment gateway (see section 7)
- Email or WhatsApp notifications (stub log only)
- Farmer accounts and farmer scorecards
- Plot geolocation

## 4. Business rules (from v2, all configurable)

All numbers live in `config/business.js`. The owner has not yet confirmed them, so the app states they are v2 defaults.

| Rule | Default | Source |
|---|---|---|
| Farm buying price | Rp120,000 per kg | v2 Inputs |
| Sorting and drying loss | 5% | v2 Inputs |
| Shipping and packing, per kg | Rp20,000 | v2 Inputs |
| Fees per kg (samples, claims, payment) | Rp2,000 | v2 Inputs |
| Tier prices per kg delivered | Reserve Rp350,000 · Premium Rp250,000 · Verified standard Rp150,000 · Local Rp100,000 | v2 Tiers |
| Shipping on Reserve and Premium | Paid by AnugerahLink (included in price) | v2 Tiers |
| Shipping on Verified standard | Buyer pays Rp20,000 per kg on top | v2 Tiers |
| Shipping on Local | None (sold in Papua, no air freight) | v2 Tiers |
| Minimum order per lot | 30 kg | v2 Buyers (30 to 60 kg lots) |
| Order increment | 1 kg | Assumption |
| Fixed costs per year | Rp400M (full team) | v2 Inputs |
| Local tier | Sold, even though it loses money at the buying price | v2 Tiers |

Rules the app enforces:
- A lot's stock is `sellableKg` minus `reservedKg` minus `soldKg`. Stock is reserved when an order is placed, so two buyers cannot buy the same kg.
- Cancelled orders release their reservation.
- Prices are computed on the server, never trusted from the browser.

## 5. Buyer flow

1. **Home.** Value proposition, the three tiers in plain language, featured lots in stock.
2. **Catalogue.** Filter by tier, region, grade, and in-stock only. Sort by price, cup score, freshness. Each card shows tier, cup score, region, farmer group (public name), kg in stock, price per kg, and shipping note.
3. **Lot page.** Full detail, photo placeholder, quantity input (min 30 kg, step 1 kg), add to cart, link to passport.
4. **Passport page.** Origin region, regency, farmer group, harvest date, process, grade, cup score, moisture, farm-gate price paid, record hash and "verified record" status. No buyer or farmer personal details.
5. **Cart.** Lines with quantity edit, per-line total, shipping, subtotal, total. Stock is checked on every change.
6. **Checkout.** Buyer type (cafe, roaster, Papua business, other), name, company, phone, email, delivery city, notes. Payment method: bank transfer with invoice (phase 1). Order created as `requested`, stock reserved.
7. **Confirmation.** Order number, summary, bank details placeholder, and the order status page link.
8. **Order tracking.** Status timeline: requested, confirmed, paid, shipped, delivered. Also cancelled.
9. **Feedback.** After delivery, a short form: taste, quality problems, reorder intent. Stored and tagged internally (section 6.4).

## 6. Admin flow

Access: a single admin token entered once, stored in `sessionStorage` only, sent as `Authorization: Bearer`. Set the real token with the `ADMIN_TOKEN` environment variable. The default is a dev-only value and the server prints a warning when it is used.

### 6.1 Dashboard
- Stock in kg by tier, orders by status, revenue requested vs confirmed.
- Unit economics per kg bought, using the v2 formula: sales, minus paid to farmers, shipping, fees, and sorting loss.
- Break-even volume per year, from fixed costs.

### 6.2 Intake (purchases from farmer groups)
- Record a purchase: group, date, kg in, buying price (defaults to config), cash paid, field agent.
- Creates a lot in `received` state, with farm-gate price recorded.

### 6.3 Grading and publishing
- Enter sorted kg, moisture, grade, cup score, tier, process, notes.
- Sellable kg = kg in × (1 − sorting loss) unless overridden by the grader.
- Publishing a lot sets it `listed` with its tier price. Only listed lots with stock appear in the storefront.
- On publish, the passport hash is computed from the record fields.

### 6.4 Orders and feedback
- Orders list with filter by status, detail view, status change, payment reference entry.
- Status changes write a timeline entry. Cancelling releases reserved kg.
- Feedback list. Each item is tagged `pass-to-farmer`, `internal-quality`, `internal-logistics`, or `discard`, following the buyer-feedback skill.
- Farmer report per group: only `pass-to-farmer` items plus the group's own grade results. No buyer names, no prices paid.

### 6.5 Settings
- Read-only view of the business rules in use, with the source note for each.

## 7. Payments

v2 says to use a licensed payment gateway for checkout rather than building payments. This phase does not connect one. Checkout uses **bank transfer against an invoice**, confirmed by the team in the back office. The payment step is written behind a small adapter (`lib/payments/`) so a gateway can be added without changing the checkout flow. No card or bank details are collected in the app.

## 8. Data model

Stored in `data/db.json`. Each collection is an array with string ids.

- **regions**: `{ id, name, regency, hub, rollout }`
- **groups**: `{ id, name, regionId, contact }` (contact is internal only)
- **lots**: `{ id, code, groupId, regionId, harvestDate, process, kgIn, buyPricePerKg, sortingLossPct, sellableKg, reservedKg, soldKg, tier, grade, cupScore, moisturePct, status, publishedAt, passportHash, notes }`
  - `status`: `received` → `graded` → `listed` → `sold_out` (or `withdrawn`)
- **orders**: `{ id, number, status, customer, lines[], subtotal, shipping, total, payment, timeline[], createdAt, updatedAt }`
  - `lines[]`: `{ lotId, lotCode, tier, kg, pricePerKg, shippingPerKg, lineTotal }`
  - `status`: `requested` → `confirmed` → `paid` → `shipped` → `delivered` → `completed`, or `cancelled`
  - `delivered` is set by the team. `completed` is set when the buyer confirms receipt, or by the team after the claim window if the buyer does not respond.
  - `problems[]`: buyer reports `{ message, createdAt, status }`. Accepted only within the claim window (48 hours from delivery, see `config/business.js` `policy`).
- **feedback**: `{ id, orderId, lotId, groupId, taste, qualityIssues, reorder, tag, createdAt }`
- **purchases**: stored on lots (one lot per intake in phase 1)

## 9. API (JSON, no auth on public routes)

Public:
- `GET /api/regions`
- `GET /api/lots?tier=&region=&inStock=1&sort=` (public fields only)
- `GET /api/lots/:code` and `GET /api/passport/:code` (public fields and hash)
- `POST /api/cart/quote` body `{ lines:[{lotCode,kg}] }` returns server-computed totals and stock check
- `POST /api/orders` creates an order (reserves stock), returns order number
- `GET /api/orders/:number` (requires the order number and the email on it, `?email=`)
- `POST /api/orders/:number/feedback` after delivery only

Admin (`Authorization: Bearer <ADMIN_TOKEN>`):
- `GET /api/admin/summary`
- `GET/POST /api/admin/groups`, `GET/POST /api/admin/lots`, `PATCH /api/admin/lots/:id` (grade, publish, withdraw)
- `GET /api/admin/orders`, `PATCH /api/admin/orders/:id` (status, payment reference)
- `GET /api/admin/feedback`, `PATCH /api/admin/feedback/:id` (tag)
- `GET /api/admin/farmer-report/:groupId`
- `GET /api/admin/config`

Errors use `{ error: { code, message, fields? } }` with proper HTTP status codes.

## 10. Security and privacy

- Public responses never include buyer details, farm contacts, buy prices of other groups, or internal notes.
- Admin token is compared in constant time. Admin pages refuse to load data without it.
- All input is validated on the server (types, lengths, ranges, email format). Prices and totals are never taken from the client.
- The order lookup needs both the order number and the matching email, so order numbers alone do not expose orders.
- Static files are served only from `public/`. Path traversal is blocked.
- Security headers: content-type, no-store on admin and order responses, a basic Content-Security-Policy.
- No third-party scripts or fonts load, so the app runs offline on a local network.

## 11. Milestones

1. Plan and design committed (this document and `DESIGN.md`).
2. Core server, store, pricing, validation, tests.
3. Storefront: catalogue, lot, passport, cart, checkout, order tracking, feedback.
4. Back office: intake, grading, publishing, orders, feedback, farmer report, dashboard, settings.
5. Run locally, check every flow in a browser, fix what breaks, commit.

## 12. Open decisions (the app uses defaults until the owner confirms)

1. Buying price: Rp120,000/kg is the planning assumption (applied); Rp100,000/kg is an old reference only.
2. Launch scope: Wamena and one hub first, or all regions. The app lists all regions but marks the later ones as "coming soon", so either choice is a config change.
3. Local tier: repriced to Rp130,000/kg (applied). Rp100,000 lost money at the Rp120,000 buying price.
4. Minimum order of 30 kg per lot line.
5. Payment: bank transfer until a gateway is chosen.
6. Which admin users get access and when separate logins are needed.

## 13. Risks for the build

- Stock double-counting if reservations are not released on every cancel path. Covered by tests.
- JSON store is fine for pilot volume (a few dozen orders a month). Move to a database before multiple admins work at the same time.
- Without a QR image encoder, the passport is a URL to print or paste. Adding an encoder is a small follow-up.
