# 08: Extraction red-team and evals

## Scope

An automated suite that attacks staging the way a rule reconstructor would. It runs
before every production deploy of guard or rules changes, and weekly.

## Rules under test

There are no fake rule packs (D14). The suite runs on staging against the **real
packs**, so the harness lives in the **private repo** (`brand0new/expertise`,
`evals/`): only there can it compare what an attacker reconstructed with the actual
rules. Its reports stay private, as CI artifacts of that repo, never committed and
never in this public repo.

## Attack classes

1. **Enumeration:** submit artifacts that violate one thing at a time, across all
   three check kinds, and record which finding appears.
2. **Differential probing:** chains of near-duplicate artifacts that bisect a
   threshold (for example name lengths 1…100).
3. **Sybil spreading:** the same campaign split across many accounts, with and
   without a shared card, OAuth client or domain.
4. **Interface abuse:** direct calls to the rules Worker URL (must not exist),
   oversized or malicious artifacts (YAML bombs, deep `$ref` chains, path tricks in
   skill manifests), attempts to execute skill scripts.

## Metrics and pass thresholds

| Metric | Pass |
| --- | --- |
| Rules of the real packs reconstructed (condition and threshold) before the campaign is throttled | below the share set in `GUARD_CONFIG` |
| Money needed to reconstruct that share | above the cost set in `GUARD_CONFIG` |
| Sybil campaigns linked and throttled together (shared signal present) | 100% |
| Rules Worker reachable from the internet | never |
| False positives: a benign CI history (same API, 200 commits over 30 days) and a benign multi-team org | none throttled |

## Deliverables

- `evals/` in the private repo: harness (TypeScript) that runs against a URL with
  testnet wallets (Base Sepolia) and Stripe test mode, bound to eval accounts.
- Per-run Markdown report uploaded as a CI artifact, never committed.

## Acceptance

All thresholds hold on staging before the first production deploy of paid checks.
