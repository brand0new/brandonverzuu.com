---
name: article-explainer
description: Write and render a looping animated explainer video for an article on brandonverzuu.com (scripts/explainers). Use when adding or changing an explainer, or when cutting the 4:5 feed version for LinkedIn. Agent-agnostic.
---

# Article explainer

A silent, looping video above the article body (`AppArticleExplainer`) that tells one
idea in about six scenes. The drawing kit, the story format and the codec choices are
documented in `scripts/explainers/README.md`; read it before writing a story. This
file is the procedure.

## 0. Prerequisites

- `npm ci`
- Playwright's Chromium: `npx playwright install chromium`
- `ffmpeg` on your PATH
- General Sans reachable from Fontshare, or the two `.woff2` files in
  `scripts/explainers/fonts/` (git-ignored, licensed). The render fails rather than
  falling back to another typeface.

## 1. Write the story

1. Copy a `defineStory()` story such as `scripts/explainers/stories/api-governance.js`
   to `stories/<name>.js`.
2. Follow the rules in the README's "Writing a new story": six scenes, one idea per
   scene, captions held at least 4 s, content between y 90 and 540, and a closing
   `compareEls()` before/after frame.
3. Add the story to the table of current stories in the README.

## 2. Review stills while you work

```
npm run explainer:render -- <name> --stills 3,12,31.5 --out <scratch-dir>
```

Look at the stills. Iterate on the story until each scene reads on its own.

## 3. Final render

```
npm run explainer:render -- <name> --slug <article-slug>
```

This writes `explainer.mp4`, `explainer.webm` and `explainer-poster.png` to
`public/articles/<slug>/` and prints the frontmatter keys (`explainerVideo`,
`explainerVideoWebm`, `explainerPoster`). Add them to the article, and write
`explainerAlt` by hand: the captions are burned into the video, so the alt text is the
screen-reader description of the whole story.

## 4. Optional: feed cut

```
npm run explainer:render -- <name> --format feed
```

This writes `scripts/explainers/out/<name>-feed-4x5.mp4` (git-ignored). It's uploaded
to LinkedIn by hand and never goes under `public/`.

## 5. Check it

Run `npm run dev` and open the article. Check that the video loops cleanly, that the
poster shows with reduced motion turned on, and that the commit contains all three
files.
