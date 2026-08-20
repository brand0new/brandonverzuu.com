<template>
  <NuxtLink :to="article.path" class="group">
    <article
      class="from-terracotta to-porcelain-950 relative overflow-hidden rounded-xl bg-gradient-to-br"
    >
      <!-- Background image. Only rendered when the article declares a cover in
           its frontmatter: this is a static build, so a guessed path for an
           article without a cover is a hard 404 in production rather than a
           silently empty image. Articles without one fall back to the gradient
           on the wrapper above. -->
      <div
        v-if="article.image"
        class="absolute inset-0 z-0 bg-cover bg-center"
        :style="{ backgroundImage: `url(${article.image})` }"
      ></div>
      <!-- Overlay -->
      <div class="absolute inset-0 z-0 bg-black/40"></div>
      <!-- Cover image credit. Most open-license sources require attribution,
           so this shows whenever the article set imageAuthor in frontmatter. -->
      <span
        v-if="article.imageAuthor"
        class="absolute right-2 bottom-2 z-10 text-[10px] text-gray-300/80"
      >
        Photo: {{ article.imageAuthor }}
      </span>
      <!-- Content -->
      <div class="relative z-10 m-8 p-4">
        <time
          class="relative z-10 order-first mb-3 flex items-center pl-3.5 text-sm text-gray-200 dark:text-gray-300"
          :datetime="article.date"
        >
          <span
            class="absolute inset-y-0 left-0 flex items-center"
            aria-hidden="true"
          >
            <span
              class="h-4 w-0.5 rounded-full bg-gray-200 dark:bg-gray-500"
            ></span>
          </span>
          {{ getReadableDate(article.date) }}
        </time>
        <h2 class="group-hover:text-primary-400 text-white dark:text-white">
          {{ article.title }}
        </h2>
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
