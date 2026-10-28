# packages

Shared libraries for the workspaces in `apps/`. Planned (see
`docs/specs/expert-mcp/README.md`):

- `acp`: Agentic Commerce Protocol `2026-04-17` types and validators
- `engine-api`: the RPC contract between the gateway and the rules Worker
- `check-kit`: generic, non-IP check primitives and the public schemas

Each one becomes a workspace once it has a `package.json`.
