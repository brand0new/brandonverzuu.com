# D14: Scoring, test rules, de-duplication

Status: **decided 2026-10-28.**

## Decision

1. **Scores are a rating from 0 to 100 per dimension**, a whole number. There are
   no A–E grades.

   `CheckResult.scores` is `{ dimension, score }[]` (`packages/engine-api`). The
   rating is `100 − weight × Σ penalty(severity)`, rounded and clamped to 0–100.
   The weights and penalties stay in the private packs.
2. **No fake rule packs**, in the rules Worker or in any deployment. The fixture
   pack, its golden cases and the `PACK_SET=fixture` switch are removed from
   `brand0new/expertise`.
   - Staging serves the real packs.
   - Engine unit tests define the few rules they need inline in the test file.
     These are test doubles, never registered with the Worker or bundled.
   - Canary strings for the leak guard (spec 06) are planted in the real packs.
3. **Findings stay de-duplicated:** one finding per rule and location.

## Consequences

- **Anti-extraction.** A 0–100 rating reveals more than a grade. A single probe can
  show the size of one penalty. Accepted. Spec 05 rounds ratings to the nearest
  10 for throttled accounts, and the probing detection is unchanged.
- **Evals (spec 08).** Without a fixture pack, the extraction evals run against
  the real packs on staging, so the harness moves into the private repo, where the
  ground truth is.
- **Gateway.** The MCP tool output schema and `PublicResult` switch from `band` to
  `score` (PR #130).
