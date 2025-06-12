<template>
  <NuxtLink :to="article.path" class="group">
    <article class="relative rounded-xl overflow-hidden">
      <!-- Background image -->
      <div
        class="absolute inset-0 z-0 bg-cover bg-center"
        :style="{ backgroundImage: `url(/articles/${article.slug}/cover.jpg)` }"
      ></div>
      <!-- Overlay -->
      <div class="absolute inset-0 z-0 bg-black/40"></div>
      <!-- Content -->
      <div class="relative z-10 p-4 m-8">
        <time class="relative z-10 order-first flex items-center mb-3 text-sm text-gray-200 dark:text-gray-300 pl-3.5"
          :datetime="article.date"
        >
          <span class="absolute inset-y-0 left-0 flex items-center" aria-hidden="true">
            <span class="h-4 w-0.5 rounded-full bg-gray-200 dark:bg-gray-500"></span>
          </span>
          {{ getReadableDate(article.date) }}
        </time>
        <h3 class="group-hover:text-primary-400 text-white dark:text-white">
          {{ article.title }}
        </h3>
        <p class="relative z-10 mt-2 text-sm text-gray-100 dark:text-gray-200">
          {{ article.description }}
        </p>
      </div>
    </article>
  </NuxtLink>
</template>

<script setup>
defineProps({
  article: {
    type: Object,
    required: true,
  },
});

const getReadableDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

</script>