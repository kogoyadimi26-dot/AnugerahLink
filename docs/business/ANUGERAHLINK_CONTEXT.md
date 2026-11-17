# AnugerahLink: Business Context

Status: pre-build. Context stored before any app code is written.
Last updated: 2026-11-17.

This document is the single source of truth for the business reasoning behind AnugerahLink. Skills in `.claude/skills/` point here. When a number changes, update it here first, then the skills.

---

## 1. What we are building

AnugerahLink is a quality-controlled coffee trading and traceability business from the Papua highlands, with a platform behind it.

- **Commodity focus:** coffee first (Wamena and the Jayawijaya highlands). Cacao next. The owner also mentioned "Grabs" and other commodities later. The word is unclear and needs confirming.
- **Promise to buyers:** every lot is graded and verified before it is listed. Each lot is traceable to a farmer group.
- **Promise to farmers:** a published, cash price and a route to higher-value sales.
- **Platform sequence:** offline collection app and QR passport first. A full marketplace only when volume justifies it.

Correct the framing on any new document: this is a trading and quality-control company that uses software. It is not a software marketplace with a few physical steps.

---

## 2. Business model (decided as the recommended direction, not yet confirmed by the owner)

### Original idea
A flat 5% commission on sales made through the platform. **This does not cover costs.**

### Recommended model: buy, grade, sell (trading margin)
1. Pay farmer groups cash at a published farm-gate price.
2. Own the stock, grade it, and sell verified lots to roasters.
3. Earn the margin between the sale price and the full landed cost.
4. Show the farm-gate price in the QR passport, so the margin is transparent.

### Fallback: commission plus fee
5% plus a separate QC and handling fee of about Rp15,000 to Rp20,000 per kg, with freight paid by the buyer. Needs less capital. Quality cannot be guaranteed on stock the company does not control, so this is weaker on the core promise.

### Later revenue
Traceability and EUDR data sold as a paid service to exporters and cooperatives.

### Decision (recommended, pending owner confirmation)
Trading margin, started with trial lots of 200 to 500 kg per farmer group and buying in batches of 1 to 2 tons. Reason: the promise that every lot is graded before sale can only be kept if the company owns the stock. Commission needs about 57 tons a year to break even; trading needs about 9.4 tons with the current mix (11.8 tons if Local stays at Rp100,000). The Local price depends on Papua buyers paying Rp130,000, which is not yet tested. Cash is the main risk, so the pilot tests margin and cycle time, not full break-even.
Safeguard (proposed): stop buying from a farmer group if two batches in a row grade below B.
The owner has not yet confirmed this. Record the confirmed choice here.

---

## 3. Unit economics (per kg, green coffee)

Status of each input:
- **Sourced reference:** a published or reported figure, with a date.
- **Assumed:** our estimate. Must be replaced with real pilot data.

| Line | 5% commission | Trading margin | Status |
|---|---|---|---|
| Sale price to roaster | Rp180,000 | Rp180,000 | Assumed |
| Paid to farmer | set by farmer | Rp100,000 | Reference: Kompas 2022 farm-gate Rp100,000/kg. Antara 2023: Rp75,000/kg paid by a Jayapura buyer for Wamena beans |
| Sorting loss (about 10%) | not ours | Rp11,000 | Assumed |
| Freight and packing to Jakarta | passed to buyer | Rp20,000 | Assumed. Air cargo Wamena route was about Rp13,000/kg in 2019 (Medcom) |
| Samples, claims, payment fees | Rp2,000 | Rp7,000 | Assumed |
| **Kept by company** | **about Rp7,000** | **about Rp42,000** | Derived |

Check: 180,000 − 100,000 − 11,000 − 20,000 − 7,000 = 42,000.

### Fixed costs
Lean team (two field agents, one QC person, travel, tools): about **Rp400 million a year**. Our estimate, not a quote.

### Break-even volume
- 5% commission: 400M ÷ 7,000 ≈ **57 tons a year**. That is over a third of the 161 tons Jayawijaya produced in 2020.
- Trading margin: 400M ÷ 42,000 ≈ **9.5 tons a year** (about 10 tons). About 6% of Jayawijaya's 2020 output.

### Working capital
Ten tons at Rp100,000/kg is about **Rp1 billion** of stock cash at any one time over the year. Turn it over in batches of 1 to 2 tons to reduce exposure. Farmers expect cash on the spot, and collectors win on this, so the plan needs a working-capital line.

