import { getCollection, type CollectionEntry } from "astro:content";
import { topicClusters } from "../../../app/utils/topicClusters";

export type Article = CollectionEntry<"articles">;

// Root-relative path under the configured base (/spike in this spike, / once it replaces the site).
export function url(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return base + (path.startsWith("/") ? path : "/" + path);
}

export async function publishedArticles(): Promise<Article[]> {
  const all = await getCollection("articles", (a) => a.data.published);
  return all.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

// Featured articles come from frontmatter (featured, featuredOrder). Until an article sets
// them, the five most recent stand in, so nothing is chosen per slug in code.
export async function featuredArticles(): Promise<Article[]> {
  const all = await publishedArticles();
  const flagged = all
    .filter((a) => a.data.featured)
    .sort((a, b) => (a.data.featuredOrder ?? 99) - (b.data.featuredOrder ?? 99));
  return flagged.length ? flagged : all.slice(0, 5);
}

// The content contract: every article has public/articles/<slug>/cover.png and cover-light.png.
export function covers(a: Article) {
  return { dark: url(`/articles/${a.id}/cover.png`), light: url(`/articles/${a.id}/cover-light.png`) };
}

export function readingMinutes(a: Article): number {
  const words = (a.body ?? "").replace(/```[\s\S]*?```/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

// Chapter 02: the /topics clusters with live counts and year ranges from the content.
// The clusters come from the Nuxt app's own file, so /topics and this chapter can't drift.
export async function clusterStats() {
  const all = await publishedArticles();
  return topicClusters.map((c) => {
    const hits = all.filter((a) => (a.data.tags ?? []).some((t) => c.tags.includes(t)));
    const years = hits.map((a) => a.data.date.getUTCFullYear());
    const lo = Math.min(...years), hi = Math.max(...years);
    return {
      slug: c.slug,
      title: c.title,
      summary: c.summary,
      count: hits.length,
      years: hits.length ? (lo === hi ? `${lo}` : `${lo}–${hi}`) : "",
    };
  });
}
