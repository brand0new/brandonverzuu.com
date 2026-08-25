<template>
  <!-- Renders `keyword` as literal ASCII-to-binary digits: one column per
       character, that character's 8 bits stacked top-to-bottom within its
       column (see app/utils/binary.ts's toBinaryColumns) — instead of a
       generic pictogram, in a bright terracotta monospace grid. Used by
       AppTopicCard and the /topics/[slug] hub header in place of the old
       Iconify icon, so each topic's "icon" is literally made of the binary
       encoding of a keyword that names it (API/AI/BTC) — ties into the
       site's existing dither/binary visual language.

       No background fill: renders directly on the page/card surface now
       (previously sat on a bg-primary-500/10 badge — removed at the call
       sites, App/TopicCard.vue and pages/topics/[slug].vue).

       Per-theme color, unchanged in substance from before this change:
       still needs one shade per theme, just now measured against each
       page's own actual background instead of the removed badge's.
       text-terracotta-heading (light mode) hits 5.38:1 against white —
       raw --color-terracotta only manages 3.07:1 there, failing WCAG AA
       (this is still a visually-rendered, sighted-perceived element even
       though aria-hidden, so it's held to the same AA bar as real text —
       see main.css's terracotta-heading rationale). In dark mode the
       relationship flips: raw --color-terracotta clears 5.84:1 against
       the near-black page, while terracotta-heading only reaches 3.33:1
       there (too dark/muted once there's no light badge lifting it) —
       so dark mode keeps the brighter raw tone, same as before. -->
  <div
    aria-hidden="true"
    class="text-terracotta-heading dark:text-terracotta flex flex-none gap-1 font-mono leading-none font-bold tracking-tighter select-none"
    :style="{ fontSize: `${fontSize}px` }"
  >
    <div v-for="(column, i) in columns" :key="i" class="flex flex-col">
      <span v-for="(bit, j) in column" :key="j">{{ bit }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    keyword: string;
    /** Pixel font size for each binary digit — controls the whole grid's
     *  scale since it's plain monospace text, no separate width/height. */
    fontSize?: number;
  }>(),
  { fontSize: 7 },
);

const columns = computed(() => toBinaryColumns(props.keyword));
</script>
