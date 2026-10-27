<template>
  <article
    v-if="review"
    class="mx-auto prose dark:prose-invert prose-blockquote:not-italic prose-img:rounded-lg"
  >
    <!-- Breadcrumb paired with useReviewSchema's BreadcrumbList, same as
         articles/[slug].vue. -->
    <nav aria-label="Breadcrumb" class="not-prose mb-4">
      <ol
        class="flex flex-wrap items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-400"
      >
        <li><NuxtLink to="/" class="hover:text-primary-600">Home</NuxtLink></li>
        <li aria-hidden="true">/</li>
        <li>
          <NuxtLink to="/reviews" class="hover:text-primary-600"
            >Reviews</NuxtLink
          >
        </li>
        <li aria-hidden="true">/</li>
        <li class="text-gray-800 dark:text-gray-300" aria-current="page">
          {{ review.title }}
        </li>
      </ol>
    </nav>
    <h1>{{ review.title }}</h1>
    <div class="not-prose my-6 flex items-center gap-5">
      <AppReviewRating :rating="review.rating" :font-size="28" />
      <div class="min-w-0">
        <p class="font-semibold text-gray-900 dark:text-gray-100">
          {{ review.subject.name }}
        </p>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ subjectLine }}
        </p>
      </div>
    </div>
    <p class="lead">{{ review.verdict }}</p>
    <UBadge
      v-for="tag in review.tags"
      :key="tag"
      :label="tag"
      class="mx-1 rounded-full"
      variant="subtle"
    />
    <dl
      v-if="review.details?.length"
      class="not-prose my-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm"
    >
      <template v-for="detail in review.details" :key="detail.label">
        <dt class="font-medium text-gray-600 dark:text-gray-400">
          {{ detail.label }}
        </dt>
        <dd class="text-gray-900 dark:text-gray-100">{{ detail.value }}</dd>
      </template>
    </dl>
    <ContentRenderer :value="review" />
    <!-- Covers are official art, not open-license imagery, so every review
         credits the rights holder and links where the art came from. -->
    <p class="not-prose mt-12 text-xs text-gray-600 dark:text-gray-400">
      Cover art: {{ review.imageAuthor }} (<NuxtLink
        :to="review.imageSource"
        external
        target="_blank"
        class="underline hover:text-primary-600"
        >source<span class="sr-only"> (opens in new tab)</span></NuxtLink
      >)
    </p>
  </article>
</template>

<script lang="ts" setup>
import { media } from "~/utils/reviews";

const slug = useRoute().params.slug as string;
const { data: review } = await useAsyncData(`reviews-${slug}`, () =>
  queryCollection("reviews").path(`/reviews/${slug}`).first(),
);

// "Video game · 2022 · FromSoftware", skipping whatever isn't set.
const subjectLine = computed(() =>
  review.value
    ? [
        media[review.value.medium].label,
        review.value.subject.year,
        review.value.subject.creator,
      ]
        .filter(Boolean)
        .join(" · ")
    : "",
);

watch(
  review,
  (value) => {
    if (!value) return;
    useReviewSchema({
      title: value.title,
      description: value.description,
      slug,
      date: String(value.date),
      image: value.image,
      medium: value.medium,
      subject: value.subject,
      rating: value.rating,
    });
  },
  { immediate: true },
);

useSeoMeta({
  title: () =>
    review.value ? `${review.value.title} | Brandon Verzuu` : "Brandon Verzuu",
  description: () => review.value?.description,
  ogTitle: () =>
    review.value ? `${review.value.title} | Brandon Verzuu` : "Brandon Verzuu",
  ogDescription: () => review.value?.description,
  ogImage: () =>
    `https://brandonverzuu.com${review.value?.image ?? "/avatar.jpg"}`,
  ogUrl: () => `https://brandonverzuu.com/reviews/${slug}`,
  twitterCard: "summary_large_image",
  author: "Brandon Verzuu",
});
</script>
