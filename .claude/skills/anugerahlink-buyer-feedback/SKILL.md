---
name: anugerahlink-buyer-feedback
description: Use when collecting, filtering, or reporting buyer feedback on AnugerahLink coffee lots, or deciding what reaches farmer groups and what stays inside the company. Trigger on mentions of buyer feedback, taste notes, cupping comments, reorders, farmer reports, or what to share with farmers.
---

# AnugerahLink buyer feedback

Buyer feedback goes to farmers only in a filtered form. Farmers get what changes their next harvest. Buyer contacts, prices, and complaints about shipping stay inside the company.

Background: `docs/business/ANUGERAHLINK_CONTEXT.md`, section 4 and section 2.

## What to pass to farmers

| Pass on | Keep inside AnugerahLink |
|---|---|
| Which of their lots sold fastest and got reorders | Buyer names and contact details |
| Taste comments tied to their lot (sweet, clean, flat, sour) | Prices buyers paid |
| Quality problems that started at the farm (unripe beans, mould, uneven drying) | Complaints about shipping, packaging, or delays (our problem to fix) |
| Requests for more volume or a specific process | One-off opinions not repeated by other buyers |

## Collection

After each delivery, ask the buyer three questions:
1. How did the coffee taste (as espresso, filter, or both), and what did you notice?
2. Were there any quality problems (defects, mould, smell, uneven roast)?
3. Would you reorder, and at what volume?

Record answers against the lot ID, so each comment links to a farmer group through the QR passport record.

## Filtering rules

Before anything reaches a farmer group, check:
- **Repeated:** the same point came from at least two buyers, or one buyer on two deliveries. Single opinions stay internal.
- **Origin-related:** the problem started on the farm (drying, sorting at source, harvest timing). Post-farm issues stay internal.
- **Actionable:** the farmer can change it before the next harvest. If not, say nothing or note it internally.
- **Anonymous:** no buyer names, no prices paid, no buyer business details.

Tag each item as `pass-to-farmer`, `internal-quality`, `internal-logistics`, or `discard`.

## Reporting to farmers

- **Once per harvest, not per order.** Use a short summary at a meeting or collection day.
- **Spoken, not only written.** Many farmers will not read a report. The field agent explains it in person.
- **Structure (keep to one page):**
  1. What sold well and why it may have (their lot, their process).
  2. What buyers said, in short quotes without names.
  3. One or two things to change next harvest.
  4. Their grading results, shown alongside.
- **Praise specific lots.** A Jakarta cafe serving a group's coffee by name, and asking for more, is the strongest motivation.
- **Do not overload.** Three points maximum per group per harvest.

## Platform note

At pilot scale this is a few notes in a spreadsheet or KoboToolbox form. Build a system feature only when there are many groups and buyers. When it is built, the flow is: buyer feedback enters AnugerahLink, the filter tags it, and only `pass-to-farmer` items plus quality scores reach the farmer report.

## Output

When asked to draft a farmer report, return:
- One paragraph, plain language, no jargon.
- Only `pass-to-farmer` items.
- No buyer identities or prices paid.
- A suggestion for who on the field team delivers it, and when.
