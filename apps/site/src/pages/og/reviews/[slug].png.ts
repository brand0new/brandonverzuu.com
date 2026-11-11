// A review's social card: its own dithered cover behind the title, rendered at build time
// into dist/og/reviews/<slug>.png (scripts/lib/og-card.mjs). No rating on the card: the
// verdict is Brandon's to present on the page.
import type { APIRoute, GetStaticPaths } from "astro";
import path from "node:path";
import { renderCard } from "../../../../scripts/lib/og-card.mjs";
import { publishedReviews, covers, type Review } from "../../../lib/content";
import { media } from "../../../lib/reviews";

export const getStaticPaths = (async () => (await publishedReviews()).map((r) => ({ params: { slug: r.id }, props: { review: r } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const d = (props as { review: Review }).review.data;
  const kicker = ["Review", media[d.medium].label, d.subject.year].filter(Boolean).join(" · ");
  const file = path.join(process.cwd(), "public", covers("reviews", (props as { review: Review }).review.id).dark);
  const png = await renderCard({ title: d.title, kicker, image: { file, ready: true } });
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png" } });
};
