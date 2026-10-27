# 05: Anti-extraction controls (`Guard`)

## Scope

Implements the `Guard` interface: admission, output screening, usage analysis,
fingerprinting and the kill switch. This spec says *what* is detected. The actual
thresholds, weights and keys are secrets, not code, because this repo is public.

## Admission (`guard.admit`)

Per account, held in the `AccountGuard` Durable Object:

- Rate limits per minute, hour and day, per tool.
- A credit spend ceiling per rolling 24h and 30 days, independent of balance. New
  accounts start low and the ceiling grows with account age and clean history.
- Linked identities (same hashed card fingerprint, same email domain for free-mail
  excluded, same OAuth client) share one budget, which blunts Sybil splitting.
- Status gate: `throttled` accounts get reduced limits, `frozen` accounts get an
  ACP `forbidden` error and nothing runs.
- Prompt-injection pre-screen on input (classifier plus patterns: "ignore previous",
  requests for system prompt, sources, verbatim text, "repeat", encodings).
  Positive → refuse without charge, add to the anomaly score.

## Output screening (`guard.screen`)

Before anything is returned:

- **Verbatim leak check.** n-gram overlap (e.g. 8-gram shingles) between the output
  and the decrypted `retrievedIds` chunks plus the prompt template. Above the
  threshold → regenerate once with a stricter instruction, then block and refund.
- **Canary check.** Prompt templates contain secret canary strings. Any canary in
  the output → block, refund, and add a large anomaly increment.
- **Grounding check.** The output must reference the buyer's input. Generic
  output that would make good training data → regenerate or block.
- **Schema check.** Output must match the tool's output schema exactly.

## Fingerprinting

Each response gets a per-account, per-response fingerprint derived from an HMAC
key: deterministic choices among equivalent phrasings and orderings in the
structured output, plus a response id. A detection tool
(`apps/expert-mcp/cli/trace.ts`, run by Brandon) takes suspected leaked text and
scores it against accounts. This is evidence, not prevention: paraphrasing weakens
it. The spec doesn't claim more.

## Usage analysis (`guard.record` and a cron job)

- Every input is embedded (input only, never output text) and stored with the
  account id and topic label.
- Per account, the job computes **coverage** (share of corpus topic clusters
  touched in a window), **templating** (near-duplicate inputs with small
  variations), **input genericity** (inputs that look synthetic rather than real
  artifacts) and **velocity**.
- These combine into an anomaly score. Crossing level 1 → `throttled`, level 2 →
  `frozen` and an email to Brandon with a summary. Unfreezing is a manual action
  through the admin CLI.

## Kill switch and admin

- A global `EXPERT_TOOLS_ENABLED` flag (KV) disables every paid tool instantly while
  checkout and balance keep working.
- Admin actions (freeze, unfreeze, refund, view anomaly report) only via
  `apps/expert-mcp/cli/admin.ts` using `wrangler d1 execute` and DO RPC with
  Brandon's own credentials. There are no admin HTTP routes.

## Data retention

- Inputs: kept 90 days for abuse analysis (stated in the terms), then only the
  embedding and hashes.
- Outputs: only a hash and the fingerprint record, so a leaked output can be matched.

## Acceptance

- Unit tests for each screen with synthetic corpora.
- The red-team suite in spec 08 passes its thresholds.
- Thresholds and keys are read from secrets; a test asserts no default threshold
  values are hard-coded beyond fail-closed fallbacks (missing config → deny).

## Out of scope

Legal enforcement (terms are spec 07).
