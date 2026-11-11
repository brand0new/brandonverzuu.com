// An article's social card: its own dithered cover behind the title, rendered at build time
// into dist/og/articles/<slug>.png (scripts/lib/og-card.mjs). The cover is found by the
// content contract's path, so an article without one fails the build here too.
import type { APIRoute, GetStaticPaths } from "astro";
import path from "node:path";
import { renderCard } from "../../../../scripts/lib/og-card.mjs";
import { publishedArticles, covers, readingMinutes, language, type Article } from "../../../lib/content";

export const getStaticPaths = (async () => (await publishedArticles()).map((a) => ({ params: { slug: a.id }, props: { article: a } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const article = (props as { article: Article }).article;
  const min = readingMinutes(article);
  const kicker = language(article) === "nl" ? `Artikel · ${min} min lezen` : `Article · ${min} min read`;
  const file = path.join(process.cwd(), "public", covers("articles", article.id).dark);
  const png = await renderCard({ title: article.data.title, kicker, image: { file, ready: true } });
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png" } });
};
