#!/usr/bin/env node
// One-time backfill: derive cover-light.png for every existing article
// cover.png by remapping its dark "off" palette color to the light-theme
// off-white tone, without re-fetching/re-dithering from the original
// source image (some of which may no longer be reachable, and re-dithering
// risks producing a visually different bit pattern than the already-live
// cover.png — a palette remap guarantees an identical dither pattern,
// just recolored).
//
// Safe because generate-cover.mjs always writes a strict 2-color indexed
// PNG (terracotta "on" + a dark "off" tone) — this script asserts that
// invariant and fails loudly if any existing cover.png doesn't match it,
// rather than silently producing a wrong result.
//
// Usage: node scripts/backfill-cover-light.mjs

import { readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const LIGHT_BG = [251, 251, 248]; // matches Home/DitherBackground.vue's OFF_WHITE
const TERRACOTTA = [217, 122, 77]; // the "on" tone every cover.png uses

async function processOne(slug) {
  const coverPath = path.join("public", "articles", slug, "cover.png");
  const outPath = path.join("public", "articles", slug, "cover-light.png");

  const img = sharp(coverPath);
  const { width, height } = await img.metadata();
  const { data } = await img
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixelCount = width * height;
  const out = Buffer.alloc(pixelCount * 3);
  let terracottaCount = 0;
  let darkCount = 0;
  let unexpectedCount = 0;

  for (let i = 0; i < pixelCount; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    const isTerracotta =
      Math.abs(r - TERRACOTTA[0]) < 3 &&
      Math.abs(g - TERRACOTTA[1]) < 3 &&
      Math.abs(b - TERRACOTTA[2]) < 3;

    if (isTerracotta) {
      terracottaCount++;
      out[i * 3] = TERRACOTTA[0];
      out[i * 3 + 1] = TERRACOTTA[1];
      out[i * 3 + 2] = TERRACOTTA[2];
    } else {
      darkCount++;
      out[i * 3] = LIGHT_BG[0];
      out[i * 3 + 1] = LIGHT_BG[1];
      out[i * 3 + 2] = LIGHT_BG[2];
    }
  }

  if (terracottaCount === 0 || darkCount === 0) {
    throw new Error(
      `${coverPath}: expected a 2-color duotone with both terracotta and a dark tone present, ` +
        `got terracotta=${terracottaCount} dark=${darkCount} — refusing to guess, check the source image.`,
    );
  }

  await sharp(out, { raw: { width, height, channels: 3 } })
    .png({ palette: true, colors: 2, compressionLevel: 9 })
    .toFile(outPath);

  console.log(
    `${slug}: wrote cover-light.png (${terracottaCount} terracotta / ${darkCount} bg px)`,
  );
}

async function main() {
  const articlesDir = path.join("public", "articles");
  const slugs = await readdir(articlesDir);
  let ok = 0;
  let failed = 0;

  for (const slug of slugs) {
    try {
      await processOne(slug);
      ok++;
    } catch (err) {
      console.error(`FAILED ${slug}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${ok} succeeded, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
}

main();
