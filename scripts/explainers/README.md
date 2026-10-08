# Animated explainers

Looping, silent explainer videos that sit above an article's body (see
`app/components/App/ArticleExplainer.vue`). Each one tells a single idea in a
few scenes, in the visual language of the Brandon Verzuu design system's
"Animated explainers" section: dark zinc ground, General Sans, porcelain for
the resolved state, terracotta for the unresolved one, and Bayer-dither
reveals stepped at 14 fps instead of opacity fades.

## Files

- `kit.js` — shared drawing primitives: dither reveals, nodes, sprites, the
  dissolve effect, ambient streams and halos, captions and the progress strip.
- `stories/<name>.js` — one file per explainer. It lays out its scenes and
  sets `window.STORY = { duration, poster, render(t) }`. `render` must be a
  pure function of `t` (seconds) so any frame renders on its own.
- `render.mjs` — loads the kit and a story into headless Chromium, steps it
  frame by frame and encodes the outputs with ffmpeg.

## Rendering

Requirements: `npm install`, Playwright's Chromium (`npx playwright install
chromium`) and `ffmpeg` on your PATH.

```
# Review stills while you work (seconds, comma separated)
npm run explainer:render -- zero-ticket --stills 3,12,31.5 --out /tmp/review

# Final render into public/articles/<slug>/
npm run explainer:render -- zero-ticket --slug building-platforms-for-vendor-led-enterprises
```

The final render writes `explainer.mp4`, `explainer.webm` and
`explainer-poster.png`, then prints the front matter to add to the article
(`explainerVideo`, `explainerVideoWebm`, `explainerPoster`, `explainerAlt`;
see `content.config.ts`). Write `explainerAlt` by hand: it is the screen
reader description of the whole story, since the captions are burned in.

### Fonts

General Sans is loaded from Fontshare, like the site itself. If that's not
reachable, put `GeneralSans-Regular.woff2` and `GeneralSans-Semibold.woff2`
in `scripts/explainers/fonts/` (git-ignored) or pass `--fonts <dir>`. The
render fails rather than falling back to another typeface.

## Output formats

| File | Codec | Why |
| --- | --- | --- |
| `explainer.webm` | VP9, CRF 30, 4:2:0 | Offered first: smallest file, and the only option in browsers built without an H.264 decoder. |
| `explainer.mp4` | H.264 High, CRF 16, `-tune animation`, 4:2:0, faststart | Plays everywhere, including all Safari versions. Faststart puts the index up front so playback starts before the download ends. |
| `explainer-poster.png` | PNG | Lossless, so the dither cells stay crisp. Shown before playback and to readers who prefer reduced motion. |

Both videos are 1280×720 at 30 fps with no audio track. That covers the
article embed (about 576 CSS px wide, so 1152 device pixels on a 2× screen).
Cloudflare Pages serves files up to 25 MiB, far above these sizes.

AV1 is deliberately left out. For a clip this small it would only save a few
hundred kilobytes, and Safari decodes it only on devices with AV1 hardware,
so it couldn't replace either existing file.

## Writing a new story

1. Copy `stories/zero-ticket.js` and keep its structure: a `SC` array of
   scene start times (the last value is the loop length), one caption per
   scene, and elements that dither in after their scene starts and out about
   0.6 s before it ends.
2. Give each scene one idea and one or two focal elements. Hold each caption
   for at least 4 s.
3. Keep particles for moments that mean something (the vendor leaving, in
   zero-ticket). Everything else uses the standard dither reveal.
4. End the last scene empty so the loop restarts cleanly, and set `poster`
   to the frame that sums the story up.
5. Type is sized for the embed: 40px captions and 26px node labels render
   at roughly 18px and 12px on the page. Don't go smaller.
