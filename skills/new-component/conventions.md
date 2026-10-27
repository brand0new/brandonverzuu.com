# Component conventions (`apps/site/app/components/`)

The reference that `SKILL.md` applies. When a component changes one of these
conventions, update this file in the same PR.

- **Placement decides the name.** `App/` holds site-wide components (auto-imported as
  `App<Name>`), and `Home/` holds homepage sections (`Home<Name>`). A new
  section-specific folder (`Topics/`, `Projects/`) is fine once it has two or more
  components.
- **Presentational by default.** Cards take one typed data prop (`article`,
  `project`, `cluster`) and render it. The caller fetches and computes, as with
  `TopicCard`'s `articleCount`. Only `Home/*` section components query content, via
  `useAsyncData` + `queryCollection`.
- **`<script setup lang="ts">`** with `defineProps<{...}>()`, plus JSDoc on
  non-obvious props. Some older components still use JS or object-syntax props.
  Convert them when you touch them for other reasons.
- **Look is driven by data, not code.** Per-item styling (like `ProjectCard`'s
  `accentColor`/`accentFont`) comes from content fields, never from a per-slug class.
- **Card shell:** `relative rounded-xl border border-gray-200 p-5 transition-colors
  group-hover:border-gray-300 dark:border-white/10 dark:group-hover:border-white/20`,
  wrapped in a `NuxtLink class="group block"`. Image-backed cards (`ArticleCard`)
  fall back to the `from-terracotta to-porcelain-950` gradient when there's no image.
- **Colours come from tokens.** Use the palette in `apps/site/public/css/main.css` and the
  Nuxt UI aliases in `apps/site/app/app.config.ts` (`primary` = porcelain). Terracotta is the
  accent. For contrast, terracotta text uses `text-terracotta-heading` in light mode
  and `text-terracotta` in dark mode.
- **Every visual element passes WCAG AA (4.5:1) in both themes**, decorative or not.
  Pick shades per theme with `dark:`, and write the measured ratio in a comment when
  you choose a non-obvious shade.
- **Switch themes with CSS, not JS.** For anything visible in prerendered HTML, use
  `dark:hidden` / `hidden dark:block` pairs rather than `useColorMode()`, so the
  first paint doesn't flash the wrong theme. Canvas code that can only run on the
  client may read `document.documentElement.classList`.
- **One page background.** `AppPageBackground` is mounted once in `app.vue` and
  positioned absolutely against its full-width wrapper (`-z-10 pointer-events-none`,
  `aria-hidden`), with a fixed height and a CSS mask fade. It isn't wrapped in
  `<ClientOnly>`, so it's part of the prerendered HTML. Article routes show the
  article's cover there, and every other route shows `AppDitherCanvas`. Pages don't
  mount their own backgrounds.
- **Motion respects `prefers-reduced-motion`.** Paint one static frame and stop.
- **Icons:** the `mage:*` set, wrapped in `<client-only>`, with `aria-hidden`. Any
  icon chosen dynamically must also be added to `icon.clientBundle.icons` in
  `apps/site/nuxt.config.ts`, or it 404s in the static build.
- **External links** get `external`, `target="_blank"` and
  `<span class="sr-only">(opens in new tab)</span>`.
- **Static-build safety:** no runtime server routes, no IPX image URLs, no guessed
  asset paths. Render an image only when the data declares it
  (`v-if="article.image"`). The one deliberate exception is the article cover, which
  is located by the `apps/site/public/articles/<slug>/cover.png` convention (see
  `skills/article-cover/`).
- **Shared logic goes in `apps/site/app/utils/` (pure) or `apps/site/app/composables/` (Nuxt state or
  head).** Visual algorithms shared with build scripts (dithering) live in
  `apps/site/scripts/lib/`. When you port one to the browser, name the source file in a
  comment.
- **Comments explain why, not what**: the constraint, the measured number, the
  alternative you rejected. Make them as long as they need to be and no longer.
