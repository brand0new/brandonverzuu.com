<template>
  <main>
    <AppHeader class="mb-12" title="Projects" :description="description" />
    <div class="space-y-4">
      <AppProjectCard v-for="(project, id) in projects" :key="id" :project="project" />
    </div>
  </main>
</template>

<script setup>
const description = "A collection of my projects, open source and otherwise. Some are in progress, some are finished, and some are just ideas. I hope you find something interesting here.";
const { data: projects } = await useAsyncData("projects", () =>
  queryCollection("projects").all()
);

useSeoMeta({
  title: "Projects | Brandon Verzuu",
  description: description
});

</script>
