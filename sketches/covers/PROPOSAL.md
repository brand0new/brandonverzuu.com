# Article cover art — visual identity proposal

## The requirement

- Every article card needs an `image` (currently a stock photo, when set at all).
- Where a diagram helps explain the article, render it as ASCII art baked into the generated image.
- A repeatable "personal brand" system: same generator produces new covers and can regenerate the 5 existing ones.
- Keep the existing fonts: Cabinet Grotesk (headings), Satoshi (body), Telma (accents/labels).

## Why generated, not stock

The current covers (`public/articles/*/cover.jpg`) are unrelated stock photography — people in coworking spaces, nothing about the article's content or Brandon's identity. They don't scale (new article = new photo hunt) and they don't say anything. A generated system:

- Uses information already in the frontmatter (title, tags, date) — zero extra authoring work.
- Is consistent — every card looks like it belongs to the same site.
- Can special-case an ASCII diagram when the article actually has a structural idea worth drawing (a pipeline, a hierarchy, a flow) — most won't, and that's fine, the system degrades gracefully to title + tag treatment.
- Regenerates instantly if the brand changes later — one script, not a photo shoot.

## Three directions (mockups in `sketches/covers/`)

All three keep the exact same typography (Cabinet Grotesk 800 for the headline, Satoshi 500 for byline, Telma 500 for kickers/tags) and use only colors already defined in `public/css/main.css` (`midnight`, `madang`, `porcelain`) — nothing invented.

### A — Terminal ledger
Dark, near-black background with a faint blue circuit-style grid, ASCII diagrams rendered in terminal green in the top-right corner when present. Closest in spirit to the existing dark article-card overlay treatment already in `ArticleCard.vue`.

### B — Editorial blueprint
Light background, dashed-border "diagram panel," corner registration ticks like a technical drawing / blueprint sheet. ASCII diagram sits in its own boxed panel rather than floating. More print/editorial, less "tech dashboard."

### C — Signal gradient
Dark radial gradient whose color is driven by the article's primary tag (governance → blue, crypto → green, api → teal, matching the three defined palettes). A small glyph badge (initials/symbol) in the top-left doubles as a repeatable "icon set" per topic. ASCII diagram appears as a lighter accent strip, subordinate to the gradient rather than the headline visual.

Each file has two or three example cards — one with an ASCII diagram inset, others without, so you can judge how it holds up on the common case (no diagram).

## My take

**Variant C is the strongest candidate for "personal brand."** A has real texture but risks looking like every other dark dev-blog template. B is distinctive and matches an "engineering documentation" sensibility that fits your writing (focus-area matrices, requirements-as-objectivity), but a dashed-border/blueprint look is a stronger claim about visual identity than a color-driven system, and every article would need the same light background regardless of subject, which flattens the tag signal that already exists in your content model.

Variant C is the only one of the three that actually uses data you already have (`tags`) to differentiate cards at a glance in the listing grid, and the badge glyph is the beginning of an actual icon system rather than a one-off treatment.

## How generation would work (once a direction is picked)

1. **Renderer**: a small script (Node, reusing the site's own Tailwind/font setup, or a standalone Python+Pillow/SVG script — TBD based on which direction you pick) that takes `{ title, tags, date, diagram? }` and renders a 1200×630 PNG (standard OG card size).
2. **ASCII diagram input**: authored inline in the article's frontmatter or a sibling file (e.g. `content/articles/<slug>.diagram.txt`) — the `note-to-article` pipeline would only include one when the article structurally warrants it (a process, hierarchy, or flow), same judgement call as the "invent freely: structure" boundary already in the skill.
3. **Output path**: `public/articles/<slug>/cover.png`, referenced by the existing `image` frontmatter field — no schema change needed, `content.config.ts` already expects a string path.
4. **Backfill**: run the generator once against all 5 existing articles' real titles/tags to replace the current stock covers.
5. **Pipeline integration**: `skills/note-to-article/SKILL.md` step 6 ("Images") gets a rule change — generate a cover automatically instead of "omit `image` unless a real cover exists." This removes one of the current TODOs agents currently leave for you.

## Open questions for you

1. Pick a direction (A / B / C / hybrid) — or ask for another round of variants on a different axis.
2. Should the ASCII diagram be something the ghostwriting pipeline invents when it judges one useful, or should it stay something only you add by hand? (The style guide's "invent freely: structure" boundary would suggest the pipeline can do it, but a diagram is a stronger claim than a metaphor.)
3. Backfill the 5 existing article covers now, or only apply this to new articles going forward?
