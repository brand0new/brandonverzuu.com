# Expert MCP: specification

Status: **draft, awaiting Brandon's decisions** (see "Open decisions" below).
Nothing here is implemented yet. Once the decisions are made, each sub-spec in this
folder is handed to one agent and implemented on its own branch and PR.

## Goal

Sell Brandon's knowledge, experience and skills (API governance, platform and
integration architecture, AI/trust) as a paid, agent-callable service. A buyer's agent
connects to a remote MCP server, pays through the Agentic Commerce Protocol (ACP),
and gets the kind of work Brandon delivers to employers and clients: reviews,
assessments and advice applied to the buyer's own situation.

The non-negotiable constraint: the knowledge itself is Brandon's intellectual
property and must not be extractable or distillable through the service.

## What "prevent distillation" can and can't mean

Brandon asked for this "at all cost", so the spec has to be honest about it first.

Every useful answer leaks some of the knowledge it came from. A buyer who pays for
enough answers and trains a model on them gets a weaker copy of the expertise. No
technique stops that completely, and no design here claims to. What the design can
do, and what every sub-spec is measured against:

1. **Nothing raw ever leaves.** The corpus, the prompts, the retrieval results and
   the rubrics are never returned, quoted or downloadable. This *can* be enforced
   absolutely, and it is.
2. **Answers are worth little outside the buyer's context.** The service does work
   on the buyer's artifacts (an OpenAPI file, an architecture description, a
   governance policy) instead of answering open-ended "teach me" questions. A review
   of someone's API is a poor training example for "how Brandon thinks". This is the
   strongest lever against distillation, and it shapes the product catalogue.
3. **Extraction is uneconomic.** Price, quotas and per-identity budgets make a
   systematic sweep cost more than the expertise is worth to a copier.
4. **Extraction is detectable.** Usage is analysed for sweeping behaviour (coverage
   of the knowledge space, templated probing, prompt-injection attempts). Suspicious
   accounts are throttled, then frozen for review.
5. **Leaks are attributable and actionable.** Outputs carry per-account
   fingerprints. The terms forbid training on outputs, and a breach ends access and
   gives Brandon evidence.

The decision Brandon has to make (D1) is whether he accepts this framing, because it
rules out a general "ask Brandon anything" chat tool. That tool is the easiest one to
distil.

### Public repo, private knowledge

This repository is **public**. So:

- The corpus, system prompts, rubrics, tool prompt templates, detection thresholds
  and fingerprinting keys **never** enter this repo, its history, its build output
  or the Worker bundle. They live in private Cloudflare storage and Worker secrets
  (spec 04).
- The code in this repo has to be safe to publish. Security comes from secrets
  and server-side enforcement, not from obscurity (Kerckhoffs). An attacker who
  reads every line here still can't get the knowledge out.
- CI gets a guard (spec 06) that fails the build if anything resembling corpus
  material or a secret is committed.

## Architecture

```
 buyer's agent (ChatGPT, Claude, custom)
        │  MCP Streamable HTTP + OAuth 2.1
        ▼
 mcp.brandonverzuu.com ── Cloudflare Worker "expert-mcp"
        │
        ├─ /.well-known/acp.json            ACP discovery (transports: ["mcp"])
        ├─ /.well-known/oauth-*             OAuth metadata (MCP auth spec)
        ├─ /mcp                             MCP endpoint
        │     ├─ ACP checkout tools ×5      buy credit packs        (spec 03)
        │     ├─ account tools              balance, usage, terms   (spec 02)
        │     └─ expertise tools            paid work               (spec 04)
        ├─ /webhooks/stripe                 payment events          (spec 03)
        │
        ├─ Durable Object  McpSession       per-connection MCP state
        ├─ Durable Object  AccountGuard     per-account budgets, rate, anomaly score (spec 05)
        ├─ D1              commerce         accounts, sessions, orders, credit ledger
        ├─ R2  (private)   corpus           encrypted source knowledge
        ├─ Vectorize       corpus-index     embeddings for retrieval
        ├─ AI Gateway  →   LLM provider     synthesis, zero data retention
        └─ Secrets         Stripe, LLM, corpus key, fingerprint key, thresholds

 brandonverzuu.com ── Cloudflare Pages (unchanged, static)
        └─ /expert, /expert/terms, /expert/pricing   human-readable pages (spec 07)
```

The static-first rule in `AGENTS.md` applies to the **site**. The MCP server is a
separate deployable with its own runtime, and the site never depends on it at
request time.

### Commerce model

- The product is **credits**, sold in packs as ACP line items with `digital`
  fulfilment. Fulfilment means crediting the buyer's ledger.
- Expertise tools cost a fixed number of credits per call, quoted in the tool
  description and charged atomically before the work starts. Failures refund.
- Payment goes through Stripe as the PSP. ACP's delegated payment flow hands over a
  Shared Payment Token (SPT) that the server charges on `complete_checkout_session`.
- Fallback for agents without ACP payment delegation: `get_purchase_link` returns a
  Stripe Checkout URL for a human to approve. Same ledger, same packs.
