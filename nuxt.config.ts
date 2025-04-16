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
      weights: [400],
      styles: ['normal', 'italic'],
      subsets: [
        'cyrillic-ext',
        'cyrillic',
        'greek-ext',
        'greek',
        'vietnamese',
        'latin-ext',
        'latin',
      ]
    },
    fontshare: [
      {
        family: 'Cabinet Grotesk',
        weights: [400, 500, 600, 700],
        styles: ['normal', 'medium', 'italic']
      }
    ]
  },

  compatibilityDate: "2025-04-11",
});