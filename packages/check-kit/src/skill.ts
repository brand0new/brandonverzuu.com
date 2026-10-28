import { fromMarkdown } from "mdast-util-from-markdown";
import { frontmatterFromMarkdown } from "mdast-util-frontmatter";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { frontmatter } from "micromark-extension-frontmatter";
import { gfm } from "micromark-extension-gfm";
import type { Root, RootContent } from "mdast";
import { CheckKitError } from "./errors.ts";
import type { CheckKitIssue } from "./errors.ts";
import { byteLength, LIMITS } from "./limits.ts";
import { parseSource } from "./yaml.ts";

/** One file of a skill folder, as the buyer sends it. */
export interface SkillFile {
  path: string;
  content: string;
}

export type SkillFileKind = "skill" | "markdown" | "script" | "data" | "text";

export interface SkillFileInfo {
  /** Relative to the skill root (the folder holding `SKILL.md`). */
  path: string;
  kind: SkillFileKind;
  bytes: number;
  lines: number;
  /** First line, for scripts that start with `#!`. */
  shebang?: string;
}

export interface SkillTreeNode {
  name: string;
  path: string;
  type: "dir" | "file";
  children?: SkillTreeNode[];
}

export interface SkillFrontmatter {
  present: boolean;
  /** The YAML between the `---` fences, as written. */
  raw?: string;
  /** Parsed data, when the YAML is a valid mapping. */
  data?: Record<string, unknown>;
  /** Why the YAML couldn't be read, when it couldn't. Not a rejection: rules decide. */
  error?: string;
  /** Lines of the opening and closing fence. */
  startLine?: number;
  endLine?: number;
  /** Line of each top-level key. */
  keyLines: Record<string, number>;
}

export type SkillReferenceKind = "link" | "image" | "definition" | "code";

export interface SkillReference {
  /** File the reference appears in. */
  from: string;
  line: number;
  kind: SkillReferenceKind;
  /** As written, without any `#fragment`. */
  target: string;
  /** Normalised path relative to the skill root, if it stays inside the root. */
  resolved?: string;
  /** Whether `resolved` is one of the submitted files or directories. */
  exists: boolean;
  /** The reference climbs out of the skill root (`../…`) or is absolute. */
  outsideRoot: boolean;
}

export interface SkillHeading {
  depth: number;
  text: string;
  line: number;
}

export interface ParsedSkill {
  /** Prefix stripped from the submitted paths, `''` if `SKILL.md` was at the top. */
  root: string;
  files: SkillFileInfo[];
  tree: SkillTreeNode;
  frontmatter: SkillFrontmatter;
  /** Markdown AST of `SKILL.md`. Positions are lines in the whole file. */
  ast: Root;
  /** Markdown ASTs of every `.md` file, `SKILL.md` included. */
  markdown: Record<string, Root>;
  headings: SkillHeading[];
  references: SkillReference[];
  /** File content by path relative to the root. Scripts are text only, never run. */
  content(path: string): string | undefined;
}

export interface ParseSkillOptions {
  maxBytes?: number;
  maxFiles?: number;
}

const SCRIPT_EXTENSIONS = new Set([
  "sh",
  "bash",
  "zsh",
  "fish",
  "ps1",
  "py",
  "rb",
  "pl",
  "php",
  "js",
  "mjs",
  "cjs",
  "ts",
  "mts",
  "cts",
  "lua",
  "go",
  "rs",
]);
const DATA_EXTENSIONS = new Set([
  "json",
  "yaml",
  "yml",
  "toml",
  "csv",
  "tsv",
  "xml",
  "ini",
]);
const MARKDOWN_EXTENSIONS = new Set(["md", "markdown", "mdx"]);

/**
 * Validate a skill manifest and parse it: frontmatter, the Markdown AST of
 * `SKILL.md` with line numbers, the file tree and every path the Markdown refers to.
 * Nothing in the manifest is executed.
 */
export function parseSkill(
  manifest: unknown,
  options: ParseSkillOptions = {},
): ParsedSkill {
  const files = validateManifest(manifest, options);
  const root = findRoot(files);
  const byPath = new Map<string, string>();
  for (const f of files) {
    if (root && !f.path.startsWith(root)) continue;
    byPath.set(f.path.slice(root.length), f.content);
  }

  const infos: SkillFileInfo[] = [...byPath.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([path, content]) => {
      const info: SkillFileInfo = {
        path,
        kind: fileKind(path, content),
        bytes: byteLength(content),
        lines: content === "" ? 0 : content.split("\n").length,
      };
      if (content.startsWith("#!")) info.shebang = content.split("\n", 1)[0];
      return info;
    });

  const dirs = new Set<string>();
  for (const path of byPath.keys()) {
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++)
      dirs.add(parts.slice(0, i).join("/"));
  }

  const markdown: Record<string, Root> = {};
  for (const info of infos) {
    if (info.kind === "skill" || info.kind === "markdown") {
      markdown[info.path] = parseMarkdown(byPath.get(info.path)!);
    }
  }
  const ast = markdown["SKILL.md"]!;
  const references: SkillReference[] = [];
  for (const [path, tree] of Object.entries(markdown)) {
    references.push(...collectReferences(path, tree, byPath, dirs));
  }

  return {
    root,
    files: infos,
    tree: buildTree(infos.map((i) => i.path)),
    frontmatter: readFrontmatter(ast),
    ast,
    markdown,
    headings: collectHeadings(ast),
    references,
    content: (path) => byPath.get(path),
  };
}

