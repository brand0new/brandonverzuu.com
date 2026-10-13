<template>
  <main class="min-h-screen">
    <AppHeader class="mb-12" title="Projects" :description="description" />
    <ul class="grid gap-4 sm:grid-cols-2">
      <li v-for="(project, id) in projects" :key="id">
        <AppProjectCard :project="project" />
      </li>
    </ul>
  </main>
</template>

<script setup>
const description =
  "A collection of my projects, open source and otherwise. Some are in progress, some are finished, and some are just ideas. I hope you find something interesting here.";
const { data: projects } = await useAsyncData("projects", () =>
  queryCollection("projects").all(),
);

useSeoMeta({
  title: "Projects | Brandon Verzuu",
  description: description,
  ogUrl: "https://brandonverzuu.com/projects",
  // No dedicated hero image for this index page (it's a list of projects,
  // each with its own thumbnail) — fall back to the avatar so social
  // previews still resolve to a real file rather than 404ing, matching the
  // fallback articles/[slug].vue uses when an article has no cover.
  ogImage: "https://brandonverzuu.com/avatar.jpg",
  twitterCard: "summary_large_image",
});
</script>
