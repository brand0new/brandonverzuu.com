import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CheckKitError, parseSkill } from "../src/index.ts";
import type { SkillFile } from "../src/index.ts";

const repoSkills = fileURLToPath(new URL("../../../skills/", import.meta.url));

function manifestOf(dir: string, prefix = ""): SkillFile[] {
  const out: SkillFile[] = [];
  const walk = (current: string) => {
    for (const name of readdirSync(current).sort()) {
      const full = join(current, name);
      if (statSync(full).isDirectory()) walk(full);
      else
        out.push({
          path: prefix + relative(dir, full).split("\\").join("/"),
          content: readFileSync(full, "utf8"),
        });
    }
  };
  walk(dir);
  return out;
}

function rejects(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(CheckKitError);
    expect((error as CheckKitError).code).toBe(code);
    return error as CheckKitError;
  }
  throw new Error(`expected a ${code} rejection`);
}

const skillDirs = readdirSync(repoSkills).filter((d) =>
  statSync(join(repoSkills, d)).isDirectory(),
);

describe("parseSkill on this repo's own skills/", () => {
  it("finds the skills", () => {
    expect(skillDirs.length).toBeGreaterThanOrEqual(5);
  });

  it.each(skillDirs)("parses skills/%s", (dir) => {
    const files = manifestOf(join(repoSkills, dir));
    const skill = parseSkill(files);
    expect(skill.root).toBe("");
    expect(skill.files.find((f) => f.path === "SKILL.md")?.kind).toBe("skill");
    expect(skill.frontmatter.present).toBe(true);
    expect(skill.frontmatter.error).toBeUndefined();
    expect(skill.frontmatter.data?.name).toBe(dir);
    expect(typeof skill.frontmatter.data?.description).toBe("string");

    // key lines point at the key in the file
    const lines = files.find((f) => f.path === "SKILL.md")!.content.split("\n");
    expect(lines[skill.frontmatter.keyLines.name! - 1]).toMatch(/^name:/);
    expect(lines[skill.frontmatter.keyLines.description! - 1]).toMatch(
      /^description:/,
    );

    // headings carry file line numbers
    expect(skill.headings.length).toBeGreaterThan(0);
    for (const h of skill.headings) {
      expect(lines[h.line - 1]).toMatch(new RegExp(`^#{${h.depth}} `));
    }
    expect(skill.ast.type).toBe("root");
    expect(skill.tree.children!.some((c) => c.name === "SKILL.md")).toBe(true);
  });

  it("resolves references between files in a skill", () => {
    const skill = parseSkill(manifestOf(join(repoSkills, "new-component")));
    const ref = skill.references.find((r) => r.resolved === "conventions.md");
    expect(ref).toBeDefined();
    expect(ref!.exists).toBe(true);
    expect(ref!.from).toBe("SKILL.md");
  });

  it("accepts a skill wrapped in one top-level folder", () => {
    const skill = parseSkill(
      manifestOf(join(repoSkills, "note-to-article"), "note-to-article/"),
    );
    expect(skill.root).toBe("note-to-article/");
    expect(skill.files.map((f) => f.path)).toContain("style-guide.md");
  });
});

describe("parseSkill manifest validation", () => {
  const skillMd =
    "---\nname: demo\ndescription: Placeholder.\n---\n\n# Demo\n\nSee [ref](references/a.md) and `scripts/run.sh`.\n";

  it("parses scripts as text and flags references", () => {
    const skill = parseSkill([
      { path: "SKILL.md", content: skillMd },
      { path: "scripts/run.sh", content: "#!/bin/sh\necho never-run\n" },
    ]);
    const script = skill.files.find((f) => f.path === "scripts/run.sh")!;
    expect(script.kind).toBe("script");
    expect(script.shebang).toBe("#!/bin/sh");
    expect(skill.content("scripts/run.sh")).toContain("never-run");
    expect(skill.references.map((r) => [r.target, r.exists, r.line])).toEqual([
      ["references/a.md", false, 8],
      ["scripts/run.sh", true, 8],
    ]);
  });

  it("records frontmatter problems without rejecting", () => {
    expect(
      parseSkill([{ path: "SKILL.md", content: "# No frontmatter\n" }])
        .frontmatter.present,
    ).toBe(false);
    const broken = parseSkill([
      { path: "SKILL.md", content: "---\nname: [\n---\n# x\n" },
    ]);
    expect(broken.frontmatter.present).toBe(true);
    expect(broken.frontmatter.error).toBeDefined();
  });

  it("rejects path traversal and unsafe paths", () => {
    for (const path of [
      "../evil.md",
      "a/../../b",
      "/etc/passwd",
      "C:/x",
      "a\\b",
      "a//b",
      "./../x",
      "a/./b",
      "dir/",
    ]) {
      rejects(
        () =>
          parseSkill([
            { path: "SKILL.md", content: skillMd },
            { path, content: "x" },
          ]),
        "invalid_path",
      );
    }
  });

  it("rejects binary content, duplicates, too many files and too many bytes", () => {
    rejects(
      () =>
        parseSkill([
          { path: "SKILL.md", content: skillMd },
          { path: "a.bin", content: "a\u0000b" },
        ]),
      "binary_content",
    );
    rejects(
      () =>
        parseSkill([
          { path: "SKILL.md", content: skillMd },
          { path: "skill.md", content: "x" },
        ]),
      "duplicate_path",
    );
    const many = Array.from({ length: 201 }, (_, i) => ({
      path: `f${i}.txt`,
      content: "",
    }));
    rejects(
      () => parseSkill([{ path: "SKILL.md", content: skillMd }, ...many]),
      "too_many_files",
    );
    rejects(
      () =>
        parseSkill([
          { path: "SKILL.md", content: "a".repeat(1024 * 1024 + 1) },
        ]),
      "too_large",
    );
  });

  it("requires SKILL.md and a well-formed manifest", () => {
    rejects(
      () => parseSkill([{ path: "README.md", content: "x" }]),
      "missing_skill_md",
    );
    rejects(() => parseSkill([]), "missing_skill_md");
    rejects(() => parseSkill({ path: "SKILL.md" }), "invalid_document");
    rejects(
      () => parseSkill([{ path: "SKILL.md", content: 42 }]),
      "invalid_document",
    );
  });
});
