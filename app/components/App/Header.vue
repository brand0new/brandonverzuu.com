<template>
  <div>
    <h1 class="text-7xl font-extrabold">
      {{ title }}
    </h1>
    <p class="mt-6 text-base text-gray-600 dark:text-gray-400">
      {{ description }}
    </p>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
});
</script>
