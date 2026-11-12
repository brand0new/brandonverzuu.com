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

// The /career page: one file, because the history is read and edited as a whole. Dates are
// "YYYY-MM" rather than dates: LinkedIn only records months, and a full date would invent a
// day. Durations and counts are derived from them (src/lib/career.ts), so nothing goes stale.
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "use YYYY-MM");
const career = defineCollection({
  loader: file("./content/career.yml", { parser: (text) => [{ id: "career", ...yamlParse(text) }] }),
  schema: z.object({
    intro: z.array(z.string()).min(1),
    location: z.string(),
    employers: z.array(
      z.object({
        name: z.string(),
        // Small print after the name, e.g. a former company name.
        note: z.string().optional(),
        // Folded into the collapsed "Early career & studies" block.
        early: z.boolean().optional(),
        roles: z.array(
          z.object({
            title: z.string(),
            start: month,
            // Omitted while the role is current.
            end: month.optional(),
            location: z.string().optional(),
            summary: z.array(z.string()),
            highlights: z.array(z.object({ label: z.string(), text: z.string() })).optional(),
            stack: z.array(z.string()).optional(),
          }),
        ).min(1),
      }),
    ),
    certifications: z.array(
      z.object({
        name: z.string(),
        issuer: z.string(),
        // Month issued.
        date: month,
        // The issuer's verification or certificate page.
        url: z.string().url().optional(),
        // An image under public/, e.g. "/career/badges/x.png". The page fails the build when
        // the file is missing; without one it draws a monogram badge for the issuer.
        badge: z.string().startsWith("/").optional(),
      }),
    ),
    skills: z.array(z.object({ group: z.string(), items: z.array(z.string()).min(1) })),
  }),
});

// The /setup diagram: one file, read as a whole, like career. Stages are drawn in order around
// the loop (clockwise), so their order is the lifecycle. Source paths are checked against the repo at
// build time in src/lib/setup.ts, which the schema can't do on its own.
const setup = defineCollection({
  loader: file("./content/setup.yml", { parser: (text) => [{ id: "setup", ...yamlParse(text) }] }),
  schema: z.object({
    intro: z.string(),
    stages: z.array(
      z.object({
        name: z.string(),
        steps: z.array(
          z.object({
            name: z.string(),
            tools: z.array(z.string()).min(1),
            body: z.array(z.string()).min(1),
            sources: z.array(
              z.object({
                label: z.string(),
                // Repo-relative, no leading slash: "skills/ship-change/SKILL.md".
                path: z.string().regex(/^[^/]/, "relative to the repo root, no leading slash"),
              }),
            ).min(1),
          }),
        ).min(1),
      }),
    // Exactly four: the diagram puts one stage on each half of the loop's top and bottom
    // edges (src/components/SetupLoop.astro).
    ).length(4),
  }),
});

export const collections = { articles, projects, setup, career };
