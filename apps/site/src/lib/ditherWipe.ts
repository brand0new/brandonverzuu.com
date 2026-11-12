// The dithered page wipe: the band of Bayer dots that sweeps down the viewport on navigation
// (global.css, "Page transitions"). It's built here at build time with the same ordered dither
// the covers and social cards use (scripts/lib/bayer-dither.mjs), and Base.astro writes it into
// CSS custom properties as SVG data URIs. Nothing is fetched and no script runs to draw it.
import { bayerDither } from "../../scripts/lib/bayer-dither.mjs";

/** Dot size in CSS px: four covers' worth of pixels per dot, so the grid reads as a grid. */
const CELL = 4;
/** One Bayer tile across; the mask repeats it horizontally. */
const COLS = 8;
/** Rows in the band, so it is 192px tall: long enough to read as a dissolve, short enough to stay quick. */
const ROWS = 48;

// A ramp from fully on (top row) to fully off (bottom row). Endpoints are exact so the band
// joins the solid area above it and the empty area below without a seam.
function band(): Uint8Array {
  const lum = new Float64Array(COLS * ROWS);
  for (let y = 0; y < ROWS; y++) lum.fill(1 - y / (ROWS - 1), y * COLS, (y + 1) * COLS);
  return bayerDither(lum, COLS, ROWS, { matrixSize: 8 });
}

// One rect per horizontal run of "on" cells, which keeps the SVG small and avoids hairline seams
// between neighbouring cells when the mask is scaled by a fractional device pixel ratio.
function svg(bits: Uint8Array, on: 0 | 1): string {
  let rects = "";
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; ) {
      if (bits[y * COLS + x] !== on) { x++; continue; }
      const start = x;
      while (x < COLS && bits[y * COLS + x] === on) x++;
      rects += `<rect x="${start}" y="${y}" width="${x - start}" height="1"/>`;
    }
  }
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${COLS} ${ROWS}" preserveAspectRatio="none" shape-rendering="crispEdges">${rects}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(doc)}")`;
}

const bits = band();

/** Custom properties for :root. `--wipe-in` is opaque at the top (the incoming page, revealed from
 * above); `--wipe-out` is its exact complement (the veil the no-view-transition fallback lifts). */
export const wipeVars =
  `--wipe-cell:${CELL}px;--wipe-w:${COLS * CELL}px;--wipe-band:${ROWS * CELL}px;` +
  `--wipe-in:${svg(bits, 1)};--wipe-out:${svg(bits, 0)}`;

/** The sweep: the band's top edge travels from just above the viewport to just below it. The
 * values are written out, not `var(--wipe-band)`: Firefox stops interpolating a registered custom
 * property when a keyframe contains var() and jumps from start to end at the halfway point
 * instead, so the band was never seen there (measured in Firefox 159). */
export const wipeKeyframes = `@keyframes wipe{from{--wipe-y:${-ROWS * CELL}px}to{--wipe-y:100lvh}}`;
