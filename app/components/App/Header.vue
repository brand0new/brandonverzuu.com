<template>
  <!-- Attrs (e.g. the page's bottom margin) go on the header block, not the
       boundary marker, so the marker sits *after* that spacing — the same
       spot pages used to place it by hand. -->
  <div v-bind="$attrs">
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
  <AppDitherBoundary />
</template>

<script setup>
defineOptions({ inheritAttrs: false });

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
