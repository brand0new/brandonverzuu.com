<template>
  <!-- A status callout for the /expert pages ("coming soon", "being
       drafted"). Not role="alert": it's static page content, not a live
       update. Opaque (bg-default) because it can overlap the dithered
       page background on short pages. The label uses the terracotta accent pair from
       conventions.md: terracotta-heading on white is 5.38:1, terracotta
       (#d97a4d) on the dark page (#18181b) is 5.8:1. -->
  <aside
    class="rounded-xl border border-gray-200 bg-default p-5 dark:border-white/10"
    :aria-label="label"
  >
    <p
      class="text-xs font-semibold tracking-wide text-terracotta-heading uppercase dark:text-terracotta"
    >
      {{ label }}
    </p>
    <div class="body-text mt-2 space-y-2">
      <slot />
    </div>
  </aside>
</template>

<script setup lang="ts">
defineProps<{
  /** Short status label, e.g. "Coming soon". */
  label: string;
}>();
</script>
