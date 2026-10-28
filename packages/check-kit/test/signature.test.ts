import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  normalisedShape,
  parseOpenApi,
  parseSkill,
  similarity,
  skillSignatureInput,
  structuralSignature,
} from "../src/index.ts";

const fixture = (name: string) =>
  readFileSync(
    fileURLToPath(new URL(`./fixtures/openapi/${name}`, import.meta.url)),
    "utf8",
  );

describe("structural signatures", () => {
  const petstore = parseOpenApi(fixture("petstore-expanded.yaml")).source;
  const tictactoe = parseOpenApi(fixture("tictactoe.yaml")).source;

  it("is deterministic", () => {
    expect(structuralSignature(petstore)).toEqual(
      structuralSignature(structuredClone(petstore)),
    );
    expect(structuralSignature(petstore).shape).toMatch(/^[0-9a-f]{32}$/);
    expect(structuralSignature(petstore).minhash).toHaveLength(128);
  });

  it("ignores key order and scalar values in the shape", () => {
    expect(normalisedShape({ a: 1, b: "x" })).toBe(
      normalisedShape({ b: "y", a: 2 }),
    );
    expect(normalisedShape({ a: 1 })).not.toBe(normalisedShape({ a: "1" }));
    const renamed = structuredClone(petstore) as any;
    renamed.info.title = "Something else";
    expect(structuralSignature(renamed).shape).toBe(
      structuralSignature(petstore).shape,
    );
  });

  it("scores near-duplicates high and unrelated documents low", () => {
    const tweaked = structuredClone(petstore) as any;
    tweaked.paths["/pets"].get.summary = "added";
    const a = structuralSignature(petstore);
    const b = structuralSignature(tweaked);
    expect(a.shape).not.toBe(b.shape);
    expect(similarity(a, b)).toBeGreaterThan(0.9);
    expect(similarity(a, structuralSignature(tictactoe))).toBeLessThan(0.3);
    expect(similarity(a, a)).toBe(1);
  });

  it("handles deep input without recursion", () => {
    let deep: unknown = "leaf";
    for (let i = 0; i < 3000; i++) deep = { n: deep };
    expect(structuralSignature(deep).features).toBeGreaterThan(3000);
  });

  it("signs skills from their structure", () => {
    const skill = parseSkill([
      {
        path: "SKILL.md",
        content: "---\nname: a\ndescription: b\n---\n# A\n## B\n",
      },
      { path: "scripts/x.py", content: "print(1)\n" },
    ]);
    const input = skillSignatureInput(skill);
    expect(input).toEqual({
      frontmatter: { name: "a", description: "b" },
      files: { "SKILL.md": "skill", "scripts/x.py": "script" },
      outline: ["h1", "h2"],
    });
    expect(structuralSignature(input).features).toBeGreaterThan(5);
  });
});
