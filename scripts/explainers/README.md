# Animated explainers

Looping, silent explainer videos that sit above an article's body (see
`app/components/App/ArticleExplainer.vue`). Each one tells a single idea in a
few scenes, in the visual language of the Brandon Verzuu design system's
"Animated explainers" section: dark zinc ground, General Sans, porcelain for
the resolved state, terracotta for the unresolved one, and Bayer-dither
reveals stepped at 14 fps instead of opacity fades.

## Files

- `kit.js` — shared drawing primitives (dither reveals, nodes, sprites, the
  dissolve effect, ambient streams and halos, captions, the progress strip)
  and `defineStory()`, which turns a list of scenes into a story. The element
  types it understands are documented above `defineStory()` in the file.
- `stories/<name>.js` — one file per explainer. Most are data: a call to
  `defineStory({ title, headline, scenes })`, ending with `compareEls()` for
  the before/after frame. `zero-ticket.js` is hand-written and sets
  `window.STORY = { duration, poster, end, render(t) }` itself. Either way,
  rendering is a pure function of `t` (seconds), so any frame renders on its
  own; `end` is the last fully composed moment, where the non-looping feed
  cut stops.
- `render.mjs` — loads the kit and a story into headless Chromium, steps it
  frame by frame and encodes the outputs with ffmpeg.

Current stories:

| Story | Article |
| --- | --- |
| `zero-ticket` | `building-platforms-for-vendor-led-enterprises` |
| `api-governance` | `automate-api-governance` |
| `service-bus` | `azure-native-service-bus-publishing-with-api-management` |
| `overlay` | `capture-api-changes-with-overlay` |
| `arazzo` | `improving-dx-with-arazzo` |
| `openapi-4` | `everything-about-openapi-4` |
| `bitcoin` | `begrijp-jij-bitcoin` (Dutch) |
| `maturity-model` | `maturity-models-and-tech` |

## Rendering

Requirements: `npm install`, Playwright's Chromium (`npx playwright install
chromium`) and `ffmpeg` on your PATH.

```
# Review stills while you work (seconds, comma separated)
npm run explainer:render -- zero-ticket --stills 3,12,31.5 --out /tmp/review

# Final render into public/articles/<slug>/
npm run explainer:render -- zero-ticket --slug building-platforms-for-vendor-led-enterprises

# 4:5 cut for social feeds, into scripts/explainers/out/ (git-ignored)
npm run explainer:render -- zero-ticket --format feed
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

Two formats share every story. Each produces only the files listed here.

### Landscape: the article embed (`public/articles/<slug>/`)

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

### Feed: native upload to LinkedIn and similar (`scripts/explainers/out/`)

| File | Codec | Why |
| --- | --- | --- |
| `<story>-feed-4x5.mp4` | H.264 High, CRF 18, 1080×1350, 30 fps, silent AAC track, faststart | 4:5 takes the most room a feed gives a video on mobile. H.264 + AAC is the input feeds transcode most predictably; the audio track is silence. |

The feed cut is laid out around the same scenes: the article headline on
top, the scenes scaled into the middle, 54px captions below and the site
domain at the bottom. It plays once and holds its last composed frame for
2 s instead of looping, because feeds don't loop seamlessly. It never goes
under `public/`: it is uploaded by hand, not served by the site. Upload it
natively rather than linking to it; feeds give native video more reach.

## Writing a new story

1. Copy a `defineStory()` story such as `stories/api-governance.js`. Each
   scene has a duration, a caption, a tone (`terra` for the problem, `porc`
   for the resolution) and its elements; elements dither in at `at` seconds
   after their scene starts and out 0.6 s before it ends, or stay for
   several scenes with `span`. Keep six scenes and end with `compareEls()`,
   so every explainer closes on a before/after frame readers can compare.
2. Give each scene one idea and one or two focal elements. Hold each caption
   for at least 4 s.
3. Keep particles for moments that mean something (the vendor leaving, in
   zero-ticket). Everything else uses the standard dither reveal.
4. The last scene must end empty so the loop restarts cleanly (defineStory
   handles this, and uses the comparison frame as the poster).
5. Type is sized for the embed: 40px captions and 26px node labels render
   at roughly 18px and 12px on the page. Don't go smaller.
6. Draw scenes in landscape coordinates inside `stage()`, and keep their
   content between y 90 and y 540, the band the feed format shows. Chrome
   and captions go through `chrome()` and `caption()`, which lay themselves
   out per format.
