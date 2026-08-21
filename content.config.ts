import { defineCollection, defineContentConfig, z } from "@nuxt/content";

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
      }),
    }),
  },
});
