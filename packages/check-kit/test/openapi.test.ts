import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CheckKitError, parseOpenApi } from "../src/index.ts";

const fixture = (name: string) =>
  readFileSync(
    fileURLToPath(new URL(`./fixtures/openapi/${name}`, import.meta.url)),
    "utf8",
  );

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

describe("parseOpenApi on public OAI examples", () => {
  it("parses petstore-expanded (3.0, YAML) and resolves its refs", () => {
    const doc = parseOpenApi(fixture("petstore-expanded.yaml"));
    expect(doc.version).toBe("3.0");
    expect(doc.format).toBe("yaml");
    expect(doc.refs.length).toBeGreaterThan(0);
    expect(doc.cycles).toEqual([]);
    expect(JSON.stringify(doc.resolved)).not.toContain("$ref");

    const ops = doc.query("$.paths[*][get,post,put,delete]");
    expect(ops.map((m) => m.location)).toEqual([
      "$.paths['/pets'].get",
      "$.paths['/pets'].post",
      "$.paths['/pets/{id}'].get",
      "$.paths['/pets/{id}'].delete",
    ]);
    expect(
      ops.every(
        (m) =>
          typeof (m.value as { operationId?: string }).operationId === "string",
      ),
    ).toBe(true);
  });

  it("locates a node reached through $ref at its definition", () => {
    const doc = parseOpenApi(fixture("petstore-expanded.yaml"));
    const [schema] = doc.query(
      "$.paths['/pets'].get.responses['200'].content['application/json'].schema.items",
    );
    expect(schema).toBeDefined();
    expect(schema!.location).toBe("$.components.schemas.Pet");
    expect(doc.locate(schema!.value)).toBe("$.components.schemas.Pet");
    // children of a resolved node are located under the definition, too
    const [required] = doc.query(
      "$.paths['/pets'].get.responses['200'].content['application/json'].schema.items.allOf[1].required",
    );
    expect(required!.location).toBe(
      "$.components.schemas.Pet.allOf[1].required",
    );
  });

  it("gives source line numbers", () => {
    const doc = parseOpenApi(fixture("petstore-expanded.yaml"));
    const text = fixture("petstore-expanded.yaml").split("\n");
    const line = doc.lineOf(["paths", "/pets", "get"])!;
    expect(text[line - 1]).toMatch(/^\s+get:/);
  });

  it("selects keys with ~", () => {
    const doc = parseOpenApi(fixture("petstore-expanded.yaml"));
    expect(doc.query("$.paths[*]~").map((m) => m.value)).toEqual([
      "/pets",
      "/pets/{id}",
    ]);
  });

  it("parses tictactoe (3.1) with parameter and schema refs", () => {
    const doc = parseOpenApi(fixture("tictactoe.yaml"));
    expect(doc.version).toBe("3.1");
    const params = doc.query("$.paths['/board/{row}/{column}'].parameters[*]");
    expect(params.map((p) => p.location)).toEqual([
      "$.components.parameters.rowParam",
      "$.components.parameters.columnParam",
    ]);
  });

  it("parses a webhook-only 3.1 document and a JSON 3.0 document", () => {
    expect(
      parseOpenApi(fixture("webhook-example.yaml")).query("$.webhooks~"),
    ).toHaveLength(1);
    const json = parseOpenApi(fixture("api-with-examples.json"));
    expect(json.format).toBe("json");
    expect(json.version).toBe("3.0");
  });
});

