<template>
  <UApp>
    <div class="relative">
      <ClientOnly>
        <HomeDitherBackground v-if="route.path === '/'" />
        <AppArticleDitherBackground
          v-else-if="articleBackgroundImage"
          :image="articleBackgroundImage"
        />
      </ClientOnly>
      <AppNavbar />
      <div class="h-32"></div>
      <UContainer class="mx-auto max-w-xl lg:max-w-2xl">
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
