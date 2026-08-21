<template>
  <NuxtLink :to="`/topics/${cluster.slug}`" class="group block">
    <article
      class="relative flex items-start gap-4 rounded-xl border border-gray-200 p-5 transition-colors group-hover:border-gray-300 dark:border-white/10 dark:group-hover:border-white/20"
    >
      <div
        class="bg-primary-500/10 flex-none rounded-lg p-3"
      >
        <AppTopicBinaryIcon :keyword="cluster.binaryKeyword" :font-size="7" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center justify-between gap-2">
          <h2
            class="group-hover:text-primary-600 dark:group-hover:text-primary-400 dark:text-gray-100"
          >
            {{ cluster.title }}
          </h2>
        </div>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {{ cluster.summary }}
        </p>
        <span
          class="mt-3 inline-block text-xs font-medium text-gray-500"
        >
          {{ articleCount }} {{ articleCount === 1 ? "article" : "articles" }}
        </span>
      </div>
    </article>
  </NuxtLink>
</template>

<script setup lang="ts">
import type { TopicCluster } from "~/utils/topicClusters";

defineProps<{
  cluster: TopicCluster;
  /** Pre-computed count of published articles matching this cluster's tags
   *  — computed by the caller (see pages/topics/index.vue) rather than here,
   *  since counting requires the full articles collection the index page
   *  already fetches; keeping this component a pure presentational card. */
  articleCount: number;
}>();
</script>
