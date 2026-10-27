# 07: Public pages and terms (`apps/site`)

## Scope

Static pages on brandonverzuu.com that humans and agents read before buying. They
follow the site's conventions (static, both themes, AA contrast, `skills/new-component`
for any new component).

## Pages

- `/expert`: what the service is, the three checks (what you give it, what you get,
  credit price), the three ways in (MCP URL with OAuth, `bv-expert` CLI, REST for
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

## Who writes what

The terms and privacy text are legal documents. An agent can draft structure and
headings with `TODO(Brandon)` markers, but Brandon (ideally with a lawyer) supplies
and approves the wording. Like reviews, these are Brandon's words, not an agent's.
The PR stays a draft until he has.

## Acceptance

- `npm run generate` includes the four routes; sitemap includes them.
- Terms version id matches the one the MCP server requires (`TERMS_VERSION` var).

## Out of scope

Any runtime call from the site to the Worker.
