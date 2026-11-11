// The sitemap, with the same URLs as the canonical links: production domain, no trailing
// slash. Lists every prerendered page except 404. robots.txt points crawlers here, and
// scripts/check-urls.mjs compares it against the URLs the site has always had.
import type { APIRoute } from "astro";
import { publishedArticles, publishedReviews, SITE } from "../lib/content";

export const GET: APIRoute = async () => {
  const articles = await publishedArticles();
  const reviews = await publishedReviews();
  const pages: { path: string; lastmod?: Date }[] = [
    { path: "/" },
    { path: "/articles", lastmod: articles[0]?.data.date },
    ...articles.map((a) => ({ path: `/articles/${a.id}`, lastmod: a.data.date })),
    { path: "/reviews", lastmod: reviews[0]?.data.date },
    ...reviews.map((r) => ({ path: `/reviews/${r.id}`, lastmod: r.data.date })),
    { path: "/projects" },
    { path: "/career" },
    { path: "/bookmarks" },
  ];
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    pages.map((p) => `  <url><loc>${SITE}${p.path}</loc>${p.lastmod ? `<lastmod>${p.lastmod.toISOString().slice(0, 10)}</lastmod>` : ""}</url>`).join("\n") +
    `\n</urlset>\n`;
  return new Response(body, { headers: { "Content-Type": "application/xml" } });
};
