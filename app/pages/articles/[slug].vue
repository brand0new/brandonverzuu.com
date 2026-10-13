<template>
  <article
    v-if="article"
    class="prose dark:prose-invert prose-blockquote:not-italic prose-img:rounded-lg mx-auto"
  >
    <!-- Visible breadcrumb trail, paired with the BreadcrumbList schema
         emitted by useArticleSchema — matching markup and structured data
         is what search engines actually reward with a breadcrumb rich
         result, an unmatched pair is often ignored. -->
    <nav aria-label="Breadcrumb" class="not-prose mb-4">
      <ol class="flex flex-wrap items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-400">
        <li><NuxtLink to="/" class="hover:text-primary-600">Home</NuxtLink></li>
        <li aria-hidden="true">/</li>
        <li><NuxtLink to="/articles" class="hover:text-primary-600">Articles</NuxtLink></li>
        <li aria-hidden="true">/</li>
        <li class="text-gray-800 dark:text-gray-300" aria-current="page">
          {{ article.title }}
        </li>
      </ol>
    </nav>
    <h1>{{ article.title }}</h1>
    <UBadge
      v-for="tag in article.tags"
      :label="tag"
      class="mx-1 rounded-full"
      variant="subtle"
    />
    <AppArticleExplainer
      v-if="article.explainerVideo"
      :src="article.explainerVideo"
      :webm="article.explainerVideoWebm"
      :poster="article.explainerPoster"
      :alt="article.explainerAlt"
    />
    <ContentRenderer :value="article" />
  </article>
</template>
<script lang="ts" setup>
const slug = useRoute().params.slug as string;
const { data: article } = await useAsyncData(`articles-${slug}`, () => {
  return queryCollection("articles").path(`/articles/${slug}`).first();
});

// BlogPosting + BreadcrumbList JSON-LD — only once the article has actually
// resolved, since useArticleSchema needs real title/description/date values
// rather than emitting a schema block for a not-yet-loaded page.
watch(
  article,
  (value) => {
    if (!value) return;
    useArticleSchema({
      title: value.title,
      description: value.description,
      slug,
      date: String(value.date),
      image: value.image,
      tags: value.tags,
    });
  },
  { immediate: true },
);

useSeoMeta({
  title: () =>
    article.value
      ? `${article.value.title} | Brandon Verzuu`
      : "Brandon Verzuu",
  description: () => article.value?.description,
  ogTitle: () =>
    article.value
      ? `${article.value.title} | Brandon Verzuu`
      : "Brandon Verzuu",
  ogDescription: () => article.value?.description,
  // Absolute URL to a file that actually exists in the static output. The
  // previous `/articles/${slug}.png` was never generated or committed, so every
  // social preview resolved to a 404. Fall back to the avatar when an article
  // declares no cover image.
  ogImage: () =>
    `https://brandonverzuu.com${article.value?.image ?? "/avatar.jpg"}`,
  ogUrl: () => `https://brandonverzuu.com/articles/${slug}`,
  twitterCard: "summary_large_image",
  author: "Brandon Verzuu",
});
</script>

<style>
.prose h2 a,
.prose h3 a {
  text-decoration: none;
}

img {
  width: 100%;
  height: auto;
}
</style>
