// The spike builds into the Nuxt site's dist/ under /spike, so the branch's Cloudflare
// preview serves both side by side. publicDir is the site's own public/, so covers and
// the avatar are read from the paths the content contract defines, never copied by hand.
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import { rehypeBase } from "./src/plugins/rehype-base.mjs";
import { remarkHighlight } from "./src/plugins/remark-highlight.mjs";

const base = "/spike";

export default defineConfig({
  site: "https://brandonverzuu.com",
  base,
  outDir: "../dist/spike",
  publicDir: "../public",
  build: { format: "directory" },
  devToolbar: { enabled: false },
  // One tsconfig for every file, the spike's own. Without this Vite also finds the repo root's,
  // which extends .nuxt/tsconfig.json and so fails on any checkout without a Nuxt build.
  vite: { tsconfig: fileURLToPath(new URL("./tsconfig.json", import.meta.url)) },
  markdown: {
    processor: unified({ remarkPlugins: [remarkHighlight], rehypePlugins: [[rehypeBase, { base }]] }),
    // Both themes as CSS variables; the article styles pick one per theme.
    shikiConfig: { themes: { light: "github-light", dark: "github-dark" }, defaultColor: false },
  },
});
