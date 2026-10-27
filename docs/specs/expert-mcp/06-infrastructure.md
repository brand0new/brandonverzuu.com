# 06: Infrastructure and deployment

## Scope

Every Cloudflare resource, how it's created, how both Workers reach production,
and the repo-level guards. Updates `docs/deployment.md` and `AGENTS.md`.

## Resources

| Resource | Staging / production |
| --- | --- |
| Gateway Worker (public repo) | `expert-mcp-staging` / `expert-mcp` |
| Rules Worker (private repo) | `expert-rules-staging` / `expert-rules`, `workers_dev = false`, no routes |
| Service binding | `RULES` on each gateway env → the matching rules Worker |
| Custom domain | `mcp-staging.brandonverzuu.com` / `mcp.brandonverzuu.com` |
| D1 | `expert-commerce-staging` / `expert-commerce` |
| KV | `expert-flags-staging` / `expert-flags` |
| Durable Objects | `McpSession`, `AccountGuard` (migrations in `wrangler.jsonc`) |
| Cron triggers | reservation sweep, probing analysis |
| Gateway secrets | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `EMAIL_HMAC_KEY`, `VARIANT_KEY`, `GUARD_CONFIG` |

No LLM, Vectorize or AI Gateway: the checks are deterministic.

`apps/expert-mcp/wrangler.jsonc` declares bindings with `env.staging` and
`env.production`. Resource ids aren't secret and are committed once created.

## Deploy path

Cloudflare's Git integration is the deploy path for both Workers, as for the site.
Neither repo holds a Cloudflare token (decision D7).

- **Gateway:** Workers Builds on this repo, root `apps/expert-mcp`, watch paths
  `apps/expert-mcp/**` and `packages/**`. Non-`master` branches → preview versions
  on staging; `master` → production. D1 migrations applied in the deploy command,
  staging first.
- **Rules:** Workers Builds on `brand0new/expert-rules`, its own `main` →
  production, other branches → staging. Deploying rules doesn't redeploy the
  gateway, and the other way round.
- **Order on first deploy:** rules Worker first, since a service binding to a
  missing Worker fails the gateway deploy.

## Provisioning (one-time)

Creating resources and setting non-personal secrets needs a scoped API token
(Workers Scripts, D1, KV, Workers Routes: edit, this account only), provided as a
session secret and never committed. The steps go in a new skill,
`skills/expert-mcp-provision/SKILL.md`. Secrets only Brandon should hold (Stripe
live keys) he sets himself with `wrangler secret put`.

## CI

- This repo: `.github/workflows/build.yml` gets an `expert` job on changes under
  `apps/expert-mcp/**`, `apps/cli/**`, `packages/**`, `products/**`: typecheck,
  vitest, `wrangler deploy --dry-run`, `npm pack` of the CLI, and the canary scan
  below. Once stable, Brandon makes it a required check next to `generate`.
- Private repo: its own workflow with the rule harness and golden tests.

### IP leak guard (this repo)

Fails the build if:

- the gateway bundle, the CLI tarball or `products/skills/` contains any private
  canary string (provided to CI as a secret, planted in the private packs),
- gitleaks (or equivalent) finds a secret,
- a path matches a denylist (`rules/`, `packs/`, `*.rules.ts`) outside test fixtures.

## Acceptance

- `mcp-staging.brandonverzuu.com/healthz` returns 200 from a staging deploy.
- The rules Worker has no reachable URL (spec 08 checks this).
- MCP Inspector and the CLI each complete a test-mode purchase and one check
  against staging.
- `docs/deployment.md` documents both Workers (pieces, dashboard settings,
  rollback through Workers versions). `AGENTS.md` describes the new deployables,
  scopes static-first to the site, and lists the new skill.

## Out of scope

Live Stripe keys and real rule packs: Brandon's steps after review.
