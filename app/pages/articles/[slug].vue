<template>
  <article v-if="article" class="prose mx-auto dark:prose-invert prose-blockquote:not-italic prose-img:rounded-lg">
    <h1 class="text-7xl font-extrabold">{{ article.title }}</h1>
    <UBadge v-for="tag in article.tags" :label="tag" class="mx-1 rounded-full" variant="subtle" />
    <ContentRenderer :value="article" />
  </article>
</template>
<script lang="ts" setup>
const slug = useRoute().params.slug as string
const { data: article } = await useAsyncData(`articles-${slug}`, () => {
  return queryCollection('articles')
    .path(`/articles/${slug}`)
    .first()
})

useSeoMeta({
  title: () => (article.value ? `${article.value.title} | Brandon Verzuu` : "Brandon Verzuu"),
  description: () => article.value?.description,
  ogTitle: () => (article.value ? `${article.value.title} | Brandon Verzuu` : "Brandon Verzuu"),
  ogDescription: () => article.value?.description,
  ogImage: `https://brandonverzuu.com/articles/${slug}.png`,
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
