<template>
  <div>
    <h2 class="mb-6">Featured articles</h2>
    <ul class="space-y-8">
      <li v-for="(article, id) in articles" :key="id">
        <AppArticleCard :article="article" />
      </li>
    </ul>
    <div class="mt-6 flex items-center justify-center gap-6 text-sm">
      <UButton
        label="All Articles &rarr;"
        to="/articles"
        variant="link"
        color="primary"
        class="text-primary-700 dark:text-primary-400"
      />
      <UButton
        label="Browse by Topic &rarr;"
        to="/topics"
        variant="link"
        color="primary"
        class="text-primary-700 dark:text-primary-400"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
const { data: articles } = await useAsyncData("articles-home", () =>
  queryCollection("articles")
    .select("title", "description", "date", "slug", "path", "tags", "image")
    .where("published", "=", true)
    .limit(5)
    .order("date", "DESC")
    .all(),
);
</script>
