# 02: MCP server, auth and accounts (`apps/expert-mcp`)

## Scope

The Worker shell: MCP Streamable HTTP transport, OAuth 2.1, accounts, the tool
registry, and the paid-tool pipeline that every expertise tool must go through.

## Stack

- Cloudflare Workers, TypeScript, `wrangler` (already a dev dependency at the root).
- `agents` (Cloudflare Agents SDK) `McpAgent` on a Durable Object (`McpSession`)
  for MCP session state, and `@modelcontextprotocol/sdk` for the server.
- `@cloudflare/workers-oauth-provider` for OAuth 2.1 with dynamic client
  registration and PKCE, as the MCP authorization spec requires.
- D1 database `commerce` for accounts (schema below; spec 03 adds its tables in
  its own migrations).

## Routes

| Route | Purpose |
| --- | --- |
| `POST/GET /mcp` | MCP Streamable HTTP endpoint, bearer token required |
| `/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server` | OAuth metadata |
| `/authorize`, `/token`, `/register` | OAuth flow (provider library) |
| `/.well-known/acp.json` | from `packages/acp` `discoveryDocument` |
| `/healthz` | liveness, no data |

Everything else is 404. No admin routes on the public hostname.

## Accounts and sign-in

The OAuth consent screen identifies a human or an organisation behind the agent.
Sign-in is by email magic link (Cloudflare Email Routing/sending or a transactional
provider; pick one in the PR and justify it). The consent screen also requires
accepting the current terms version (spec 07), recorded on the account.

```sql
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,               -- acct_<ulid>
  email_hash TEXT NOT NULL UNIQUE,   -- HMAC-SHA256(email, secret), raw email kept only for receipts
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  terms_version TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

## Tool registry

- `registerPaidTool({ name, description, inputSchema, credits, run })` wraps `run`
  in the pipeline from the README: authenticate → `guard.admit` →
  `ledger.reserve` → `run` → `guard.screen` → fingerprint → `ledger.commit` →
  respond → `guard.record`, refunding on any failure. A tool can't be registered
  any other way. A test enforces that every registered tool with `credits > 0` went
  through this wrapper.
- Free account tools: `get_balance`, `get_usage`, `get_terms`, `get_purchase_link`
  (the latter delegates to spec 03).
- The ACP checkout tools come from spec 03 and are registered as free tools with
  the ACP argument shape `{ meta, id?, payload? }`.
- **No MCP resources and no prompts are exposed.** Exposing either would make
  internal material listable.
- Tool descriptions state the credit price and the terms URL.

## Hardening that belongs here

- Input size limits per tool (reject before any model call).
- Strict JSON Schema validation of all tool input; unknown properties rejected.
- Request IDs on every call, propagated to logs.
- Logs never include tool output or retrieved corpus text. They may include
  hashes.

## Acceptance

- MCP Inspector can connect, complete OAuth, list tools and call `get_balance`.
- An unauthenticated call to `/mcp` returns 401 with the right
  `WWW-Authenticate` resource metadata pointer.
- `resources/list` and `prompts/list` return empty.
- `wrangler dev` runs the Worker locally with local D1 and DO.
- Vitest with `@cloudflare/vitest-pool-workers` covers the pipeline wrapper,
  including refund on failure.

## Out of scope

Pricing, Stripe, the engine, the guard's internals (use stub implementations of
`Ledger` and `Guard` that specs 03 and 05 replace).
