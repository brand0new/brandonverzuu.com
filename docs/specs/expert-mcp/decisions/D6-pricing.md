# D6: Pricing

Status: **decided 2026-10-28, to be reconsidered** (see "When to look again").
Prices are planned, not live. They live as data in
`apps/site/content/expert/pricing.yml` (spec 07). Spec 03 seeds the gateway's
`products` table from the same numbers.

## Decision

**Unit.** 1 credit is about EUR 1 list price. Prices are in EUR and exclude VAT.
A buyer's agent can quote "this check costs EUR 10" without converting anything.

| Pack | Price | Per credit |
| --- | --- | --- |
| 10 credits | EUR 12 | EUR 1.20 |
| 50 credits | EUR 50 | EUR 1.00 |
| 200 credits | EUR 160 | EUR 0.80 |
| Annual team commitment, invoiced | from EUR 2,500 a year | about EUR 0.70, with higher spending limits |

| Check | Credits per artifact |
| --- | --- |
| Skill design | 5 |
| API governance | 10 for up to 50 operations, +5 per further 50 |
| Process description review | 15 |

Terms that go with it, for the terms of service (spec 07, legal scaffold):

- Business customers only, which avoids the consumer withdrawal right for
  digital content. To confirm with the lawyer.
- Credits expire 12 months after purchase. To confirm with the lawyer.
- No refunds on unused credits, apart from the automatic refund when a check
  fails on our side.
- No free tier (D10). Instead, `/expert` shows one public sample report, of a
  public spec such as Petstore. It leaks a handful of findings, which is accepted
  as marketing.

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
- **CI cost:** checking the same API on every commit adds up at 10 credits a run.
  A CI plan follows later, either a monthly subscription per API or discounted
  re-checks of the same API lineage. Spec 05 already tells legitimate CI history
  apart from probing.
- **Thin evidence:** the human-review prices come from individual freelancer
  listings, not consultancy rate cards.

## Direction: micropayments

The longer-term direction is to move from prepaid packs towards paying per use in
small amounts, so an agent pays exactly for what it calls, with no account
balance to manage.

Why not now:

- **Card fees have a floor.** EU card payments cost a percentage plus a fixed fee
  per charge (on Stripe, about EUR 0.25), so charging cards per check below a few
  euros doesn't pay. Credit packs batch many checks into one card payment.
- **The rails are young.** Candidates to track:
  - x402: per-call payments in stablecoins over HTTP.
  - Stripe's machine payments with session-based fiat aggregation, launched
    March 2026 according to one secondary source. To verify.
  - ACP itself, which works per checkout and is too heavy for a single call.

  None is supported widely enough by buyers' agent clients yet.
- **Anti-extraction needs friction.** Per-call payments without accounts
  remove the identity, card linking and spending ceilings that spec 05 relies
  on. Any micropayment design has to keep an identity per payer, such as a
  wallet or payment credential bound to an account, or it gives up the main
  defence against rule reconstruction.

The gateway is already shaped for it: every paid call goes through one pipeline
(`runPaidCheck`) with a price per check, so a per-call payment rail can replace
`ledger.reserve` without touching the checks.

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
4. **Rails.** Micropayments fit this better than checks do. Data access is many
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
- a micropayment rail supported by at least two widely used agent clients,
- a CI plan becoming necessary (more than a third of checks coming from CI
  tokens).

Measure before revisiting:

- the pack mix,
- checks per account per month,
- the CI share of checks,
- refunds and disputes,
- conversion from `/expert` visits to first purchase,
- probing incidents (spec 05),
- average spec size for the API check.
