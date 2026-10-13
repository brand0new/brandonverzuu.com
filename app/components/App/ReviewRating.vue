<template>
  <!-- A 0–10 rating drawn as its 4-bit binary encoding (8 -> 1000, see
       app/utils/reviews.ts's ratingToBits), the same literal-binary
       language as AppTopicBinaryIcon, with the decimal score underneath so
       it's readable without decoding.

       Both visible parts are aria-hidden and replaced by one sr-only
       sentence: read separately they would come out as "one zero zero
       zero, eight slash ten".

       Digit colours are AppTopicBinaryIcon's measured pair:
       text-terracotta-heading 5.38:1 on the light page,
       text-terracotta 5.84:1 on the dark one. All four digits share
       one colour; dimming the zeros would have pushed them under 4.5:1. -->
  <div class="flex flex-none flex-col items-center gap-1">
    <span class="sr-only">Rated {{ rating }} out of {{ MAX_RATING }}</span>
    <span
      aria-hidden="true"
      class="text-terracotta-heading dark:text-terracotta font-mono leading-none font-bold tracking-tight select-none"
      :style="{ fontSize: `${fontSize}px` }"
    >
      {{ ratingToBits(rating) }}
    </span>
    <span
      aria-hidden="true"
      class="text-xs leading-none font-medium text-gray-600 tabular-nums dark:text-gray-400"
    >
      {{ rating }}/{{ MAX_RATING }}
    </span>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Whole-number score, 0–10 (enforced by content.config.ts). */
    rating: number;
    /** Pixel size of the binary digits; the decimal label stays text-xs. */
    fontSize?: number;
  }>(),
  { fontSize: 18 },
);
</script>
