---
name: article-cover
description: Produce the dithered duotone cover (cover.png + cover-light.png) for an article on brandonverzuu.com with scripts/generate-cover.mjs. Use whenever an article is added or its cover changes, including articles written outside the note-to-article pipeline. Agent-agnostic.
---

# Article cover

Every article has a cover, and it always lives at `public/articles/<slug>/cover.png`
with a `cover-light.png` sibling. The site finds both by that path, not through
frontmatter: `app.vue` uses it for the article page background, and `AppArticleCard`
swaps in the light variant by string substitution. A missing cover therefore leaves a
blank band on the article page as well as an empty card.

The script runs locally in Node at build time. Nothing in it ships to the browser.

## 1. Find a source image

Use one of these, in order:

1. An image attached to the originating issue, or supplied by Brandon.
2. An openly licensed image (Wikimedia Commons, Openverse, Unsplash). Search with a
   one-word summary of the article's topic, plus its most relevant tag if that's too
   broad. Prefer photographs and illustrations with strong shapes: fine detail
   disappears in the dither.

For an open-license image, record the author, the licence (SPDX id or name) and the
page you found it on. Don't use anything without a licence that allows reuse.

## 2. Generate

```
# From a URL (most open-license images)
npm run cover:generate -- --url <image-url> --slug <slug> \
  --author "<credit>" --license <licence> --source <page-url>

# From a file already on disk (an issue attachment you downloaded)
npm run cover:generate -- --file <path> --slug <slug>
```

Exactly one of `--url` / `--file`. Options:

- `--collection reviews` writes to `public/reviews/<slug>/` for a review instead of
  an article. The rest of this skill applies the same way, with `reviews` in place of
  `articles`. `skills/new-review/` covers the review-specific parts.
- `--dither zhou-fang` swaps the default Bayer 4×4 ordered dither
  (`scripts/lib/bayer-dither.mjs`) for smoother error diffusion
  (`scripts/lib/zhou-fang-dither.mjs`). Use it when Bayer turns a face or a gradient
  into noise.
- `--width` / `--height` / `--dark` / `--light` / `--seed` exist for experiments.
  Leave them at their defaults for real covers, so every card matches.

The script writes `cover.png` and `cover-light.png` and prints the frontmatter to paste
into the article.

## 3. Wire it into the article

- Set `image: "/articles/<slug>/cover.png"`. Never point `image` at any other file:
  components derive the light path from it.
- Paste `imageAuthor`, `imageLicense` and `imageSource` whenever the licence asks for
  attribution (CC-BY and most others do). They render as the credit line on the card.
- Commit both PNGs.

## 4. Check it

Run `npm run dev`, then open the article and `/articles` in both themes. The cover
should read as a shape, not as noise, and the credit line should show where one is
needed.
