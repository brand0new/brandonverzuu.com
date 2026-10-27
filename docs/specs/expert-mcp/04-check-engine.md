# 04: Check engine and private rules Worker

## Scope

The deterministic engine that runs Brandon's checks, split between public,
generic code in this repo and private IP in `brand0new/expert-rules`.

## Split

| Public (this repo) | Private (`expert-rules`) |
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
// expert-rules/packs/api-governance/naming.ts (illustrative shape, not content)
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

- Input: a process document matching a **public** schema
  (`packages/check-kit/schemas/process.schema.json`, decision D4): process
  metadata, roles, steps (actor, input, output, system, trigger), decisions,
  handoffs, controls, exceptions, SLAs and KPIs. YAML or JSON.
- The schema is public on purpose: it tells buyers' agents how to convert a prose
  description, and its structure isn't the IP. The judgment about it is.
- BPMN 2.0 XML import is a later addition (mapped to the same schema in `check-kit`).
- Location: step or element id.

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