- ACP version pinned to **`2026-04-17`** (latest stable; the spec is still labelled
  beta). The MCP binding is `docs/mcp-binding.md` in the
  `agentic-commerce-protocol/agentic-commerce-protocol` repo.

## Monorepo layout

npm workspaces (the repo already uses npm, lockfile v3, Node from `.node-version`).

```
apps/
  site/            the Nuxt site, moved as-is (content/, app/, public/, nuxt.config.ts …)
  expert-mcp/      the Cloudflare Worker
packages/
  acp/             ACP 2026-04-17 types + zod validators, generated from the pinned JSON Schemas
  config/          shared tsconfig / prettier
scripts/           stays at the root (covers, scrub, explainers); paths updated
skills/            stays at the root
docs/              stays at the root
```

Moving the site changes the Cloudflare Pages build (root directory or build
command plus output path) in the dashboard. That's a production-affecting change,
so spec 00 is its own PR and is verified on a preview deployment before merge.

## Sub-specs and order

| # | Spec | Depends on | Parallel with |
| --- | --- | --- | --- |
| 00 | [Monorepo migration](00-monorepo.md) | — | — |
| 01 | [ACP package](01-acp-package.md) | 00 | 02, 04, 07 |
| 02 | [MCP server, auth, accounts](02-mcp-server.md) | 00 | 01, 04, 07 |
| 03 | [Commerce: checkout, payment, ledger](03-commerce.md) | 01, 02 | 04, 05 |
| 04 | [Expertise engine and corpus vault](04-expertise-engine.md) | 02 | 03, 05 |
| 05 | [Anti-extraction controls](05-anti-extraction.md) | 02, 04 (interfaces) | 03 |
| 06 | [Infrastructure and deployment](06-infrastructure.md) | 00, then each of 02–05 | all |
| 07 | [Public pages and terms](07-site-pages.md) | 00 | 01–05 |
| 08 | [Extraction red-team and evals](08-evals.md) | 04, 05 | — |

Each sub-spec has the same sections: scope, interfaces it owns, acceptance criteria
and what's out of scope. An agent implementing a sub-spec changes only what that
spec owns. Shared interfaces are fixed in this README and in spec 02's
`ToolContext`, and can only change through a PR to the spec.

## Shared interfaces (contract between sub-specs)

```ts
// apps/expert-mcp/src/types.ts (owned by spec 02)
interface Account { id: string; createdAt: string; status: 'active' | 'throttled' | 'frozen'; termsVersion: string }

interface ToolContext {
  account: Account
  requestId: string
  ledger: Ledger            // spec 03
  guard: Guard              // spec 05
  env: Env
}

interface Ledger {
  balance(accountId: string): Promise<number>
  /** Atomically reserves credits; throws InsufficientCredits. */
  reserve(accountId: string, credits: number, ref: string): Promise<Reservation>
  commit(r: Reservation): Promise<void>
  refund(r: Reservation, reason: string): Promise<void>
  grant(accountId: string, credits: number, orderId: string): Promise<void>
}

interface Guard {
  /** Called before any paid work. Can deny, throttle or allow. */
  admit(ctx: { accountId: string; tool: string; input: unknown }): Promise<Admission>
  /** Called on every model output before it's returned. Can redact or block. */
  screen(ctx: { accountId: string; tool: string; output: string; retrievedIds: string[] }): Promise<ScreenResult>
  /** Called after the response is sent. */
  record(ctx: { accountId: string; tool: string; inputEmbedding: number[]; outcome: string }): Promise<void>
}
```

Every paid tool follows one pipeline, and spec 02 provides it as a helper so no tool
can skip a step:

```
authenticate → guard.admit → ledger.reserve → engine.run → guard.screen
  → fingerprint → ledger.commit → respond → guard.record
                (on any failure: ledger.refund)
```

## Open decisions (Brandon)

These block implementation. The spec carries a recommendation for each.

| # | Decision | Recommendation |
| --- | --- | --- |
| D1 | Accept the threat model above, which means no open-ended Q&A tool | Accept. Ship artifact-shaped tools only. |
| D2 | The tool catalogue: which services, at what credit price | Start with three: `review_openapi`, `assess_api_governance`, `advise_integration_architecture` (spec 04 has drafts) |
| D3 | Where the knowledge lives today, in what form | Markdown in a **private** repo or local folder, uploaded by a CLI (spec 04). Never this repo. |
| D4 | LLM provider for synthesis | Anthropic API through Cloudflare AI Gateway, on terms with no training on inputs or outputs |
| D5 | Seller of record: legal entity, Stripe account, VAT | Brandon's business entity with Stripe Tax on. Needed before any live payment. |
| D6 | Pricing and currency | EUR, packs of 10/50/200 credits. Brandon sets the amounts. |
| D7 | How agents deploy to Cloudflare | Workers Builds (Cloudflare's Git integration) for deploys, like Pages today, plus one scoped API token for provisioning, held as a session secret and never in the repo |
| D8 | Move the site into `apps/site` | Yes, as its own PR, verified on a preview first |
| D9 | Hostname | `mcp.brandonverzuu.com` |
