<template>
  <!-- Purely decorative — positioned absolutely against app.vue's full-width
       wrapper (not the width-constrained UContainer the page content sits
       in), so it spans edge-to-edge and sits behind AppNavbar (a `fixed`
       element that always paints above regardless of z-index here). Height
       is computed at runtime to reach the [data-dither-boundary] marker,
       which any top-level hub page (currently the homepage and /topics)
       places just before its "next section" starts, so the fade always
       finishes before that section regardless of viewport size or content
       reflow. -->
  <canvas
    ref="canvasEl"
    aria-hidden="true"
    class="pointer-events-none absolute inset-x-0 top-0 -z-10 w-full opacity-60 dark:opacity-55"
    :style="{ height: `${height}px` }"
  ></canvas>
</template>

<script setup lang="ts">
// A drifting Bayer-dithered noise field behind the homepage hero.
//
// Deliberately the same *algorithm* as scripts/lib/bayer-dither.mjs (see
// that file for the construction/citation) so the hero texture reads as the
// same visual language as the dithered article covers — just animated and
// abstract (noise, not a photo) rather than a static image generated at
// build time. Ported inline rather than imported: the build-time script
// runs under Node with `sharp`; this needs to be small, dependency-free
// browser code that runs every animation frame.
//
// Renders at a deliberately chunky resolution (one dithered "pixel" per
// several real pixels, upscaled with image-smoothing disabled) so it reads
// as coarse, deliberate digital texture rather than a smooth generic web
// gradient — but the noise field itself moves at a speed and contrast
// clearly perceptible at a glance, not a barely-there ambient effect.

const canvasEl = ref<HTMLCanvasElement | null>(null);
const height = ref(600);

// Matches the article-cover duotone (public/css/main.css --color-terracotta /
// --color-porcelain-950). Kept as plain hex here since this runs before any
// CSS custom property lookup would be meaningful on a bare canvas.
//
// Dark-mode pair, composited at 55% opacity over a near-black page — this
// combination reads with strong contrast there. Alpha-compositing the same
// pair over a *white* page instead washes both tones toward pastel gray
// (measured ~1.6:1 dot-to-dot contrast at the old 45% light-mode opacity —
// the pattern nearly disappeared). NEAR_BLACK below is a warmer, near-black
// "off" tone that stays dark even after alpha blending onto white, paired
// with a higher light-mode opacity (see template above) so the pattern
// stays legible against a white background.
const LIGHT = [217, 122, 77]; // terracotta
const DARK = [29, 46, 52]; // porcelain-950
const NEAR_BLACK = [20, 15, 12]; // warm near-black "off" tone for light mode

const CELL = 7; // px per dithered "pixel" — chunky, matches cover.png's pixelSize feel
const FPS = 14; // fast enough to visibly read as motion, still deliberately steppy

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
let resizeObserver: ResizeObserver | null = null;

// Cheap deterministic 2D value noise so the field drifts smoothly instead of
// flickering randomly frame to frame — no dependency, just a hashed sine
// field offset by `seed`, which advances each frame.
function noise(x: number, y: number, t: number) {
  const v =
    Math.sin(x * 0.12 + t * 0.9) * Math.cos(y * 0.1 - t * 0.6) +
    Math.sin((x + y) * 0.05 + t * 0.5);
  return (v + 2) / 4; // normalize roughly into [0, 1]
}

function measureHeight() {
  const boundary = document.querySelector("[data-dither-boundary]");
  if (!boundary) return;
  const rect = boundary.getBoundingClientRect();
  // getBoundingClientRect() is viewport-relative; the canvas is positioned
  // absolute against a wrapper that starts at the same point as the page,
  // so adding the current scroll position gives the boundary's distance
  // from the top of that wrapper/page.
  height.value = Math.max(200, Math.round(rect.top + window.scrollY));
}

function draw(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  if (cssWidth === 0 || cssHeight === 0) return;
  const cols = Math.ceil(cssWidth / CELL);
  const rows = Math.ceil(cssHeight / CELL);

  if (canvas.width !== cssWidth * dpr || canvas.height !== cssHeight * dpr) {
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const isDark = document.documentElement.classList.contains("dark");
  // "on" pixel is terracotta in both themes; only the "off" tone and the
  // overall opacity (set on the <canvas> element) change per theme.
  const on = LIGHT;
  const off = isDark ? DARK : NEAR_BLACK;

  for (let row = 0; row < rows; row++) {
    const bayerRow = BAYER_4X4[row % 4];
    for (let col = 0; col < cols; col++) {
      const threshold = (bayerRow[col % 4] + 0.5) / 16;
      const value = noise(col, row, seed);
      const [r, g, b] = value >= threshold ? on : off;
      // Fade the whole field out over its full height, fully transparent by
      // the very bottom (which is pinned to the Featured Projects boundary),
      // so it never bleeds into that section.
      const fade = Math.max(0, 1 - row / (rows - 1 || 1));
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
    seed += 0.08;
    draw(canvasEl.value);
  }
  if (!reduceMotion) {
    raf = requestAnimationFrame(loop);
  }
}

function handleResize() {
  measureHeight();
  if (canvasEl.value) draw(canvasEl.value);
}

onMounted(() => {
  reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  measureHeight();

  // The boundary marker's position depends on content below it (fonts
  // loading, images loading, layout shifts) settling — re-measure whenever
  // the page's layout changes, not just once on mount.
  resizeObserver = new ResizeObserver(() => handleResize());
  resizeObserver.observe(document.body);

  if (canvasEl.value) {
    draw(canvasEl.value); // always paint one frame, even for reduced motion
  }
  if (!reduceMotion) {
    raf = requestAnimationFrame(loop);
  }

  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  cancelAnimationFrame(raf);
  resizeObserver?.disconnect();
  window.removeEventListener("resize", handleResize);
});
</script>
