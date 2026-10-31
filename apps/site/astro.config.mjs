// Astro is a build tool here: every page is prerendered to static HTML in dist/, which
// Cloudflare Pages serves as plain files. Nothing runs at request time.
import { defineConfig, fontProviders } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import remarkDirective from "remark-directive";
import { remarkHighlight } from "./src/plugins/remark-highlight.mjs";
import { remarkStory } from "./src/plugins/remark-story.mjs";

export default defineConfig({
  site: "https://brandonverzuu.com",
  outDir: "dist",
  // /articles/<slug> is written as articles/<slug>.html and served without a trailing slash,
  // the same URLs (and canonical links) the site has always had.
  build: { format: "file" },
  trailingSlash: "never",
  devToolbar: { enabled: false },
  // Telma is the Abcdates project's accent face (content/projects/1.abcdates.json). The Fonts
  // API downloads it from Fontshare at build time and self-hosts it from dist/.
  fonts: [{ provider: fontProviders.fontshare(), name: "Telma", cssVariable: "--font-telma", weights: [500], styles: ["normal"] }],
  markdown: {
    processor: unified({ remarkPlugins: [remarkDirective, remarkStory, remarkHighlight] }),
    // Both themes as CSS variables; the prose styles pick one per theme.
    shikiConfig: { themes: { light: "github-light", dark: "github-dark" }, defaultColor: false },
  },
});
