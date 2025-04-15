<template>
  <main v-if="article" class="min-h-screen">
    <div class="prose dark:prose-invert prose-blockquote:not-italic prose-pre:bg-gray-900 prose-img:rounded-lg">
      <h1>{{ article.title }}</h1>
      <UBadge v-for="tag in article.tags" :label="tag" class="mx-1 rounded-full" variant="outline" />
      <ContentRenderer :value="article" />
    </div>
  </main>
</template>
<script lang="ts" setup>
const slug = useRoute().params.slug as string
const { data: article } = await useAsyncData(`articles-${slug}`, () => {
  return queryCollection('articles').path(`/articles/${slug}`).first()
})

useSeoMeta({
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
