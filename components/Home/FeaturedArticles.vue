<template>
  <div>
    <h2 class="mb-6">
      Featured articles
    </h2>
    <ul class="space-y-16">
      <li v-for="(article, id) in articles" :key="id">
        <AppArticleCard :article="article" />
      </li>
    </ul>
    <div class="flex items-center justify-center mt-6 text-sm">
      <UButton label="All Articles &rarr;" to="/articles" variant="link" color="primary" />
    </div>
  </div>
</template>

<script lang="ts" setup>
const { data: articles } = await useAsyncData("articles-home", () =>
  queryCollection("articles")
    .select("title", "description", "date", "slug", "path", "tags")
    .where("published", "=", true)
    .limit(5)
    .order("date", "DESC")
    .all()
);
</script>
