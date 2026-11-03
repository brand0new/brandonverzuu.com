// The content contract, as schemas. `npm run generate` fails on any entry that doesn't match.
// Entries are keyed by filename (content/articles/<slug>.md -> id "<slug>"), the same key the
// routes and the cover folders (public/articles/<slug>/) use. The glob loader would otherwise
// prefer a `slug` frontmatter field, which can differ (first-post.md).
import { defineCollection } from "astro:content";
import { file, glob } from "astro/loaders";
import { z } from "astro/zod";
import { parse as yamlParse } from "yaml";

const byFilename = ({ entry }: { entry: string }) => entry.replace(/\.(md|json)$/, "").replace(/^\d+\./, "");

const articles = defineCollection({
  loader: glob({ pattern: "*.md", base: "./content/articles", generateId: byFilename }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    published: z.boolean(),
    date: z.coerce.date(),
    image: z.string().optional(),
    imageAuthor: z.string().optional(),
    imageLicense: z.string().optional(),
    imageSource: z.string().optional(),
    slug: z.string().optional(),
    tags: z.array(z.string()).optional(),
    // Optional looping explainer video: an MP4 (H.264) plus an optional WebM (VP9) offered
    // first. The poster is its still frame, also shown to readers who prefer reduced motion;
    // the alt text describes the animation's story, since its captions are burned in.
    explainerVideo: z.string().optional(),
    explainerVideoWebm: z.string().optional(),
    explainerPoster: z.string().optional(),
    explainerAlt: z.string().optional(),
    // Picks the cards in the homepage filmstrip. Until any article sets it, the five most
    // recent stand in, so nothing is chosen per slug in code.
    featured: z.boolean().optional(),
    featuredOrder: z.number().int().optional(),
  }),
});

// Reviews of films, games, books etc. A separate collection rather than articles with a tag,
// so they stay out of /articles, the homepage and the topic filters.
const reviews = defineCollection({
  loader: glob({ pattern: "*.md", base: "./content/reviews", generateId: byFilename }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    published: z.boolean(),
    date: z.coerce.date(),
    slug: z.string().optional(),
    tags: z.array(z.string()).optional(),
    // Drives the label and the schema.org type of itemReviewed (src/lib/reviews.ts). An enum
    // so a typo fails the build instead of producing an unlabelled review.
    medium: z.enum(["film", "series", "video-game", "board-game", "book", "other"]),
    // The thing being reviewed, as opposed to `title`, the review's own headline.
    subject: z.object({
      name: z.string(),
      year: z.number().int().optional(),
      // Director, studio, designer or author, whichever fits the medium.
      creator: z.string().optional(),
    }),
    // Whole numbers only: the rating is drawn as its 4-bit binary encoding, which has no
    // half steps.
    rating: z.number().int().min(0).max(10),
    // One-line takeaway shown on the /reviews list.
    verdict: z.string(),
    // Medium-specific facts (platform, hours played, player count…) as label/value pairs.
    details: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    // Cover and credit are required. The page finds the cover by path
    // (public/reviews/<slug>/cover.png); covers are official art, so every review credits
    // imageAuthor and links imageSource.
    image: z.string(),
    imageAuthor: z.string(),
    imageSource: z.string(),
    imageLicense: z.string().optional(),
  }),
});

const projects = defineCollection({
  // content/projects/<n>.<name>.json: the number orders the list.
  loader: glob({ pattern: "*.json", base: "./content/projects", generateId: ({ entry }) => entry.replace(/\.json$/, "") }),
  schema: z.object({
    name: z.string(),
    url: z.string(),
    description: z.string(),
    thumbnail: z.string(),
    // Free-text status label ("WIP", "Live", "Archived").
    status: z.string(),
    opensource: z.boolean(),
    // Optional per-project accent colour for the title, as a CSS colour.
    accentColor: z.string().optional(),
    // Optional per-project display face for the title, e.g. "Telma" on Abcdates. It must be
    // registered in astro.config.mjs `fonts`, or it falls back to the display face.
    accentFont: z.string().optional(),
  }),
});

// The expertise service (/expert, docs/specs/expert-mcp/). Prices live in content so Brandon
// can set them without touching code (spec 07, decision D6). An amount is a number or the
// literal "TBD", printed as-is so no placeholder can be mistaken for a real price.
const expertPricing = defineCollection({
  loader: file("./content/expert/pricing.yml", { parser: (text) => [{ id: "pricing", ...yamlParse(text) }] }),
  schema: z.object({
    currency: z.literal("EUR"),
    checks: z.array(
      z.object({
        kind: z.enum(["api-governance", "skill-design", "process-review"]),
        name: z.string(),
        // A mage:* icon name, drawn from src/lib/icons.ts.
        icon: z.string().startsWith("mage:"),
        price: z.union([z.number().positive(), z.literal("TBD")]),
        note: z.string().optional(),
      }),
    ),
  }),
});

// Terms and privacy statement, one file per version (expert/terms/<version>.md). These are
// Brandon's words, like reviews: agents scaffold structure only. The pages render the newest
// `published` version and show a "being drafted" notice while only drafts exist.
const legalDocument = z.object({
  title: z.string(),
  // The version id buyers accept, e.g. "2026-11-01". Matches the filename.
  version: z.string(),
  date: z.coerce.date(),
  status: z.enum(["draft", "published"]),
});
const expertTerms = defineCollection({ loader: glob({ pattern: "*.md", base: "./content/expert/terms" }), schema: legalDocument });
const expertPrivacy = defineCollection({ loader: glob({ pattern: "*.md", base: "./content/expert/privacy" }), schema: legalDocument });

export const collections = { articles, reviews, projects, expertPricing, expertTerms, expertPrivacy };
