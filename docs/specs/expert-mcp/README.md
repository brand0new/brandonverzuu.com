# Expert MCP: specification

Status: **draft, awaiting Brandon's decisions** (see "Open decisions" below).
Nothing here is implemented yet. Once the decisions are made, each sub-spec in this
folder is handed to one agent and implemented on its own branch and PR.

## Goal

Sell Brandon's knowledge, experience and skills as paid, agent-callable checks. A
buyer's agent (or a CI pipeline) sends an artifact, pays through the Agentic
Commerce Protocol (ACP), and gets back the findings Brandon would give an employer
or client.

Three products, all deterministic:

| Product | Buyer sends | Buyer gets |
| --- | --- | --- |
| **API governance check** | OpenAPI 3.x / AsyncAPI document | Findings (severity, JSONPath, issue, fix), governance score per dimension |
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
  apps/expert-mcp      gateway Worker: MCP, REST, OAuth, ACP checkout, ledger, guard
  apps/cli             thin CLI client
  packages/acp         ACP 2026-04-17 types and validators
  packages/engine-api  the RPC contract between gateway and rules Worker (types only)
  packages/check-kit   generic, non-IP check primitives (parsers, JSONPath, AST walkers)
  products/skills      the thin public skills

PRIVATE brand0new/expert-rules (separate private repo, decision D3)
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
   ├─ /mcp                      MCP: check tools, account tools, ACP checkout tools,
   │                            Skills extension (thin public skills as resources)
   ├─ /v1/*                     REST: same checks and account operations
   ├─ /.well-known/acp.json     ACP discovery (transports: ["mcp"])
   ├─ /.well-known/oauth-*      OAuth metadata
   ├─ /webhooks/stripe
   ├─ DO McpSession, DO AccountGuard, D1 commerce, KV flags
   └─ service binding ──► Worker "expert-rules" (private repo, no route)
                              rule packs, scoring, bespoke checks

 brandonverzuu.com ── Cloudflare Pages (static, unchanged)
   └─ /expert, /expert/pricing, /expert/terms, /expert/privacy
```

### Commerce model

- The product is **credits**, sold in packs as ACP line items with `digital`
  fulfilment. Fulfilment means crediting the buyer's ledger.
- Each check costs a fixed number of credits per artifact, charged atomically
  before the check runs and refunded if it fails.
- Stripe is the PSP. ACP's delegated payment flow hands over a Shared Payment Token
  that the gateway charges on `complete_checkout_session`.
- A Stripe Checkout link is the fallback for agents and CLI users without ACP
  payment delegation.
- ACP version pinned to **`2026-04-17`** (latest stable; still labelled beta), with
  its MCP binding.

## Monorepo layout

npm workspaces (the repo already uses npm, lockfile v3, Node from `.node-version`).

```
apps/site/            the Nuxt site, moved as-is
apps/expert-mcp/      gateway Worker
apps/cli/             CLI
packages/acp/
packages/engine-api/
packages/check-kit/
products/skills/      thin public skills (served over MCP, installable from the repo)
scripts/  skills/  docs/   stay at the root
```

`skills/` (repo procedures for agents working on this repo) and `products/skills/`
(skills sold to buyers) are deliberately separate.

## Sub-specs and order

| # | Spec | Depends on | Parallel with |
| --- | --- | --- | --- |
| 00 | [Monorepo migration](00-monorepo.md) | — | — |
| 01 | [ACP package](01-acp-package.md) | 00 | 02, 04, 07, 09, 10 |
| 02 | [Gateway: MCP, REST, auth, accounts](02-mcp-server.md) | 00 | 01, 04, 07 |
| 03 | [Commerce: checkout, payment, ledger](03-commerce.md) | 01, 02 | 04, 05 |
| 04 | [Check engine and private rules Worker](04-check-engine.md) | 00 | 02, 03 |
| 05 | [Anti-extraction controls](05-anti-extraction.md) | 02, 04 (interfaces) | 03 |
| 06 | [Infrastructure and deployment](06-infrastructure.md) | 00, then each of 02–05 | all |
| 07 | [Public pages and terms](07-site-pages.md) | 00 | 01–05 |
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
  options: { profile?: string; locale?: string }
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
interface ToolContext { account: Account; requestId: string; ledger: Ledger; guard: Guard; env: Env }

interface Ledger {
  balance(accountId: string): Promise<number>
  reserve(accountId: string, credits: number, ref: string): Promise<Reservation> // throws InsufficientCredits
  commit(r: Reservation): Promise<void>
  refund(r: Reservation, reason: string): Promise<void>
  grant(accountId: string, credits: number, orderId: string): Promise<void>
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
authenticate → validate + parse → guard.admit → ledger.reserve → rules.run
  → guard.shape → ledger.commit → respond → guard.record
                (on any failure: ledger.refund)
```

## Open decisions (Brandon)

| # | Decision | Recommendation |
| --- | --- | --- |
| D1 | Threat model and thin skills | **Decided:** accepted |
| D2 | Products | **Decided:** API governance, skill design, process description review |
| D3 | Private repo for rules | Create `brand0new/expert-rules` (private). Brandon writes the rules; agents scaffold its structure only. |
| D4 | Process description input format | A published JSON/YAML schema (spec 04), plus BPMN 2.0 XML import later. The buyer's agent converts prose to the schema using the public skill. |
| D5 | Seller of record: legal entity, Stripe account, VAT | Brandon's business entity with Stripe Tax on. Needed before any live payment. |
| D6 | Pricing and currency | EUR, packs of 10/50/200 credits. Brandon sets the amounts and credits per check. |
| D7 | How agents deploy to Cloudflare | Workers Builds (Git integration) for both Workers, plus one scoped API token for provisioning, held as a session secret, never in a repo |
| D8 | Move the site into `apps/site` | Yes, as its own PR, verified on a preview first |
| D9 | Hostname and CLI package name | `mcp.brandonverzuu.com`; npm package `@brandonverzuu/expert`, binary `bv-expert` |
