<template>
  <div>
    <h1>
      {{ title }}
    </h1>
    <!-- Default slot for multi-paragraph intros (the homepage); falls back
         to the single `description` paragraph every index page uses. -->
    <div class="body-text mt-6 space-y-4 text-lg leading-relaxed">
      <slot>
        <p>{{ description }}</p>
      </slot>
    </div>
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
    default: "",
  },
});
</script>
