import { defineCollection, defineContentConfig, z } from "@nuxt/content";

// Shared by the versioned legal documents of the expertise service.
const legalDocumentSchema = z.object({
  title: z.string(),
  // The version id buyers accept, e.g. "2026-11-01". Matches the filename.
  version: z.string(),
  date: z.date(),
  status: z.enum(["draft", "published"]),
});

export default defineContentConfig({
  collections: {
    projects: defineCollection({
      source: "projects/*",
      type: "data",
      schema: z.object({
        name: z.string(),
        url: z.string(),
        description: z.string(),
        thumbnail: z.string(),
        // Free-text status label shown as a badge on the card (e.g. "WIP",
        // "Live", "Archived") — kept as a plain string rather than a fixed
        // enum since this is a personal portfolio, not a product board, and
        // new one-off statuses shouldn't require a schema change.
        status: z.string(),
        opensource: z.boolean(),
        // Optional per-project accent color for the card's hover/icon
        // treatment, as a CSS color value (hex/named). Replaces the old
        // approach of hardcoding one-off classes per project slug in
        // ProjectCard.vue (e.g. `.abcdates { color: #fe6e8b }`), which
        // didn't scale past a couple of entries.
        accentColor: z.string().optional(),
        // Optional per-project display font for the title, e.g. "Telma" on
        // Abcdates — a deliberate one-off decorative touch (see nuxt.config.ts
        // fonts.families), not a general theming mechanism. Most projects
        // should leave this unset and inherit the site's default heading font.
        accentFont: z.string().optional(),
      }),
    }),
    articles: defineCollection({
      source: "articles/*.md",
      type: "page",
      schema: z.object({
        title: z.string(),
        description: z.string(),
        published: z.boolean(),
        date: z.date(),
        image: z.string().optional(),
        imageAuthor: z.string().optional(),
        imageLicense: z.string().optional(),
        imageSource: z.string().optional(),
        slug: z.string().optional(),
        tags: z.array(z.string()).optional(),
        // Optional looping explainer video shown above the article body
        // (AppArticleExplainer): an MP4 (H.264) plus an optional WebM (VP9)
        // offered first. The poster is its still frame, also shown
        // to readers who prefer reduced motion; the alt text describes the
        // animation's story for screen readers, since its captions are
        // burned into the frames.
        explainerVideo: z.string().optional(),
        explainerVideoWebm: z.string().optional(),
        explainerPoster: z.string().optional(),
        explainerAlt: z.string().optional(),
      }),
    }),
    // Reviews of films, games, books etc. A separate collection rather than
    // articles with a tag, so they stay out of /articles, the homepage and
    // the /topics clusters, which all query `articles`.
    reviews: defineCollection({
      source: "reviews/*.md",
      type: "page",
      schema: z.object({
        title: z.string(),
        description: z.string(),
        published: z.boolean(),
        date: z.date(),
        slug: z.string().optional(),
        tags: z.array(z.string()).optional(),
        // Drives the label and the schema.org type of itemReviewed — see
        // app/utils/reviews.ts. An enum so a typo fails the build instead
        // of producing an unlabelled review.
        medium: z.enum([
          "film",
          "series",
          "video-game",
          "board-game",
          "book",
          "other",
        ]),
        // The thing being reviewed, as opposed to `title`, which is the
        // review's own headline.
        subject: z.object({
          name: z.string(),
          year: z.number().int().optional(),
          // Director, studio, designer or author, whichever fits the medium.
          creator: z.string().optional(),
        }),
        // Whole numbers only: the rating is drawn as its 4-bit binary
        // encoding (AppReviewRating), which has no half steps. Not
        // `.int()`: Nuxt Content maps that to a TEXT column and the page
        // gets "8" back instead of 8. ratingToBits enforces whole numbers
        // instead, failing the prerender on a 7.5.
        rating: z.number().min(0).max(10),
        // One-line takeaway shown on the /reviews card.
        verdict: z.string(),
        // Medium-specific facts (platform, hours played, player count…) as
        // free label/value pairs rather than a schema per medium.
        details: z
          .array(z.object({ label: z.string(), value: z.string() }))
          .optional(),
        // Cover and credit are all required, unlike articles. app.vue derives
        // the page background from the route (/reviews/<slug>/cover.png)
        // without checking frontmatter, and covers are official art, which
        // is copyrighted: the page credits imageAuthor and links
        // imageSource on every review.
        image: z.string(),
        imageAuthor: z.string(),
        imageSource: z.string(),
        imageLicense: z.string().optional(),
      }),
    }),
    // The expertise service (/expert, docs/specs/expert-mcp/). Prices live
    // in content rather than a component so Brandon can set them without
    // touching code (spec 07). An amount is a number or the literal "TBD":
    // the pages print "TBD" as-is, so no placeholder price can be mistaken
    // for a real one.
    expertPricing: defineCollection({
      source: "expert/pricing.yml",
      type: "data",
      schema: z.object({
        currency: z.literal("EUR"),
        packs: z.array(
          z.object({
            id: z.string(),
            credits: z.number().positive(),
            price: z.union([z.number().positive(), z.literal("TBD")]),
          }),
        ),
        // Credits charged per artifact, one entry per check kind
        // (packages/engine-api CheckKind).
        checks: z.array(
          z.object({
            kind: z.enum(["api-governance", "skill-design", "process-review"]),
            name: z.string(),
            credits: z.union([z.number().positive(), z.literal("TBD")]),
            // How the price scales, e.g. with the size of the artifact.
            note: z.string().optional(),
          }),
        ),
        // Invoiced annual plan for teams; shown below the packs.
        annualCommitment: z
          .object({
            priceFrom: z.number().positive(),
            note: z.string(),
          })
          .optional(),
      }),
    }),
    // Terms and privacy statement, one file per version
    // (expert/terms/<version>.md). These are Brandon's words, like reviews:
    // agents scaffold structure only. /expert/terms and /expert/privacy
    // render the newest `published` version and show a "being drafted"
    // notice while only drafts exist. A published terms version must equal
    // the gateway's TERMS_VERSION (spec 07).
    expertTerms: defineCollection({
      source: "expert/terms/*.md",
      type: "page",
      schema: legalDocumentSchema,
    }),
    expertPrivacy: defineCollection({
      source: "expert/privacy/*.md",
      type: "page",
      schema: legalDocumentSchema,
    }),
  },
});
