# Expert MCP: specification

Status: **draft.** Specs 00–04 and 07–10 are unblocked; payments go live and
spec 06 deploys once the "Later" decisions below are made.
Nothing here is implemented yet. Once the decisions are made, each sub-spec in this
folder is handed to one agent and implemented on its own branch and PR.

## Goal

Sell Brandon's knowledge, experience and skills as paid, agent-callable checks. A
buyer's agent (or a CI pipeline) sends an artifact, pays for that one check
over a micropayment rail (x402 or MPP, decision D13), and gets back the findings Brandon would give an employer
or client.

Three products, all deterministic:

| Product | Buyer sends | Buyer gets |
| --- | --- | --- |
| **API governance check** | OpenAPI 3.0/3.1 document | Findings (severity, JSONPath, issue, fix), governance score per dimension |
| **Skill design check** | An Agent Skill folder (`SKILL.md` plus files) | Findings on structure, triggering, scope, progressive disclosure and safety, plus a score |
| **Process description review** | A process in a published structured format (spec 04) | Findings on roles, handoffs, controls, exceptions and measurability, plus a score |

The non-negotiable constraint: the knowledge itself is Brandon's intellectual
property and must not be extractable or distillable through the service.

## Decisions taken

- **No LLM on Brandon's side.** Answers come from deterministic rule packs and
  scoring models, not generated text. Any language work (for example turning a
  prose process description into the structured format) is done by the buyer's
  own agent, guided by the public skill.
- **Public skills stay thin.** Skills served over MCP and published in the repo
  tell an agent *when* to use a check, *how* to prepare the input and *how* to read
  the result. They never contain the rules, thresholds, weights or methodology.
  Brandon confirmed this trade-off.
- **One API, three ways in:** MCP (with the Skills extension), a CLI, and REST for CI.
  All three call the same server-side checks.

## Where the IP lives

Anything that runs on the buyer's side or enters the buyer's model context is
disclosed. So the rule of this design is: **the IP only ever executes on
Cloudflare, in code that isn't in this public repo.**

```
PUBLIC  brand0new/brandonverzuu.com (this repo, monorepo)
  apps/site            static site, incl. /expert pages
  apps/expert-mcp      gateway Worker: MCP, REST, OAuth, x402/MPP payments, guard
  apps/cli             thin CLI client
  packages/engine-api  the RPC contract between gateway and rules Worker (types only)
  packages/check-kit   generic, non-IP check primitives (parsers, JSONPath, AST walkers)
  products/skills      the thin public skills

PRIVATE brand0new/expertise (separate private repo)
  rule packs           declarative rules: what is checked, severities, messages, fixes
  scoring models       dimensions, weights, bands
  bespoke checks       any check logic that is itself IP
  → deployed as Worker "expert-rules": no public route, reachable only through a
    service binding from the gateway
```

Why a separate private Worker and not encrypted files in R2: the rules include
executable logic, and Workers can't safely run code loaded at runtime. A private
repo deployed by Cloudflare's Git integration keeps the code out of public view,
keeps it under version control, and lets Brandon edit rules like any other code.

What leaves the rules Worker: findings and score *bands* for one artifact. What
never leaves: rule definitions, the full rule list, conditions, thresholds,
weights, raw scores and anything not triggered by the buyer's artifact.

## What "prevent distillation" still means

Moving to deterministic rules removes prompt and corpus leakage completely. The
remaining risk is **black-box rule reconstruction**: submitting many crafted
artifacts to map which inputs trigger which findings. The finding messages also
state the standard being applied. That's the product, and it's accepted. Controls
(spec 05):

1. **Nothing raw leaves**: enforced by architecture, as above.
2. **Probing is uneconomic**: priced per artifact, with quotas and spend ceilings
   per linked identity.
3. **Probing is detectable**: near-duplicate artifacts, synthetic minimal
   artifacts, and accounts that systematically trigger an unusual share of the rule
   pack are throttled, then frozen.
4. **Results are coarse where precision would leak the model**: score bands, not
   raw scores; findings don't expose thresholds; no "explain this rule" endpoint.
5. **Leaks are attributable and actionable**: per-account phrasing variants in
   messages, and terms that forbid reconstruction, training and resale.

