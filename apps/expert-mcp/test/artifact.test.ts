import { describe, expect, it } from "vitest";
import { parseArtifact } from "../src/artifact";
import { GatewayError } from "../src/errors";

async function code(
  kind: Parameters<typeof parseArtifact>[0],
  input: unknown,
): Promise<string | null> {
  try {
    await parseArtifact(kind, input);
    return null;
  } catch (error) {
    expect(error).toBeInstanceOf(GatewayError);
    return (error as GatewayError).code;
  }
}

const openapi = (extra = "") =>
  `openapi: 3.0.3\ninfo:\n  title: t\n  version: "1"\npaths: {}\n${extra}`;

describe("parseArtifact", () => {
  it("parses OpenAPI as JSON or YAML", async () => {
    const yaml = await parseArtifact("api-governance", { document: openapi() });
    expect(yaml.artifact).toMatchObject({
      kind: "api-governance",
      format: "yaml",
      content: openapi(),
    });
    expect(yaml.document).toMatchObject({ openapi: "3.0.3" });
    const json = await parseArtifact("api-governance", {
      document: '{"openapi":"3.1.0","info":{},"paths":{}}',
    });
    expect(json.artifact).toMatchObject({ format: "json" });
    expect(json.signature).toMatch(/^[0-9a-f]{64}$/);
  });

  it("accepts only OpenAPI 3.0 and 3.1", async () => {
    expect(
      await code("api-governance", { document: '{"swagger":"2.0"}' }),
    ).toBe("invalid_artifact");
    expect(
      await code("api-governance", { document: '{"openapi":"3.2.0"}' }),
    ).toBe("invalid_artifact");
  });

  it("rejects external $refs", async () => {
    const doc = JSON.stringify({
      openapi: "3.1.0",
      paths: { "/a": { $ref: "https://example.com/a.yaml" } },
    });
    expect(await code("api-governance", { document: doc })).toBe(
      "invalid_artifact",
    );
    const internal = JSON.stringify({
      openapi: "3.1.0",
      paths: { "/a": { $ref: "#/components/pathItems/a" } },
    });
    expect(await code("api-governance", { document: internal })).toBeNull();
  });

  it("refuses YAML alias bombs", async () => {
    const bomb = [
      "openapi: 3.0.3",
      'a: &a ["x","x","x","x","x","x","x","x","x"]',
      "b: &b [*a,*a,*a,*a,*a,*a,*a,*a,*a]",
      "c: &c [*b,*b,*b,*b,*b,*b,*b,*b,*b]",
      "d: &d [*c,*c,*c,*c,*c,*c,*c,*c,*c]",
      "e: &e [*d,*d,*d,*d,*d,*d,*d,*d,*d]",
      "f: &f [*e,*e,*e,*e,*e,*e,*e,*e,*e]",
      "g: [*f,*f,*f,*f,*f,*f,*f,*f,*f]",
    ].join("\n");
    expect(await code("api-governance", { document: bomb })).toBe(
      "invalid_artifact",
    );
  });

  it("refuses deep nesting in JSON and in block YAML", async () => {
    const deepJson = `{"openapi":"3.1.0","x":${"[".repeat(10_000)}${"]".repeat(10_000)}}`;
    expect(await code("api-governance", { document: deepJson })).toBe(
      "invalid_artifact",
    );
    let yaml = "openapi: 3.0.3\nx:\n";
    for (let i = 1; i < 80; i++) yaml += `${"  ".repeat(i)}k${i}:\n`;
    expect(await code("api-governance", { document: yaml })).toBe(
      "invalid_artifact",
    );
  });

  it("enforces the size limit before parsing", async () => {
    const big = `{"openapi":"3.1.0","x":"${"a".repeat(2 * 1024 * 1024)}"}`;
    expect(await code("api-governance", { document: big })).toBe(
      "artifact_too_large",
    );
  });

  it("rejects unknown properties and bad options", async () => {
    expect(
      await code("api-governance", { document: openapi(), profile: "public" }),
    ).toBe("invalid_request");
    expect(
      await code("api-governance", {
        document: openapi(),
        options: { locale: "<script>" },
      }),
    ).toBe("invalid_request");
    expect(
      await code("api-governance", {
        document: openapi(),
        options: { locale: "nl-NL" },
      }),
    ).toBeNull();
  });

  it("checks skill folders: SKILL.md, paths, counts and size", async () => {
    const skill = (files: { path: string; content: string }[]) => ({ files });
    const md = {
      path: "SKILL.md",
      content: "---\nname: x\ndescription: y\n---\n",
    };
    expect(
      await code(
        "skill-design",
        skill([md, { path: "scripts/run.sh", content: "echo" }]),
      ),
    ).toBeNull();
    expect(
      await code("skill-design", skill([{ path: "README.md", content: "" }])),
    ).toBe("invalid_artifact");
    for (const path of [
      "../etc/passwd",
      "/abs",
      "a/../b",
      "a\\b",
      "a//b",
      "./a",
    ]) {
      expect(
        await code("skill-design", skill([md, { path, content: "" }])),
        path,
      ).toBe("invalid_artifact");
    }
    expect(await code("skill-design", skill([md, md]))).toBe(
      "invalid_artifact",
    );
    const many = Array.from({ length: 201 }, (_, i) => ({
      path: `f${i}.md`,
      content: "",
    }));
    expect(await code("skill-design", skill([md, ...many]))).toBe(
      "artifact_too_large",
    );
    expect(
      await code(
        "skill-design",
        skill([md, { path: "big.md", content: "a".repeat(1024 * 1024) }]),
      ),
    ).toBe("artifact_too_large");
  });

  it("parses process descriptions", async () => {
    const parsed = await parseArtifact("process-review", {
      document: "process:\n  id: p1\n",
      format: "yaml",
    });
    expect(parsed.artifact).toMatchObject({ kind: "process-review" });
    expect(parsed.document).toEqual({ process: { id: "p1" } });
    expect(
      await code("process-review", { document: "- just\n- a list\n" }),
    ).toBe("invalid_artifact");
  });
});
