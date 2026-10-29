# Noise to Signal: Phase 1 spike

An Astro 7 sandbox for the redesign proposal. Astro is a build tool here: the output is
static HTML, CSS and about 11 KB of scripts, with no framework at runtime. It reads the
real content (`../content/articles`) and assets (`../public`) under the same content
contract as the live site, and changes neither.

**Not for merging.** On this branch the root `generate` script builds the spike into
`dist/spike/` after the Nuxt build, so the branch's Cloudflare preview serves both: the
current site at `/` and the spike at `/spike/`. Pages carry `noindex`.

## What's in it

| Piece | Where |
| --- | --- |
| Tokens, signal colour, glitch keyframes | `src/styles/global.css` |
| Resolve and glitch engine (Bayer 8×8, box-averaged ramp, lock-on) | `src/scripts/signal.js` |
| 01 Name and face: portrait resolves over the first scroll | `src/components/Hero.astro` |
| 02 What I do: `/topics` clusters with counts from the content | `src/components/WhatIDo.astro` |
| 04 Writing: the pinned filmstrip, then an index by year | `src/components/Filmstrip.astro`, `src/pages/index.astro` |
| Story template: resolving cover, chapter rail, explainer chapter | `src/pages/articles/[slug].astro` |
| `==highlight==` and base-path rewriting for markdown | `src/plugins/` |

## Running it

Astro 7 needs Node 22.23.4 or later. The repo pins 24.22.1 in `.node-version`, which is
what CI and Cloudflare use.

```
npm ci --prefix spike
npm run dev --prefix spike     # http://localhost:4321/spike/
npm run build --prefix spike   # writes ../dist/spike
```
