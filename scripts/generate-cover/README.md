# Article cover generator

Generates a 1200×630 OG-card cover image for an article: a deterministic
isometric "lattice" line-art background, a tag-driven color gradient overlay,
and the article's title/byline/tag — using the same fonts (Cabinet Grotesk,
Satoshi, Telma) and colors already defined in `public/css/main.css`. No stock
photography, no per-article manual asset work.

## Usage

```bash
# one article, by slug (matches frontmatter `slug`, not necessarily the filename)
npm run cover -- <slug>

# every article
npm run cover:all
```

`npm run cover` only renders the PNG to `public/articles/<slug>/cover.png` — it
does not touch the article's frontmatter. Copy the printed path into the
article's `image` field yourself (or let `note-to-article`'s pipeline do it —
see `skills/note-to-article/SKILL.md` step 6).

`npm run cover:all` does both: regenerates every article's cover AND updates
every article's `image` frontmatter field to point at it (via
`set-frontmatter-image.js`, which does a minimal text-level edit rather than
reformatting the whole YAML block). Use this after changing the template or
tag colors, to refresh every existing cover in one pass.

## How it works

1. `index.js` reads an article's `title` and `tags` from its frontmatter
   (via `gray-matter`).
2. It fills in `template.html` — a static HTML/CSS/inline-SVG page — with the
   title, primary tag, a tag→color lookup (`TAG_COLORS`), and a numeric seed
   derived from the slug (so the same article always gets the same lattice
   pattern; the render is idempotent).
3. Fonts are pulled from Fontshare's CDN at render time (same fonts/weights as
   `nuxt.config.ts`) rather than vendored into the repo, so there's one font
   source of truth.
4. A headless Chromium screenshots the page at 1200×630 to
   `public/articles/<slug>/cover.png`.

No native build step, no GPU, no design tool — just Chromium (already
installed as `chromium` on this machine; set `COVER_CHROMIUM_PATH` if your
binary is named differently, e.g. `chromium-browser` or `google-chrome`).

## Extending the tag → color map

`TAG_COLORS` in `index.js` maps each known tag to an `{ strong, soft }` RGB
pair used in the gradient overlay. All colors come from the three palettes
already defined in `public/css/main.css` (`midnight`/blue, `madang`/green,
`porcelain`/teal) — don't invent a new color, pick whichever of the three
existing families best fits the new tag's vibe. Unmapped tags fall back to
`TAG_COLORS.default` (teal). Add new tags here as they appear in articles;
there is no schema enforcement tying this list to `content.config.ts`, so it
can drift — check it when adding a genuinely new topic area.

## Design history

The visual direction (isometric lattice + tag gradient, ASCII-icon variant
tried and dropped) was worked out interactively — see `sketches/covers/` for
the mockup iterations and `sketches/covers/PROPOSAL.md` for the reasoning.
Those are throwaway design exploration, not part of the generator; the
`sketches/` directory can be deleted once the design is stable and this
README is trusted as the source of truth instead.
