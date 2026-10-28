<template>
  <main class="min-h-screen">
    <AppBreadcrumb
      :items="[
        { label: 'Home', to: '/' },
        { label: 'Expertise', to: '/expert' },
        { label: 'Terms' },
      ]"
    />
    <ExpertLegalDocument title="Terms of service" :document="terms ?? null" />
  </main>
</template>

<script setup lang="ts">
// Newest published version wins; drafts (status: draft) are never shown.
const { data: terms } = await useAsyncData("expert-terms", () =>
  queryCollection("expertTerms")
    .where("status", "=", "published")
    .order("date", "DESC")
    .first(),
);

const description =
  "Terms of service for Brandon Verzuu's expertise service: API governance, skill design and process description checks.";

useSeoMeta({
  title: "Terms of service | Brandon Verzuu",
  description,
  ogUrl: "https://brandonverzuu.com/expert/terms",
  ogImage: "https://brandonverzuu.com/avatar.jpg",
  twitterCard: "summary_large_image",
});
</script>
