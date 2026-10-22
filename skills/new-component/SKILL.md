---
name: new-component
description: Add a new Vue component to brandonverzuu.com that matches the existing component conventions (placement, props, theming, accessibility, static-build safety). Use when creating or substantially reworking anything under app/components/. Agent-agnostic.
---

# New component

The conventions themselves are listed in `conventions.md` next to this file. Read it
first. This file is the procedure that applies them. The pseudo-code below is a
decision template, not literal code: walk it top to bottom and each branch tells you
which existing component to copy from.

## 1. Classify it

```
kind = classify(component):
  "card"        if it renders one content item as a link   → copy App/TopicCard.vue
  "image-card"  if that item has a cover image             → copy App/ArticleCard.vue
  "section"     if it is a homepage block that fetches data → copy Home/FeaturedProjects.vue
  "decorative"  if it is a background/texture, no content  → extend App/PageBackground.vue
                                                             (canvas: App/DitherCanvas.vue)
  "icon"        if it is a generated glyph                 → copy App/TopicBinaryIcon.vue
  "chrome"      if it is nav/footer/toggle                 → copy App/Navbar.vue, App/ThemeToggle.vue

folder = 
  "Home/"        if used only on the homepage
  "<Section>/"   if used only in one section AND that folder will hold ≥ 2 components
  "App/"         otherwise
name = PascalCase noun, no folder prefix in the filename
       (Nuxt auto-imports App/TopicCard.vue as <AppTopicCard>)
```

## 2. Shape the script

```
<script setup lang="ts">
  import type { Item } from "~/utils/<domain>"      // reuse the type the data already has

  props = defineProps<{
    item: Item                    // ONE domain object, named for the domain
    /** why this exists, if not obvious */
    derivedValue?: number         // computed by the CALLER, not here
  }>()
  // withDefaults(...) only for presentation knobs (size, fontSize)

  if kind == "section":
    data = await useAsyncData("<name>-<page>", () =>
             queryCollection("<collection>").where(...).order(...).all())
  else:
    NO data fetching. NO useColorMode(). NO route reads.

  derived = computed(() => pure transform of props)    // e.g. cover → cover-light path
  shared logic → app/utils/*.ts (pure) or app/composables/use*.ts (state/head)
</script>
```

## 3. Shape the template

```
<template>
  if kind in ["card", "image-card"]:
    <NuxtLink :to="..." class="group block" [external target="_blank" if off-site]>
      <article class="relative flex items-start gap-4 rounded-xl
                      border border-gray-200 p-5 transition-colors
                      group-hover:border-gray-300
                      dark:border-white/10 dark:group-hover:border-white/20">
        <h2 class="group-hover:text-primary-600 dark:group-hover:text-primary-400
                   dark:text-gray-100">{{ title }}</h2>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ summary }}</p>
        [<span class="sr-only">(opens in new tab)</span> if external]
      </article>
    </NuxtLink>

  if kind == "image-card":
    gradient fallback on wrapper: "from-terracotta to-porcelain-950 bg-gradient-to-br"
    for each theme variant:
      <div v-if="item.image" class="absolute inset-0 bg-cover dark:hidden"        :style=light />
      <div v-if="item.image" class="absolute inset-0 bg-cover hidden dark:block"  :style=dark  />
    overlay for text contrast, credit line v-if="item.imageAuthor"

  if kind == "decorative":
    there is ONE page background (AppPageBackground, mounted in app.vue);
    add a variant to it rather than mounting a second background in a page
    root has aria-hidden="true", class="pointer-events-none absolute inset-x-0 top-0 -z-10"
    fixed height + CSS mask fade, NOT measured from the page (measuring pops in after hydration)
    canvas animation: client-only, clean up in onUnmounted
    if prefers-reduced-motion: draw one frame, no requestAnimationFrame loop

  for every icon:
    <client-only><Icon :name="mage:..." aria-hidden="true" /></client-only>
    if name is dynamic: add it to nuxt.config.ts → icon.clientBundle.icons
</template>
```

## 4. Colour and contrast

```
for each colour you add:
  token = pick from public/css/main.css or Nuxt UI alias (primary, neutral)
          NEVER a raw hex in the template; raw hex only in <canvas> code,
          with a comment naming the CSS token it mirrors
  for theme in [light, dark]:
    ratio = contrast(token, background(theme))
    if ratio < 4.5:   pick a different shade for that theme with `dark:` prefix
    if the shade isn't the obvious one: write the ratio in a comment
  terracotta on text: light → text-terracotta-heading, dark → text-terracotta
```

## 5. Static-build checks

```
assert no server/API route is needed at runtime
assert every image is rendered only when its data declares it (v-if)
run `npm run generate`; open the page in both themes and with reduced motion on
```

## 6. Comments and PR

- Write a header comment on any non-trivial component. Say what it is for, which
  sibling it mirrors, and any constraint that isn't visible in the code: a contrast
  ratio, a static-build pitfall, an approach you rejected.
- PR title: `design: <summary>` for visual work, `feat: <summary>` for new behaviour.
  Ship it with `skills/ship-change/`.
- If this component changes a convention, update `conventions.md` (and this file, if
  the procedure changes) in the same PR.
