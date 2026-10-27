# 09: CLI (`apps/cli`)

## Scope

A thin client for humans, coding agents and CI. It holds no rules and computes
nothing beyond input packaging and output formatting.

## Package

- npm `@brandonverzuu/expertise`, binary `bv-expertise` (decision D9). Node from
  `.node-version`; also bundled as a single file for `npx`.
- Published from this repo by a tagged release workflow, with npm provenance.

## Commands

```
bv-expertise login                         OAuth device flow against the gateway; token in the OS keychain
bv-expertise logout
bv-expertise credits                       balance and recent usage
bv-expertise buy [--pack <id>]             opens a Stripe Checkout link
bv-expertise check api <file>              api-governance check   [--profile public|internal|partner]
bv-expertise check skill <dir>             skill-design check (packages text files into a manifest)
bv-expertise review process <file>         process-review check (validates against the public schema first)
bv-expertise schema process                prints the public process schema
```

Common flags: `--format text|json|sarif|markdown`, `--fail-on error|warning`
(non-zero exit code for CI), `--dry-run` (validate and show the price, no charge).

## Behaviour

- Validates input locally with `check-kit` parsers and the public schema before
  sending, so malformed input never costs credits.
- Shows the credit price and asks for confirmation unless `--yes` or a non-TTY.
- `CI=true` or `BV_EXPERTISE_TOKEN` set → non-interactive, token from the
  environment (an account-scoped API token created with `bv-expertise token create`,
  which the gateway issues as a long-lived, revocable credential tied to the
  account's guard budget).
- SARIF output maps findings to `results` with locations, so GitHub code scanning
  shows them on PRs.
- Sends an install id (random, stored locally) for linked-identity budgets
  (spec 05). Documented in the privacy page.

## Gateway dependency

Uses the REST surface from spec 02:

| Command | Endpoint |
| --- | --- |
| login | OAuth device authorization grant (`/device_authorization`, `/token`) |
| credits | `GET /v1/account` |
| buy | `POST /v1/purchase-links` |
| check / review | `POST /v1/checks/{kind}` with `Idempotency-Key` |

## Acceptance

- Each command works against `wrangler dev`.
- `bv-expertise check api` on a public example spec produces text, JSON and SARIF that
  validate (SARIF 2.1.0 schema).
- `--dry-run` never charges (ledger unchanged).
- The published package contains no rule content (CI checks the packed tarball for
  the private canary strings from spec 04).

## Out of scope

A GitHub Action wrapper (follow-up once the CLI is stable).
