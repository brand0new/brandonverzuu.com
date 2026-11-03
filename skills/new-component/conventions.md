# Component conventions (`apps/site/src/components/`)

The reference that `SKILL.md` applies. The visual language behind them is Noise to Signal:
cool porcelain paper, terracotta dither, one signal drop, billboard type. When a component
changes one of these conventions, update this file in the same PR.

- **Astro components, rendered at build time.** A component is `src/components/<Name>.astro`
  (PascalCase noun). It ships HTML and CSS. JavaScript goes in a `<script>` block only when
  the component has behaviour, and it's bundled and loaded once per page. No UI framework
  runs in the browser.
- **Presentational by default.** Most components take typed props (`articles`, `crumbs`,
  `rating`) and render them; the page fetches and computes. Homepage chapters (`Hero`,
  `WhatIDo`) and shared blocks (`ProjectPanels`, `LegalDocument`) may query
  content themselves through `src/lib/content.ts` or `astro:content`.
- **Look is driven by data, not code.** Per-item styling (a project's `accentColor` and
  `accentFont`) comes from content fields, never from a per-slug class.
- **The grammar is rows, not cards.** Lists use `.rows` / `.row` from
  `src/styles/global.css`: a 2px ink rule on top, hairlines between, a display-face title,
  mono metadata on the right. Panels (`--panel` background, 1px `--line` border, square
  corners) are for things that carry their own image or field, like projects and the
  filmstrip. No rounded corners, shadows, gradients or blur.
- **Three typefaces with fixed jobs.** `--display` (Big Shoulders Display, uppercase) for
  titles, chapter heads, numerals and pull quotes. `--serif` (Newsreader) for reading.
  `--mono` (IBM Plex Mono, uppercase `.label`) for labels, metadata, tags and buttons.
- **Colours come from tokens.** Use the custom properties (`--paper`, `--panel`, `--ink`,
  `--muted`, `--line`, `--accent`, `--dot`, `--signal`, `--on-signal`, `--signal-text`)
  that `src/layouts/Base.astro` writes from `apps/site/scripts/lib/tokens.mjs`. Never a raw
  hex in a component; canvas code reads tokens with `tok("--dot")`. A new colour or a new
  text pairing goes into `tokens.mjs`, and a text pairing also into its `pairs` list, which
  `npm run generate` checks for WCAG AA in both themes.
- **Terracotta is noise, signal is the result.** Dither dots are always `--dot` and never
  text. Text-weight terracotta is `--accent`. Signal (`--signal`) covers under 2% of a
  screen: a highlight, a chip, a drop. On light paper it's always a fill behind
  `--on-signal`, never text; `--signal-text` is its text-safe partner. Keep signal and
  terracotta from touching.
- **Light and dark are equal citizens.** Theme switching is CSS only (the tokens change
  under `[data-theme]` and `prefers-color-scheme`), so the prerendered first paint is
  right. Canvas code redraws on `onTheme()` from `src/scripts/signal.js`.
- **Three motions, one grammar** (`src/scripts/signal.js`). *Resolve* is understanding:
  an image goes from the 56-column noise floor to its own native grid as the reader
  scrolls. *Glitch* is the lock-on: a 357 ms, five-frame stutter when something reaches
  signal, once, never on a timer. *Field* is a slow decorative dither on quiet surfaces.
  Timed motion shares the 14 fps clock; everything else follows scroll. Nothing moves text
  while someone reads, and nothing depends on hover.
- **Rest state first.** The HTML is complete before any script runs: covers are real PNGs
  (`.nojs-only`), every card's text is in the markup. Scripts upgrade it. With
  `prefers-reduced-motion`, show the resolved state and skip the transition.
- **Icons:** `mage:*` names through `Icon.astro`, which inlines the SVG at build time and
  fails the build on an unknown name. Always decorative (`aria-hidden`), next to a text
  label.
- **Sub-pages get a breadcrumb, not a section menu.** Pages below an index
  (`/expert/pricing`) pass `crumbs` to `PageHead` (Home / section /
  page) and the same crumbs to `breadcrumbSchema()`. Links onward go at the end as a
  `.more` line ("Pricing →").
- **Status labels are `.tag`s** (mono, uppercase, hairline box; `.tag.on` in the accent
  colour), not custom callout boxes.
- **External links open in the same tab.** Name the destination in the link text (the
  host, the network's name) so it's clear the link leaves the site.
- **Static-build safety:** no request-time server, no image proxy, no third-party request
  at runtime, no guessed asset paths. Render an image only when the data declares it. The
  deliberate exception is the cover, located by the
  `apps/site/public/<collection>/<slug>/cover.png` convention (see `skills/article-cover/`).
- **Shared logic goes in `apps/site/src/lib/`.** Visual algorithms shared with build
  scripts (dithering, the palette) live in `apps/site/scripts/lib/`. When you port one to
  the browser, name the source file in a comment, as `signal.js` does for the Bayer matrix.
- **Comments explain why, not what**: the constraint, the measured number, the
  alternative you rejected. Make them as long as they need to be and no longer.
