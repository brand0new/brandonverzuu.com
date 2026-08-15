<template>
  <li>
    <div
      class="relative after:absolute after:top-1/2 after:right-0 after:left-0 after:-z-10 after:block after:h-[2px] after:w-full after:transform after:bg-gray-100 dark:after:bg-white/10"
    >
      <span
        class="bg-gray-50 pr-4 text-sm font-medium text-gray-600 dark:bg-black dark:text-gray-500"
        >{{ title }}</span
      >
    </div>
  </li>
</template>

<script lang="ts" setup>
defineProps({
  title: String,
});
</script>
