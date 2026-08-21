<template>
  <UApp>
    <div class="relative">
      <a
        href="#main-content"
        class="focus:bg-primary-600 sr-only z-[60] rounded-md px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <ClientOnly>
        <HomeDitherBackground v-if="showHeroDitherBackground" />
        <AppArticleDitherBackground
          v-else-if="articleBackgroundImage"
          :image="articleBackgroundImage"
        />
      </ClientOnly>
      <AppNavbar />
      <div class="h-32"></div>
      <UContainer id="main-content" class="mx-auto max-w-xl lg:max-w-2xl">
        <NuxtPage />
      </UContainer>
    </div>
    <div class="h-32"></div>
    <AppFooter />
  </UApp>
</template>

<script setup lang="ts">
// Applies a self-referencing canonical <link> to every route from one place
// (see app/composables/useCanonical.ts) so it can't be missed on new pages.
useCanonical();

// HomeDitherBackground lives here (rather than in pages/index.vue) so it can
// be positioned absolutely against this full-width wrapper — the page's own
// content sits inside <UContainer class="max-w-2xl">, which would clip the
// background to that column. This wrapper spans the full viewport, so the
// background can render edge-to-edge and behind AppNavbar (a `fixed`
// element, so it always paints above regardless of DOM order/z-index).
//
// AppArticleDitherBackground follows the exact same placement approach for
// article pages, sourcing its image from a shared useState the article page
// sets — set here in app.vue rather than reaching into route.meta so it
// stays reactive across client-side navigation between two article pages.
const route = useRoute();
const articleBackgroundImage = useArticleBackgroundImage();

// HomeDitherBackground (the animated terracotta noise hero) is shared by
// any top-level index/hub page, not just "/" — currently that's the
// homepage, /topics, and /projects. Each places a [data-dither-boundary]
// marker in their own template so the canvas knows where to stop fading
// regardless of which page rendered it (see DitherBackground.vue).
const HERO_DITHER_ROUTES = new Set(["/", "/topics", "/projects"]);
const showHeroDitherBackground = computed(() =>
  HERO_DITHER_ROUTES.has(route.path),
);
</script>

<style>
.page-enter-active,
.page-leave-active {
  transition: all 0.2s;
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

.page-enter-from {
  opacity: 0;
  transform: translateY(5px);
}
</style>