## Architecture

```
 buyer's agent ──MCP + OAuth──┐        developer / CI ──CLI or REST + token──┐
                              ▼                                              ▼
 mcp.brandonverzuu.com ── Worker "expert-mcp" (public repo)
   ├─ /mcp                      MCP: check tools, account tools,
   │                            Skills extension (thin public skills as resources)
   ├─ /v1/*                     REST: same checks and account operations
   ├─ /.well-known/oauth-*      OAuth metadata
   ├─ /webhooks/stripe
   ├─ DO McpSession, DO AccountGuard, D1 commerce, KV flags
   └─ service binding ──► Worker "expert-rules" (private repo, no route)
                              rule packs, scoring, bespoke checks

 brandonverzuu.com ── Cloudflare Pages (static, unchanged)
   └─ /expert, /expert/pricing, /expert/terms, /expert/privacy
```

### Commerce model

- **Pay per check, micropayment rails only** (decision D13). No checkout, credit
  packs or balance.
- An unpaid request gets a 402 with two challenges:
  - **x402**: EURC or USDC on Base, through a facilitator.
  - **MPP**: Stripe's Machine Payments Protocol, for fiat.
- The gateway verifies the payment, runs the check, and only then settles. A
  check that fails on our side is never paid.
- Prices per check in EUR excluding VAT (D6): skill design 5, API governance 10
  (+5 per 50 operations over 50), process review 15.
- Every payer (wallet or Stripe customer) is bound to an OAuth account, so the
  anti-extraction controls keep an identity per payer (spec 03, 05).

## Monorepo layout

npm workspaces (the repo already uses npm, lockfile v3, Node from `.node-version`).

```
apps/site/            the Nuxt site, moved as-is, including its scripts/
apps/expert-mcp/      gateway Worker
apps/cli/             CLI
packages/engine-api/
packages/check-kit/
products/skills/      thin public skills (served over MCP, installable from the repo)
skills/  docs/  wrangler.toml   stay at the root
```

`skills/` (repo procedures for agents working on this repo) and `products/skills/`
(skills sold to buyers) are deliberately separate.

## Sub-specs and order

| # | Spec | Depends on | Parallel with |
| --- | --- | --- | --- |
| 00 | [Monorepo migration](00-monorepo.md) | — | — |
| 01 | ~~[ACP package](01-acp-package.md)~~ superseded by D13, not built | — | — |
| 02 | [Gateway: MCP, REST, auth, accounts](02-mcp-server.md) | 00 | 04, 07 |
| 03 | [Payments: x402 and MPP](03-commerce.md) | 02 | 04, 05 |
| 04 | [Check engine and private rules Worker](04-check-engine.md) | 00 | 02, 03 |
| 05 | [Anti-extraction controls](05-anti-extraction.md) | 02, 04 (interfaces) | 03 |
| 06 | [Infrastructure and deployment](06-infrastructure.md) | 00, then each of 02–05 | all |
| 07 | [Public pages and terms](07-site-pages.md) | 00 | 02–05 |
| 08 | [Extraction red-team and evals](08-evals.md) | 04, 05 | — |
| 09 | [CLI](09-cli.md) | 02 (REST) | 03–05 |
| 10 | [Thin public skills](10-public-skills.md) | 04 (input formats) | 03, 05, 09 |

Each sub-spec has scope, interfaces it owns, acceptance criteria and what's out of
scope. An agent implementing a sub-spec changes only what that spec owns. Shared
interfaces are fixed here and in `packages/engine-api`, and change only through a PR
to the spec.

## Shared interfaces

