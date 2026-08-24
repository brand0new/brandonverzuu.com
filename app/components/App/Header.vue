<template>
  <div>
    <h1>
      {{ title }}
    </h1>
    <p class="body-text mt-6 text-lg leading-relaxed">
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
