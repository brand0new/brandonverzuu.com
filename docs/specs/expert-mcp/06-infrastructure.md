# 06: Infrastructure and deployment

## Scope

Every Cloudflare resource, how it's created, how the Worker reaches production,
and the repo-level guards. Updates `docs/deployment.md` and `AGENTS.md`.

## Resources

| Resource | Name (staging / production) |
| --- | --- |
| Worker | `expert-mcp-staging` / `expert-mcp` |
| Custom domain | `mcp-staging.brandonverzuu.com` / `mcp.brandonverzuu.com` |
| D1 | `expert-commerce-staging` / `expert-commerce` |
| R2 (private) | `expert-corpus-staging` / `expert-corpus` |
| Vectorize | `expert-corpus-index-staging` / `expert-corpus-index` (dimensions match the embedding model) |
| KV | `expert-flags-staging` / `expert-flags` |
| Durable Objects | `McpSession`, `AccountGuard` (migrations in `wrangler.jsonc`) |
| AI Gateway | `expert-mcp` (metadata-only logging, rate limit as a backstop) |
| Cron trigger | reservation sweep, usage analysis |
| Secrets | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `LLM_API_KEY`, `CORPUS_KEY`, `FINGERPRINT_KEY`, `EMAIL_HMAC_KEY`, `GUARD_CONFIG` (JSON thresholds), `CANARIES` |

`apps/expert-mcp/wrangler.jsonc` declares all bindings with `env.staging` and
`env.production`. Resource ids are not secret and are committed once created.

## Deploy path

Same principle as the site: Cloudflare's Git integration is the deploy path, and
the repo holds no Cloudflare token (decision D7).

- **Workers Builds** connected to this repo, root directory `apps/expert-mcp`:
  - non-`master` branches → `wrangler versions upload --env staging` (preview
    versions on staging),
  - `master` → `wrangler deploy --env production`.
- Watch paths limited to `apps/expert-mcp/**` and `packages/**`, so site-only
  changes don't redeploy the Worker and vice versa.
- D1 migrations: `wrangler d1 migrations apply` as part of the Workers Builds
  deploy command, staging first.

## Provisioning (one-time)

Creating resources and setting secrets needs Cloudflare credentials. An agent does
it with a scoped API token (Workers Scripts, D1, R2, Vectorize, KV, Workers Routes,
AI Gateway: edit, on this account only), provided as a session secret and never
committed. Steps live in a new skill, `skills/expert-mcp-provision/SKILL.md`, so any
agent can repeat them. Secrets whose values only Brandon has (Stripe live keys,
`CORPUS_KEY`) are set by Brandon with `wrangler secret put`, never pasted into chat
or an issue.

## CI

`.github/workflows/build.yml` gains a second job, `expert-mcp`, on changes under
`apps/expert-mcp/**` or `packages/**`: typecheck, vitest (workers pool), and
`wrangler deploy --dry-run`. Once it's stable, Brandon adds it as a required check
next to `generate`.

### Corpus and secret guard

A CI step (in both jobs) fails if:

- any file under `apps/expert-mcp/` other than `test/fixtures/` contains long
  Markdown prose blocks outside code comments,
- gitleaks (or equivalent) finds a secret,
- any file matches a denylist of corpus-like paths (`corpus/`, `knowledge/`,
  `*.corpus.md`).

## Acceptance

- `mcp-staging.brandonverzuu.com/healthz` returns 200 from a staging deploy.
- MCP Inspector completes OAuth and a test-mode checkout against staging.
- `docs/deployment.md` has a section for the Worker matching the Pages one (pieces,
  dashboard settings, rollback through Workers versions).
- `AGENTS.md` describes the second deployable and the relaxed static-first rule
  (site only), and lists the new skill.

## Out of scope

Live Stripe keys and the production corpus: Brandon's step after review.