### Stress tests to run
- Farm-gate price moves ±20%.
- Sorting loss of 5% vs 20%.
- Roaster price falls to Rp150,000.
- Freight doubles.
- Volume is 50% of the plan.

---

### 3a. Grade-based pricing and intake costs (revised model)

**Pricing change.** Lots are now paid by grade at intake, not one flat price. Target grade A pays 100% of the buying price, grade B pays 90%, and grade C pays 80%. Defaults are in `config/business.js` (`gradeBands`) and need owner confirmation.

**Effect on unit economics (per kg bought).** The calculation uses the same sales mix and cost lines as section 3, and only the buying price changes.

| Case | Buying price per kg | Gross margin per kg bought | Gross margin (% of sales) | Break-even per year |
|---|---|---|---|---|
| Flat price (section 3) | Rp 120,000 | Rp 33,900 | 21% | 11,800 kg |
| Grade-based, assumed grade mix A 60%, B 30%, C 10% | Rp 114,000 | Rp 39,900 | 25% | 10,026 kg |

Grade mix of 60/30/10 is an assumption. The trial lots (section 13) will replace it with real data.

**Caveat, important.** This case assumes lower-grade lots still sell at the same tier mix. A grade B or C lot may only sell at Verified standard or Local prices. If the sales mix shifts down, the margin falls below the flat-price case. The model must be re-run with the trial-lot sales data before it is relied on.

**Intake costs (new cost lines, to be quoted):**

| Cost | Per year | Notes |
|---|---|---|
| Scale calibration service | To quote | Calibrated scale, checked before each purchase day |
| Sample storage (labelled bags, shelf space) | To quote | Retained samples, 300 g each |
| Photo storage on the server | Included in platform hosting | Photos are small (max 2 MB each) |
| Sample check time for the field agent | Included in field agent cost | Adds time at each collection |

These lines are not yet in the cost structure above (section 8 of the v2 plan). Add them once quotes are available.

## 4. Market facts (with sources and dates)

Sources were gathered in an earlier research pass. Several are old (2019, 2022). Re-verify before any external use.

### Coffee supply
- Jayawijaya output: 130 t (2018) to 161 t (2020). Kompas, Feb 2022.
- The two main Papuan growing areas together yield about 230 t a year. Remarkable Indonesian Coffee.
- One established buyer sourced 20 t from all Papuan farmers in 2018 and 40 t in 2021. Supply is unstable. Kompas, Feb 2022.

### Coffee demand
- Domestic demand is flat. USDA expects 2025/26 consumption near 4.81 million bags. Prices are high and weak purchasing power pushes drinkers to cheaper blends. Daily Coffee News, Jan 2026.

### Mud crab (second step, not first)
- Mimika live crab exports: 19,245 kg worth Rp1.05 billion by early May 2026, about Rp55,000/kg. Suara Pemerintah, May 2026.
- Existing exporters ship to Singapore and Malaysia: UD Putri Desi and PT Hokky Laut Perkasa. One Garuda route change stalled the trade. Antara.
- Sustainability risk: a 2020 stock study put Mimika red mud crab exploitation at 0.70, meaning overexploited.
- Rules are shifting: Permen KP 5/2026 amended the 2024 lobster and crab regulation with size and condition limits.

### Tuna, cacao, vanilla
- Tuna from Biak: PT Indo Pasifik Numfor already ships fresh to Japan.
- Cacao is organised: Ransiki beans to the UK and Netherlands since 2020. Jayapura regency sends about 10 t a month to Bali. Kakao Kita and IDH are active.
- Vanilla: global oversupply, Madagascar running a $38 million stock-buying plan. **Dropped.**

### Logistics
- Wamena has no port. Air cargo is the main route, about Rp13,000/kg in 2019. A current landed-cost figure is missing.
- Trans-Papua highway is cited by the ministry as a future cost reducer. Not yet in use.

### Buyer prices (reference only)
- Wamena green beans listed at about Rp145,000 to Rp250,000/kg in small retail lots (Tokopedia). Wholesale to roasters is lower. **Still unknown:** what five to ten roasters actually pay for 30 to 60 kg lots.

### Regulation
- **EUDR:** applies from **30 December 2026** for large companies and **30 June 2027** for small and micro ones. Requires plot geolocation. Covers coffee and cacao. Does not cover seafood or vanilla. This is the strongest wedge for coffee and cacao traceability. Large-company deadline is about six weeks from the date of this document.

