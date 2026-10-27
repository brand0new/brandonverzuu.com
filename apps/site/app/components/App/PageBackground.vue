<template>
  <!-- The one page background for every route, rendered from app.vue.
       Purely decorative — positioned absolutely against app.vue's
       full-width wrapper (not the width-constrained UContainer the page
       content sits in), so it spans edge-to-edge and sits behind AppNavbar
       (a `fixed` element that always paints above regardless of z-index).

       The frame — fixed height plus one CSS mask fade — is shared by both
       variants, so every page fades out over exactly the same distance.
       The height is a constant rather than measured from each page's
       header: a measured height can only be known after client JS runs,
       which made the background pop in and resize on load and differ in
       length from page to page. 21rem matches where the fade ended on the
       reference pages (/projects, /topics) when it was still measured.

       Content is either:
       - `image` set (individual article posts): the article's own dithered
         cover as a static background. Two variants toggled with CSS
         (dark:hidden / hidden dark:block) rather than a JS color-mode
         check, same as AppArticleCard, so the right one is already in the
         prerendered HTML before any JS runs.
       - otherwise: the animated terracotta noise field (AppDitherCanvas). -->
  <div
    data-page-background
    aria-hidden="true"
    class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[21rem] w-full"
    :style="{ maskImage: FADE, WebkitMaskImage: FADE }"
  >
    <template v-if="image">
      <div
        class="absolute inset-0 bg-cover bg-top opacity-55 dark:hidden"
        :style="{ backgroundImage: `url(${lightImage})` }"
      ></div>
      <div
        class="absolute inset-0 hidden bg-cover bg-top opacity-55 dark:block"
        :style="{ backgroundImage: `url(${image})` }"
      ></div>
    </template>
    <AppDitherCanvas v-else />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ image?: string | null }>();

const FADE = "linear-gradient(to bottom, black 0%, transparent 100%)";

// /articles/<slug>/cover.png -> /articles/<slug>/cover-light.png, the same
// derivation AppArticleCard uses — scripts/generate-cover.mjs always writes
// both files under these fixed names.
const lightImage = computed(() =>
  props.image?.replace(/cover\.png$/, "cover-light.png"),
);
</script>
