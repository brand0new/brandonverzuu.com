export default defineNuxtConfig({
  ssr: true,

  css: ["~~/public/css/main.css"],

  nitro: {
    preset: "cloudflare_pages_static",
    prerender: {
      autoSubfolderIndex: false,
    },
  },

  modules: ["@nuxt/ui", "@nuxt/icon", "@nuxt/image", "@nuxt/content"],

  icon: {
    // Default provider only resolves icons client-side (or via a live fetch
    // to the public Iconify API during SSR/prerender for anything not in the
    // small client bundle). Use the "server" provider so icons are resolved
    // from a locally generated bundle instead.
    provider: "server",
    // "auto" also switches to fetching icons from a remote CDN at build time
    // whenever the nitro preset name contains "cloudflare"/"edge"/"worker".
    // This is a purely static build with no edge runtime, and the icon sets
    // are already installed locally (@iconify-json/mage, @iconify-json/lucide),
    // so force local bundling to avoid depending on that CDN at build time.
    serverBundle: "local",
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
        name: "Cabinet Grotesk",
        weights: ["400", "500", "600", "800"],
        styles: ["normal"],
      },
      {
        name: "Satoshi",
        weights: ["500"],
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
