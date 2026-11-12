---
name: new-component
description: Add a new Astro component to brandonverzuu.com that matches the Noise to Signal conventions (placement, props, tokens, motion, accessibility, static-build safety). Use when creating or substantially reworking anything under apps/site/src/components/. Agent-agnostic.
---

# New component

The conventions themselves are listed in `conventions.md` next to this file. Read it
first. This file is the procedure that applies them. The pseudo-code below is a decision
template, not literal code: walk it top to bottom and each branch tells you which existing
component to copy from.

## 1. Classify it

```
kind = classify(component):
  "list"        renders several content items as links    → copy the rows in pages/bookmarks.astro,
                                                             or ArticleCards.astro when each item has a cover
  "panel"       one item with its own image or field       → copy ProjectPanels.astro
  "chapter"     a homepage chapter that reads content      → copy WhatIDo.astro
  "resolving"   an image that goes from noise to signal    → copy ResolvingCover.astro
  "decorative"  a texture with no content                  → use field() from src/scripts/signal.js
                                                             (see SayHello.astro)
  "glyph"       a generated, decorative mark               → copy BinaryIcon.astro
  "chrome"      bar, footer, theme toggle                  → edit src/layouts/Base.astro

file = apps/site/src/components/<PascalCaseNoun>.astro
```

## 2. Shape the frontmatter

```
---
// Header comment: what it's for, which sibling it mirrors, any constraint
// that isn't visible in the code.
import type { Article } from "../lib/content";      // reuse the type the data already has

interface Props {
  articles: Article[];          // domain objects, named for the domain
  /** why this exists, if not obvious */
  size?: "s" | "l";             // presentation knobs only
}
const { articles, size = "s" } = Astro.props;

if kind == "chapter":
  data = await clusterStats() / publishedArticles() / getCollection(...)   // src/lib/content.ts
else:
  NO content queries. The page passes what you render.

shared logic → apps/site/src/lib/*.ts (pure)
---
```

## 3. Shape the markup and styles

```
markup:
  semantic element first (ul/ol of links, section with aria-labelledby, figure)
  lists use .rows / .row / .row-title / .row-meta / .row-desc from global.css
  labels and metadata use .label; tags use .tag
  every decorative element: aria-hidden="true"

<style> (scoped):
  colours: var(--token) only (conventions.md, "Colours come from tokens")
  type: var(--display) / var(--serif) / var(--mono) and the --step-* scale
  layout must work at 390px wide with no horizontal page scroll
  @media (prefers-reduced-motion: reduce) for any transition you add
```

## 4. Behaviour (only if it has any)

```
<script>
  import { resolve, field, glitch, tok, onTheme, reduce } from "../scripts/signal.js";
  the HTML must already be complete; the script upgrades it
  canvases: class="dither" (absolutely positioned in a relative frame), sized with sizeCanvas()
  redraw on onTheme(); read colours with tok()
  if reduce: draw the final, resolved state once, no animation loop
  animate only while on screen (IntersectionObserver), on the 14 fps clock for timed motion
</script>
```

## 5. Colour and contrast

```
for each colour you add:
  add it to apps/site/scripts/lib/tokens.mjs, for both themes
  if text sits on it, or it's a focus ring or meaningful mark:
    add the pair to `pairs` there (4.5 for text, 3 for large text and non-text)
  npm run generate runs scripts/check-contrast.mjs first and fails below AA
```

## 6. Static-build checks

```
assert nothing needs a server, an image proxy or a third-party request at runtime
assert every image is rendered only when its data declares it
run `npm run generate`; open the page in both themes, at phone width, and with
reduced motion on
```

## 7. Comments and PR

- PR title: `design: <summary>` for visual work, `feat: <summary>` for new behaviour.
  Ship it with `skills/ship-change/`.
- If this component changes a convention, update `conventions.md` (and this file, if
  the procedure changes) in the same PR.
