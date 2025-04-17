<template>
  <NuxtLink class="flex items-end gap-4 group p-2 -m-2 rounded-lg" :to="props.project.url" target="_blank" external>
    <div class="max-w-sm">
      <h3 :class="['group-hover:text-primary-600', props.project.name.toLowerCase()]">
        {{ props.project.name }}
      </h3>
      <p class="text-sm text-gray-600 dark:text-gray-400">{{ props.project.description }}</p>
    </div>
    <div class="flex-1 border-b border-dashed border-gray-300 dark:border-gray-800 group-hover:border-gray-700"></div>
    <UAvatar :src="props.project.thumbnail" size="md" :alt="props.project.name" />
  </NuxtLink>
</template>

<script setup lang="ts">
const props = defineProps({
  project: {
    type: Object as () => {
      name: string;
      description: string;
      url: string;
      thumbnail: string;
    },
    required: true,
  },
});
</script>

<style scoped>
.abcdates {
  font-family: 'Telma';
  color: pink
}
</style>