function validateManifest(
  manifest: unknown,
  options: ParseSkillOptions,
): SkillFile[] {
  const maxFiles = options.maxFiles ?? LIMITS.skill.maxFiles;
  const maxBytes = options.maxBytes ?? LIMITS.skill.maxBytes;
  if (!Array.isArray(manifest)) {
    throw new CheckKitError(
      "invalid_document",
      "Skill manifest must be an array of { path, content }",
    );
  }
  if (manifest.length === 0) {
    throw new CheckKitError("missing_skill_md", "Skill manifest is empty");
  }
  if (manifest.length > maxFiles) {
    throw new CheckKitError(
      "too_many_files",
      `Skill has ${manifest.length} files; the limit is ${maxFiles}`,
    );
  }
  const issues: CheckKitIssue[] = [];
  const seen = new Map<string, string>();
  const out: SkillFile[] = [];
  let total = 0;
  for (const [i, entry] of manifest.entries()) {
    if (
      entry === null ||
      typeof entry !== "object" ||
      typeof (entry as SkillFile).path !== "string" ||
      typeof (entry as SkillFile).content !== "string"
    ) {
      throw new CheckKitError(
        "invalid_document",
        `Manifest entry ${i} must be { path, content } strings`,
      );
    }
    const { path: rawPath, content } = entry as SkillFile;
    const path = rawPath.startsWith("./") ? rawPath.slice(2) : rawPath;
    const problem = pathProblem(path);
    if (problem) {
      issues.push({ at: rawPath, message: problem });
      continue;
    }
    if (content.includes("\u0000")) {
      throw new CheckKitError("binary_content", `${path} is not text`, [
        { at: path, message: "Only text files are accepted" },
      ]);
    }
    const folded = path.toLowerCase();
    if (seen.has(folded)) {
      throw new CheckKitError(
        "duplicate_path",
        `${path} appears more than once`,
        [{ at: path, message: `Collides with ${seen.get(folded)}` }],
      );
    }
    seen.set(folded, path);
    total += byteLength(content);
    if (total > maxBytes) {
      throw new CheckKitError(
        "too_large",
        `Skill exceeds ${maxBytes} bytes in total`,
      );
    }
    out.push({ path, content });
  }
  if (issues.length > 0) {
    throw new CheckKitError(
      "invalid_path",
      "Some file paths are not allowed",
      issues,
    );
  }
  return out;
}

/** Why a manifest path is unsafe, or undefined if it's fine. */
export function pathProblem(path: string): string | undefined {
  if (path.length === 0) return "Empty path";
  if (path.length > LIMITS.skill.maxPathLength) return "Path is too long";
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(path))
    return "Path contains control characters";
  if (path.includes("\\")) return "Use / as the path separator";
  if (path.startsWith("/") || /^[A-Za-z]:/.test(path))
    return "Path must be relative";
  if (path.endsWith("/")) return "Path names a directory, not a file";
  for (const segment of path.split("/")) {
    if (segment === "" || segment === "." || segment === "..") {
      return 'Path must not contain empty, "." or ".." segments';
    }
  }
  return undefined;
}

function findRoot(files: SkillFile[]): string {
  if (files.some((f) => f.path === "SKILL.md")) return "";
  const candidates = files.filter((f) => /^[^/]+\/SKILL\.md$/.test(f.path));
  if (candidates.length === 1) {
    const root = candidates[0]!.path.slice(0, -"SKILL.md".length);
    if (files.every((f) => f.path.startsWith(root))) return root;
  }
  throw new CheckKitError(
    "missing_skill_md",
    "No SKILL.md at the root of the skill (or inside a single top-level folder)",
  );
}

