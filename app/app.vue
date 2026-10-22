<template>
  <UApp>
    <div class="relative">
      <a
        href="#main-content"
        class="focus:bg-primary-600 sr-only z-[60] rounded-md px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <AppPageBackground :image="pageCover" />
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

// AppPageBackground is the background for every route. It lives here rather
// than in each page so it can be positioned absolutely against this
// full-width wrapper — the page's own content sits inside
// <UContainer class="max-w-2xl">, which would clip the background to that
// column (and the page transition's transform would re-anchor it mid-
// navigation). Not wrapped in <ClientOnly>, so it's part of the prerendered
// HTML instead of appearing after hydration.
//
// Individual articles and reviews show their own dithered cover instead of
// the animated field. The path is derived from the route by the cover
// convention (scripts/generate-cover.mjs always writes
// public/<collection>/<slug>/cover.png; the note-to-article skill makes an
// article cover mandatory and content.config.ts makes a review's required)
// rather than read from frontmatter: the page's data loads after app.vue
// has already rendered, so it can't be known here in time for the
// prerendered HTML.
const route = useRoute();
const pageCover = computed(() => {
  const match = route.path.match(/^\/(articles|reviews)\/([^/]+)\/?$/);
  return match ? `/${match[1]}/${match[2]}/cover.png` : null;
});
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
