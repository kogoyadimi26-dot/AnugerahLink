# Large order (2 ton and above): design and plan

Status: draft for owner review. No code yet.
Date: 18 November 2026

## 1. Problem

The web checkout is built for small orders: 30 to 300 kg per order (`minOrderKg` 30, `maxOrderKg` 300 in `config/business.js`). A roaster or exporter that needs 2 tons or more cannot use it. They need to agree on lots, price, delivery and payment before any coffee moves.

## 2. Goal

For orders of **2,000 kg or more**, the buyer submits a proposal online. AnugerahLink reviews and verifies it, both sides agree written terms, the buyer pays, and AnugerahLink prepares the shipment to the buyer's destination.

## 3. Scope

In scope:
- A large-order proposal form for buyers with an account.
- Staff review and verification queue.
- A written offer (terms) that the buyer accepts or counters.
- Deposit and balance payments.
- Shipment preparation and documents.

Out of scope for this phase:
- Automatic checkout for large orders (the proposal replaces it).
- Export licensing and customs brokerage (flagged in section 11).
- Contract signing with a third-party e-signature service (decide in section 11).

## 4. Threshold and routing

| Quantity | Path |
|---|---|
| Under 300 kg | Normal checkout (unchanged) |
| 300 kg to under 2,000 kg | Normal checkout with a larger-order note, or a proposal (owner decision) |
| 2,000 kg and above | Large-order proposal (this plan) |

The threshold is one value (`largeOrderMinKg: 2000`) in `config/business.js`, so the owner can change it.

## 5. End-to-end flow

1. **Buyer fills the proposal** (account required). Form saved as a draft at any time.
2. **Submit.** Buyer checks the agreement boxes and submits. Status: `submitted`. Buyer gets an email and WhatsApp with a reference number (for example `ALP-2611-001`).
3. **Review (AnugerahLink).** Staff check fit with the offer (tiers, volume, timing) and reply within **2 business days**. Status: `in_review`.
4. **Verify.** Two checks, both must pass:
   - *Buyer:* company identity (NPWP, business licence, contact person, delivery address), and at least one reference or prior trade.
   - *Supply:* enough listed, graded lots of the requested tier and cupping score, and a reservation of those lots for the offer period.
   If something is missing, status becomes `need_info` and the buyer gets a list of what to send.
5. **Offer (terms sheet).** Staff prepare a written offer: lots and kg, price per kg by tier, delivery terms, payment schedule, shipment date, and validity (7 days). Status: `offered`.
6. **Buyer responds.** Accept, decline, or counter with changes. A counter goes back to staff. Status: `negotiating` on each counter.
7. **Agreement.** When both sides accept the same terms version, status becomes `agreed`. Both sides receive the final terms as a PDF with a version number and a hash, the same way passports are checked.
8. **Deposit.** AnugerahLink issues a deposit invoice (owner sets the percentage, see section 11). Buyer pays by bank transfer or QRIS. Status: `deposit_pending` then `deposit_paid`. Lots are reserved in the system.
9. **Prepare shipment.** Staff weigh, sort, pack, label each lot, and prepare documents (packing list, lot list, quality results, origin statement). Status: `preparing`.
10. **Balance.** Balance invoice issued before dispatch. Status: `balance_pending` then `balance_paid`. Dispatch is blocked until the balance is paid, unless the owner approves credit terms.
11. **Dispatch.** Waybill recorded, buyer notified. Status: `shipped`. Courier updates use the existing courier webhook.
12. **Delivered and closed.** Buyer confirms receipt or the claim window (48 hours) passes. Status: `completed`.

Ends early at any step: `declined` (buyer or AnugerahLink), `expired` (offer not answered in 7 days, or deposit not paid in 5 days), `cancelled` (after agreement, only by mutual written agreement).

## 6. Status summary

```
draft -> submitted -> in_review -> offered -> negotiating <-> offered -> agreed
                         |  ^                                              |
                         v  |                                              v
                      need_info                        deposit_pending -> deposit_paid
                                                                              |
                                  preparing -> balance_pending -> balance_paid -> shipped -> completed
```

Side exits: `declined`, `expired`, `cancelled`.

## 7. Proposal form (buyer fills in)

**Company**
- Company name, legal form, NPWP
- Business licence number (upload)
- Contact person, role, phone, email
- Delivery address, city, country, port or airport if relevant

**Order**
- Quantity in kg (must be 2,000 or more; step 100 kg)
- Preferred tier(s): Reserve, Premium, Verified standard, Local (multi-select)
- Minimum cupping score or grade (optional)
- Processing preference (washed, honey, natural, and so on; optional)
- Lot preference or single origin (optional)
- Sample requested before offer: yes or no
- Needed by (date)
- Packaging: jute sacks, GrainPro, or other (text)
- Roasting or intended use (text)

