// Social cards (og:image / twitter:image), 1200x630, in the Noise to Signal language.
//
// Runs in Node at build time only: the static endpoints in src/pages/og/ call renderCard()
// while `astro build` prerenders, and the PNGs land in dist/og/ like any other page. Nothing
// here ships to the browser.
//
// Layout: a dark porcelain panel on the left carries the BV mark, a mono kicker, the title in
// billboard type with a signal-chartreuse drop, and the domain. On the right, an image (an
// article's own dithered cover, the dithered portrait, or a dithered gradient) shows through,
// and the panel's edge dissolves into it through a Bayer threshold ramp: the same
// noise-to-signal transition the covers make on the site. Text is drawn as SVG paths from the
// self-hosted fonts (opentype.js), so the output never depends on fonts installed on the
// build machine.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import opentype from "opentype.js";
import sharp from "sharp";
import { toLinearLuminance } from "./color.mjs";
import { bayerDither } from "./bayer-dither.mjs";
import { zhouFangDither } from "./zhou-fang-dither.mjs";
import { themes } from "./tokens.mjs";

export const W = 1200;
export const H = 630;
// Covers dither in 3x3 blocks; the card's own dither uses the same grid so the edges line up.
const BLOCK = 3;
const t = themes.dark;

// npm runs the build from apps/site; resolve the font packages from there so this works the
// same whether it runs as a script or bundled into Astro's prerender chunk.
const require = createRequire(path.join(process.cwd(), "package.json"));
const fontFile = (pkg, file) => readFileSync(require.resolve(`${pkg}/files/${file}`));
const toArrayBuffer = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
let fonts;
function loadFonts() {
  fonts ??= {
    display: opentype.parse(toArrayBuffer(fontFile("@fontsource/big-shoulders-display", "big-shoulders-display-latin-900-normal.woff"))),
    mono: opentype.parse(toArrayBuffer(fontFile("@fontsource/ibm-plex-mono", "ibm-plex-mono-latin-500-normal.woff"))),
  };
  return fonts;
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** Width of a string in px, with extra tracking (em) between glyphs. */
function measure(font, text, size, tracking = 0) {
  return font.getAdvanceWidth(text, size) + Math.max(0, [...text].length - 1) * tracking * size;
}

/** SVG path data for a string, glyph by glyph so tracking can be applied. */
function textPath(font, text, x, y, size, tracking = 0) {
  if (!tracking) return font.getPath(text, x, y, size).toPathData(2);
  let d = "";
  let cx = x;
  for (const ch of text) {
    d += font.getPath(ch, cx, y, size).toPathData(2);
    cx += font.getAdvanceWidth(ch, size) + tracking * size;
  }
  return d;
}

/** Greedy word wrap. Returns null when a single word is wider than maxWidth. */
function wrap(font, text, size, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    if (measure(font, w, size) > maxWidth) return null;
    const next = line ? `${line} ${w}` : w;
    if (measure(font, next, size) <= maxWidth) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** The largest size (from max down to min) at which the title fits in maxLines and maxHeight. */
function fitTitle(font, text, maxWidth, maxHeight, maxLines, max, min) {
  for (let size = max; size >= min; size -= 2) {
    const lines = wrap(font, text, size, maxWidth);
    // Cap height of the first line plus the line steps below it.
    if (lines && lines.length <= maxLines && size * 0.74 + (lines.length - 1) * size * 0.88 <= maxHeight) return { size, lines };
  }
  // Still too long at the smallest size: keep maxLines and end the last one with an ellipsis.
  const lines = wrap(font, text, min, maxWidth) ?? [text];
  if (lines.length <= maxLines) return { size: min, lines };
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.includes(" ") && measure(font, `${last}…`, min) > maxWidth) last = last.slice(0, last.lastIndexOf(" "));
  kept[maxLines - 1] = `${last}…`;
  return { size: min, lines: kept };
}

/** A two-tone dithered image (terracotta dots on the dark panel) from any source, as RGB raw. */
async function ditherImage(input, w, h, mode, seed, extract) {
  const dw = Math.round(w / BLOCK);
  const dh = Math.round(h / BLOCK);
  let pipeline = sharp(input);
  if (extract) pipeline = pipeline.extract(extract);
  pipeline = pipeline.resize(dw, dh, { fit: "cover", position: "centre" }).removeAlpha();
  // Stretch contrast first, as the article-cover skill does, so a face reads as a face.
  if (mode === "zhou-fang") pipeline = pipeline.grayscale().normalise().linear(1.6, 0);
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  const lum = toLinearLuminance(data, info.width * info.height, info.channels);
  const bits = mode === "zhou-fang" ? zhouFangDither(lum, info.width, info.height, { seed }) : bayerDither(lum, info.width, info.height);
  return twoTone(bits, info.width, info.height, w, h);
}

/** A dithered diagonal gradient: the noise floor, for cards without an image of their own. */
async function ditherGradient(w, h) {
  const dw = Math.round(w / BLOCK);
  const dh = Math.round(h / BLOCK);
  const lum = new Float64Array(dw * dh);
  for (let y = 0; y < dh; y++)
    for (let x = 0; x < dw; x++) {
      const u = x / dw;
      const v = y / dh;
      lum[y * dw + x] = Math.min(1, Math.max(0, 0.08 + 0.75 * (0.65 * u + 0.35 * (1 - v)) ** 1.6));
    }
  return twoTone(bayerDither(lum, dw, dh), dw, dh, w, h);
}

async function twoTone(bits, dw, dh, w, h) {
  const on = hex(t.dot);
  const off = hex(t.panel);
  const rgb = Buffer.alloc(dw * dh * 3);
  for (let i = 0; i < dw * dh; i++) rgb.set(bits[i] ? on : off, i * 3);
  return sharp(rgb, { raw: { width: dw, height: dh, channels: 3 } }).resize(w, h, { kernel: "nearest" }).png().toBuffer();
}

/**
 * The left panel as RGBA: solid paper up to `from`, then a Bayer-thresholded ramp that
 * dissolves into the image beneath by `to`.
 */
function panel(from, to) {
  const paper = hex(t.paper);
  const m = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const buf = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const bx = Math.floor(x / BLOCK);
      const by = Math.floor(y / BLOCK);
      const ramp = (bx * BLOCK - from) / (to - from); // 0 inside the panel, 1 past the edge
      const solid = ramp <= 0 || (ramp < 1 && (m[(by % 4) * 4 + (bx % 4)] + 0.5) / 16 > ramp);
      if (!solid) continue;
      const i = (y * W + x) * 4;
      buf.set(paper, i);
      buf[i + 3] = 255;
    }
  return buf;
}

