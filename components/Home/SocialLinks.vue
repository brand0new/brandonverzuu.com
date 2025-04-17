<template>
  <div>
    <h2 class="mb-4">Find me on</h2>
    <div class="space-y-5">
      <NuxtLink v-for="link in links" :key="link.icon" :to="link.url" external
        class="flex items-end gap-4 dark:hover:text-gray-300 group">
        <p class="text-sm text-gray-600 dark:text-gray-400 group-hover:text-primary-600">
          {{ link.name }}
        </p>
        <div class="flex-1 border-b border-dashed border-gray-300 dark:border-gray-800 group-hover:border-gray-700">
        </div>
        <UIcon :name="link.icon" size="25" mode="svg" class="text-primary-400 group-hover:text-primary-600"></UIcon>
      </NuxtLink>
    </div>
  </div>
</template>

<script lang="ts" setup>
const links = [
  {
    name: "X",
    url: "https://twitter.com/brandonverzuu",
    icon: "mage:x",
  },
  {
    name: "GitHub",
    url: "https://github.com/brand0new",
    icon: "mage:github",
  },
  {
    name: "Medium",
    url: "https://medium.com/@brandon-verzuu",
    icon: "mage:medium",
  },
  {
    name: "Linkedin",
    url: "https://www.linkedin.com/in/brandonverzuu/",
    icon: "mage:linkedin",
  }
];
</script>
