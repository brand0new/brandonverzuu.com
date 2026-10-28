<template>
  <main class="min-h-screen">
    <AppBreadcrumb
      :items="[
        { label: 'Home', to: '/' },
        { label: 'Expertise', to: '/expert' },
        { label: 'Privacy' },
      ]"
    />
    <ExpertLegalDocument
      title="Privacy statement"
      :document="privacy ?? null"
    />
  </main>
</template>

<script setup lang="ts">
// Newest published version wins; drafts (status: draft) are never shown.
const { data: privacy } = await useAsyncData("expert-privacy", () =>
  queryCollection("expertPrivacy")
    .where("status", "=", "published")
    .order("date", "DESC")
    .first(),
);

const description =
  "What Brandon Verzuu's expertise service stores about you, why, and for how long.";

useSeoMeta({
  title: "Privacy statement | Brandon Verzuu",
  description,
  ogUrl: "https://brandonverzuu.com/expert/privacy",
  ogImage: "https://brandonverzuu.com/avatar.jpg",
  twitterCard: "summary_large_image",
});
</script>
