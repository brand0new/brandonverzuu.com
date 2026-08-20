export default defineNuxtConfig({
  ssr: true,

  css: ["~~/public/css/main.css"],

  nitro: {
    preset: "cloudflare_pages_static",
    prerender: {
      autoSubfolderIndex: false,
    },
  },

  modules: [
    "@nuxt/ui",
    "@nuxt/icon",
    "@nuxt/image",
    "@nuxt/content",
    "@nuxtjs/sitemap",
  ],

  // Required by @nuxtjs/sitemap to emit absolute <loc> URLs and by the
  // robots.txt route (see public/robots.txt) that points crawlers at it.
  site: {
    url: "https://brandonverzuu.com",
    name: "Brandon Verzuu",
  },

  icon: {
    // This is a purely static build with no server/edge runtime, so icons
    // must be resolved entirely at build time with nothing fetched at
    // request time. The "server" provider (previously used here) resolves
    // icons via a Nitro API route (/api/_nuxt_icon/...), which doesn't
    // exist in the static `dist/` output and 404s in production. Instead,
    // bundle icons directly into the client JS at build time via
    // clientBundle, so the <Icon>/<UIcon> components (all wrapped in
    // <client-only> to avoid SSR/prerender-time resolution) render from
    // local data with zero runtime requests. Icons are listed explicitly
    // because some are chosen dynamically (e.g. ThemeToggle's ternary),
    // which the automatic source scanner can miss.
    clientBundle: {
      scan: true,
      icons: [
        "mage:book-text-fill",
        "mage:bookmark-fill",
        "mage:folder-2-fill",
        "mage:tag-fill",
        "mage:github",
        "mage:home-fill",
        "mage:linkedin",
        "mage:medium",
        "mage:moon-fill",
        "mage:sun",
        "mage:x",
      ],
    },
  },

  image: {
    // This site is a fully static prerendered build (no server/edge functions),
    // so @nuxt/image's IPX provider has nowhere to run at request time and the
    // static prerenderer never generates the /_ipx/... files it points to.
    // Serve images as-is instead of routing them through IPX.
    provider: "none",
  },

  app: {
    pageTransition: {
      name: "page",
      mode: "out-in",
    },
    head: {
      htmlAttrs: {
        lang: "en",
        class: "h-full",
      },
      bodyAttrs: {
        class: "antialiased min-h-screen",
      },
    },
  },

  content: {
    build: {
      markdown: {
        highlight: {
          theme: "github-dark-default",
        },
      },
    },
  },

  fonts: {
    provider: "fontshare",
    families: [
      {
        // Semibold weight, used for h1-h6 (see public/css/main.css).
        name: "General Sans",
        weights: ["400", "600"],
        styles: ["normal"],
        global: true,
      },
      {
        name: "Telma",
        weights: ["500"],
        styles: ["normal"],
      },
    ],
  },

  compatibilityDate: "2025-04-11",
});
