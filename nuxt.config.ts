export default defineNuxtConfig({
  ssr: true,
  devtools: { enabled: true },

  nitro: {
    preset: 'cloudflare_pages'
  },

  modules: [
    "@nuxt/ui",
    "@nuxt/icon",
    "@nuxtjs/google-fonts",
    "@nuxtjs/fontaine",
    "@nuxt/image",
    "@nuxt/content",
    "@vueuse/nuxt"
  ],

  app: {
    pageTransition: { name: "page", mode: "out-in" },
    head: {
      htmlAttrs: {
        lang: "en",
        class: "h-full",
      },
      bodyAttrs: {
        class: "antialiased bg-gray-50 dark:bg-black min-h-screen",
      },
    },
  },

  content: {
    build: {
      markdown: {
        highlight: {
          theme: "github-dark",
        }
      },
    }
  },

  googleFonts: {
    display: "swap",
    families: {
      Inter: [400, 500, 600, 700, 800, 900],
    },
  },

  compatibilityDate: "2025-04-11",
});