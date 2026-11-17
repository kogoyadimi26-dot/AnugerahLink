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

### Decision still open
The owner has not yet confirmed trading margin over commission. Record the choice here once made.

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
