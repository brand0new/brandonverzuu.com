<template>
  <!-- Purely decorative — the hero's actual content (Home/Intro.vue) sits in
       normal document flow above this in index.vue and stays fully
       accessible/readable; this is absolutely positioned behind it. -->
  <canvas
    ref="canvasEl"
    aria-hidden="true"
    class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] w-full opacity-[0.16] dark:opacity-[0.22]"
  ></canvas>
</template>

<script setup lang="ts">
// A slowly-drifting Bayer-dithered noise field behind the homepage hero.
//
// Deliberately the same *algorithm* as scripts/lib/bayer-dither.mjs (see
// that file for the construction/citation) so the hero texture reads as the
// same visual language as the dithered article covers — just animated and
// abstract (noise, not a photo) rather than a static image generated at
// build time. Ported inline rather than imported: the build-time script
// runs under Node with `sharp`; this needs to be small, dependency-free
// browser code that runs every animation frame.
//
// Renders at a deliberately low, chunky resolution (one dithered "pixel" per
// several real pixels, upscaled with the canvas's default nearest-neighbor
// image-smoothing-disabled scaling) and a low frame rate — this is meant to
// look like coarse, deliberate digital texture, not a smooth generic web
// animation.

const canvasEl = ref<HTMLCanvasElement | null>(null);

// Matches the article-cover duotone (public/css/main.css --color-terracotta /
// --color-porcelain-950). Kept as plain hex here since this runs before any
// CSS custom property lookup would be meaningful on a bare canvas.
const LIGHT = [217, 122, 77]; // terracotta
const DARK = [29, 46, 52]; // porcelain-950

const CELL = 6; // px per dithered "pixel" — chunky, matches cover.png's pixelSize feel
const FPS = 7; // deliberately low: reads as "drifting", not smooth animation

// Standard 4x4 Bayer ordered-dither threshold matrix (see bayer-dither.mjs
// for the recursive construction — hardcoded here since it never changes).
const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

let raf = 0;
let lastFrame = 0;
let seed = 0;
let reduceMotion = false;

// Cheap deterministic 2D value noise so the field drifts smoothly instead of
// flickering randomly frame to frame — no dependency, just a hashed sine
// field offset by `seed`, which advances slowly each frame.
function noise(x: number, y: number, t: number) {
  const v =
    Math.sin(x * 0.12 + t * 0.6) * Math.cos(y * 0.1 - t * 0.4) +
    Math.sin((x + y) * 0.05 + t * 0.3);
  return (v + 2) / 4; // normalize roughly into [0, 1]
}

function draw(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  const cols = Math.ceil(cssWidth / CELL);
  const rows = Math.ceil(cssHeight / CELL);

  if (canvas.width !== cssWidth * dpr || canvas.height !== cssHeight * dpr) {
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;

  const isDark = document.documentElement.classList.contains("dark");
  const on = isDark ? LIGHT : DARK;
  const off = isDark ? DARK : LIGHT;

  for (let row = 0; row < rows; row++) {
    const bayerRow = BAYER_4X4[row % 4];
    for (let col = 0; col < cols; col++) {
      const threshold = (bayerRow[col % 4] + 0.5) / 16;
      const value = noise(col, row, seed);
      const [r, g, b] = value >= threshold ? on : off;
      // Fade the whole field out toward the bottom so it blends into the
      // page rather than ending on a hard edge.
      const fade = 1 - row / rows;
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${fade})`;
      ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
    }
  }
}

function loop(timestamp: number) {
  if (!canvasEl.value) return;
  const interval = 1000 / FPS;
  if (timestamp - lastFrame >= interval) {
    lastFrame = timestamp;
    seed += 0.04;
    draw(canvasEl.value);
  }
  if (!reduceMotion) {
    raf = requestAnimationFrame(loop);
  }
}

onMounted(() => {
  reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (canvasEl.value) {
    draw(canvasEl.value); // always paint one frame, even for reduced motion
  }
  if (!reduceMotion) {
    raf = requestAnimationFrame(loop);
  }

  window.addEventListener("resize", handleResize);
});

function handleResize() {
  if (canvasEl.value) draw(canvasEl.value);
}

onUnmounted(() => {
  cancelAnimationFrame(raf);
  window.removeEventListener("resize", handleResize);
});
</script>
