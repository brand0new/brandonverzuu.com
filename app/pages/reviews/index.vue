<template>
  <main class="min-h-screen">
    <AppHeader class="mb-8" title="Reviews" :description="description" />
    <!-- Filtering is client-side on this one prerendered page rather than a
         prerendered page per medium: there are few reviews per medium, and
         thin category pages would do more harm than good for SEO. Chips
         only appear once there are two media to choose between. -->
    <div
      v-if="availableMedia.length > 1"
      role="group"
      aria-label="Filter reviews by medium"
      class="mb-8 flex flex-wrap gap-2"
    >
      <UButton
        v-for="option in filterOptions"
        :key="option.value ?? 'all'"
        :label="option.label"
        :aria-pressed="selected === option.value"
        :variant="selected === option.value ? 'solid' : 'outline'"
        color="neutral"
        size="sm"
        class="rounded-full"
        @click="selected = option.value"
      />
    </div>
    <ul v-if="filteredReviews.length" class="space-y-4">
      <li v-for="review in filteredReviews" :key="review.path">
        <AppReviewCard :review="review" />
      </li>
    </ul>
    <p v-else class="text-sm text-gray-600 dark:text-gray-400">
      No reviews yet.
    </p>
  </main>
</template>

<script setup lang="ts">
import { media, type ReviewMedium } from "~/utils/reviews";

const description =
  "What I thought of the films, series, games and books I've spent time with lately, each scored out of ten.";

const { data: reviews } = await useAsyncData("reviews", () =>
  queryCollection("reviews")
    .where("published", "=", true)
    .order("date", "DESC")
    .all(),
);

const selected = ref<ReviewMedium | null>(null);

// In the order they're declared in app/utils/reviews.ts, not the order
// they first appear, so the chips don't reshuffle when a review is added.
const availableMedia = computed(() =>
  (Object.keys(media) as ReviewMedium[]).filter((medium) =>
    reviews.value?.some((review) => review.medium === medium),
  ),
);

const filterOptions = computed(() => [
  { label: "All", value: null },
  ...availableMedia.value.map((medium) => ({
    label: media[medium].plural,
    value: medium,
  })),
]);

const filteredReviews = computed(() =>
  (reviews.value ?? []).filter(
    (review) => !selected.value || review.medium === selected.value,
  ),
);

useSeoMeta({
  title: "Reviews | Brandon Verzuu",
  description,
  ogUrl: "https://brandonverzuu.com/reviews",
  // Falls back to the avatar so social previews resolve to a real file
  // instead of 404ing — see articles/[slug].vue for the origin of this
  // pattern, now applied to every index page that has no page-specific hero.
  ogImage: "https://brandonverzuu.com/avatar.jpg",
  twitterCard: "summary_large_image",
});
</script>
