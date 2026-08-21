<template>
  <main class="min-h-screen">
    <AppHeader class="mb-12" :title="title" :description="description" />
    <!-- HomeDitherBackground (rendered in app.vue for this route) measures
         this to know where to fully fade out — mirrors the homepage's own
         boundary marker so the terracotta hero always finishes fading
         before the topic cards start, regardless of viewport size. -->
    <div data-dither-boundary></div>
    <ul class="space-y-4">
      <li v-for="cluster in clustersWithCounts" :key="cluster.slug">
        <AppTopicCard :cluster="cluster" :article-count="cluster.count" />
      </li>
    </ul>
  </main>
</template>

<script setup lang="ts">
const title = "Topics";
const description =
  "My writing organised by theme rather than publish date — cloud integration and API governance, AI and trust, and blockchain, each grouped into one place.";

const { data: articles } = await useAsyncData("topics-index-articles", () =>
  queryCollection("articles").where("published", "=", true).all(),
);

// Article counts per cluster, computed once here so AppTopicCard stays a
// pure presentational component — same tag-intersection logic as the
// cluster page's own filteredArticles (pages/topics/[slug].vue).
const clustersWithCounts = computed(() =>
  topicClusters.map((cluster) => ({
    ...cluster,
    count: (articles.value ?? []).filter((article) =>
      article.tags?.some((tag) => cluster.tags.includes(tag)),
    ).length,
  })),
);

useSeoMeta({
  title: "Topics | Brandon Verzuu",
  description,
  ogUrl: "https://brandonverzuu.com/topics",
  // Falls back to the avatar so social previews resolve to a real file
  // instead of 404ing — see articles/[slug].vue for the origin of this
  // pattern, now applied to every index page that has no page-specific hero.
  ogImage: "https://brandonverzuu.com/avatar.jpg",
  twitterCard: "summary_large_image",
});
</script>
