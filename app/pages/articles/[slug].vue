<template>
  <article
    v-if="article"
    class="prose dark:prose-invert prose-blockquote:not-italic prose-img:rounded-lg mx-auto"
  >
    <h1 class="text-7xl font-extrabold">{{ article.title }}</h1>
    <UBadge
      v-for="tag in article.tags"
      :label="tag"
      class="mx-1 rounded-full"
      variant="subtle"
    />
    <!-- AppArticleDitherBackground (rendered in app.vue) measures this to
         know where to fully fade out — it must finish fading before the
         article body starts, mirroring HomeDitherBackground's own
         boundary-detection logic against [data-dither-boundary]. -->
    <div data-article-background-boundary></div>
    <ContentRenderer :value="article" />
  </article>
</template>
<script lang="ts" setup>
const slug = useRoute().params.slug as string;
const { data: article } = await useAsyncData(`articles-${slug}`, () => {
  return queryCollection("articles").path(`/articles/${slug}`).first();
});

// Drives AppArticleDitherBackground in app.vue — see
// composables/useArticleBackgroundImage.ts for why this is shared state
// rather than a prop (the background layer lives outside this page's
// <UContainer>). Only set when the article actually declares a cover;
// articles without one simply render no background layer, same as
// AppArticleCard's own fallback-to-gradient behaviour.
const articleBackgroundImage = useArticleBackgroundImage();
watch(
  article,
  (value) => {
    articleBackgroundImage.value = value?.image ?? null;
  },
  { immediate: true },
);
onUnmounted(() => {
  articleBackgroundImage.value = null;
});

useSeoMeta({
  title: () =>
    article.value
      ? `${article.value.title} | Brandon Verzuu`
      : "Brandon Verzuu",
  description: () => article.value?.description,
  ogTitle: () =>
    article.value
      ? `${article.value.title} | Brandon Verzuu`
      : "Brandon Verzuu",
  ogDescription: () => article.value?.description,
  // Absolute URL to a file that actually exists in the static output. The
  // previous `/articles/${slug}.png` was never generated or committed, so every
  // social preview resolved to a 404. Fall back to the avatar when an article
  // declares no cover image.
  ogImage: () =>
    `https://brandonverzuu.com${article.value?.image ?? "/avatar.jpg"}`,
  ogUrl: () => `https://brandonverzuu.com/articles/${slug}`,
  twitterCard: "summary_large_image",
  author: "Brandon Verzuu",
});
</script>

<style>
.prose h2 a,
.prose h3 a {
  text-decoration: none;
}

img {
  width: 100%;
  height: auto;
}
</style>
