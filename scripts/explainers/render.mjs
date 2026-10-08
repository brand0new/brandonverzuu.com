#!/usr/bin/env node
// Renders an animated explainer (scripts/explainers/stories/<story>.js) to the
// files an article embeds: a silent looping H.264 MP4, a VP9 WebM and a
// poster PNG. See scripts/explainers/README.md.
//
// Usage:
//   npm run explainer:render -- <story> --slug <article-slug>
//   npm run explainer:render -- zero-ticket --slug building-platforms-for-vendor-led-enterprises
//   npm run explainer:render -- zero-ticket --stills 3,12,31.5 --out /tmp/review
//
// Options:
//   --slug <slug>     write to public/articles/<slug>/ (default output)
//   --out <dir>       write to this directory instead
//   --fps <n>         frame rate (default 30)
//   --fonts <dir>     folder holding GeneralSans-Regular.woff2 and
//                     GeneralSans-Semibold.woff2 (default scripts/explainers/fonts);
//                     without it the page loads General Sans from Fontshare
//   --stills <t,...>  only write PNG stills at these times (seconds) for review
//
// Runs locally only (Node + Playwright's Chromium + ffmpeg on PATH); nothing
// here ships to the browser or runs on Cloudflare.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { args._.push(a); continue; }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) args[a.slice(2)] = true;
    else { args[a.slice(2)] = next; i++; }
  }
  return args;
}

function fail(msg) { console.error(`explainer: ${msg}`); process.exit(1); }

const args = parseArgs(process.argv.slice(2));
const story = args._[0];
if (!story) fail("name a story, e.g. `npm run explainer:render -- zero-ticket --slug <slug>`");
const storyFile = path.join(here, "stories", `${story}.js`);
if (!existsSync(storyFile)) fail(`no story at ${path.relative(root, storyFile)}`);
const stills = args.stills ? String(args.stills).split(",").map(Number) : null;
const outDir = args.out ? path.resolve(args.out) : args.slug ? path.join(root, "public/articles", args.slug) : null;
if (!outDir) fail("pass --slug <article-slug> or --out <dir>");
const fps = Number(args.fps ?? 30);
if (!stills && spawnSync("ffmpeg", ["-version"]).status !== 0) fail("ffmpeg is not on PATH");

// Fonts: local files when present (embedded as data URLs so the page needs no
// network), otherwise Fontshare, the same source nuxt.config.ts uses.
const fontDir = path.resolve(args.fonts ?? path.join(here, "fonts"));
const fontFiles = { 400: "GeneralSans-Regular.woff2", 600: "GeneralSans-Semibold.woff2" };
let fontCss;
if (Object.values(fontFiles).every((f) => existsSync(path.join(fontDir, f)))) {
  const faces = await Promise.all(Object.entries(fontFiles).map(async ([weight, f]) => {
    const b64 = (await readFile(path.join(fontDir, f))).toString("base64");
    return `@font-face{font-family:"General Sans";src:url(data:font/woff2;base64,${b64}) format("woff2");font-weight:${weight}}`;
  }));
  fontCss = `<style>${faces.join("")}</style>`;
} else {
  fontCss = `<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=general-sans@400,600&display=swap">`;
}

const icons = JSON.parse(await readFile(path.join(root, "node_modules/@iconify-json/mage/icons.json"), "utf8")).icons;
const iconBodies = Object.fromEntries(Object.entries(icons).map(([k, v]) => [k, v.body]));
const [kit, storySrc] = await Promise.all([readFile(path.join(here, "kit.js"), "utf8"), readFile(storyFile, "utf8")]);

const html = `<!doctype html><html><head><meta charset="utf-8">${fontCss}
<style>html,body{margin:0;background:#09090b}canvas{display:block}</style></head>
<body><canvas id="c" width="1280" height="720"></canvas>
<script>window.ICONS=${JSON.stringify(iconBodies)};</script>
<script>${kit}\n${storySrc}</script></body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setContent(html, { waitUntil: "load" });
  const fontsOk = await page.evaluate(async () => {
    await Promise.all([document.fonts.load("400 16px 'General Sans'"), document.fonts.load("600 16px 'General Sans'")]);
    return document.fonts.check("400 16px 'General Sans'") && document.fonts.check("600 16px 'General Sans'");
  });
  if (errors.length) fail(`story failed to load: ${errors.join("; ")}`);
  if (!fontsOk) fail(`General Sans did not load; put ${Object.values(fontFiles).join(" and ")} in ${path.relative(root, fontDir)}/ (or allow api.fontshare.com)`);

  const frame = (t) => page.evaluate((t) => { window.STORY.render(t); return document.getElementById("c").toDataURL("image/png"); }, t);
  const png = (dataUrl) => Buffer.from(dataUrl.split(",")[1], "base64");
  const { duration, poster } = await page.evaluate(() => ({ duration: window.STORY.duration, poster: window.STORY.poster }));
  await mkdir(outDir, { recursive: true });

  if (stills) {
    for (const t of stills) {
      const file = path.join(outDir, `${story}-${t}s.png`);
      await writeFile(file, png(await frame(t)));
      console.log(`wrote ${path.relative(process.cwd(), file)}`);
    }
  } else {
    const frames = await mkdtemp(path.join(tmpdir(), `explainer-${story}-`));
    const n = Math.round(duration * fps);
    for (let i = 0; i < n; i++) {
      await writeFile(path.join(frames, `f${String(i).padStart(5, "0")}.png`), png(await frame(i / fps)));
      if (i % fps === 0) process.stdout.write(`\rrendering ${i}/${n} frames`);
    }
    process.stdout.write(`\rrendered ${n} frames            \n`);
    if (errors.length) fail(`render errors: ${errors.join("; ")}`);

    const input = ["-loglevel", "error", "-y", "-framerate", String(fps), "-i", path.join(frames, "f%05d.png")];
    const encode = (file, codec) => {
      const r = spawnSync("ffmpeg", [...input, ...codec, file], { stdio: "inherit" });
      if (r.status !== 0) fail(`ffmpeg failed for ${file}`);
      console.log(`wrote ${path.relative(process.cwd(), file)}`);
    };
    // H.264 High profile, 4:2:0, moov atom up front for progressive playback.
    encode(path.join(outDir, "explainer.mp4"), ["-c:v", "libx264", "-preset", "slow", "-crf", "16", "-tune", "animation", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an"]);
    // VP9 constant quality; offered first by AppArticleExplainer.
    encode(path.join(outDir, "explainer.webm"), ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-row-mt", "1", "-pix_fmt", "yuv420p", "-an"]);
    await writeFile(path.join(outDir, "explainer-poster.png"), png(await frame(poster)));
    console.log(`wrote ${path.relative(process.cwd(), path.join(outDir, "explainer-poster.png"))}`);
    await rm(frames, { recursive: true, force: true });

    if (args.slug) {
      const base = `/articles/${args.slug}`;
      console.log(`\nFront matter:\nexplainerVideo: "${base}/explainer.mp4"\nexplainerVideoWebm: "${base}/explainer.webm"\nexplainerPoster: "${base}/explainer-poster.png"\nexplainerAlt: "<describe the story for screen readers>"`);
    }
  }
} finally {
  await browser.close();
}
