#!/usr/bin/env node
// Bundles the thin public skills (products/skills, spec 10) into a TypeScript
// module the Worker imports, so the gateway serves exactly what's in the repo
// at build time. Each directory with a SKILL.md is a skill; every file under it
// becomes a resource with its SHA-256 digest and size, as the MCP Skills
// extension (io.modelcontextprotocol/skills) requires.
//
// Usage: node scripts/bundle-skills.mjs [--src <dir>] [--out <file>]

import { createHash } from "node:crypto";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const here = dirname(fileURLToPath(import.meta.url));

// Per-skill limits from the extension spec: hosts must accept up to these.
const MAX_RESOURCES = 512;
const MAX_TOTAL_BYTES = 16 * 1024 * 1024;
// Agent Skills naming rules: lowercase letters, digits and single hyphens, 1–64 chars.
const NAME_PATTERN = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,63}$/;

const MIME = {
  ".md": "text/markdown",
  ".txt": "text/plain",
  ".json": "application/json",
  ".yaml": "application/yaml",
  ".yml": "application/yaml",
  ".sh": "text/x-shellscript",
  ".py": "text/x-python",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".ts": "text/typescript",
  ".html": "text/html",
  ".csv": "text/csv",
  ".xml": "application/xml",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};
const TEXT_TYPES = /^(text\/|application\/(json|yaml|xml)|image\/svg\+xml)/;

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : 1,
  )) {
    if (entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

function toPosix(path) {
  return path.split(sep).join("/");
}

/** Parses the YAML frontmatter at the top of a SKILL.md. */
export function parseFrontmatter(text, where) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match)
    throw new Error(
      `${where}: SKILL.md must start with YAML frontmatter between --- lines`,
    );
  const frontmatter = parseYaml(match[1], { schema: "core" });
  if (
    !frontmatter ||
    typeof frontmatter !== "object" ||
    Array.isArray(frontmatter)
  ) {
    throw new Error(`${where}: frontmatter must be a YAML mapping`);
  }
  if (
    typeof frontmatter.name !== "string" ||
    typeof frontmatter.description !== "string"
  ) {
    throw new Error(
      `${where}: frontmatter needs string "name" and "description" fields`,
    );
  }
  return frontmatter;
}

export function bundleSkills(srcDir) {
  const all = walk(srcDir);
  const skillDirs = all
    .filter((f) => f.endsWith(`${sep}SKILL.md`))
    .map((f) => dirname(f));
  const skills = [];
  for (const skillDir of skillDirs) {
    const skillPath = toPosix(relative(srcDir, skillDir));
    if (!skillPath)
      throw new Error(
        "products/skills itself can't be a skill: put each skill in its own folder",
      );
    const where = `products/skills/${skillPath}`;
    const skillMd = readFileSync(join(skillDir, "SKILL.md"), "utf8");
    const frontmatter = parseFrontmatter(skillMd, where);
    const finalSegment = skillPath.split("/").pop();
    if (frontmatter.name !== finalSegment) {
      throw new Error(
        `${where}: frontmatter name "${frontmatter.name}" must equal the folder name "${finalSegment}"`,
      );
    }
    if (!NAME_PATTERN.test(frontmatter.name)) {
      throw new Error(
        `${where}: "${frontmatter.name}" isn't a valid skill name (lowercase letters, digits, single hyphens)`,
      );
    }
    const files = all
      .filter((f) => f.startsWith(skillDir + sep))
      .map((f) => {
        const bytes = readFileSync(f);
        const path = toPosix(relative(skillDir, f));
        const mimeType =
          MIME[extname(f).toLowerCase()] ?? "application/octet-stream";
        const isText = TEXT_TYPES.test(mimeType);
        return {
          path,
          mimeType,
          size: bytes.byteLength,
          digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
          ...(isText
            ? { text: bytes.toString("utf8") }
            : { blob: bytes.toString("base64") }),
        };
      });
    if (files.length > MAX_RESOURCES)
      throw new Error(`${where}: more than ${MAX_RESOURCES} files`);
    const total = files.reduce((sum, f) => sum + f.size, 0);
    if (total > MAX_TOTAL_BYTES)
      throw new Error(`${where}: more than ${MAX_TOTAL_BYTES} bytes in total`);
    skills.push({ path: skillPath, frontmatter, files });
  }
  return skills.sort((a, b) => (a.path < b.path ? -1 : 1));
}

export function renderModule(skills) {
  return [
    "// Generated by scripts/bundle-skills.mjs from products/skills. Don't edit.",
    'import type { BundledSkill } from "../mcp/skills";',
    "",
    `export const SKILLS: BundledSkill[] = ${JSON.stringify(skills, null, 2)};`,
    "",
  ].join("\n");
}

function main() {
  const args = process.argv.slice(2);
  const arg = (name, fallback) => {
    const i = args.indexOf(name);
    return i >= 0 ? resolve(args[i + 1]) : fallback;
  };
  const src = arg("--src", resolve(here, "../../../products/skills"));
  const out = arg("--out", resolve(here, "../src/generated/skills.ts"));
  if (!statSync(src, { throwIfNoEntry: false })?.isDirectory())
    throw new Error(`No skills folder at ${src}`);
  const skills = bundleSkills(src);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, renderModule(skills));
  console.log(
    `bundle-skills: ${skills.length} skill(s) from ${relative(process.cwd(), src) || "."}`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
