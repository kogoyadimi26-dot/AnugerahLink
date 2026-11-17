# AnugerahLink Web App: Design

Date: 2026-11-17. Companion to `PLAN.md`.

## 1. Design principles

1. **Trust first.** Buyers are paying for verified quality. Every lot shows its grade, cup score, origin and the record hash. Nothing is decorated for its own sake.
2. **Plain Indonesian-English.** Short sentences, one term per idea. "Tier", "grade", "cup score", "kg in stock". No jargon without a tooltip.
3. **Works on a phone at a cafe counter, and on a laptop at the office.** Mobile first. Buyers often order from a phone.
4. **Works on a weak connection.** No external fonts, scripts or images. Pages are small and render without JavaScript for the core text.
5. **Honest claims.** The passport says "verified record" with a hash for tamper evidence. It never says "unalterable".

## 2. Visual system

### Colour tokens (defined on `:root`, with dark mode)

Coffee and highland palette. Contrast is checked for WCAG AA on text.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#FAF7F2` | `#1B1714` | Page background |
| `--surface` | `#FFFFFF` | `#27211C` | Cards, panels |
| `--ink` | `#2A211B` | `#F3ECE3` | Body text |
| `--ink-muted` | `#6B5D52` | `#B5A697` | Secondary text |
| `--line` | `#E6DDD2` | `#3E342C` | Borders, dividers |
| `--brand` | `#5B3A24` | `#D9A66B` | Primary buttons, links |
| `--brand-ink` | `#FFFFFF` | `#1B1714` | Text on brand |
| `--accent` | `#2F6B4F` | `#7FC4A0` | In stock, success, pass |
| `--warn` | `#9A5B00` | `#F0B45A` | Low stock, pending |
| `--danger` | `#A3262B` | `#F08A8D` | Errors, cancelled |

Tier colours (used only as a small label with text, never colour alone):

| Tier | Label | Colour token |
|---|---|---|
| Reserve | "Reserve" | `--brand` |
| Premium | "Premium" | `--accent` |
| Verified standard | "Verified standard" | `--ink-muted` |
| Local | "Local" | `--warn` |

### Typography
- System font stack only: `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`.
- Scale: 14 / 16 (body) / 18 / 22 / 28 / 36 px. Line height 1.5 for body, 1.2 for headings.
- Numbers use tabular figures (`font-variant-numeric: tabular-nums`) so prices line up.
- Rupiah formatting: `Rp 350.000` (dot as thousands separator, Indonesian style). Kg: `200 kg`.

### Spacing and shape
- 4 px base grid. Spacing tokens: 4, 8, 12, 16, 24, 32, 48.
- Radius 10 px for cards, 8 px for inputs and buttons. Borders 1 px `--line`. No heavy shadows: one soft shadow for the cart drawer only.

### Layout
- Phone (under 640 px): single column, 16 px side gutter, bottom-fixed cart bar.
- Tablet (640 to 1023 px): two-column catalogue grid.
- Desktop (1024 px and up): catalogue with a left filter column (240 px) and a card grid.
- No horizontal page scroll at any width. Tables in the back office scroll inside their own container.

### Iconography
- No icon font. Use text labels and a few inline SVG glyphs (cart, check, arrow). Every icon-only button has an `aria-label`.

## 3. Page map

Public (hash-routed single page, `public/index.html`):

| Route | Page | Purpose |
|---|---|---|
| `#/` | Home | Value statement, how it works, the four tiers, featured lots |
| `#/catalogue` | Catalogue | Filter and browse lots in stock |
| `#/lot/:code` | Lot | Detail, quantity, add to cart |
| `#/passport/:code` | Passport | Origin and grading record with hash |
| `#/cart` | Cart | Lines, totals, go to checkout |
| `#/checkout` | Checkout | Buyer details, place order |
| `#/order/:number` | Order created | Confirmation and bank transfer instructions |
| `#/track` | Track order | Enter order number and email |
| `#/track/:number` | Order status | Timeline and feedback link when delivered |
| `#/feedback/:number` | Feedback | Short form after delivery |
| `#/about` | About | Who runs it, how farmers are paid, the claims we make |

Back office (same app, `#/admin`):

| Route | Page |
|---|---|
| `#/admin` | Login (token), then dashboard |
| `#/admin/dashboard` | Stock, orders, economics, break-even |
| `#/admin/intake` | Record purchase from a group |
| `#/admin/lots` | Lot list, grade, publish, withdraw |
| `#/admin/orders` | Orders, status, payment reference |
| `#/admin/feedback` | Feedback and tags, farmer report per group |
| `#/admin/settings` | Business rules in use, with sources |

## 4. Components

