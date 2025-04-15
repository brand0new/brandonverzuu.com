<template>
  <main class="min-h-screen">
    <AppHeader class="mb-16" title="Articles" :description="description" />
    <ul class="space-y-16">
      <li v-for="(article, id) in articles" :key="id">
        <AppArticleCard :article="article" />
      </li>
    </ul>
  </main>
</template>

<script setup>
const description =
  "All of my long form content on software development, technology, and more, shown in chronological order.";
const { data: articles } = await useAsyncData("articles", () =>
  queryCollection("articles").order("published", "DESC").all()
);

useSeoMeta({
  title: "Articles | Brandon Verzuu",
  description,
});
</script>
