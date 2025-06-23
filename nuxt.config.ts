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
        class: "antialiased min-h-screen",
      },
    }, 
  },

  content: {
    build: {
      markdown: {
        highlight: {
          theme: "github-dark-default",
        }
      },
    },
  },

  fonts: {
    provider: 'fontshare',
    families: [
      {
        name: 'Cabinet Grotesk',
        weights: ['400', '500', '600', '800'],
        styles: ['normal'],
      },
      {
        name: 'Satoshi',
        weights: ['500'],
        styles: ['normal'],
        global: true,
      },
      {
        name: 'Telma',
        weights: ['500'],
        styles: ['normal'],
      }
    ],
  },

  compatibilityDate: "2025-04-11",
});