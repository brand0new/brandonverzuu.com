---
name: new-review
description: Add a review (film, series, video game, board game, book) to brandonverzuu.com's /reviews section. Use when Brandon asks for help adding, formatting or publishing a review he has written. Agent-agnostic.
---

# New review

Reviews are written by Brandon, by hand. There is no issue-driven pipeline for them.
Your job is the content contract: the file, the frontmatter, the cover and the build.
Do not write or rewrite the opinion itself unless he asks you to.

**Never invent the rating, the verdict or any opinion.** If the rating or verdict is
missing, ask for it. Subject facts (release year, creator, platform) are checkable:
check them against an official or reference source, and leave the field out rather than
guess.

## 1. The file

`apps/site/content/reviews/<slug>.md`, where the filename equals the `slug` field. The schema is
the `reviews` collection in `apps/site/content.config.ts`. A wrong field fails the build.

```yaml
---
title: "Elden Ring is the open world I stopped resisting"   # the review's headline
description: "One or two sentences for search results and social previews."
published: true
date: 2026/10/13
slug: "elden-ring"
medium: "video-game"        # film | series | video-game | board-game | book | other
subject:
  name: "Elden Ring"        # the thing being reviewed
  year: 2022                # optional
  creator: "FromSoftware"   # optional: director / studio / designer / author
rating: 8                   # whole number 0-10, drawn as binary (8 -> 1000)
verdict: "One-line takeaway shown on the /reviews card."
details:                    # optional, free label/value pairs
  - label: "Platform"
    value: "PS5"
  - label: "Played"
    value: "94 hours"
image: "/reviews/elden-ring/cover.png"
imageAuthor: "Bandai Namco / FromSoftware"   # rights holder, credited on the page
imageSource: "https://..."                   # where the art came from
tags: ["rpg", "open world"]
---
```

- `rating` has no half points, because a binary digit row can't show them.
- `medium` decides the label and the schema.org type (`apps/site/app/utils/reviews.ts`). Adding a
  new medium means editing both `apps/site/content.config.ts` and that file.
- Reuse existing review tags before making new ones. Review tags have nothing to do
  with `apps/site/app/utils/topicClusters.ts`, which only reads articles.

## 2. The cover

Covers are official art (key art, poster, box art) from a press kit or the publisher's
own site, dithered by the same script articles use:

```
npm run cover:generate -- --url <art-url> --slug <slug> --collection reviews \
  --author "<rights holder>" --source <page-the-art-came-from>
```

This writes `apps/site/public/reviews/<slug>/cover.png` and `cover-light.png`. Never point `image`
at anything else: `app.vue` derives the page background from the route, and the light
variant is derived from `image`. Prefer press-kit pages for `imageSource`; don't use
fan art or images from other review sites.

## 3. Check and ship

```
npm run generate     # must succeed
```

Open `/reviews` and `/reviews/<slug>` with `npm run dev` and check the card, the rating,
the cover in both themes and the credit line. Then ship it with `skills/ship-change/`
(`content: review of <subject>`).