**Logistics and payment**
- Delivery terms wanted: delivered to destination, or collected at Jayapura or Wamena
- Who arranges international freight: buyer or AnugerahLink (quote only)
- Preferred payment: bank transfer, QRIS, or other (text)
- Credit request (optional, staff review only)

**Agreement (checkboxes, each required)**
- I confirm the information is correct.
- I agree AnugerahLink may verify my company and references.
- I understand the offer is subject to lot availability and written agreement from both sides.
- I agree to the claim and return terms (`policy` in config).
- I agree to the privacy notice for business data.

**Attachments:** business licence, NPWP, company profile (optional), previous purchase order (optional).

Validation: quantity 2,000 kg or more, delivery address required, at least one tier, all agreement boxes ticked.

## 8. Roles and permissions

| Role | Can do |
|---|---|
| Buyer | Create and edit a draft, submit, respond to an offer, pay invoices, view own proposal |
| Field agent | None in this flow |
| Grader | Grade and cupping results for reserved lots (existing permission) |
| Staff (admin) | Review, verify, request info, prepare offer, mark status, issue invoices |
| Owner (admin) | Approve offer terms above a set value, approve credit, change thresholds |

New permission names: `proposals` (view and review), `proposals_approve` (owner approval).

## 9. Data (new records, to be added to the store)

- `proposal`: id, reference, buyer id, status, form fields, submitted at, timeline (status changes with time and user), verification checks (each with result and note), linked offer ids.
- `offer`: id, proposal id, version number, lines (lot id, kg, price per kg), total, delivery terms, payment schedule, valid until, status, hash of the terms text.
- `largeInvoice`: deposit or balance, amount, due date, paid date, reference. Reuses the existing payment flow where possible.

Lots reserved for an agreed offer use the existing reservation fields (`reservedKg`) so storefront stock stays correct.

## 10. Notifications

Each status change sends email and WhatsApp (through the existing outbox in `lib/notify.js`), with a new template per step:
- Submitted (buyer and staff)
- Need info (buyer)
- Offer ready (buyer)
- Counter received (staff)
- Agreed (both)
- Deposit due and deposit received (buyer and staff)
- Shipped (buyer), using the existing tracking link format

## 11. Open decisions for the owner

1. **Threshold:** 2,000 kg confirmed? Should 300 kg to 2,000 kg also use a proposal?
2. **Bulk price:** same price per tier for large orders, or a volume discount? Minimum margin per kg must hold (see the unit-economics notes: Rp42,450 per kg at the default mix).
3. **Deposit:** what percentage (for example 30 percent), and is it refundable if the buyer cancels after agreement?
4. **Credit:** do any buyers get payment after shipment? If yes, on what terms and limit?
5. **Delivery terms:** delivered to buyer, or collected in Jayapura or Wamena? Who pays air or sea freight, and is it quoted as a separate line?
6. **Signature:** typed acceptance in the app with a version hash (simple), or a third-party e-signature service (cost, more legal weight)?
7. **Legal review:** the offer and agreement template need a lawyer's review before the first large order. Governing law and dispute terms.
8. **Export:** will any large order leave Indonesia? If yes, export documents, phytosanitary and EUDR plot geolocation (EU rule from 30 December 2026 for large companies) must be planned.
9. **Supply:** can we reserve 2 tons across listed lots at one time? Current stock must be checked before any offer. The plan lists tier volumes of about 12 tons a year for the full model, so one 2-ton order is a large share of early supply.
10. **SLA:** 2 business days for review, 7 days for an offer to be answered, 5 days for a deposit. Confirm these.
11. **Who approves offers:** staff alone, or owner above a value?

## 12. Build phases

1. **Plan (this document).** Owner answers section 11.
2. **Data and form.** Proposal record, draft and submit, buyer-side pages, validation, admin list.
3. **Review and verify.** Verification checklist, need-info loop, supply reservation.
4. **Offer and agreement.** Offer builder, versioning, accept or counter, agreed PDF with hash.
5. **Payment and shipment.** Deposit and balance invoices, dispatch block, shipment checklist.
6. **Notifications and tests.** Templates, state-transition tests, one end-to-end test from submit to shipped.

Each phase ships as its own PR with tests passing, following the normal branch and draft-PR flow.

## 13. Tests to write (when built)

- Quantity under 2,000 kg is rejected from the large-order path.
- Each status transition is allowed only from the states above (for example `shipped` cannot happen before `balance_paid`).
- Agreed terms cannot change without a new version and new acceptance on both sides.
- Lots reserved for an offer are not sold to another buyer while the offer is valid.
- Offer expires after 7 days; deposit expires after 5 days.
- Buyer cannot see another buyer's proposal.
