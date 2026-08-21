<template>
  <main class="min-h-screen">
    <AppHeader class="mb-8" title="Articles" :description="description" />
    <ul class="space-y-8">
      <li v-for="(article, id) in articles" :key="id">
        <AppArticleCard :article="article" />
      </li>
    </ul>
  </main>
</template>

<script setup lang="ts">
const description =
  "All of my long form content on software development, technology, and more, shown in chronological order.";
const { data: articles } = await useAsyncData("articles", () =>
  queryCollection("articles")
    .where("published", "=", true)
    .order("date", "DESC")
    .all(),
);

useSeoMeta({
  title: "Articles | Brandon Verzuu",
  description,
  ogUrl: "https://brandonverzuu.com/articles",
  // Falls back to the avatar so social previews resolve to a real file
  // instead of 404ing — see articles/[slug].vue for the origin of this
  // pattern, now applied to every index page that has no page-specific hero.
  ogImage: "https://brandonverzuu.com/avatar.jpg",
  twitterCard: "summary_large_image",
});
</script>
