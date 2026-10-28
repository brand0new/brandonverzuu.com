# @brandonverzuu/check-kit

Generic, non-IP machinery for the expertise checks (spec
`docs/specs/expert-mcp/04-check-engine.md`). The gateway uses it to validate, parse
and sign artifacts; the private rules Worker uses it to read them. Nothing here
says what is checked or how it's weighed: that lives in `brand0new/expertise`.

| Module                    | What it does                                                                                                                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parseOpenApi`            | OpenAPI 3.0/3.1, JSON or YAML. Resolves internal `$ref`s (shared, cycle-safe, size-bounded), rejects external refs, maps every resolved node back to its JSONPath in the source, gives source lines.                                                                |
| `parseSkill`              | Agent Skills manifest (`{ path, content }[]`, ≤ 1 MB, ≤ 200 files, text only, no path traversal) → frontmatter with key lines, Markdown AST of `SKILL.md` with file line numbers, file tree, headings and referenced paths. Scripts are read as text and never run. |
| `parseProcessDescription` | Process Description YAML/JSON → schema validation, referential integrity, in-memory model (nodes, flows, lanes, RACI by task …).                                                                                                                                    |
| `query`, `formatPath`     | An eval-free JSONPath subset (`$`, `.a`, `['a']`, `[0]`, `*`, unions, `..`, trailing `~` for keys).                                                                                                                                                                 |
| predicates                | `exists`, `pattern`, `casing`, `length`, `enumeration`, `schema`, plus `not` / `all` / `any`.                                                                                                                                                                       |
| `structuralSignature`     | Normalised shape hash plus a MinHash of key paths, for the near-duplicate gate (spec 05).                                                                                                                                                                           |

Every parser throws `CheckKitError` (with a `code` and `issues`) when an artifact
can't be accepted: too large, too deep, YAML alias bombs, unknown tags, duplicate
keys, external refs and so on. Limits are in `src/limits.ts`.

## Process Description schema

`schemas/process-description.schema.json` is a JSON Schema 2020-12 draft with
`$id` `https://brandonverzuu.com/schemas/process-description/v1.json`. It uses BPMN
2.0 vocabulary for the process and a separate `governance` block for what BPMN
lacks. **It is a draft pending Brandon's review** and isn't published or registered
in SchemaStore yet. `examples/*.process.yaml` are two illustrative processes.

## Tests

```
npm test -w packages/check-kit
```

Fixtures: public OpenAPI examples from the OpenAPI Initiative (CC BY 4.0, see
`test/fixtures/openapi/README.md`), this repo's own `skills/` folders, and the
process examples.
