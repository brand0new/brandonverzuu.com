# 02: Gateway: MCP, REST, auth and accounts (`apps/expert-mcp`)

Status: **implemented** in `apps/expert-mcp` (PR pending review). ACP checkout tools and `/.well-known/acp.json` wait for specs 01 and 03.

## Scope

The public gateway Worker: MCP Streamable HTTP, a REST surface for the CLI and CI,
OAuth 2.1, accounts, the tool registry, and the paid-check pipeline that every
entry point must go through. The gateway holds no rules: it calls the private
rules Worker over a service binding (spec 04).

## Stack

- Cloudflare Workers, TypeScript, `wrangler`.
- `agents` (Cloudflare Agents SDK) `McpAgent` on a Durable Object (`McpSession`),
  and `@modelcontextprotocol/sdk` for the server.
- `@cloudflare/workers-oauth-provider` for OAuth 2.1: authorization code with PKCE
  and dynamic client registration (MCP clients), plus the device authorization
  grant (CLI).
- D1 `commerce` for accounts and API tokens (spec 03 adds its tables), created
  with the EU jurisdiction (decision D11).
- Service binding `RULES` → `expert-rules` (`RulesService` from
  `packages/engine-api`).

## Routes

| Route | Purpose |
| --- | --- |
| `POST/GET /mcp` | MCP endpoint, bearer token required |
| `POST /v1/checks/{kind}` | Run a check (REST), `Idempotency-Key` required |
| `GET /v1/account`, `GET /v1/prices`, `POST /v1/wallets`, `DELETE /v1/wallets/{id}`, `GET /v1/statements`, `POST /v1/tokens`, `DELETE /v1/tokens/{id}` | Account operations (payments ones from spec 03) |
| `/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server` | OAuth metadata |
| `/authorize`, `/token`, `/register`, `/device_authorization`, `/device` | OAuth flows |
| `/webhooks/stripe` | spec 03 |
| `/healthz` | liveness, no data |

Everything else is 404. No admin routes on the public hostname.

## Accounts and sign-in

Sign-in is by email magic link on the consent screen (pick a sending provider in
the PR and justify it). Consent requires accepting the current terms version
(spec 07), recorded on the account.

```sql
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,               -- acct_<ulid>
  email_hash TEXT NOT NULL UNIQUE,   -- HMAC-SHA256(email, EMAIL_HMAC_KEY)
  email TEXT NOT NULL,               -- receipts only
  status TEXT NOT NULL DEFAULT 'active',
  terms_version TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE api_tokens (
  id TEXT PRIMARY KEY, account_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
  label TEXT, created_at TEXT NOT NULL, last_used_at TEXT, revoked_at TEXT
);
```

## MCP surface

- **Paid check tools:** `check_api_governance`, `check_skill_design`,
  `review_process`. Input: the artifact (inline text or a file manifest) and
  options. Output: the shaped `PublicResult` (spec 05) as structured content.
  Descriptions state the price in EUR and link the terms. Without a payment they
  return the 402 payment requirements from spec 03 (x402 MCP transport).
- **Free tools:** `get_account`, `get_prices`, `quote_check`, `bind_wallet`,
  `get_terms`, `get_process_schema`, `get_skill` (fallback for clients without
  the Skills extension).
- **Skills extension:** the thin public skills from spec 10, as resources through
  `skills/list`. These are the **only** resources. No prompts are exposed.

## Pipeline

`runPaidCheck(ctx, kind, artifact, options)` implements the pipeline from the
README: authenticate → validate + parse (`check-kit`) → `payments.quote` →
`guard.admit` → 402 challenge when unpaid → `payments.verify` → `RULES.run` →
`guard.shape` → `payments.settle` → respond → `guard.record`, voiding the
payment on any failure after verify. MCP tools and REST handlers both call it;
a test asserts every paid entry point does.

## Hardening

- Input limits per kind (spec 04) enforced before parsing; parsers protected against
  YAML bombs, deep nesting and `$ref` cycles.
- Strict input schema validation; unknown properties rejected.
- Request ids on every call. Logs never contain artifacts or results, only hashes,
  sizes and timings.

## Acceptance

- MCP Inspector connects, completes OAuth, lists tools and skills, and calls
  `get_account`.
- The CLI device flow completes against `wrangler dev`.
- An unauthenticated `/mcp` call returns 401 with the resource metadata pointer.
- `resources/list` returns only the public skills; `prompts/list` is empty.
- Vitest with `@cloudflare/vitest-pool-workers` covers the pipeline, including
  void on failure, using stub `PaymentGate`, `Guard` and `RulesService`.

## Out of scope

Payment rails (03), rules (04), guard internals (05).
