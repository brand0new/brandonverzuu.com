<template>
  <main class="min-h-screen">
    <AppHeader
      class="mb-8"
      title="Topics"
      :description="description"
    />
    <ul class="space-y-8">
      <li v-for="cluster in topicClusters" :key="cluster.slug">
        <NuxtLink :to="`/topics/${cluster.slug}`" class="group block">
          <h3 class="group-hover:text-primary-500 dark:text-gray-100">
            {{ cluster.title }}
          </h3>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {{ cluster.summary }}
          </p>
        </NuxtLink>
      </li>
    </ul>
  </main>
</template>

<script setup lang="ts">
const description =
  "My writing organised by theme rather than publish date — cloud integration and API governance, AI and trust, and blockchain, each grouped into one place.";

useSeoMeta({
  title: "Topics | Brandon Verzuu",
  description,
  ogUrl: "https://brandonverzuu.com/topics",
});
</script>
