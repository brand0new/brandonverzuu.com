<template>
  <div>
    <h2 class="uppercase text-xs font-semibold text-gray-400 mb-6">
      RECENT ARTICLES
    </h2>
    <ul class="space-y-16">
      <li v-for="(article, id) in articles" :key="id">
        <AppArticleCard :article="article" />
      </li>
    </ul>
    <div class="flex items-center justify-center mt-6 text-sm">
      <UButton label="All Articles &rarr;" to="/articles" variant="link" color="gray" />
    </div>
  </div>
</template>

<script lang="ts" setup>
const { data: articles } = await useAsyncData("articles-home", () =>
  queryCollection("articles")
    .order("published", "DESC")
    .limit(3)
    .select("title", "description", "published", "slug", "path")
    .all()
);
</script>
