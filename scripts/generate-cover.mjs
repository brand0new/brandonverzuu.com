#!/usr/bin/env node
// Fetches an open-license source image (or reads one already on disk) and
// converts it into a stylized duotone article-card cover, dithered with
// either the Bayer ordered-dither algorithm (default) or Zhou-Fang
// variable-coefficient error diffusion — see scripts/lib/bayer-dither.mjs
// and scripts/lib/zhou-fang-*.mjs.
//
// Usage:
//   node scripts/generate-cover.mjs --url <image-url> --slug <article-slug> \
//     --author "Jane Doe" --license "CC-BY-4.0" --source <page-url>
//   node scripts/generate-cover.mjs --file <local-path> --slug <article-slug>
//   node scripts/generate-cover.mjs --file <local-path> --slug <article-slug> \
//     --dither zhou-fang
//
// Exactly one of --url / --file is required. Writes
// public/articles/<slug>/cover.png and prints the frontmatter fields to
// paste into the article (image / imageAuthor / imageLicense / imageSource
// — see content.config.ts).
//
// Runs at build time only (Node, via `npm run cover:generate`) — nothing
// here ships to the browser or runs on Cloudflare's edge.

import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { toLinearLuminance } from "./lib/color.mjs";
import { zhouFangDither } from "./lib/zhou-fang-dither.mjs";
import { bayerDither } from "./lib/bayer-dither.mjs";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Expected a #rrggbb hex color, got: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if ((!args.url && !args.file) || (args.url && args.file) || !args.slug) {
    console.error(
      "Usage: node scripts/generate-cover.mjs (--url <image-url> | --file <local-path>) --slug <article-slug> " +
        "[--author <name>] [--license <spdx-or-name>] [--source <page-url>] " +
        "[--width 1200] [--height 630] [--light #d97a4d] [--dark #1d2e34] [--seed <string>] " +
        "[--dither bayer|zhou-fang] [--bayer-size 4] [--pixel-size 3]",
    );
    process.exitCode = 1;
    return;
  }

  const width = Number(args.width ?? 1200);
  const height = Number(args.height ?? 630);
  // Complementary duotone defaults: porcelain-950 (public/css/main.css, the
  // site's dark brand tone, hue ~192°) against a warm terracotta accent at
  // roughly the complementary hue (~19°) — a warm highlight against the
  // site's cool teal chrome, rather than a same-hue tint of it.
  const light = hexToRgb(args.light ?? "#d97a4d");
  const dark = hexToRgb(args.dark ?? "#1d2e34");
  const seed = args.seed ?? args.url ?? args.file;
  const ditherMode = args.dither ?? "bayer";
  const bayerSize = Number(args["bayer-size"] ?? 4);
  // Each dithered "pixel" is rendered as a pixelSize x pixelSize block of
  // the final image (dither at a reduced resolution, then upscale with
  // nearest-neighbor) — bigger blocks read as a coarser, chunkier halftone;
  // 1 dithers at full output resolution, one dot per real pixel.
  const pixelSize = Number(args["pixel-size"] ?? 3);

  let sourceBuffer;
  if (args.file) {
    console.log(`Reading ${args.file} ...`);
    sourceBuffer = await readFile(args.file);
  } else {
    console.log(`Fetching ${args.url} ...`);
    const res = await fetch(args.url);
    if (!res.ok) {
      throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
    }
    sourceBuffer = Buffer.from(await res.arrayBuffer());
  }

  const ditherWidth = Math.max(1, Math.round(width / pixelSize));
  const ditherHeight = Math.max(1, Math.round(height / pixelSize));

  const { data, info } = await sharp(sourceBuffer)
    .resize(ditherWidth, ditherHeight, { fit: "cover", position: "attention" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixelCount = info.width * info.height;
  const luminance = toLinearLuminance(data, pixelCount, info.channels);

  let bits;
  if (ditherMode === "zhou-fang") {
    bits = zhouFangDither(luminance, info.width, info.height, { seed });
  } else if (ditherMode === "bayer") {
    bits = bayerDither(luminance, info.width, info.height, {
      matrixSize: bayerSize,
    });
  } else {
    throw new Error(
      `Unknown --dither mode: ${ditherMode} (expected "bayer" or "zhou-fang")`,
    );
  }

  const rgb = Buffer.alloc(pixelCount * 3);
  for (let i = 0; i < pixelCount; i++) {
    const [r, g, b] = bits[i] ? light : dark;
    rgb[i * 3] = r;
    rgb[i * 3 + 1] = g;
    rgb[i * 3 + 2] = b;
  }

  const outDir = path.join("public", "articles", args.slug);
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "cover.png");

  // Only 2 colors in the output — an indexed palette PNG compresses this
  // far better than a lossy format would, with no dither-smearing artifacts.
  // "nearest" upscaling turns each dithered pixel into a crisp pixelSize x
  // pixelSize block instead of blurring it into a soft-edged blob.
  await sharp(rgb, {
    raw: { width: info.width, height: info.height, channels: 3 },
  })
    .resize(width, height, { kernel: "nearest" })
    .png({ palette: true, colors: 2, compressionLevel: 9 })
    .toFile(outPath);

  console.log(`Wrote ${outPath}`);
  console.log("\nAdd to the article's frontmatter:\n");
  console.log(`image: "/articles/${args.slug}/cover.png"`);
  if (args.author) console.log(`imageAuthor: "${args.author}"`);
  if (args.license) console.log(`imageLicense: "${args.license}"`);
  if (args.source) console.log(`imageSource: "${args.source}"`);
  if (!args.author || !args.license || !args.source) {
    console.log(
      "\nNote: --author/--license/--source were not all provided. Fill in " +
        "whatever attribution the source image's license requires before " +
        "publishing — most open-license imagery (CC-BY, etc.) requires credit.",
    );
  }
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exitCode = 1;
});
