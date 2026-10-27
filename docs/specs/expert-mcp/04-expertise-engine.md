# 04: Expertise engine and corpus vault

## Scope

How Brandon's knowledge is stored, retrieved and turned into paid work, without
the raw material ever leaving Cloudflare.

## Corpus vault

- **Source:** wherever Brandon keeps it (decision D3). Recommended: Markdown files
  in a **private** repository or a local folder. Never in this repo.
- **Upload:** a CLI in `apps/expert-mcp/cli/corpus.ts`, run by Brandon locally,
  that chunks the Markdown, encrypts each chunk with AES-GCM under a key held only
  as a Worker secret and in Brandon's password manager, uploads ciphertext to the
  private R2 bucket `expert-corpus`, and upserts embeddings to Vectorize
  `expert-corpus-index`. Vectors carry only a chunk id and a topic label, no text.
  The CLI reads the source path from an argument, so the repo doesn't learn where
  the corpus lives.
- The R2 bucket has no public access and no custom domain. Only the Worker binding
  can read it.
- **System prompts, rubrics and tool prompt templates are corpus.** They're
  stored and encrypted the same way and loaded at runtime, not committed as code.
- Corpus versions are immutable sets (`v2026-10-27-1`). The Worker reads the active
  version id from a secret or KV key, so rollback is one change.

## Tools (draft catalogue, decision D2)

Each tool takes the buyer's material, not open questions:

| Tool | Input | Output | Credits (placeholder) |
| --- | --- | --- | --- |
| `review_openapi` | OpenAPI 3.x document (≤ 1 MB), optional context (industry, audience) | Findings: severity, location (JSONPath), issue, recommendation | 5 |
| `assess_api_governance` | Questionnaire answers (structured schema) and optional policy docs | Maturity scores per dimension, gaps, a prioritised roadmap | 10 |
| `advise_integration_architecture` | Structured description of systems, flows, constraints | Recommended patterns, risks, trade-offs, specific to the input | 8 |

Rules for every tool:

- The output schema is structured and specific to the input. No free-form essays.
- The output must reference the buyer's input (paths, systems, answers). A
  generation that doesn't is rejected by `guard.screen` (spec 05).
- No tool returns source text, chunk ids, citations into the corpus, or the
  prompt.

## Synthesis pipeline (`engine.run`)

1. Validate and normalise input; reject oversized or off-topic input (cheap
   classifier, refund).
2. Retrieve top-k chunks from Vectorize, decrypt in memory.
3. Build the prompt from the encrypted template, the retrieved chunks and the
   buyer's input, with clear delimiters and an instruction hierarchy that treats
   buyer input as data.
4. Call the LLM through AI Gateway (decision D4), structured output mode, no
   logging of prompt bodies at the gateway (gateway logging set to metadata only).
5. Return `{ output, retrievedIds }` to the pipeline. `retrievedIds` go to the
   guard, never to the buyer.

## Acceptance

- `corpus upload` and `corpus activate` round-trip on a sample corpus (a few fake
  documents written for testing, stored under `apps/expert-mcp/test/fixtures/`,
  clearly marked as not Brandon's).
- No plaintext corpus in R2 (test reads an object and asserts it isn't valid
  UTF-8 Markdown).
- Each tool returns schema-valid output for fixture inputs.
- The Worker bundle (`wrangler deploy --dry-run --outdir`) contains no fixture
  corpus text.

## Out of scope

Guard internals (spec 05), billing (spec 03).
