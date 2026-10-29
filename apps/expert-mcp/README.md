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

| Path                        | What                                                        |
| --------------------------- | ----------------------------------------------------------- |
| `src/index.ts`              | Routes, OAuth provider wiring, device-flow hook on `/token` |
| `src/pipeline.ts`           | `runPaidCheck`, the one paid-check pipeline                 |
| `src/pricing.ts`            | D6 prices, operation count, VAT                             |
| `src/payments/`             | PaymentGate (x402 + MPP), transports, binding, VAT, webhook |
| `src/statements.ts`         | Monthly statements and CSV export                           |
| `src/artifact.ts`           | Input schemas, limits and hardened parsing                  |
| `src/mcp/`                  | `McpSession` (Durable Object), tools, Skills extension      |
| `src/auth/`                 | Magic-link sign-in, consent, device flow, email senders     |
| `src/rest.ts`               | `/v1/*`                                                     |
| `src/types.ts`              | Gateway interfaces; re-exports `@brandonverzuu/engine-api`  |
| `migrations/`               | D1 `commerce`: accounts, tokens, sign-in, payments          |
| `scripts/bundle-skills.mjs` | Bundles `products/skills` into `src/generated/skills.ts`    |

## Secrets and payment config

Secrets (`wrangler secret put <NAME> --env <env>`, listed under `secrets.required`
in `wrangler.jsonc`): `EMAIL_HMAC_KEY`, `VARIANT_KEY`, `PAYMENT_HMAC_KEY`,
`X402_FACILITATOR_KEY` (CDP API key secret), `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `GUARD_CONFIG`. Development falls back to fixed
dev-only HMAC keys and runs without the rest.

Vars: `X402_NETWORK` (`base-sepolia` on staging, `base` in production),
`X402_PAY_TO` (receiving address; the zero-address placeholder means x402 isn't
offered), `X402_FACILITATOR_URL`, `X402_FACILITATOR_KEY_ID`,
`MPP_STRIPE_NETWORK_ID` (Stripe profile id; empty means MPP isn't offered) and,
in development only, `PAYMENT_GATE` (`stub` or `live`). Never commit keys or a
wallet private key; local live testing reads them from `.dev.vars`.