describe("parseOpenApi hardening", () => {
  const base = (extra: string) =>
    `openapi: 3.1.0\ninfo: { title: t, version: '1' }\n${extra}`;

  it("rejects external refs", () => {
    const err = rejects(
      () =>
        parseOpenApi(
          base("paths:\n  /a:\n    $ref: 'other.yaml#/paths/~1a'\n"),
        ),
      "external_ref",
    );
    expect(err.issues[0]!.at).toBe("$.paths['/a']");
    rejects(
      () =>
        parseOpenApi(
          base(
            "components:\n  schemas:\n    A: { $ref: 'https://example.com/a.json' }\n",
          ),
        ),
      "external_ref",
    );
  });

  it("rejects refs to nothing", () => {
    rejects(
      () =>
        parseOpenApi(
          base(
            "components:\n  schemas:\n    A: { $ref: '#/components/schemas/B' }\n",
          ),
        ),
      "unresolved_ref",
    );
  });

  it("keeps cyclic refs as $ref and terminates", () => {
    const doc = parseOpenApi(
      base(`components:
  schemas:
    Node:
      type: object
      properties:
        children:
          type: array
          items: { $ref: '#/components/schemas/Node' }
    A: { $ref: '#/components/schemas/B' }
    B: { $ref: '#/components/schemas/A' }
`),
    );
    expect(doc.cycles.map((c) => c.ref).sort()).toEqual([
      "#/components/schemas/A",
      "#/components/schemas/B",
      "#/components/schemas/Node",
    ]);
    expect(JSON.stringify(doc.resolved)).toContain("#/components/schemas/Node");
  });

  it("bounds the size after resolution (ref fan-out bomb)", () => {
    const levels = Array.from({ length: 30 }, (_, i) => {
      const next = `'#/components/schemas/L${i + 1}'`;
      return `    L${i}: { type: object, properties: { a: { $ref: ${next} }, b: { $ref: ${next} } } }`;
    });
    levels.push("    L30: { type: string, description: payload }");
    rejects(
      () =>
        parseOpenApi(base(`components:\n  schemas:\n${levels.join("\n")}\n`)),
      "too_large",
    );
  });

  it("stops YAML alias bombs", () => {
    const bomb = [
      "openapi: 3.1.0",
      'a: &a ["x","x","x","x","x","x","x","x","x"]',
      "b: &b [*a,*a,*a,*a,*a,*a,*a,*a,*a]",
      "c: &c [*b,*b,*b,*b,*b,*b,*b,*b,*b]",
      "d: &d [*c,*c,*c,*c,*c,*c,*c,*c,*c]",
      "e: &e [*d,*d,*d,*d,*d,*d,*d,*d,*d]",
    ].join("\n");
    rejects(() => parseOpenApi(bomb), "too_large");
  });

  it("rejects oversized input before parsing", () => {
    rejects(
      () => parseOpenApi(base("x-pad: " + "a".repeat(2 * 1024 * 1024))),
      "too_large",
    );
  });

  it("rejects excessive nesting", () => {
    const deep = "[".repeat(200) + "]".repeat(200);
    rejects(() => parseOpenApi(`{"openapi":"3.0.3","x":${deep}}`), "too_deep");
  });

  it("rejects Swagger 2.0, unknown versions and non-objects", () => {
    rejects(
      () => parseOpenApi('swagger: "2.0"\ninfo: {}\n'),
      "unsupported_version",
    );
    rejects(() => parseOpenApi("openapi: 4.0.0\n"), "unsupported_version");
    rejects(() => parseOpenApi("- a\n"), "invalid_document");
  });

  it("rejects invalid syntax, duplicate keys and custom tags", () => {
    rejects(() => parseOpenApi("openapi: [\n"), "invalid_syntax");
    rejects(
      () => parseOpenApi("openapi: 3.0.0\nopenapi: 3.1.0\n"),
      "invalid_syntax",
    );
    rejects(
      () => parseOpenApi('openapi: 3.0.0\nx: !!js/function "f"\n'),
      "invalid_syntax",
    );
  });

  it("does not treat $ref inside examples as a reference", () => {
    const doc = parseOpenApi(
      base(`components:
  schemas:
    A:
      type: object
      example: { $ref: 'not/a/ref.json' }
`),
    );
    expect(doc.refs).toEqual([]);
  });
});
