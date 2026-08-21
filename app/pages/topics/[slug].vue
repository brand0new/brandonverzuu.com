<template>
  <main v-if="cluster" class="min-h-screen">
    <nav aria-label="Breadcrumb" class="mb-4">
      <ol
        class="flex flex-wrap items-center gap-1 text-sm text-gray-500 dark:text-gray-400"
      >
        <li><NuxtLink to="/" class="hover:text-primary-500">Home</NuxtLink></li>
        <li aria-hidden="true">/</li>
        <li>
          <NuxtLink to="/topics" class="hover:text-primary-500">Topics</NuxtLink>
        </li>
        <li aria-hidden="true">/</li>
        <li class="text-gray-700 dark:text-gray-300" aria-current="page">
          {{ cluster.title }}
        </li>
      </ol>
    </nav>
    <div class="mb-8 flex items-start gap-4">
      <div
        class="text-primary-600 dark:text-primary-400 bg-primary-500/10 flex-none rounded-lg p-3"
      >
        <client-only>
          <Icon :name="cluster.icon" aria-hidden="true" class="h-7 w-7" />
        </client-only>
      </div>
      <div class="min-w-0">
        <h1>{{ cluster.title }}</h1>
        <p class="mt-6 text-base text-gray-600 dark:text-gray-400">
          {{ cluster.intro }}
        </p>
      </div>
    </div>
    <ul v-if="filteredArticles.length" class="space-y-8">
      <li v-for="(article, id) in filteredArticles" :key="id">
        <AppArticleCard :article="article" />
      </li>
    </ul>
    <p v-else class="text-sm text-gray-500 dark:text-gray-400">
      No articles in this topic yet.
    </p>
  </main>
</template>

<script setup lang="ts">
const slug = useRoute().params.slug as string;
const cluster = topicClusters.find((c) => c.slug === slug);

if (!cluster) {
  throw createError({ statusCode: 404, statusMessage: "Topic not found" });
}

const { data: articles } = await useAsyncData(`topic-${slug}`, () =>
  queryCollection("articles")
    .where("published", "=", true)
    .order("date", "DESC")
    .all(),
);

// where("tags", ...) isn't expressible against a JSON array column via the
// query builder, so filter client/server-side in JS instead — the articles
// collection is small (a dozen entries), no performance concern here.
const filteredArticles = computed(() =>
  (articles.value ?? []).filter((article) =>
    article.tags?.some((tag) => cluster!.tags.includes(tag)),
  ),
);

useSeoMeta({
  title: () => `${cluster!.title} | Brandon Verzuu`,
  description: () => cluster!.summary,
  ogUrl: () => `https://brandonverzuu.com/topics/${slug}`,
});

useTopicClusterSchema({
  title: cluster.title,
  description: cluster.summary,
  slug,
  articles: filteredArticles.value.map((article) => ({
    title: article.title,
    url: `https://brandonverzuu.com${article.path}`,
    datePublished: String(article.date),
  })),
});
</script>
