#!/usr/bin/env node
"use strict";

/**
 * Sets/updates the `image` frontmatter field on every article to point at
 * its generated cover (public/articles/<slug>/cover.png).
 *
 * Edits the frontmatter block as text rather than via gray-matter's
 * stringify — stringify reformats the whole YAML block (quote style, list
 * style, line wrapping), which turns a one-line change into a noisy diff
 * across every article. This only touches the `image:` line, inserting one
 * if missing.
 *
 * Usage: node scripts/generate-cover/set-frontmatter-image.js
 */

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const ARTICLES_DIR = path.join(REPO_ROOT, "content", "articles");

for (const file of fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith(".md"))) {
  const filePath = path.join(ARTICLES_DIR, file);
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = matter(raw);
  const slug = parsed.data.slug || file.replace(/\.md$/, "");
  const coverPath = `/articles/${slug}/cover.png`;

  if (parsed.data.image === coverPath) {
    console.log(`= ${file} already points at ${coverPath}`);
    continue;
  }

  const frontmatterMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) {
    console.error(`✗ ${file}: could not locate frontmatter block, skipping`);
    continue;
  }
  const [fullMatch, fmBody] = frontmatterMatch;
  const imageLine = `image: "${coverPath}"`;

  let newFmBody;
  if (/^image:.*/m.test(fmBody)) {
    newFmBody = fmBody.replace(/^image:.*/m, imageLine);
  } else {
    // Insert after `slug:` if present, otherwise after the first line.
    if (/^slug:.*/m.test(fmBody)) {
      newFmBody = fmBody.replace(/^(slug:.*)$/m, `$1\n${imageLine}`);
    } else {
      const lines = fmBody.split("\n");
      lines.splice(1, 0, imageLine);
      newFmBody = lines.join("\n");
    }
  }

  const newFrontmatter = `---\n${newFmBody}\n---`;
  const updated = raw.replace(fullMatch, newFrontmatter);
  fs.writeFileSync(filePath, updated);
  console.log(`✓ ${file} -> image: ${coverPath}`);
}
