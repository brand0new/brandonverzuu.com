# 08: Extraction red-team and evals

## Scope

An automated suite that attacks staging the way a rule reconstructor would. It runs
before every production deploy of guard or rules changes, and weekly.

## Test rule pack

Runs against a **fixture rule pack** (fake rules written for the test, in the
private repo's `test/` folder) on staging, so reconstruction can be scored exactly
without exposing real rules to the eval harness.

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
| Rules of the fixture pack reconstructed (condition and threshold) before the campaign is throttled | below the share set in `GUARD_CONFIG` |
| Credits needed to reconstruct that share | above the cost set in `GUARD_CONFIG` |
| Sybil campaigns linked and throttled together (shared signal present) | 100% |
| Rules Worker reachable from the internet | never |
| False positives: a benign CI history (same API, 200 commits over 30 days) and a benign multi-team org | none throttled |

## Deliverables

- `apps/expert-mcp/evals/`: harness (TypeScript) that runs against a URL with
  test-mode credits granted by the admin CLI.
- Per-run Markdown report uploaded as a CI artifact, never committed.

## Acceptance

All thresholds hold on staging before the first production deploy of paid checks.