### Agritech funding climate
- TaniHub is defunct and under a graft probe. eFishery collapsed in a fraud case. Plan on grants, impact funders or own trading cash flow, not venture capital.

---

## 5. Pilot plan (before building software)

1. Buy 500 kg to 1 ton of Wamena coffee through one or two farmer groups.
2. Sell to five roasters, in 30 to 60 kg lots.
3. Record true cost per kg at every step in a spreadsheet or KoboToolbox.
4. Measure the real sorting loss and defect rate.
5. Collect buyer feedback at each delivery (see the buyer-feedback skill).

### Interviews before design
- About 15 buyers: what they pay today, what would make them switch, payment terms.
- About 20 farmers: current prices, cash needs, where they sell.
- Existing cooperatives and collectors: volumes, margins, pain points.

### Four numbers that decide the plan
1. Today's farm-gate price in Wamena, by grade.
2. Outbound cargo rate, Wamena to Jayapura to Jakarta.
3. What five to ten roasters pay for 30 to 60 kg lots, and their payment terms.
4. Real defect and sorting loss on a first 500 kg batch.

### Test the alternative
Selling traceability software to cooperatives and exporters that already ship may be a better business than trading. Keep this option open until the pilot reports.

---

## 6. Competitors and existing players

- **Collectors and local traders:** win because they pay cash on the spot.
- **Established exporters and buyers:** already source Papuan coffee and crab.
- **Cooperatives and NGOs:** Kakao Kita and IDH are active in cacao.
- **Agritech platforms:** TaniHub and eFishery have failed. Use them as cautionary cases, not as models.

A full competitor table (names, volumes, prices, what each does better) is still missing and needs the interview work.

---

## 7. Risks

- **Supply:** tiny and unstable. Highlands output is small.
- **Cash:** working capital needed before sales. Collectors pay cash.
- **Quality:** sorting and defect losses are unknown.
- **Logistics:** air freight is costly, no port, weather and schedule dependence.
- **Land rights and security:** highlands conflict risk. Not yet assessed.
- **Regulation:** EUDR deadlines; Permen KP changes for marine products.
- **Buyer due diligence:** claims must survive audit.
- **Disintermediation:** buyers and farmers dealing directly would cut the company out. Keep buyer contacts inside the company.
- **Team:** no team plan yet.

---

## 8. Claims we must not make

These phrases will not survive buyer due diligence. Replace them.

| Avoid | Use instead |
|---|---|
| "Unalterable" QR passport | "Tamper-evident record, with a hash of each lot's data" (only if built that way) |
| "Absolute trust" | "Verified lot records with sample results" |
| "Untouched" / "pristine" | Describe actual sustainability practice, with data |
| "Underexplored" market | Name the real gap, against existing exporters |

---

## 9. Missing sections (must be added before a pitch or build)

- Competitors (table with names and volumes)
- Per-kg unit economics (done in section 3, needs real inputs)
- Legal entity, export licence, and any required trade permits
- Land-rights and security risk assessment for the highlands
- Team plan (roles, hires, who does QC)
- Pilot results

---

## 10. Open questions for the owner

1. Confirm trading margin as the core model, or keep commission.
2. What is "Grabs"? Which commodity comes after cacao?
3. Which farmer groups and collectors will the pilot start with?
4. What legal entity exists, and which export licences are held or planned?
5. What is the available working capital?

---

## 12. Reconciliation with the v2 plan (Google Drive, 16 Nov 2026)

The owner's v2 plan and v2 spreadsheet are stored in `docs/business/source/`. They are more detailed than sections 2 to 3 above. They use four quality tiers, a higher farm-gate buying price, and a multi-region scope. The table shows where they differ.

