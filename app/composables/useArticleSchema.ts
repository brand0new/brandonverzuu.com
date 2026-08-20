// BlogPosting + BreadcrumbList JSON-LD schema for an individual article page.
// Takes reactive-ish plain values (called from a computed/watch context in
// the page) rather than refs directly, since useHead's own reactivity
// wrapper is what pages/articles/[slug].vue relies on — see how it's called.
//
// BlogPosting (not the more generic Article) since every entry here is a
// dated, authored long-form post — the more specific type gives search
// engines and AI crawlers a clearer signal.
export interface ArticleSchemaInput {
  title: string;
  description: string;
  slug: string;
  date: string; // ISO-ish date string as stored in frontmatter
  image?: string;
  tags?: string[];
}

export function useArticleSchema(article: ArticleSchemaInput) {
  const url = `https://brandonverzuu.com/articles/${article.slug}`;
  const imageUrl = `https://brandonverzuu.com${article.image ?? "/avatar.jpg"}`;

  useHead({
    script: [
      {
        type: "application/ld+json",
        innerHTML: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: article.title,
          description: article.description,
          image: imageUrl,
          datePublished: article.date,
          dateModified: article.date,
          url,
          mainEntityOfPage: {
            "@type": "WebPage",
            "@id": url,
          },
          keywords: article.tags?.join(", "),
          author: {
            "@type": "Person",
            name: "Brandon Verzuu",
            url: "https://brandonverzuu.com",
          },
          publisher: {
            "@type": "Person",
            name: "Brandon Verzuu",
            url: "https://brandonverzuu.com",
          },
        }),
      },
      {
        type: "application/ld+json",
        innerHTML: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Home",
              item: "https://brandonverzuu.com/",
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "Articles",
              item: "https://brandonverzuu.com/articles",
            },
            {
              "@type": "ListItem",
              position: 3,
              name: article.title,
              item: url,
            },
          ],
        }),
      },
    ],
  });
}
