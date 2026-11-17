---
name: anugerahlink-pilot-validation
description: Use when planning or reviewing the AnugerahLink manual pilot (500 kg to 1 ton of Wamena coffee sold to roasters), buyer and farmer interviews, or the checks that must happen before any software is built. Trigger on mentions of pilot, interview, validation, batch, sorting loss, roaster prices, or "what to verify first".
---

# AnugerahLink pilot and validation

Build the business before the software. This skill sets the order of work and what must be measured. Background and numbers: `docs/business/ANUGERAHLINK_CONTEXT.md`, sections 4 and 5.

## Order of work

1. **Interviews** (before any design)
   - About 15 roasters and cafes: what they pay today, for what lot sizes, payment terms, what would make them switch, what quality problems they see.
   - About 20 farmers: current price received, who they sell to, cash needs, what they want in return.
   - Cooperatives and collectors: volumes, margins, how they pay cash.
2. **Manual pilot** (no app)
   - Buy 500 kg to 1 ton through one or two farmer groups.
   - Sell to five roasters in 30 to 60 kg lots.
3. **Record everything** in a spreadsheet or KoboToolbox: cost per kg at each step, defect count, sorting loss, freight actuals, payment dates.
4. **Feed results into the unit-economics model** and decide the revenue model.
5. **Only then** build the offline collection app and QR passport.

## Four numbers to verify first

| # | Number | Method | Source of truth |
|---|---|---|---|
| 1 | Wamena farm-gate price, by grade | Ask at least three collectors and two farmer groups on the same day, record grade | Field notes |
| 2 | Cargo rate, Wamena to Jayapura to Jakarta | Quote from at least two air cargo and one sea-plus-road route | Written quotes |
| 3 | Roaster price for 30 to 60 kg lots, and terms | Interviews plus actual offers | Written offers |
| 4 | Real sorting loss and defect rate | Weigh input and output at each grading step on the pilot batch | Scale records |

Record the date and the person for each data point.

## Interview guide (keep it short)

Roasters:
- What do you buy now, from whom, at what price per kg?
- What lot size do you need, and how often?
- How do you pay, and how long after delivery?
- What makes you switch supplier?
- What problems have you had with origin coffee?

Farmers and collectors:
- What price did you get last harvest, and what did you sell for?
- How do you get paid, and how fast?
- What stops you from selling more?
- What would make you join a group that pays a published price?

Do not promise prices, volume, or a platform in interviews.

## Pilot rules

- Keep every purchase traceable to a farmer group and date, even on paper.
- Grade each lot before sale. Record grade, defect count, and moisture if measured.
- Send buyer feedback with each delivery (see the buyer-feedback skill).
- Record all costs, including ones that feel small: transport, bags, samples, fees.
- Do not extend credit to roasters on the pilot without a written term.

## Go or no-go review

After the pilot, answer in writing:
1. Did the kept margin per kg match the model within 20%?
2. Did at least three roasters reorder?
3. Did the farm-gate price hold for the whole pilot?
4. Is the working-capital need within what the company can fund?
5. Is the EUDR geolocation data collectable from the groups we buy from?

If any answer is no, change the model before building software.

## Output

Return a pilot tracker (table or spreadsheet) with: date, group, kg in, grade, cost per kg, defect rate, buyer, kg out, price, payment date, feedback notes.