- **Header.** Logo wordmark (text), links: Catalogue, Track order, About, cart button with count. Collapses to a menu button under 640 px.
- **Tier badge.** Small rounded label with text and a dot.
- **Lot card.** Tier badge, lot code, cup score ("Cup 85"), region, public group name, kg in stock, price per kg, shipping note, "View lot" button. A "Low stock" label under 60 kg.
- **Filter panel.** Checkboxes for tier, select for region, toggle for in stock, sort select. On phone, opens as a sheet.
- **Quantity input.** Stepper with minus and plus buttons (44 px targets) and a numeric field. Minimum 30 kg, validation text under the field.
- **Passport card.** Two-column definition list: origin, group, harvest, process, grade, cup score, moisture, farm-gate price paid. Footer shows the record hash in monospace with a "Copy" button.
- **Order summary.** Lines, shipping, total. Repeated on checkout and confirmation.
- **Status timeline.** Vertical list of steps with dates. Completed steps use `--accent`; the current step is bold; cancelled shows in `--danger`.
- **Form fields.** Label above field, help text below, error text in `--danger` with an icon-free prefix "Error:". Required fields marked with the word "required", not only an asterisk.
- **Toast.** Bottom of screen, announced with `role="status"`, auto-hides after 4 seconds.
- **Table (admin).** Sticky header row, zebra rows, numbers right-aligned, scrolls horizontally inside its container.
- **Stat tile (admin).** Label, large number, one line of context.
- **Confirm dialog.** Used for cancel order, withdraw lot. Focus trapped, Escape closes.

## 5. Key screen notes

### Home
- Headline: "Verified Papuan coffee, bought directly from farmer groups."
- Three short points: graded before listing, traced to the farmer group, paid to farmers in cash.
- A "How the tiers work" strip with the four tiers, each one line.
- Featured: up to four lots in stock.

### Catalogue
- Default sort: cup score, highest first. Default filter: in stock.
- Result count above the grid: "12 lots in stock".
- Empty state: "No lots match these filters. Clear filters" button.

### Lot page
- Price shown per kg with the tier label, plus a line: "Reserve and Premium include shipping. Verified standard adds Rp20.000/kg shipping. Local is collected in Papua."
- Quantity below the price. Subtotal updates live but the server total is shown at checkout.

### Checkout
- Single page, four groups: Buyer type, Contact, Delivery, Payment.
- Payment is "Bank transfer against invoice". The text says that the team confirms payment by hand and gives the bank details on the confirmation page.
- Place order button disabled while submitting, and text changes to "Placing order…".

### Passport
- Title: "Lot passport: AL-…".
- A subtitle: "Verified record. Hash: …" with a short explanation under it: "The hash is computed from the lot's recorded fields. If any field changes, the hash changes."
- No personal details. Group name is public. Region and regency are public.

### Admin dashboard
- Top row: four tiles (kg in stock, open orders, revenue requested this month, feedback to review).
- Middle: economics table per kg bought, with the v2 line items.
- Bottom: break-even line: "Break-even at 11.8 t a year (983 kg a month)".

### Admin grading
- A lot form with tier select. Changing tier updates the displayed price immediately.
- Publish button is disabled until grade, cup score and sellable kg are set.

## 6. Interaction and states

- Every async action shows a loading state on its button. Failed actions show the error next to the form, with the field name.
- Stock changes in the cart re-check on each quantity change. If stock is short, the line shows "Only N kg left" and the stepper caps at N.
- Forms keep input on error. Nothing is cleared by a failed request.
- Hash navigation keeps scroll position on back.

## 7. Accessibility

- Semantic landmarks: `header`, `nav`, `main`, `footer`. One `h1` per page.
- Focus rings visible (`outline: 2px solid var(--brand)` with offset). Never remove outlines without a replacement.
- Touch targets at least 44 by 44 px.
- Colour is never the only signal: tiers and statuses have text.
- `prefers-reduced-motion` disables transitions.
- Form errors are linked with `aria-describedby`. The toast uses `role="status"`.
- Language attribute `lang="en"`. Indonesian product terms are given in plain English next to them where it helps.

## 8. Copy style

- Short, active voice. "Add to cart", "Place order", "Track your order".
- Money in rupiah with dots. Kg with a space.
- Claims: use "graded", "verified record", "traced to the farmer group". Do not use "unalterable", "absolute trust", "untouched", "pristine", "underexplored".

## 9. Build notes for the implementation

- Plain HTML, CSS and JavaScript. No framework and no build step. Node 22 standard library on the server.
- One CSS file with the tokens above. Dark mode via `prefers-color-scheme` and a `data-theme` override.
- `app.js` holds a small router, view functions that return HTML strings with escaped values, and a fetch wrapper.
- Escape every value written to the DOM. Never insert raw user text as HTML.
