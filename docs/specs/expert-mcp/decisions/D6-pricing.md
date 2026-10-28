# D6: Pricing

Status: **decided 2026-10-28, revised the same day by D13, to be reconsidered**
(see "When to look again").
Prices are planned, not live. They live as data in
`apps/site/content/expert/pricing.yml` (spec 07). Spec 03 seeds the gateway's
`prices` table from the same numbers.

## Decision

Revised the same day by D13: payment is per check over micropayment rails (x402,
MPP), so there are no credit packs and no annual plan. Prices are in EUR and
exclude VAT.

| Check | Price per artifact |
| --- | --- |
| Skill design | EUR 5 |
| API governance | EUR 10 for up to 50 operations, +EUR 5 per further 50 |
| Process description review | EUR 15 |

Terms that go with it, for the terms of service (spec 07, legal scaffold):

- Business customers only, which avoids the consumer withdrawal right for
  digital content. To confirm with the lawyer.
- A check is paid when it runs and isn't collected if it fails on our side
  (verify-then-settle, spec 03). There's no balance, so nothing to expire or
  refund.
- No free tier (D10). Instead, `/expert` shows one public sample report, of a
  public spec such as Petstore. It leaks a handful of findings, which is accepted
  as marketing.

The first version of this decision used credits (1 credit about EUR 1) in packs
of 10/50/200 at EUR 12/50/160, plus an annual plan from EUR 2,500. The per-check
prices above are the same numbers without the pack discount.

## Why these numbers

Market reference points, researched 2026-10-28:

| Comparable | Price | Reading |
| --- | --- | --- |
| Generic OpenAPI linting | Free (42Crunch IDE), about USD 0.25 per report (an Apify OpenAPI audit) | A commodity, so we don't price against it |
| Paid MCP tools | Typically USD 0.001–0.10 per call; credit packs common (Ref: USD 9 for 1,000) | Data lookups, not judgment. This is the anchor buyers' agents bring |
| AI code review | About USD 1–1.50 per run (Cursor Bugbot), USD 1 per review over quota (Greptile), USD 24–30 per seat (CodeRabbit) | The market accepts about USD 1 per automated judgment, and is moving from seats to usage |
| Human API design review | USD 200–1,000 per API (freelancers), API audits USD 400–1,000 per API, packages from USD 2,000 | The ceiling. Automated output sits well below it |
| Senior IT architect, Netherlands | About EUR 116/h (2025), EUR 850–1,300 per day | One check should cost minutes of Brandon's time, not hours |

The checks sit near AI code review, about ten times commodity linting and about a
fortieth of a human review.

**Pricing as anti-extraction (spec 05).** Reconstructing a rule pack of about
150 rules takes roughly 5–20 probes per rule to bisect thresholds: 750–3,000
checks, so EUR 7,500–30,000. Spending ceilings then force several identities,
each with its own card, which links them. The rule set should cost more to steal
than to use.

## Known risks

- **Low anchor:** MCP buyers expect cents per call. EUR 10 only works if the tool
  descriptions and `/expert` say plainly that this is expert review, not a lookup,
  with the sample report as evidence.
- **CI cost:** checking the same API on every commit adds up at EUR 10 a run.
  A CI plan follows later, either a monthly subscription per API or discounted
  re-checks of the same API lineage. Spec 05 already tells legitimate CI history
  apart from probing.
- **Thin evidence:** the human-review prices come from individual freelancer
  listings, not consultancy rate cards.

## Micropayments: decided in D13

The first version of this record treated micropayments as a later direction,
mainly because card fees have a floor per charge. D13 settles it the other way:
x402 settles in stablecoins for fractions of a cent, and MPP covers fiat, so the
service charges per check from the start. The concerns raised here (identity per
payer for anti-extraction, young rails) are answered in D13 and spec 03.

## Direction: the work as a data set

Brandon's aim is for his collective work and its traces to become a data set that
holds value in its own right and can be exchanged through micropayments. This is
recorded as a direction, not a decision, with the constraints any design must
meet:

1. **Whose data it is.** Brandon's own material (his rules, reviews, decisions,
   annotated examples and how they changed over time) is his to sell. Buyers'
   material isn't:
   - their artifacts are never stored (spec 05), and
   - the signatures and triggered-rule records kept for abuse prevention are
     held under legitimate interest for that purpose only.

   Reusing them for a data set needs a separate legal basis: explicit opt-in in
   the terms, and aggregation or anonymisation (GDPR purpose limitation). No
   buyer data goes into a data set without that.
2. **It changes the threat model.** A data set is training material by nature.
   Selling one means part of the IP is protected by its price and licence rather
   than by secrecy. The safer first products are derived and aggregated, for
   example benchmarks such as "how common governance issue X is across N APIs,
   by industry". Raw rules or a reconstructable rule set stay out.
3. **Provenance.** Each sold slice is signed and versioned, with a per-buyer
   fingerprint (as in spec 05), so a resold copy can be traced.
4. **Rails.** The same x402/MPP rails as the checks (D13). Data access is many
   small reads, and an agent paying per record or per query is the natural model.

No-regret preparation, starting now:

- Keep rule ids stable and versioned in the private repo.
- Keep Brandon's own review notes and decisions in the private repo, with dates,
  so the history becomes part of the asset.
- Store guard telemetry (spec 05) in a schema that supports aggregation by
  dimension and industry, without any artifact content.
- Leave a `TODO(Brandon)` in the terms for an opt-in clause on aggregated
  statistics.

## When to look again

Revisit D6 at whichever comes first:

- 90 days after paid checks go live,
- 50 paying accounts,
- a CI discount becoming necessary (more than a third of checks coming from CI
  tokens).

Measure before revisiting:

- the split between x402 and MPP payments,
- checks per account per month,
- the CI share of checks,
- refunds and disputes,
- conversion from `/expert` visits to first purchase,
- probing incidents (spec 05),
- average spec size for the API check.
