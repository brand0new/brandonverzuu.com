// Self-referencing <link rel="canonical"> for the current route, using the
// production domain regardless of what host actually served the request.
//
// Why this matters here specifically: this is a static build (nitro preset
// cloudflare_pages_static) deployed via Cloudflare Pages, which means the
// same prerendered HTML is also reachable at the *.pages.dev preview domain
// Cloudflare assigns automatically. Without a canonical tag, that preview
// domain is a legitimate duplicate of every page, and search engines have to
// guess which one to index. This tells them explicitly.
//
// URL shape matches the sitemap (see nuxt.config.ts `site.url` +
// nitro.prerender.autoSubfolderIndex: false): no trailing slash except for
// the root path itself.
const SITE_URL = "https://brandonverzuu.com";

export function useCanonical() {
  const route = useRoute();

  useHead(() => {
    const path = route.path === "/" ? "/" : route.path.replace(/\/+$/, "");
    return {
      link: [
        {
          rel: "canonical",
          href: `${SITE_URL}${path}`,
        },
      ],
    };
  });
}