function extension(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function fileKind(path: string, content: string): SkillFileKind {
  if (path === "SKILL.md") return "skill";
  const ext = extension(path);
  if (MARKDOWN_EXTENSIONS.has(ext)) return "markdown";
  if (SCRIPT_EXTENSIONS.has(ext) || content.startsWith("#!")) return "script";
  if (DATA_EXTENSIONS.has(ext)) return "data";
  return "text";
}

function parseMarkdown(content: string): Root {
  return fromMarkdown(content, {
    extensions: [frontmatter(["yaml"]), gfm()],
    mdastExtensions: [frontmatterFromMarkdown(["yaml"]), gfmFromMarkdown()],
  });
}

function readFrontmatter(ast: Root): SkillFrontmatter {
  const first = ast.children[0];
  if (!first || first.type !== "yaml") return { present: false, keyLines: {} };
  const startLine = first.position?.start.line ?? 1;
  const result: SkillFrontmatter = {
    present: true,
    raw: first.value,
    startLine,
    endLine: first.position?.end.line,
    keyLines: {},
  };
  try {
    const parsed = parseSource(first.value, {
      maxBytes: LIMITS.skill.maxBytes,
      format: "yaml",
      label: "Frontmatter",
    });
    const data = parsed.value;
    if (data === null || data === undefined) {
      result.data = {};
    } else if (typeof data !== "object" || Array.isArray(data)) {
      result.error = "Frontmatter is not a mapping";
    } else {
      result.data = data as Record<string, unknown>;
      for (const key of Object.keys(data)) {
        const line = parsed.lineOf([key]);
        if (line !== undefined) result.keyLines[key] = startLine + line;
      }
    }
  } catch (error) {
    if (
      error instanceof CheckKitError &&
      (error.code === "too_large" || error.code === "too_deep")
    ) {
      throw error;
    }
    result.error =
      error instanceof CheckKitError ? error.message : String(error);
  }
  return result;
}

function textOf(node: RootContent | Root): string {
  if ("value" in node && typeof node.value === "string") return node.value;
  if ("children" in node)
    return (node.children as RootContent[]).map(textOf).join("");
  return "";
}

function collectHeadings(ast: Root): SkillHeading[] {
  const out: SkillHeading[] = [];
  walk(ast, (node) => {
    if (node.type === "heading") {
      out.push({
        depth: node.depth,
        text: textOf(node).trim(),
        line: node.position?.start.line ?? 0,
      });
    }
  });
  return out;
}

function walk(
  node: Root | RootContent,
  visit: (node: RootContent) => void,
): void {
  const stack: (Root | RootContent)[] = [node];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current.type !== "root") visit(current);
    if ("children" in current) {
      const kids = current.children as RootContent[];
      for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]!);
    }
  }
}

const URL_SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/;
/** Inline code that looks like a relative file path: has a `/` or a file extension. */
const PATH_LIKE = /^(?:\.{1,2}\/)?[\w@.-]+(?:\/[\w@.-]+)*\/?$/;

function collectReferences(
  from: string,
  ast: Root,
  files: Map<string, string>,
  dirs: Set<string>,
): SkillReference[] {
  const out: SkillReference[] = [];
  const add = (raw: string, kind: SkillReferenceKind, line: number) => {
    const target = raw.split("#")[0]!.split("?")[0]!;
    if (target === "" || URL_SCHEME.test(target) || target.startsWith("//"))
      return;
    const { resolved, outsideRoot } = resolveRelative(from, target);
    const exists =
      resolved !== undefined && (files.has(resolved) || dirs.has(resolved));
    out.push({ from, line, kind, target, resolved, exists, outsideRoot });
  };
  walk(ast, (node) => {
    const line = node.position?.start.line ?? 0;
    if (node.type === "link" || node.type === "definition") {
      add(node.url, node.type === "link" ? "link" : "definition", line);
    } else if (node.type === "image") {
      add(node.url, "image", line);
    } else if (node.type === "inlineCode") {
      const value = node.value.trim();
      if (
        PATH_LIKE.test(value) &&
        (value.includes("/") || /\.[A-Za-z0-9]{1,8}$/.test(value)) &&
        !/^\d+(\.\d+)+$/.test(value)
      ) {
        add(value, "code", line);
      }
    }
  });
  return out;
}

function resolveRelative(
  from: string,
  target: string,
): { resolved?: string; outsideRoot: boolean } {
  if (target.startsWith("/")) return { outsideRoot: true };
  const base = from.includes("/")
    ? from.slice(0, from.lastIndexOf("/")).split("/")
    : [];
  const parts = [...base];
  for (const segment of target.replace(/\/$/, "").split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (parts.length === 0) return { outsideRoot: true };
      parts.pop();
    } else {
      let decoded = segment;
      try {
        decoded = decodeURIComponent(segment);
      } catch {
        // keep as written
      }
      parts.push(decoded);
    }
  }
  return { resolved: parts.join("/"), outsideRoot: false };
}

function buildTree(paths: string[]): SkillTreeNode {
  const root: SkillTreeNode = { name: "", path: "", type: "dir", children: [] };
  for (const path of paths) {
    const parts = path.split("/");
    let node = root;
    parts.forEach((name, i) => {
      const isFile = i === parts.length - 1;
      const childPath = parts.slice(0, i + 1).join("/");
      let child = node.children!.find((c) => c.name === name);
      if (!child) {
        child = isFile
          ? { name, path: childPath, type: "file" }
          : { name, path: childPath, type: "dir", children: [] };
        node.children!.push(child);
      }
      node = child;
    });
  }
  return root;
}