| Item | Earlier context (this doc) | v2 plan and sheet | Note |
|---|---|---|---|
| Farm-gate buy price | Rp100,000/kg | Rp120,000/kg, cash at collection | v2 is 20% to 60% above the Rp75,000 to Rp100,000 references. Must be confirmed in the pilot |
| Sales pricing | One blended Rp180,000/kg | Four tiers: Reserve Rp350k, Premium Rp250k, Verified standard Rp150k, Local Rp100k | Blended Rp170k at the assumed mix |
| Grade mix (share of volume) | Not set | 5% / 25% / 40% / 30% | Assumed. Grade the first batch |
| Local tier | Not included | Sells below cost (loss of Rp22k/kg) | Recovers money on low grades only |
| Sorting and drying loss | 10% | 5% | Weigh the first batch |
| Shipping and packing | Rp20,000/kg, passed to buyer (commission model) | Rp20,000/kg on Reserve and Premium only. Buyer pays on Verified standard. Rp6,000 blended | Confirm with written cargo quotes |
| Fees (samples, claims, payment) | Rp7,000/kg (trading) | Rp2,000/kg | Plan includes a Rp2,000/kg claims allowance. Earlier figure was more conservative |
| Margin per kg | Rp42,000 per kg sold (trading) | Rp42,000 per kg sold; Rp33,900 per kg bought after sorting loss | Both figures are correct on different bases. Quote the basis every time |
| Fixed costs | Rp400M/yr, full team | Rp400M/yr full team. Monthly by stage: Rp5.5M, Rp15M, Rp30M | Staged hiring is the new element |
| Break-even volume | About 9.5 t/yr | About 11.8 t/yr (983 kg/month) | Driven by the higher buying price and staged costs |
| Scope | Wamena coffee, one corridor first | All Papuan coffee regions, rolled out hub by hub. Wamena plus one more hub first | Conflicts with the "one corridor" advice. See open question below |
| Working capital | Rp1B for 10 t/yr | Rp48M (Stage A), Rp120M (Stage B) for two batches of stock | v2 uses 2 batches, not the full year |
| Total start-up funding | Not set | Rp131M (Stage A), Rp203M (Stage B) | Includes equipment, registration, six months of fixed costs |
| Pilot | 500 kg to 1 ton | 200 to 500 kg over 90 days | Similar. v2 has a day-by-day plan |
| Cacao and crab timing | Cacao next, crab second | Cacao in Year 3, live crab as a separate cold-chain operation in Year 3 | Conflicts with earlier sequencing. Confirm |
| Platform | Offline app and QR passport first | Pilot on WhatsApp and a spreadsheet. Version 1: catalogue, checkout, offline app, QR passport | Consistent in principle |
| Claims | Avoid "unalterable" and "absolute trust" | Same, and the plan says to describe QR passport as a verified record | Consistent |

Points to resolve with the owner before building:
1. Confirm the buying price. Recommended: plan at Rp120,000, the top price (Grade A), and treat Rp100,000 as an old 2022 reference only. The app uses Rp120,000. With the default grade mix and Local at Rp130,000, margin is Rp42,450/kg and break-even is about 9.4 tons a year. Without the Local price change, it is Rp33,900/kg and 11.8 tons. Replace it after trial lots give real prices.
2. Confirm scope. Start with Wamena and one hub, as v2 says, or open all regions from the start.
3. Confirm what "Grabs" refers to in the earlier message. Cacao is Year 3 in v2.
4. Local tier. Recommended and applied: reprice from Rp100,000 to Rp130,000/kg. At Rp120,000 buying, Rp100,000 lost Rp26,900/kg; Rp130,000 gives about Rp1,600/kg, which is a floor, not a return. A test keeps it at or above break-even.
5. Confirm the Premium price basis. The Rp250,000/kg Premium price is the top of the listed range for Wamena green beans, and those listings are mostly 1 kg retail packs. v2 itself notes that bulk buyers may pay less. Roasted retail prices (for example Rp150,000 per 250 g from a Papuan processor) are not a green-bean per-kg price and should not be used to justify Premium. Test with five to ten buyers.

## 13. Sourcing and quality strategy (buying from farmer groups)

Purpose: make sure each lot is good quality before we pay cash, and that farmers know in advance how they will be paid for quality. Applies to green coffee: gabah (dried cherry in parchment) and green beans after hulling.

**1. Start with a trial lot.** Buy a small amount (200 to 500 kg) from each new group. Grade it. Only after the result, agree on regular prices with that group.

