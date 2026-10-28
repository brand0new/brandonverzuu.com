# 01: ACP package (`packages/acp`)

Status: implemented in PR #128.

## Scope

A typed, validated implementation of the ACP `2026-04-17` data model for the
checkout API and the MCP binding. No business logic.

## Source of truth

The JSON Schemas and OpenRPC document from
`agentic-commerce-protocol/agentic-commerce-protocol` at tag/commit for
`spec/2026-04-17/` (Apache-2.0). Vendored under `packages/acp/spec/2026-04-17/` with
the upstream `LICENSE` and `NOTICE`, and the commit SHA recorded in a `SOURCE` file.

## Deliverables

- `npm run build -w packages/acp` generates TypeScript types and zod schemas from
  the vendored JSON Schemas (e.g. `json-schema-to-zod` or a small generator in
  `packages/acp/scripts/`). Generated files are committed so the Worker build
  doesn't need the generator.
- Exports:
  - `CheckoutSession`, `CheckoutSessionWithOrder`, `CheckoutSessionCreateRequest`,
    `CheckoutSessionUpdateRequest`, `CheckoutSessionCompleteRequest`,
    `CancelSessionRequest`, `Error`, `LineItem`, `Total`, `FulfillmentOption`,
    `PaymentHandler`, and the delegated-payment types.
  - `mcpTools`: the five checkout tool definitions (`create_checkout_session`,
    `get_checkout_session`, `update_checkout_session`,
    `complete_checkout_session`, `cancel_checkout_session`) with `$ref`s resolved
    and bundled into plain JSON Schema, as the binding requires.
  - `MetaSchema` for the `meta` argument (api_version required, others optional,
    unknown fields ignored).
  - `acpError(type, code, message, param?)` → JSON-RPC error with code `-32000`
    and the ACP `Error` in `data`; `-32602` helper for envelope errors.
  - `discoveryDocument(config)` → the `/.well-known/acp.json` body with
    `transports: ["mcp"]` and `protocol.supported_versions: ["2026-04-17"]`.
- Fixtures: the upstream `examples/2026-04-17` JSON files, used in tests.

## Acceptance

- Every upstream example for the checkout and delegate-payment APIs parses with
  the matching schema; every upstream error example produces the expected
  JSON-RPC error shape.
- Tool schemas contain no unresolved `$ref`.
- Unit tests run with `npm test -w packages/acp` (vitest).

## Out of scope

Persistence, Stripe, the MCP transport.
