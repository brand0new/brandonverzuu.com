// Social cards for the pages that aren't an article, rendered at build time into
// dist/og/<card>.png (scripts/lib/og-card.mjs). Base.astro points og:image at them.
import type { APIRoute, GetStaticPaths } from "astro";
import path from "node:path";
import { renderCard } from "../../../scripts/lib/og-card.mjs";

const cards = {
  // The default for any page without its own: the homepage hero, as a card.
  home: {
    title: "Brandon Verzuu",
    kicker: "Head of Innovation & Product",
    footer: "brandonverzuu.com · Rosmalen, NL",
    image: { file: path.join(process.cwd(), "public/avatar.jpg"), dither: "zhou-fang", right: 600, extract: { left: 80, top: 10, width: 260, height: 290 } },
    panelTo: 700,
  },
  articles: { title: "Articles", kicker: "APIs, platforms & technology" },
  setup: { title: "Setup", kicker: "From idea to production" },
  projects: { title: "Projects", kicker: "Brandon Verzuu" },
  career: { title: "Career", kicker: "Head of Innovation & Product" },
  bookmarks: { title: "Bookmarks", kicker: "Brandon Verzuu" },
} as const;

export type Card = keyof typeof cards;

export const getStaticPaths = (() => Object.keys(cards).map((card) => ({ params: { card } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params }) =>
  new Response(new Uint8Array(await renderCard(cards[params.card as Card] as Parameters<typeof renderCard>[0])), { headers: { "Content-Type": "image/png" } });