/**
 * Render a card.
 * @param {object} o
 * @param {string} o.title - billboard title, drawn uppercase.
 * @param {string} o.kicker - mono line above the title.
 * @param {string} [o.footer] - mono line at the bottom, defaults to the domain.
 * @param {{ file?: string, buffer?: Buffer, dither?: "bayer" | "zhou-fang", ready?: boolean, right?: number, extract?: { left: number, top: number, width: number, height: number } }} [o.image]
 *   `ready: true` uses a file that's already a dithered cover as-is; otherwise the image is
 *   dithered here, full-bleed or, with `right`, into a box that wide at the right edge. No
 *   image gives the dithered gradient. `extract` crops the source first (sharp's extract).
 * @param {number} [o.panelTo] - x where the panel has fully dissolved (default 820).
 * @returns {Promise<Buffer>} PNG
 */
export async function renderCard({ title, kicker, footer = "brandonverzuu.com", image, panelTo = 820 }) {
  const { display, mono } = loadFonts();
  const panelFrom = panelTo - 200;
  const pad = 72;
  const textWidth = panelFrom - pad - 24;

  let bg;
  if (image?.ready) bg = await sharp(image.file).resize(W, H, { fit: "cover" }).removeAlpha().png().toBuffer();
  else if (image?.right) {
    // Only the right-hand box, so a square portrait isn't cropped to a letterbox.
    const x = W - image.right;
    const box = await ditherImage(image.buffer ?? image.file, image.right, H, image.dither ?? "bayer", image.file ?? title, image.extract);
    bg = await sharp({ create: { width: W, height: H, channels: 3, background: t.panel } }).composite([{ input: box, left: x, top: 0 }]).png().toBuffer();
  } else if (image) bg = await ditherImage(image.buffer ?? image.file, W, H, image.dither ?? "bayer", image.file ?? title, image.extract);
  else bg = await ditherGradient(W, H);

  // Mark, top left: "B" in ink, "V" in the accent, as in the site's top bar.
  const markSize = 64;
  const markY = pad + markSize * 0.8;
  const bW = display.getAdvanceWidth("B", markSize);
  const mark = `<path d="${textPath(display, "B", pad, markY, markSize)}" fill="${t.ink}"/><path d="${textPath(display, "V", pad + bW, markY, markSize)}" fill="${t.accent}"/>`;

  // Title, bottom-aligned above the footer, with the signal drop after its last line. It may
  // grow up to just under the kicker, which needs to clear the mark.
  const footY = H - pad + 6;
  const lastBase = footY - 64;
  const titleTop = markY + 104;
  const { size, lines } = fitTitle(display, title.toUpperCase(), textWidth, lastBase - titleTop, 5, 128, 48);
  const lh = size * 0.88;
  const firstBase = lastBase - (lines.length - 1) * lh;
  const titlePaths = lines.map((l, i) => `<path d="${textPath(display, l, pad, firstBase + i * lh, size)}" fill="${t.ink}"/>`).join("");
  const drop = Math.round(size * 0.17);
  const lastW = measure(display, lines.at(-1), size);
  const dropX = Math.min(pad + lastW + size * 0.06, panelFrom - drop);
  const dropSvg = `<rect x="${dropX.toFixed(1)}" y="${(lastBase - drop).toFixed(1)}" width="${drop}" height="${drop}" fill="${t.signal}"/>`;

  // Kicker sits a fixed gap above the title's cap height.
  const kSize = 22;
  const kTrack = 0.08;
  const capTop = firstBase - size * 0.74;
  const kText = kicker.toUpperCase();
  const kFit = measure(mono, kText, kSize, kTrack) > textWidth ? (kSize * textWidth) / measure(mono, kText, kSize, kTrack) : kSize;
  const kicky = `<path d="${textPath(mono, kText, pad, capTop - 30, kFit, kTrack)}" fill="${t.muted}"/>`;
  const foot = `<path d="${textPath(mono, footer.toUpperCase(), pad, footY, 22, 0.08)}" fill="${t.ink}"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${mark}${kicky}${titlePaths}${dropSvg}${foot}</svg>`;

  return sharp(bg)
    .composite([
      { input: panel(panelFrom, panelTo), raw: { width: W, height: H, channels: 4 } },
      { input: Buffer.from(svg) },
    ])
    .png({ palette: true, colors: 16, compressionLevel: 9 })
    .toBuffer();
}

