<template>
  <!-- Renders `keyword` as literal ASCII-to-binary digits (one row per
       character, 8 bits each — see app/utils/binary.ts) instead of a
       generic pictogram, in a bright terracotta monospace grid. Used by
       AppTopicCard and the /topics/[slug] hub header in place of the old
       Iconify icon, so each topic's "icon" is literally made of the binary
       encoding of a keyword that names it (API/AI/BTC) — ties into the
       site's existing dither/binary visual language.

       Per-theme color, not a single shared CSS var: this sits on a pale
       primary-500/10 badge background in light mode (~#eef4f6) where raw
       --color-terracotta only hits 2.76:1 (fails WCAG AA even for this
       decorative aria-hidden element, since it's still visually rendered
       and perceived by sighted low-vision users) — text-terracotta-heading
       clears 4.84:1 there. Dark mode's badge background is dark enough
       that the brighter raw --color-terracotta reads correctly and stays
       vivid, matching the "punchy/bright" look wanted in both themes. -->
  <div
    aria-hidden="true"
    class="text-terracotta-heading dark:text-terracotta font-mono leading-none font-bold tracking-tighter select-none"
    :style="{ fontSize: `${fontSize}px` }"
  >
    <div v-for="(row, i) in rows" :key="i">{{ row }}</div>
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

const rows = computed(() => toBinaryRows(props.keyword));
</script>
