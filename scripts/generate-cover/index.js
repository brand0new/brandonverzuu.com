#!/usr/bin/env node
"use strict";

/**
 * Generates OG-card cover images for articles: a 1200x630 PNG combining a
 * deterministic isometric "lattice" background art with a tag-driven color
 * gradient overlay, title, byline, and primary tag — no stock photography,
 * no per-article manual asset hunting.
 *
 * Usage:
 *   node scripts/generate-cover/index.js <slug>          # one article
 *   node scripts/generate-cover/index.js --all           # every article
 *
 * Requires a system Chromium/Chrome binary (headless rendering) — set
 * COVER_CHROMIUM_PATH to override the default lookup (`chromium`, then
 * `chromium-browser`, then `google-chrome`).
 *
 * Writes to public/articles/<slug>/cover.png. Does NOT touch frontmatter —
 * the caller (or the note-to-article pipeline) is responsible for setting
 * `image: "/articles/<slug>/cover.png"` once the file exists.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const matter = require("gray-matter");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const ARTICLES_DIR = path.join(REPO_ROOT, "content", "articles");
const PUBLIC_ARTICLES_DIR = path.join(REPO_ROOT, "public", "articles");
const TEMPLATE_PATH = path.join(__dirname, "template.html");
const TMP_DIR = path.join(__dirname, ".tmp");

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

// Fontshare CSS endpoint — same fonts/weights already used by nuxt.config.ts,
// fetched at generation time rather than vendored, so there's one font
// source of truth and no redistribution question for the repo. Fetched one
// family per request rather than combined — the combined `f[]=a&f[]=b&f[]=c`
// form has been unreliable (sometimes drops families) whereas one-per-call
// is consistent.
const FONT_REQUESTS = {
  "Cabinet Grotesk": "https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@800&display=swap",
  Satoshi: "https://api.fontshare.com/v2/css?f[]=satoshi@500&display=swap",
  Telma: "https://api.fontshare.com/v2/css?f[]=telma@500&display=swap",
};

// Tag -> color mapping, using ONLY colors already defined in
// public/css/main.css (midnight/madang/porcelain scales). Extend this list
// as new tags appear; `default` is the fallback for anything unmapped.
const TAG_COLORS = {
  governance: { strong: "52,118,220", soft: "52,118,220" }, // midnight-600
  api: { strong: "64,120,137", soft: "64,120,137" }, // porcelain-600
  openapi: { strong: "64,120,137", soft: "64,120,137" },
  overlay: { strong: "64,120,137", soft: "64,120,137" },
  arazzo: { strong: "64,120,137", soft: "64,120,137" },
  "developer experience": { strong: "64,120,137", soft: "64,120,137" },
  "maturity-model": { strong: "52,118,220", soft: "52,118,220" },
  linting: { strong: "52,118,220", soft: "52,118,220" },
  bitcoin: { strong: "13,172,33", soft: "13,172,33" }, // madang-600
  blockchain: { strong: "13,172,33", soft: "13,172,33" },
  crypto: { strong: "13,172,33", soft: "13,172,33" },
  finance: { strong: "13,172,33", soft: "13,172,33" },
  africa: { strong: "13,172,33", soft: "13,172,33" },
  ai: { strong: "52,118,220", soft: "52,118,220" },
  "social contract": { strong: "52,118,220", soft: "52,118,220" },
  technology: { strong: "64,120,137", soft: "64,120,137" },
  ethics: { strong: "52,118,220", soft: "52,118,220" },
  design: { strong: "64,120,137", soft: "64,120,137" },
  "web-development": { strong: "64,120,137", soft: "64,120,137" },
  personal: { strong: "64,120,137", soft: "64,120,137" },
  default: { strong: "64,120,137", soft: "64,120,137" },
};

function findChromium() {
  if (process.env.COVER_CHROMIUM_PATH) return process.env.COVER_CHROMIUM_PATH;
  const candidates = ["chromium", "chromium-browser", "google-chrome"];
  for (const bin of candidates) {
    try {
      execFileSync("which", [bin], { stdio: "pipe" });
      return bin;
    } catch {
      // try next
    }
  }
  throw new Error(
    "No Chromium/Chrome binary found. Install one (e.g. `sudo apt-get install chromium`) " +
      "or set COVER_CHROMIUM_PATH to an explicit binary path.",
  );
}

// Deterministic hash -> integer seed, so regenerating the same article's
// cover always produces the same lattice art (idempotent build output).
function seedFromString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) % 233280;
  }
  return hash || 1;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function primaryTag(tags) {
  if (!tags || tags.length === 0) return "article";
  return tags[0];
}

function colorsForTags(tags) {
  const tag = (tags && tags[0]) || "default";
  return TAG_COLORS[tag] || TAG_COLORS.default;
}

// Resolve Fontshare's CSS to actual woff2 URLs so the template can
// @font-face directly against CDN URLs (Chromium fetches them at render
// time — no local font files to keep in sync with nuxt.config.ts).
function fetchCss(url) {
  const https = require("https");
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve(body));
      })
      .on("error", reject);
  });
}

async function resolveFontUrls() {
  const families = {};
  for (const [name, url] of Object.entries(FONT_REQUESTS)) {
    const css = await fetchCss(url);
    const woff2Match = css.match(/url\('([^']+\.woff2)'\)/);
    if (!woff2Match) {
      throw new Error(`Could not resolve woff2 URL for "${name}" from ${url}`);
    }
    families[name] = "https:" + woff2Match[1];
  }
  return families;
}

async function renderCover({ slug, title, tags }) {
  const chromiumBin = findChromium();
  const fonts = await resolveFontUrls();
  const seed = seedFromString(slug);
  const colors = colorsForTags(tags);

  let html = fs.readFileSync(TEMPLATE_PATH, "utf8");
  html = html
    .replace("__FONT_CABINET_GROTESK__", fonts["Cabinet Grotesk"])
    .replace("__FONT_SATOSHI__", fonts.Satoshi)
    .replace("__FONT_TELMA__", fonts.Telma)
    .replace("__TITLE__", escapeHtml(title))
    .replace("__PRIMARY_TAG__", escapeHtml(primaryTag(tags)))
    .replace("__TAG_TINT_STRONG__", `rgba(${colors.strong},0.28)`)
    .replace("__TAG_TINT_SOFT__", `rgba(${colors.soft},0.35)`)
    .replace("__SEED__", String(seed));

  fs.mkdirSync(TMP_DIR, { recursive: true });
  const tmpHtmlPath = path.join(TMP_DIR, `${slug}.html`);
  fs.writeFileSync(tmpHtmlPath, html);

  const outDir = path.join(PUBLIC_ARTICLES_DIR, slug);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "cover.png");

  execFileSync(
    chromiumBin,
    [
      "--headless",
      "--disable-gpu",
      "--no-sandbox",
      "--virtual-time-budget=4000",
      `--screenshot=${outPath}`,
      `--window-size=${CARD_WIDTH},${CARD_HEIGHT}`,
      "--hide-scrollbars",
      "--default-background-color=00000000",
      `file://${tmpHtmlPath}`,
    ],
    { stdio: "pipe" },
  );

  fs.unlinkSync(tmpHtmlPath);
  optimizePng(outPath);
  return outPath;
}

// Chromium's raw screenshot PNGs run 350-450KB for this card design — fine
// correctness-wise but needlessly heavy for an OG image. pngquant gives a
// large, visually-lossless reduction (typically 60-75% smaller) with no
// extra dependency beyond the system package. Skipped gracefully if
// pngquant isn't installed — output is still correct, just heavier.
function optimizePng(filePath) {
  try {
    execFileSync("which", ["pngquant"], { stdio: "pipe" });
  } catch {
    console.warn(`  (pngquant not found — skipping PNG optimization for ${path.basename(filePath)})`);
    return;
  }
  execFileSync("pngquant", ["--force", "--quality=80-95", "--output", filePath, filePath], {
    stdio: "pipe",
  });
}

// Builds a slug -> filename map so callers can look up an article by its
// frontmatter `slug` even when it doesn't match the filename (legacy files
// predate the "filename must match slug" convention documented in
// skills/note-to-article/SKILL.md).
function articleFiles() {
  return fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith(".md"));
}

function loadArticle(slug) {
  for (const file of articleFiles()) {
    const filePath = path.join(ARTICLES_DIR, file);
    const { data } = matter(fs.readFileSync(filePath, "utf8"));
    const fileSlug = data.slug || file.replace(/\.md$/, "");
    if (fileSlug === slug) {
      return { slug, title: data.title, tags: data.tags || [] };
    }
  }
  throw new Error(`No article found with slug "${slug}" in ${ARTICLES_DIR}`);
}

function allSlugs() {
  return articleFiles().map((f) => {
    const { data } = matter(fs.readFileSync(path.join(ARTICLES_DIR, f), "utf8"));
    return data.slug || f.replace(/\.md$/, "");
  });
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: node scripts/generate-cover/index.js <slug> | --all");
    process.exit(1);
  }

  const slugs = arg === "--all" ? allSlugs() : [arg];

  for (const slug of slugs) {
    const article = loadArticle(slug);
    const outPath = await renderCover(article);
    console.log(`✓ ${slug} -> ${path.relative(REPO_ROOT, outPath)}`);
  }
}

main().catch((err) => {
  console.error("Cover generation failed:", err.message);
  process.exit(1);
});
