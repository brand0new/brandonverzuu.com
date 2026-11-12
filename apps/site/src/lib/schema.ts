// JSON-LD builders. Each page passes the objects it needs to the Base layout, which writes
// them into <head>. Kept in one file so the Person, the author and the breadcrumbs can't drift.
import { SITE } from "./content";

export type JsonLd = Record<string, unknown>;

export const author = { "@type": "Person", name: "Brandon Verzuu", url: SITE };

// The primary entity declaration for crawlers and the Knowledge Graph, on the homepage.
export function personSchema(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Brandon Verzuu",
    url: SITE,
    image: `${SITE}/avatar.jpg`,
    jobTitle: "Head of Innovation & Product",
    address: { "@type": "PostalAddress", addressLocality: "Rosmalen", addressCountry: "NL" },
    knowsAbout: ["API Governance", "Cloud Integration", "Enterprise Integration Architecture", "OpenAPI", "Artificial Intelligence", "Blockchain"],
    sameAs: ["https://www.linkedin.com/in/brandonverzuu/", "https://github.com/brand0new", "https://medium.com/@brandon-verzuu", "https://twitter.com/brandonverzuu"],
  };
}

export type Crumb = { label: string; href?: string };

// Matches the visible breadcrumb trail (src/components/Breadcrumb.astro): search engines only
// reward a BreadcrumbList that agrees with what's on the page.
export function breadcrumbSchema(crumbs: Crumb[], currentUrl: string): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      item: c.href ? SITE + c.href : currentUrl,
    })),
  };
}

export function articleSchema(a: { title: string; description: string; url: string; date: Date; image: string; tags?: string[] }): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: a.title,
    description: a.description,
    image: SITE + a.image,
    datePublished: a.date.toISOString(),
    dateModified: a.date.toISOString(),
    url: a.url,
    mainEntityOfPage: { "@type": "WebPage", "@id": a.url },
    keywords: a.tags?.join(", "),
    author,
    publisher: author,
  };
}

export function collectionSchema(c: { title: string; description: string; url: string; items: { title: string; url: string }[] }): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: c.title,
    description: c.description,
    url: c.url,
    isPartOf: { "@type": "WebSite", name: "Brandon Verzuu", url: SITE },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: c.items.map((it, i) => ({ "@type": "ListItem", position: i + 1, url: it.url, name: it.title })),
    },
  };
}
