<template>
  <NuxtLink :to="review.path" class="group block">
    <!-- The bordered card shell, not AppArticleCard's cover-image card: the
         rating's terracotta digits are only AA-measured against the plain
         page backgrounds, and a dithered cover behind them would make the
         contrast vary per review. The cover appears on the review page. -->
    <article
      class="relative flex items-start gap-5 rounded-xl border border-gray-200 p-5 transition-colors group-hover:border-gray-300 dark:border-white/10 dark:group-hover:border-white/20"
    >
      <AppReviewRating :rating="review.rating" />
      <div class="min-w-0 flex-1">
        <p class="text-xs font-medium text-gray-600 dark:text-gray-400">
          {{ subjectLine }} ·
          <time :datetime="String(review.date)">{{ readableDate }}</time>
        </p>
        <h2
          class="group-hover:text-primary-600 dark:group-hover:text-primary-400 mt-1 dark:text-gray-100"
        >
          {{ review.title }}
        </h2>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {{ review.verdict }}
        </p>
      </div>
    </article>
  </NuxtLink>
</template>

<script setup lang="ts">
import type { ReviewsCollectionItem } from "@nuxt/content";

const props = defineProps<{ review: ReviewsCollectionItem }>();

// "Video game · 2022", or just "Video game" when no year is set.
const subjectLine = computed(() =>
  [media[props.review.medium].label, props.review.subject.year]
    .filter(Boolean)
    .join(" · "),
);

const readableDate = computed(() =>
  new Date(props.review.date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }),
);
</script>