```ts
// packages/engine-api: the only contract the public code has with the rules
type CheckKind = 'api-governance' | 'skill-design' | 'process-review'

interface CheckRequest {
  kind: CheckKind
  artifact: Artifact            // parsed and size-checked by the gateway
  options: { locale?: string }   // profiles are a later option
  variantSeed: string           // per-account HMAC, for phrasing variants (spec 05)
}

interface Finding {
  id: string                    // opaque per response, not a stable rule id
  severity: 'error' | 'warning' | 'info'
  location: string              // JSONPath / file:line / step id in the buyer's artifact
  message: string
  fix: string
  dimension: string             // e.g. "naming", "security", "handoffs"
}

interface CheckResult {
  findings: Finding[]
  scores: { dimension: string; band: 'A' | 'B' | 'C' | 'D' | 'E' }[]
  rulePackVersion: string       // opaque label, e.g. "2026.10"
  telemetry: { triggered: string[] }   // stable rule ids: for the guard only, stripped before responding
}

// rules Worker entrypoint (WorkerEntrypoint RPC over the service binding)
interface RulesService { run(req: CheckRequest): Promise<CheckResult> }

// apps/expert-mcp (spec 02)
interface ToolContext { account: Account; requestId: string; payments: PaymentGate; guard: Guard; env: Env }

// spec 03
interface PaymentGate {
  quote(kind: CheckKind, artifact: Artifact): Promise<Price>                 // EUR minor units, VAT applied per account
  challenge(ctx: { account: Account; price: Price; resource: string }): PaymentChallenge  // the 402 body: x402 requirements + MPP challenge
  verify(ctx: { account: Account; price: Price; payment: PaymentProof }): Promise<Authorization> // throws payer_not_bound, wrong_amount, reused
  settle(a: Authorization): Promise<void>
  void(a: Authorization, reason: string): Promise<void>                     // nothing collected; refund on MPP if capture can't be deferred
}

interface Guard {
  admit(ctx: { accountId: string; kind: CheckKind; artifact: Artifact }): Promise<Admission>
  shape(ctx: { accountId: string; result: CheckResult }): Promise<PublicResult> // strips telemetry, coarsens if throttled
  record(ctx: { accountId: string; kind: CheckKind; artifactSignature: string; triggered: string[] }): Promise<void>
}
```

Every paid check, over MCP, REST or CLI, goes through one pipeline that spec 02
provides, so no entry point can skip a step:

```
authenticate → validate + parse → payments.quote → guard.admit
  → no payment? 402 with payments.challenge (nothing runs)
  → payments.verify → rules.run → guard.shape → payments.settle → respond → guard.record
                (on any failure after verify: payments.void)
```

## Open decisions (Brandon)

| # | Decision | Recommendation |
| --- | --- | --- |
| D1 | Threat model and thin skills | **Decided:** accepted |
| D2 | Products | **Decided:** API governance (OpenAPI 3.0/3.1 only, no profiles), skill design (Agent Skills format only), process description review |
| D3 | Private repo for rules | **Decided:** `brand0new/expertise` (private). Brandon writes the rules; agents scaffold its structure only. |
| D4 | Process description input format | **Researched:** no JSON Schema standard exists. Our own Process Description schema using BPMN 2.0 vocabulary, plus a governance block, published at a static URL and registered in SchemaStore (spec 04). Brandon reviews v1. |
| D5 | Seller of record: legal entity, Stripe account, VAT | **Later.** Brandon's business entity with Stripe Tax on. Blocks live payments only; everything runs in Stripe test mode until then. |
| D6 | Pricing and currency | **Decided, to reconsider:** per check, EUR excl. VAT: API governance 10 (+5 per 50 operations over 50), skill design 5, process review 15. Direction: Brandon's work as a data set. See [decisions/D6-pricing.md](decisions/D6-pricing.md). |
| D7 | How agents deploy to Cloudflare | **Later.** Workers Builds (Git integration) for both Workers, plus one scoped API token for provisioning, held as a session secret, never in a repo. Blocks spec 06 only. |
| D8 | Move the site into `apps/site` | **Decided:** yes, as its own PR, verified on a preview first |
| D13 | Payment rails | **Decided:** x402 and MPP only, pay per check; no ACP, packs or balance. See [decisions/D13-payment-rails.md](decisions/D13-payment-rails.md). |
| D9 | Hostname and CLI package name | **Decided:** `mcp.brandonverzuu.com`; npm package `@brandonverzuu/expertise` (binary `bv-expertise`) |
| D10 | Free trial | **Decided:** none. Every check is paid. |
| D11 | Data location | **Decided:** EU only (spec 06). |
| D12 | Merging | **Decided:** Brandon always reviews the Cloudflare preview before a PR in this programme merges. Agents open PRs and get them green, but don't merge them. |
