<template>
  <div>
    <h2 class="mb-6">
      Featured projects
    </h2>
    <div class="space-y-4">
      <AppProjectCard v-for="(project, id) in projects" :key="id" :project="project" />
    </div>
    <div class="flex items-center justify-center mt-6 text-sm">
      <UButton label="All Projects &rarr;" to="/projects" variant="link" color="primary" />
    </div>
  </div>
</template>

<script lang="ts" setup>
const { data: projects } = await useAsyncData("projects-home", () =>
  queryCollection("projects").limit(3).all()
);
</script>
