# 04: Check engine and private rules Worker

## Scope

The deterministic engine that runs Brandon's checks, split between public,
generic code in this repo and private IP in `brand0new/expertise`.

## Split

| Public (this repo) | Private (`brand0new/expertise`) |
| --- | --- |
| `packages/engine-api`: request/result types, `RulesService` interface | Rule packs per check kind |
| `packages/check-kit`: parsers (OpenAPI/AsyncAPI with `$ref` resolution, Markdown + frontmatter AST, process schema), JSONPath, generic predicates (exists, pattern, casing, length, enum, schema) | Which predicates apply where, with what options, severity, dimension, message and fix text |
| Gateway: input size limits, parsing, validation | Scoring models: dimension weights, band cut-offs |
| | Bespoke check functions that are IP in themselves |
| | Phrasing variants per message (spec 05) |

Test for the split: if a piece of code would tell a reader *what Brandon checks
for* or *how he weighs it*, it belongs in the private repo. Generic machinery that
any linter has belongs in `check-kit`.

## Rule format (private repo)

Declarative, typed, version-controlled:

```ts
// expertise/packs/api-governance/naming.ts (illustrative shape, not content)
export default rule({
  id: 'agv-…',                 // stable, private
  dimension: 'naming',
  severity: 'warning',
  given: '$.paths[*]~',
  check: kit.casing({ type: '…' }),   // or a bespoke function from ./functions
  message: v('…', '…'),        // phrasing variants
  fix: v('…'),
})
```

Agents scaffold this structure, the pack loader, the scoring runner and a test
harness. **Brandon writes the rules.** An agent never invents rule content, just as
agents never supply review ratings.

## The three check kinds

### API governance (`api-governance`)

- Input: OpenAPI 3.0/3.1 or AsyncAPI 2.6/3.0, JSON or YAML, ≤ 2 MB after
  `$ref` resolution (external refs rejected; the buyer bundles first).
- Options: `profile` (e.g. `public`, `internal`, `partner`), which picks a subset
  and severity overrides in the private pack.
- Location: JSONPath into the submitted document.

### Skill design (`skill-design`)

- Input: a skill folder as a JSON manifest of files (`{ path, content }[]`, text
  only, ≤ 1 MB total, ≤ 200 files), or a tarball the gateway unpacks.
- Parsed into: frontmatter, Markdown AST of `SKILL.md`, file tree, referenced paths,
  scripts (inspected as text, **never executed**).
- Location: `file:line`.

### Process description review (`process-review`)

- Input: a document in the **Process Description** format (below), YAML or JSON,
  ≤ 1 MB. BPMN 2.0 XML is accepted too and converted to the same model by
  `check-kit` (later milestone).
- Location: element id.

#### Why a new schema, and how it stays standard

Research (October 2026) found no standard JSON Schema for describing business
processes:

- **BPMN 2.0.2 (OMG, ISO/IEC 19510)** is the standard, but its normative
  serialisation is XML (XSD and CMOF metamodels). The bpmn.io maintainers confirm
  there's no standard JSON form; any JSON mapping is custom.
- **SchemaStore** (the de facto JSON Schema registry) lists no BPMN or
  business-process schema. What it has is workflow *execution* formats:
  Serverless Workflow (CNCF sandbox), Arazzo (OpenAPI Initiative, API call
  sequences), Argo, GitHub Actions, Google Cloud Workflows, CWL. They model
  automated tasks, not human roles, accountability, controls or SLAs.
- **schema.org `HowTo`** is JSON-LD markup for instructions, too thin for roles,
  decisions and controls.
- **NIST OSCAL** has JSON Schemas for control catalogues. It's a good reference
  for controls, but it doesn't describe processes.

So the format is ours, built to be as close to a standard as possible:

1. **BPMN vocabulary.** Every element maps to a BPMN 2.0 concept: `process`,
   `participants` / `lanes` (roles), `tasks` (with BPMN task types: user,
   service, manual, script, send, receive), `events` (start, end, intermediate,
   boundary, with BPMN trigger types), `gateways` (exclusive, parallel,
   inclusive, event-based), `flows` (sequence) and `messages` (message flows =
   handoffs between participants), `dataObjects`. Ids are BPMN-compatible, so a
   BPMN XML export and import is a mapping, not a translation.
2. **Extensions BPMN lacks, in a separate `governance` block:** RACI per task
   (exactly one accountable), controls (with optional OSCAL control-id
   references), exceptions and their handling, SLAs and KPIs, systems of record,
   evidence produced, document owner and review cadence.
3. **Published as JSON Schema 2020-12** at a stable, static URL on the site:
   `https://brandonverzuu.com/schemas/process-description/v1.json` (served from
   `apps/site/public/`, so it fits the static-first rule). The source lives in
   `packages/check-kit/schemas/process-description.schema.json` and the site
   build copies it.
4. **Registered in SchemaStore** with the file pattern `*.process.yaml` /
   `*.process.json`, so editors validate files without our tooling.
5. **Versioned by URL** (`v1`, `v2`), never changed in place.

The schema is public on purpose. It tells buyers' agents how to convert a prose
description, and its structure isn't the IP. The judgment applied to it is.

Agents draft the schema; Brandon reviews it before v1 is published, because it
fixes what buyers have to supply.

## Rules Worker

- `WorkerEntrypoint` class exposing `run(req: CheckRequest): Promise<CheckResult>`
  over RPC. No `fetch` handler that does anything except return 404.
- `workers_dev = false`, no routes, no custom domain. Reachable only through the
  gateway's service binding.
- Deterministic: same artifact, pack version and variant seed give the same
  result. Pure function of its input: no network, no storage.
- Pack version label returned on every result; the gateway shows it so buyers can
  tell when results change.

## Acceptance

- Public side: `check-kit` parsers have tests on real-world fixtures (public
  OpenAPI examples, this repo's own `skills/`, a sample process file).
- Private side: harness with golden-file tests per rule; a test fails if a rule
  lacks message, fix, dimension or severity.
- Gateway → rules round trip works in `wrangler dev` with both Workers running
  locally (`wrangler dev -c gateway -c rules`).
- `wrangler deploy --dry-run` output of the gateway contains no rule content (CI
  greps the bundle for a set of private canary strings planted in the pack).

## Out of scope

Payment, admission and shaping (specs 03 and 05).
