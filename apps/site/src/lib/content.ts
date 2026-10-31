// Queries and small formatters over the content collections, shared by every page.
import { getCollection, type CollectionEntry } from "astro:content";
import { topicClusters, type TopicCluster } from "./topicClusters";

export type Article = CollectionEntry<"articles">;
export type Review = CollectionEntry<"reviews">;

export const SITE = "https://brandonverzuu.com";

export async function publishedArticles(): Promise<Article[]> {
  const all = await getCollection("articles", (a) => a.data.published);
  return all.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export async function publishedReviews(): Promise<Review[]> {
  const all = await getCollection("reviews", (r) => r.data.published);
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

// The content contract: every article and review has public/<collection>/<slug>/cover.png
// and cover-light.png. Found by path, never through frontmatter.
export function covers(collection: "articles" | "reviews", id: string) {
  return { dark: `/${collection}/${id}/cover.png`, light: `/${collection}/${id}/cover-light.png` };
}

export function readingMinutes(entry: { body?: string }): number {
  const words = (entry.body ?? "").replace(/```[\s\S]*?```/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export function formatDate(d: Date, month: "short" | "long" = "short"): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month, year: "numeric", timeZone: "UTC" });
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function inCluster(a: Article, c: TopicCluster): boolean {
  return (a.data.tags ?? []).some((t) => c.tags.includes(t));
}

function yearSpan(dates: Date[]): string {
  if (!dates.length) return "";
  const years = dates.map((d) => d.getUTCFullYear());
  const lo = Math.min(...years), hi = Math.max(...years);
  return lo === hi ? `${lo}` : `${lo}–${hi}`;
}

// The /topics clusters with live counts and year ranges, counted from the content at build
// time, so a number on the page is never a claim.
export async function clusterStats() {
  const all = await publishedArticles();
  return topicClusters.map((c) => {
    const hits = all.filter((a) => inCluster(a, c));
    return { ...c, count: hits.length, years: yearSpan(hits.map((a) => a.data.date)) };
  });
}

// An article's language, from its own words: Dutch stopwords against English ones.
export function language(a: Article): "nl" | "en" {
  const words = (a.body ?? "").toLowerCase().match(/[a-z]+/g) ?? [];
  const count = (set: string[]) => words.filter((w) => set.includes(w)).length;
  return count(["de", "het", "een", "en", "van", "niet", "zijn"]) > count(["the", "and", "of", "is", "not", "are"]) ? "nl" : "en";
}

// "In numbers": only facts the build can count from the content itself.
export async function siteNumbers() {
  const all = await publishedArticles();
  return {
    articles: all.length,
    since: Math.min(...all.map((a) => a.data.date.getUTCFullYear())),
    explainers: all.filter((a) => a.data.explainerVideo).length,
    topics: topicClusters.length,
    languages: new Set(all.map(language)).size,
  };
}

export function plural(n: number, one: string, many = one + "s"): string {
  return `${n} ${n === 1 ? one : many}`;
}
