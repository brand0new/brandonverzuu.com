// CollectionPage JSON-LD for a topic cluster hub page. Signals to search
// engines and AI crawlers that this page is a curated collection of the
// listed articles, not a duplicate of the /articles index — the mainEntity
// ItemList is what lets a crawler understand the page's role as an authority
// hub for the given topic rather than just another list view.
export interface TopicClusterSchemaInput {
  title: string;
  description: string;
  slug: string;
  articles: { title: string; url: string; datePublished: string }[];
}

export function useTopicClusterSchema(input: TopicClusterSchemaInput) {
  const url = `https://brandonverzuu.com/topics/${input.slug}`;

  useHead({
    script: [
      {
        type: "application/ld+json",
        innerHTML: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: input.title,
          description: input.description,
          url,
          isPartOf: {
            "@type": "WebSite",
            name: "Brandon Verzuu",
            url: "https://brandonverzuu.com",
          },
          mainEntity: {
            "@type": "ItemList",
            itemListElement: input.articles.map((article, index) => ({
              "@type": "ListItem",
              position: index + 1,
              url: article.url,
              name: article.title,
            })),
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
              name: "Topics",
              item: "https://brandonverzuu.com/topics",
            },
            {
              "@type": "ListItem",
              position: 3,
              name: input.title,
              item: url,
            },
          ],
        }),
      },
    ],
  });
}
