<template>
  <div>
    <h1>
      {{ title }}
    </h1>
    <p class="mt-6 text-lg leading-relaxed text-gray-700 dark:text-gray-400">
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
