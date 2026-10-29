<template>
  <!-- Same trail as pages/topics/[slug].vue: plain links separated by "/",
       the current page last and unlinked. -->
  <nav aria-label="Breadcrumb" class="mb-4">
    <ol
      class="flex flex-wrap items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-400"
    >
      <template v-for="(item, index) in items" :key="item.label">
        <li v-if="index > 0" aria-hidden="true">/</li>
        <li
          v-if="index === items.length - 1"
          class="text-gray-700 dark:text-gray-300"
          aria-current="page"
        >
          {{ item.label }}
        </li>
        <li v-else>
          <NuxtLink :to="item.to" class="hover:text-primary-600">
            {{ item.label }}
          </NuxtLink>
        </li>
      </template>
    </ol>
  </nav>
</template>

<script setup lang="ts">
defineProps<{
  /** Root first, current page last; every item but the last needs `to`. */
  items: { label: string; to?: string }[];
}>();
</script>
