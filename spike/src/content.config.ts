// Reads the real articles from content/articles/, with the same fields as the Nuxt
// `articles` schema in ../content.config.ts. `featured` and `featuredOrder` are the new
// optional fields the proposal adds; until an article sets them, the filmstrip shows
// the five most recent English articles.
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const articles = defineCollection({
  // Keyed by filename, like the live site's routes and public/articles/<name>/ cover folders.
  // The glob loader would otherwise prefer the slug frontmatter, which can differ (first-post.md).
  loader: glob({ pattern: "*.md", base: "../content/articles", generateId: ({ entry }) => entry.replace(/.md$/, "") }),
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
    explainerVideo: z.string().optional(),
    explainerVideoWebm: z.string().optional(),
    explainerPoster: z.string().optional(),
    explainerAlt: z.string().optional(),
    featured: z.boolean().optional(),
    featuredOrder: z.number().int().optional(),
  }),
});

export const collections = { articles };
