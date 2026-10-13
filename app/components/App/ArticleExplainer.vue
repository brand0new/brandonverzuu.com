<template>
  <!-- Looping, silent explainer video shown above an article's body. It is
       not autoplayed through the `autoplay` attribute: playback starts on
       mount instead, so readers who prefer reduced motion get the poster
       and a play button rather than motion they didn't ask for. The pause
       button keeps the loop compliant with WCAG 2.2.2 (moving content longer
       than five seconds needs a way to stop it). -->
  <figure class="not-prose my-8">
    <div
      class="relative overflow-hidden rounded-xl border border-gray-200 bg-[#09090b] dark:border-white/10"
    >
      <video
        ref="video"
        :poster="poster"
        :aria-label="alt"
        class="block aspect-video h-auto w-full"
        muted
        loop
        playsinline
        preload="metadata"
        @play="playing = true"
        @pause="playing = false"
      >
        <!-- WebM (VP9) first: smaller, and the only option in browsers built
             without an H.264 decoder. MP4 (H.264) covers everything else. -->
        <source v-if="webm" :src="webm" type="video/webm" />
        <source :src="src" type="video/mp4" />
      </video>
      <button
        type="button"
        class="absolute top-3 right-3 flex size-11 items-center justify-center rounded-full bg-zinc-900/80 text-white transition-colors hover:text-primary-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400"
        :aria-label="playing ? 'Pause animation' : 'Play animation'"
        @click="toggle"
      >
        <svg
          v-if="playing"
          aria-hidden="true"
          viewBox="0 0 24 24"
          class="size-5"
          fill="currentColor"
        >
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
        <svg
          v-else
          aria-hidden="true"
          viewBox="0 0 24 24"
          class="size-5"
          fill="currentColor"
        >
          <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
        </svg>
      </button>
    </div>
  </figure>
</template>
<script lang="ts" setup>
defineProps<{ src: string; webm?: string; poster?: string; alt?: string }>();

const video = ref<HTMLVideoElement | null>(null);
const playing = ref(false);

function toggle() {
  const el = video.value;
  if (!el) return;
  if (el.paused) el.play().catch(() => {});
  else el.pause();
}

onMounted(() => {
  const el = video.value;
  if (!el) return;
  // Set the property as well as the attribute: autoplay policies check the
  // live `muted` property, which Vue's SSR markup alone doesn't guarantee.
  el.muted = true;
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (!reduceMotion) el.play().catch(() => {});
});
</script>
