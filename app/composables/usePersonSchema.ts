// Person JSON-LD schema, injected once on the homepage. This is the primary
// entity declaration for AI agents/crawlers and Google's Knowledge Graph:
// it explicitly ties this site to the same person across LinkedIn, GitHub,
// Medium, and X via `sameAs`, and states the professional identity/expertise
// areas in a machine-parseable form rather than only prose.
//
// Kept as a dedicated composable (not inlined in Home/Intro.vue) so the
// schema payload has one source of truth if it needs to be referenced from
// more than one place later (e.g. a future /about page).
export function usePersonSchema() {
  useHead({
    script: [
      {
        type: "application/ld+json",
        innerHTML: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Person",
          name: "Brandon Verzuu",
          url: "https://brandonverzuu.com",
          image: "https://brandonverzuu.com/avatar.jpg",
          jobTitle: "Head of Innovation & Product",
          address: {
            "@type": "PostalAddress",
            addressLocality: "Rosmalen",
            addressCountry: "NL",
          },
          knowsAbout: [
            "API Governance",
            "Cloud Integration",
            "Enterprise Integration Architecture",
            "OpenAPI",
            "Artificial Intelligence",
            "Blockchain",
          ],
          sameAs: [
            "https://www.linkedin.com/in/brandonverzuu/",
            "https://github.com/brand0new",
            "https://medium.com/@brandon-verzuu",
            "https://twitter.com/brandonverzuu",
          ],
        }),
      },
    ],
  });
}
