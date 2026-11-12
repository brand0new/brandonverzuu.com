// Build-time helpers for the /setups diagram (content/setup.yml). They run only while the site is
// prerendered, so they may read the repo and ask git; nothing here reaches the browser.
import { execSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

export const REPO = "https://github.com/brand0new/brandonverzuu.com";

// Scripts run from apps/site (the og cards rely on the same cwd), so the repo root is two up.
// AGENTS.md is the marker: if it isn't there, the cwd assumption broke and every path check
// below would fail for the wrong reason.
const root = path.resolve(process.cwd(), "../..");
if (!existsSync(path.join(root, "AGENTS.md"))) throw new Error(`setup: expected the repo root at ${root}`);

// Links are pinned to the commit being built, so they show the code as it was when this page
// was deployed and never break when a file moves later. Cloudflare Pages names the commit in
// CF_PAGES_COMMIT_SHA; GitHub Actions and local builds ask git. A local commit that isn't
// pushed yet links to a 404 until it is, which only matters on a dev machine.
function commit(): string {
  const env = process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA;
  if (env) return env;
  try {
    return execSync("git rev-parse HEAD", { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "master";
  }
}
export const COMMIT = commit();

// A source path that doesn't exist fails the build, the same way a missing cover does: a
// permalink to a file that was never there is still a broken link.
export function sourceUrl(p: string): string {
  const abs = path.join(root, p);
  if (!existsSync(abs)) throw new Error(`content/setup.yml: source "${p}" doesn't exist in the repo`);
  return `${REPO}/${statSync(abs).isDirectory() ? "tree" : "blob"}/${COMMIT}/${p.replace(/\/+$/, "")}`;
}
