import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error: plain JavaScript build script without type declarations
import { generate } from "../scripts/generate.mjs";

describe("generated files", () => {
  it("match the vendored spec (run `npm run build -w packages/acp`)", async () => {
    const files = (await generate()) as Record<string, string>;
    expect(Object.keys(files).length).toBe(3);
    for (const [path, content] of Object.entries(files)) {
      expect(readFileSync(path, "utf8"), path).toBe(content);
    }
  });
});
