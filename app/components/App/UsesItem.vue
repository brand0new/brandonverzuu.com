<template>
  <li>
    <NuxtLink :to="item.url" class="group" target="_blank" external>
      <p
        class="text-base font-semibold text-gray-700 group-hover:text-primary-600 dark:text-gray-300"
      >
        {{ item.name }}
        <span class="sr-only">(opens in new tab)</span>
      </p>
      <p class="text-sm text-gray-500">{{ item.description }}</p>
    </NuxtLink>
  </li>
</template>

<script setup>
defineProps({
  item: Object,
  required: true,
});
</script>
