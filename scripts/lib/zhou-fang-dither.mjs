// Zhou-Fang variable-coefficient error-diffusion dithering.
//
// A faithful port of the "Zhoufang" branch of Robert Kist's libdither
// (https://github.com/robertkist/libdither, dither_varerrdiff.c) — see
// zhou-fang-tables.mjs for attribution and algorithm references.
//
// The algorithm is inherently bilevel (each pixel becomes pure black or
// pure white): it walks the image in serpentine (boustrophedon) order,
// diffusing each pixel's quantization error to its right, below-left/
// below-right, and below neighbours using a 3-tap kernel whose weights
// vary by gray level (finer, more numerous coefficients in the midtones,
// where naive error diffusion produces "worm" artifacts). On top of that,
// Zhou & Fang's contribution is threshold modulation: instead of always
// comparing against a fixed 0.5, the threshold is jittered by a random
// amount whose *scale* also depends on gray level, which further breaks
// up periodic artifacts.
//
// One deliberate deviation from libdither: this port takes a `seed`
// instead of reading system time into `rand()`. libdither's own
// randomness makes every run of the reference implementation produce a
// different dither pattern; for a build script producing a static asset,
// re-running it without changing the source image should reproduce the
// same output, so the jitter here comes from a small seeded PRNG instead.

// mulberry32 — small, fast, seeded PRNG (public domain).
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

import {
  ZHOUFANG_DIVS,
  ZHOUFANG_COEF,
  RAND_SCALE,
} from "./zhou-fang-tables.mjs";

const OFFSET_X = [
  [1, -1, 0],
  [-1, 1, 0],
];
const OFFSET_Y = [
  [0, 1, 1],
  [0, 1, 1],
];

/**
 * @param {Float64Array|number[]} luminance - row-major, one entry per
 *   pixel, linear-light luminance in [0, 1] (see toLinearLuminance below).
 * @param {number} width
 * @param {number} height
 * @param {object} [options]
 * @param {boolean} [options.serpentine=true]
 * @param {number|string} [options.seed=0] - seeds the threshold jitter.
 * @returns {Uint8Array} one byte per pixel, 1 = white/"on", 0 = black/"off".
 */
export function zhouFangDither(luminance, width, height, options = {}) {
  const { serpentine = true, seed = 0 } = options;
  const rand = mulberry32(
    typeof seed === "string" ? hashSeed(seed) : seed >>> 0,
  );

  const buffer = Float64Array.from(luminance);
  const out = new Uint8Array(width * height);

  let direction = 0;
  const directionToggle = serpentine ? 2 : 1;

  for (let y = 0; y < height; y++) {
    const start = direction === 0 ? 0 : width - 1;
    const end = direction === 0 ? width : -1;
    const step = direction === 0 ? 1 : -1;

    for (let x = start; x !== end; x += step) {
      const addr = y * width + x;
      const px = luminance[addr];
      const foldedPx = px >= 0.5 ? 1 - px : px;

      let err = buffer[addr];
      const threshold =
        (128 +
          Math.floor(rand() * 128) *
            (RAND_SCALE[Math.min(127, Math.floor(foldedPx * 128))] / 100)) /
        256;

      if (err >= threshold) {
        out[addr] = 1;
        err = buffer[addr] - 1;
      }
      // else: out[addr] stays 0; err stays buffer[addr] (residual carries forward in full)

      // Off-by-one guard: libdither indexes this table with
      // round(foldedPx * 255), which reaches exactly 128 only when the
      // pixel is precisely mid-gray — one past the table's last valid
      // entry (127). Clamp rather than reproduce the read past the end.
      const coefOffs = Math.min(127, Math.round(foldedPx * 255));
      err /= ZHOUFANG_DIVS[coefOffs];

      for (let i = 0; i < 3; i++) {
        const xx = x + OFFSET_X[direction][i];
        if (xx > -1 && xx < width) {
          const yy = y + OFFSET_Y[direction][i];
          if (yy < height) {
            buffer[yy * width + xx] += err * ZHOUFANG_COEF[coefOffs * 3 + i];
          }
        }
      }
    }
    direction = (y + 1) % directionToggle;
  }

  return out;
}
