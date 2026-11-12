# 05: Anti-extraction controls (`Guard`)

## Scope

Implements the `Guard` interface: admission, result shaping, probing detection,
fingerprinting and the kill switch. This spec says *what* is detected. The actual
thresholds, weights and keys are secrets, not code, because this repo is public.

The threat is **black-box reconstruction of the rule packs**: an attacker submits
crafted artifacts and maps inputs to findings. Prompt and corpus leakage don't apply,
because there's no LLM and no corpus on the server.

## Admission (`guard.admit`)

Per account, held in the `AccountGuard` Durable Object:

- Rate limits per minute, hour and day, per check kind.
- No free trial: every check is paid per request, so probing always costs
  money (decisions D10, D13).
- Spending ceilings in EUR per rolling 24 hours and 30 days. New
  accounts start low; the ceiling grows with account age and clean history.
- Linked identities share one budget: same bound wallet or hashed card fingerprint
  (spec 03), same OAuth client, same non-free-mail email domain, same CLI install
  id. Payments only count from payers bound to an account, so fresh wallets add
  no identities.
- Status gate: `throttled` → reduced limits and coarser results; `frozen` → a
  `forbidden` error, nothing runs, nothing charged.
- **Near-duplicate gate:** the gateway computes a structural signature of each
  artifact (normalised AST hash plus a MinHash of its paths and keys). An artifact
  very close to recent submissions from the same identity costs the full price again
  and adds to the anomaly score. Small diffs are the signature of a probe.

## Result shaping (`guard.shape`)

- Strip `telemetry` before anything leaves.
- Ratings are whole numbers 0–100 per dimension (D14). For `throttled` accounts
  they're rounded to the nearest 10, so small probes can't read single-penalty
  differences.
- Finding ids are random per response, so findings can't be joined across
  responses by id.
- Findings are capped per dimension when the account is `throttled`, sorted by
  severity.
- No endpoint lists rules, explains a rule, or returns what *didn't* trigger.

## Probing detection (`guard.record` and a cron job)

Stored per check: account, kind, artifact signature, triggered rule ids, time.
Nothing of the artifact content beyond the signature.

Signals per linked identity:

- **Rule coverage:** share of the pack's rules triggered over a window. Real
  users trigger a stable, small subset; a reconstructor tries to trigger all of them.
- **Probe shape:** chains of near-duplicate artifacts; minimal artifacts (few
  operations, few steps) that look built for one rule.
- **Synthetic-ness:** artifacts with placeholder names, generated patterns, or
  no realistic structure.
- **Velocity** and time-of-day regularity (scripted use).

These feed an anomaly score. Level 1 → `throttled`, level 2 → `frozen` and an
email to Brandon. Unfreezing is manual through the admin CLI.

CI use is legitimate and repetitive (the same API checked on every commit). The
near-duplicate rules treat *the same artifact evolving over time from one CI
identity* as benign, and *many variants in a short window* as probing. Spec 08
measures false positives on exactly this.

## Fingerprinting

Message and fix texts have phrasing variants in the private pack. The variant is
picked by `variantSeed` (HMAC of account id and finding position). A leaked report
or a reconstructed rule set can be traced back to likely accounts with
`apps/expert-mcp/cli/trace.ts`. This is evidence, not prevention.

## Kill switch and admin

- `CHECKS_ENABLED` flag in KV disables all paid checks instantly; account,
  prices and statements keep working.
- Admin actions (freeze, unfreeze, refund, anomaly report) only through
  `apps/expert-mcp/cli/admin.ts` with Brandon's own Cloudflare credentials. No admin
  HTTP routes.

## Data retention

- Artifacts aren't stored. Only structural signatures and triggered rule ids, kept
  for 180 days (stated in the terms).
- Results: a hash and the variant seed, so a leaked report can be matched.

## Acceptance

- Unit tests per signal with synthetic histories.
- Spec 08's red-team suite passes its thresholds.
- Thresholds and keys read from secrets; missing config fails closed (deny).
