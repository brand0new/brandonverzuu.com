// URL parity: runs after `astro build` in `npm run generate`. Fails when a URL in
// scripts/url-baseline.txt has no page in dist/ (and no redirect in public/_redirects), or
// when the sitemap lists a URL that has no page.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");

const baseline = read(path.join(root, "scripts/url-baseline.txt")).split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
const redirects = new Set(read(path.join(root, "public/_redirects")).split("\n").map((l) => l.trim().split(/\s+/)[0]).filter(Boolean));
const sitemap = [...read(path.join(dist, "sitemap.xml")).matchAll(/<loc>https:\/\/brandonverzuu\.com([^<]*)<\/loc>/g)].map((m) => m[1]);

const page = (url) => (url === "/" ? "index.html" : url.replace(/^\//, "") + ".html");
const missing = baseline.filter((u) => !existsSync(path.join(dist, page(u))) && !redirects.has(u));
const orphans = sitemap.filter((u) => !existsSync(path.join(dist, page(u))));
const unlisted = baseline.filter((u) => !sitemap.includes(u) && !redirects.has(u));

if (!sitemap.length) missing.push("(dist/sitemap.xml is missing or empty)");
for (const u of missing) console.error(`missing page: ${u}`);
for (const u of orphans) console.error(`sitemap lists a URL with no page: ${u}`);
for (const u of unlisted) console.error(`not in the sitemap: ${u}`);
if (missing.length || orphans.length || unlisted.length) process.exit(1);
console.log(`URL parity: all ${baseline.length} baseline URLs exist, sitemap lists ${sitemap.length}.`);
