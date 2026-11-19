# Pesan Kios Papua

A B2B ordering and credit app for kios, warung, schools, churches and government offices in Papua. Buyers order goods for delivery from a regional hub (Jayapura, Wamena or Timika). The back office tracks orders, stock by hub, credit balances and platform fees.

This is the first product from the opportunity review in [docs/opportunities.md](docs/opportunities.md). It is a working prototype. It is not ready for real customers.

## Run it

Requires Node 20 or later. No dependencies.

```bash
cd papua-kios
ADMIN_TOKEN=change-me npm start
```

Open http://localhost:3100. The back-office panel is under "Panel admin" and needs the `ADMIN_TOKEN` value.

Data is stored as JSON in `data/kios.json` (set `KIOS_DATA` to move it). The folder is git-ignored.

## Test

```bash
npm test
```

20 tests cover the pricing and credit rules (domain) and the HTTP API, including the admin token gate.

## How the money works

- **Platform fee:** 5% of the goods subtotal (`PLATFORM_FEE_BPS` in `lib/domain.js`).
- **Delivery fee:** a flat fee per hub, a placeholder until real freight quotes are in.
- **Credit:** a buyer with a credit limit can order on account. The balance is recorded as receivables and cleared by repayments.
- **Stock:** each product has stock per hub. Orders reduce stock at the buyer's hub. Cancelling a waiting order returns it.

## Known gaps before real use

These are deliberate scope cuts for the prototype:

- **Buyer login.** Buyers pick their account from a dropdown. There is no password or phone verification. Add real auth before any real credit is extended.
- **Single admin token.** The back office uses one shared token. Replace with per-user accounts and an audit log.
- **No payment gateway.** Cash and QRIS are recorded as settled, not verified. Connect QRIS or a bank before relying on the paid flag.
- **Flat prices and delivery fees.** Replace with supplier cost and per-kilogram freight once quotes exist.
- **JSON file storage.** Fine for one server with low volume. Move to a database before running more than one server.
- **Single-language UI.** Indonesian only.
- **No notifications.** Buyers and admins are not told when an order status changes.

## Layout

```
server.js          HTTP server, JSON persistence, admin gate
lib/domain.js      pricing, stock, credit and status rules (pure functions)
public/index.html  buyer storefront and back office
test/              domain and HTTP tests
docs/opportunities.md   ranked digital opportunities for Papua, Timika and Tembagapura
```