**2. Pay by grade, not one flat price.** Publish a price for each grade:
- full price for the target grade (today's app: Rp 120,000/kg for the target lot)
- a stated deduction for lower grades (today's app: 10% for lots that are "dipotong")
- rejection for lots that fail the minimum (no payment)

The current app pays one flat buying price for every lot that passes, plus the 10% reduction for "dipotong" lots. Per-grade pricing is not built yet and is the next step if the owner agrees.

**3. Check in front of the farmer.** Weigh, sample and check moisture together with the farmer present. Show the result, then pay. Cash is paid only for a lot that passes or is reduced as agreed.

**4. Keep a retained sample.** Store a labelled sample (for example 300 g, with the sample number) from each paid lot, until the lot is sold and any dispute is closed.

**5. Record everything.** For each purchase: date, group, weight before and after, moisture, defect count, gabah and green weights (hulling yield), the sample number and a photo of the sample. The app records the first three to five items now; photo upload is not built yet.

**6. Reject rules in writing.** Agree with each group, before the first purchase, on what is rejected and what is reduced. Current rules (to be shown to every group):

| Result | Condition | Payment |
|---|---|---|
| Lolos (passed) | Moisture 10 to 12%, defects up to 25 per 300 g | Full price |
| Dipotong (adjusted) | Moisture 8 to 10% or 12 to 14%, or defects 26 to 60 | Price less 10% |
| Ditolak (rejected) | Moisture below 8% or above 14%, or defects over 60 | No payment; lot is not graded or sold |

These values are set in `config/business.js` under `intake` and were confirmed by the owner.

**7. Check the scale.** Use a calibrated scale, check it before each purchase day, and weigh with the farmer present.

**What the app already does:** records the sample number, moisture, defect count, hulling yield, and the result; sets the grade and pay percentage; calculates the amount due; records the three field checks; stores sample and bag photos; blocks grading and sale of rejected lots.

**What it does not yet do:** farmer signature on the weight slip, a scale calibration log with dates, and printed price lists for farmers.

## 14. Core values (Nilai inti)

**Our quality principle.** AnugerahLink delivers top-quality Papuan coffee. We do not accept or sell low-quality coffee. Every lot is checked before we pay for it and graded before we sell it.

| Value | English | Bahasa Indonesia |
|---|---|---|
| **Integrity** | We sell only the coffee we have checked, graded, and can prove. | **Integritas**: Kami hanya menjual kopi yang sudah kami periksa, nilai, dan dapat kami buktikan. |
| **Trust** | Every lot matches its grade, cup score and passport, every time. | **Kepercayaan**: Setiap lot sesuai dengan grade, skor cupping, dan paspornya, selalu. |
| **Empowerment** | We train farmers and price transparently, so they can grow better coffee and earn more. | **Pemberdayaan**: Kami melatih petani dan menetapkan harga secara transparan, agar mereka bisa menghasilkan kopi yang lebih baik dan memperoleh penghasilan lebih besar. |
| **Help** | We bring Papua’s hidden coffee to market, so buyers taste what Papua produces, and farmers get credit for it. | **Membantu**: Kami menghadirkan kopi Papua yang tersembunyi ke pasar, agar pembeli dapat merasakan kopinya dan petani mendapat pengakuan atasnya. |

**How the values show up in practice**

- **Integrity:** lots that fail intake are rejected and not paid for (see section 13). Lower-grade lots are labelled as such and never sold as Reserve or Premium.
- **Trust:** every passport shows the recorded grade, cup score and price paid, with a hash check. Claims and returns follow the published policy.
- **Empowerment:** training for farmer groups, grade-based pricing (planned), and a result shown to the farmer before payment.
- **Help:** Papuan coffee is presented by region and group, with the same standard as any other origin.

The same four values are shown on the home page of the web app, from `config/business.js` (`values`).

**Review notes for the owner**

1. The Local tier and "dipotong" lots are below target grade. The values above are kept consistent by labelling them clearly and never selling them as higher tiers. Confirm this is the intended rule.
2. Avoid claims such as "the best coffee in the world" or "absolute trust". Use what we can show: graded, traced, checked.
3. Grade-based pricing (section 13 and 3a) is built in the app. Its effect on margin depends on the sales mix of lower grades, which the trial lots must confirm.

## 11. Glossary

- **Farm-gate price:** what the farmer is paid at the farm, per kg.
- **Green bean / green coffee:** unroasted coffee, traded by kg.
- **Lot:** a batch of coffee from one or more farmer groups, graded together.
- **Farmer group:** the cooperative or group the lot is traced to.
- **Collector:** a local trader who buys from farmers and resells.
- **QR passport:** the lot record linked to a QR code, showing origin, grade and price paid.
- **EUDR:** EU Deforestation Regulation. Requires plot-level geolocation for coffee and cacao.
- **Sorting loss:** kg lost when defective beans are removed.
- **Landed cost:** total cost to deliver the coffee to the buyer, including freight.
