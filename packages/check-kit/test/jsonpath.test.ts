import { describe, expect, it } from "vitest";
import {
  compilePath,
  formatPath,
  getAt,
  parsePointer,
  query,
} from "../src/index.ts";

const doc = {
  info: { title: "T" },
  paths: {
    "/a": { get: { tags: ["x"] }, post: { tags: ["y", "z"] } },
    "/b": { get: {} },
  },
  list: [10, 20, 30],
};

describe("JSONPath", () => {
  it("selects children, wildcards, unions and indices", () => {
    expect(query(doc, "$.info.title").map((m) => m.value)).toEqual(["T"]);
    expect(query(doc, "$.paths['/a'].get").map((m) => m.location)).toEqual([
      "$.paths['/a'].get",
    ]);
    expect(query(doc, "$.paths[*].get").map((m) => m.location)).toEqual([
      "$.paths['/a'].get",
      "$.paths['/b'].get",
    ]);
    expect(query(doc, "$.paths.*[get,post]")).toHaveLength(3);
    expect(query(doc, "$.list[1]").map((m) => m.value)).toEqual([20]);
    expect(query(doc, "$.list[-1]").map((m) => m.value)).toEqual([30]);
    expect(query(doc, "$.missing.deeper")).toEqual([]);
  });

  it("supports recursive descent and key selection", () => {
    expect(query(doc, "$..tags[*]").map((m) => m.value)).toEqual([
      "x",
      "y",
      "z",
    ]);
    expect(query(doc, "$.paths[*]~").map((m) => m.value)).toEqual(["/a", "/b"]);
    expect(query(doc, "$.paths[*][*]~").map((m) => m.value)).toEqual([
      "get",
      "post",
      "get",
    ]);
  });

  it("refuses filters and slices, which would need an evaluator", () => {
    expect(() => compilePath("$.list[?(@ > 1)]")).toThrow(SyntaxError);
    expect(() => compilePath("$.list[0:2]")).toThrow(SyntaxError);
    expect(() => compilePath("paths")).toThrow(SyntaxError);
  });

  it("formats paths and pointers", () => {
    expect(formatPath(["paths", "/a", "get", "tags", 0])).toBe(
      "$.paths['/a'].get.tags[0]",
    );
    expect(formatPath(["it's"])).toBe("$['it\\'s']");
    expect(parsePointer("#/paths/~1a~0b/get")).toEqual([
      "paths",
      "/a~b",
      "get",
    ]);
    expect(parsePointer("#/components/schemas/A%20B")).toEqual([
      "components",
      "schemas",
      "A B",
    ]);
    expect(getAt(doc, ["paths", "/a", "post", "tags", 1])).toBe("z");
    expect(getAt(doc, ["constructor"])).toBeUndefined();
  });
});
