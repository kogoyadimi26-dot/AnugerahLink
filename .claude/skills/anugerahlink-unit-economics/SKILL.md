---
name: anugerahlink-unit-economics
description: Use when calculating or reviewing AnugerahLink per-kg margins, break-even volumes, working capital, or price and cost sensitivity for coffee (and later cacao or crab). Trigger on mentions of margin, break-even, per kg, landed cost, sorting loss, commission vs trading margin, or the spreadsheet model.
---

# AnugerahLink unit economics

Use this skill to build or check the per-kg model. The baseline numbers are in `docs/business/ANUGERAHLINK_CONTEXT.md`, section 3. Read that section first.

## The formula (trading margin, per kg green coffee)

```
kept = sale_price
     − farm_price
     − sorting_loss_cost
     − freight_and_packing
     − samples_claims_fees
```

Baseline: 180,000 − 100,000 − 11,000 − 20,000 − 7,000 = **Rp42,000/kg**.

## The formula (5% commission)

```
kept = 0.05 × sale_price − samples_claims_fees
```

Baseline: 9,000 − 2,000 = **about Rp7,000/kg**. Freight is passed to the buyer.

## Break-even

```
break_even_kg = annual_fixed_cost / kept_per_kg
```

- Trading margin: 400,000,000 ÷ 42,000 ≈ 9,524 kg, about 10 tons.
- Commission: 400,000,000 ÷ 7,000 ≈ 57,143 kg, about 57 tons.

Always express break-even as a share of regional output (Jayawijaya 2020: 161 t). Flag any result above about 10% of output as a supply risk.

## Working capital

```
peak_stock_cash = batch_kg × farm_price
annual_stock_cash_turned = annual_kg × farm_price
```

Ten tons at Rp100,000/kg is about Rp1 billion of stock purchased over the year. Model batch size (1 to 2 tons) and the number of turns per year. Show the cash gap between paying farmers and receiving roaster payment.

## Required sensitivities

Run each one and report the break-even volume:

- Farm-gate price ±20%
- Sorting loss 5% vs 20%
- Roaster price falls to Rp150,000
- Freight doubles
- Volume at 50% of plan
- Payment terms: roaster pays 30, 60 or 90 days after delivery

## Rules when building the model

1. Every input has a status: **sourced** (with date and source) or **assumed**. Show both.
2. Keep assumed inputs in one place so the pilot can replace them.
3. Do not present a margin without its landed cost.
4. Do not treat the farm-gate price as fixed. It moves with grade and season.
5. Round break-even up, not down.

## Output format

When asked for a model or a check, return:
- Per-kg table for both models
- Break-even in kg, tons, and share of output
- Sensitivity table
- A list of inputs that are still assumed, in order of how much they move the result

If a spreadsheet is requested, build it as an `.xlsx` with editable input cells. Do not hard-code results.
