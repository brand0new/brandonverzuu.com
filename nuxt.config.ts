export default defineNuxtConfig({
  ssr: true,
  devtools: { enabled: true },

  css: ['~/public/css/main.css'],

  nitro: {
    preset: 'cloudflare_pages_static',
    prerender: {
      autoSubfolderIndex: false,
    }
  },

  modules: [
    "@nuxt/ui",
    "@nuxt/icon",
    "@nuxt/image",
    "@nuxt/content"
  ],

  app: {
    pageTransition: {
      name: "page",
      mode: "out-in"
    },
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
    },
  },

  fonts: {
    defaults: {
      weights: [400, 500, 700],
      fallbacks: {
        monospace: ['Courier New']
      }
    },
    families: [
      { name: 'Cabinet Grotesk', provider: 'fontshare' },
      { name: 'Satoshi', provider: 'fontshare' },
    ],
  },

  compatibilityDate: "2025-04-11",
});