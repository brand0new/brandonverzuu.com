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
    families: [
      {
        name: 'Cabinet Grotesk',
        provider: 'fontshare',
        weights: ['400', '500', '600', '800'],
        styles: ['normal'],
      },
      {
        name: 'Satoshi',
        provider: 'fontshare',
        weights: ['500'],
        styles: ['normal'],
      },
    ],
  },

  compatibilityDate: "2025-04-11",
});