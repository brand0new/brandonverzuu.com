# 07: Public pages and terms (`apps/site`)

Status: **draft PR, unpublished.** The navbar has an Expertise entry
(`mage:file-check-fill`) at Brandon's request, so the section is reachable while
it says "coming soon". `/expert`, `/expert/pricing`, `/expert/terms`
and `/expert/privacy` exist, with placeholder prices and draft legal text that
isn't rendered. TODO: the `/schemas/process-description/v1.json` route, once
`packages/check-kit` has the schema (spec 04).

## Scope

Static pages on brandonverzuu.com that humans and agents read before buying. They
follow the site's conventions (static, both themes, AA contrast, `skills/new-component`
for any new component).

## Pages

- `/expert`: what the service is, the three checks (what you give it, what you get,
  credit price), the three ways in (MCP URL with OAuth, `bv-expertise` CLI, REST for
  CI), links to the public skills and the process schema, and how purchasing works
  (ACP or purchase link).
- `/expert/pricing`: credit packs and prices. Data from a content file
  (`content/expert/pricing.yml`) so prices aren't hard-coded in a component.
- `/expert/terms`: terms of service, versioned (`content/expert/terms/<version>.md`).
  Must include: outputs licensed for the buyer's internal use; **no use of outputs
  to train, fine-tune, evaluate or distil models, or to reconstruct the checks'
  rules**; no automated harvesting beyond the buyer's own artifacts; no resale; retention periods from spec 05; suspension on
  breach; governing law.
- `/expert/privacy`: what's stored and for how long.
- `/schemas/process-description/v1.json`: the public Process Description schema
  (spec 04), copied from `packages/check-kit` at build time and served as a static
  file with `Content-Type: application/schema+json` (via `public/_headers`).

## Who writes what

Scaffolds already exist in `docs/specs/expert-mcp/legal/` (`terms.md`,
`privacy.md`). This spec moves the approved versions into `content/expert/`.

The terms and privacy text are legal documents. An agent can draft structure and
headings with `TODO(Brandon)` markers, but Brandon (ideally with a lawyer) supplies
and approves the wording. Like reviews, these are Brandon's words, not an agent's.
The PR stays a draft until he has.

## Acceptance

- `npm run generate` includes the four routes; sitemap includes them.
- Terms version id matches the one the MCP server requires (`TERMS_VERSION` var).

## Out of scope

Any runtime call from the site to the Worker.
