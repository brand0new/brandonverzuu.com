# 10: Thin public skills (`products/skills`)

## Scope

The skills buyers' agents load. They're the storefront and the instructions for
using the checks, and they contain no IP (decision D1).

## Skills

| Skill | Tells the agent |
| --- | --- |
| `api-governance-check` | When an API spec should be checked; how to bundle `$ref`s; how to call the check (MCP tool or CLI); how to present findings and prioritise fixes |
| `skill-design-check` | When to check a skill; how to package the folder; how to read findings by file and line |
| `process-review` | How to turn a prose or diagram process description into the public process schema, asking the user for missing roles, controls or SLAs instead of inventing them; how to call the review; how to present findings |
| `expert-account` | How to check the balance, quote prices to the user, and buy credits (ACP checkout or the purchase link), always with the user's explicit approval before spending |

## Thinness rules

A public skill may contain:

- input preparation steps and formats (all public),
- the tool or command names, their arguments and prices,
- how to present results (ordering by severity, grouping by dimension),
- consent rules for spending credits.

A public skill must not contain:

- what the checks look for, examples of findings beyond generic placeholders,
  thresholds, scoring dimensions' weights, or Brandon's methodology,
- anything copied from the private rule packs.

A CI test greps `products/skills/` for the private canary strings (spec 04) and
fails on a match. Brandon approves each skill's text before release.

## Distribution

- **Over MCP:** the gateway implements the MCP Skills extension
  (`io.modelcontextprotocol/skills`, SEP-2640), serving these skills as resources
  through `skills/list`. Check the extension's status when implementing; sources
  disagreed on whether it was final as of October 2026. If it isn't supported by
  a client, the same text is reachable through a free `get_skill` tool.
- **From the repo:** installable as plain Agent Skills folders (Claude Code, Codex
  and other harnesses that read `SKILL.md`).
- **On the site:** `/expert` links to them.

## Acceptance

- Each skill passes the product's own `skill-design` check (dogfooding).
- An agent with only the skill and an account completes each check end to end
  against staging, including asking the user before buying credits.
- `skills/list` over MCP returns exactly the four skills.
