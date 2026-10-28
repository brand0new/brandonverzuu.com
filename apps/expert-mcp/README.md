# expert-mcp

The gateway Worker for the paid expertise checks: MCP, REST, OAuth and accounts.
Spec: `docs/specs/expert-mcp/02-mcp-server.md`. Checks are paid per artifact over
x402 or MPP (decision D13, spec 03).

It holds no rules. Those live in the private `brand0new/expertise` repo and run
in a separate Worker behind the `RULES` service binding.

## Run it

From the repo root (Node from `.node-version`):

```sh
npm ci
npm run typecheck -w apps/expert-mcp   # bundles products/skills, generates Worker types, runs tsc
npm test -w apps/expert-mcp            # bundler tests (Node) + vitest in workerd
npx -w apps/expert-mcp wrangler d1 migrations apply COMMERCE --local
npm run dev -w apps/expert-mcp         # http://localhost:8787
```

In development the PaymentGate, Guard and RulesService are in-memory stubs
(`src/stubs.ts`): a paid check without a payment answers 402 with placeholder
x402 requirements, the stub accepts any x402-shaped payload for the right amount
(`stubPayment` in `src/stubs.ts`) and collects nothing, and every check returns
one fake finding labelled `STUB FINDING`. Magic links are printed to the console.
Staging and production never use the stubs; whatever isn't built yet answers
`not_configured`.

## Layout

| Path                        | What                                                           |
| --------------------------- | -------------------------------------------------------------- |
| `src/index.ts`              | Routes, OAuth provider wiring, device-flow hook on `/token`    |
| `src/pipeline.ts`           | `runPaidCheck`, the one paid-check pipeline                    |
| `src/pricing.ts`            | D6 prices, operation count, VAT                                |
| `src/payments/`             | Where x402 and MPP travel over HTTP and MCP                    |
| `src/artifact.ts`           | Input schemas, limits and hardened parsing                     |
| `src/mcp/`                  | `McpSession` (Durable Object), tools, Skills extension         |
| `src/auth/`                 | Magic-link sign-in, consent, device flow, email senders        |
| `src/rest.ts`               | `/v1/*`                                                        |
| `src/types.ts`              | Shared interfaces (move to `packages/engine-api` with spec 04) |
| `migrations/`               | D1 `commerce`: accounts, API tokens, sign-in state             |
| `scripts/bundle-skills.mjs` | Bundles `products/skills` into `src/generated/skills.ts`       |

## Secrets

`EMAIL_HMAC_KEY` and `VARIANT_KEY` (`wrangler secret put`, per environment).
Development falls back to fixed dev-only keys.
