<script setup lang="ts">
defineProps<{
  /** Visible text. The control keeps its own sr-only name, so this is aria-hidden. */
  text: string;
}>();
</script>

<template>
  <!--
    Hover/focus label for an icon-only navbar control. Place it inside a
    `relative` element carrying the `group/nav` class.

    CSS-only rather than UTooltip: UTooltip waits out an open delay, never
    opens on keyboard focus, and teleports out of the header. Hidden below
    sm, where the icons sit in a scrolling strip that would clip it and
    there is no hover anyway; Tailwind v4's group-hover already only
    matches devices that can hover, so a tap on a tablet doesn't leave it
    stuck open.

    gray-800 on white is 14.5:1 and gray-100 on gray-900 is 16.9:1 (AA 4.5:1).
  -->
  <span
    aria-hidden="true"
    data-nav-label
    class="pointer-events-none absolute top-full left-1/2 z-20 mt-1 hidden -translate-x-1/2 rounded-md bg-white px-2 py-1 text-xs whitespace-nowrap text-gray-800 opacity-0 shadow-lg ring-1 shadow-gray-800/5 ring-gray-900/5 transition-opacity group-hover/nav:opacity-100 group-focus-visible/nav:opacity-100 motion-reduce:transition-none sm:block dark:bg-gray-900 dark:text-gray-100 dark:ring-white/20"
  >
    {{ text }}
  </span>
</template>
