<template>
  <!-- Purely decorative — positioned absolutely against app.vue's full-width
       wrapper (not the width-constrained UContainer the page content sits
       in), so it spans edge-to-edge and sits behind AppNavbar, mirroring
       HomeDitherBackground's placement/z-index approach exactly. Uses the
       article's own dithered cover image (public/articles/<slug>/cover.png)
       as a static background rather than an animated canvas: starts at the
       very top, spans full viewport width, and tapers off via a CSS mask
       gradient before the article body starts — same visual language as the
       homepage hero (start top, full width, fade going down), just a static
       image instead of drifting noise since the source is a pre-rendered
       dither, not something we can regenerate per-frame in the browser. -->
  <div
    ref="bgEl"
    aria-hidden="true"
    class="pointer-events-none absolute inset-x-0 top-0 -z-10 w-full bg-cover bg-top opacity-45 dark:opacity-55"
    :style="{
      height: `${height}px`,
      backgroundImage: `url(${image})`,
      maskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)',
      WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)',
    }"
  ></div>
</template>

<script setup lang="ts">
const props = defineProps<{ image: string }>();

const bgEl = ref<HTMLDivElement | null>(null);
const height = ref(600);
let resizeObserver: ResizeObserver | null = null;

// Same boundary-measurement approach as HomeDitherBackground: height is
// computed at runtime to reach the [data-article-background-boundary]
// marker placed just before <ContentRenderer> in pages/articles/[slug].vue,
// so the fade always finishes before the article body starts regardless of
// title length, tag count, or viewport size.
function measureHeight() {
  const boundary = document.querySelector(
    "[data-article-background-boundary]",
  );
  if (!boundary) return;
  const rect = boundary.getBoundingClientRect();
  height.value = Math.max(200, Math.round(rect.top + window.scrollY));
}

onMounted(() => {
  measureHeight();
  resizeObserver = new ResizeObserver(() => measureHeight());
  resizeObserver.observe(document.body);
  window.addEventListener("resize", measureHeight);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  window.removeEventListener("resize", measureHeight);
});

// image prop changes (navigating between two article pages without a full
// remount) should re-measure since content length likely differs.
watch(
  () => props.image,
  () => nextTick(measureHeight),
);
</script>
