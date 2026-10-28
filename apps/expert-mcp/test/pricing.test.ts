import { describe, expect, it } from "vitest";
import { DEFAULT_PRICES } from "../src/config";
import { countOperations, priceFor, vatAmount } from "../src/pricing";
import type { Artifact } from "../src/types";

function openapi(operations: number): Artifact {
  const paths: Record<string, Record<string, unknown>> = {};
  for (let i = 0; i < operations; i++) {
    const path = `/r${Math.floor(i / 2)}`;
    paths[path] = { ...paths[path], [i % 2 ? "post" : "get"]: {} };
  }
  return {
    kind: "api-governance",
    format: "json",
    text: "",
    document: { openapi: "3.1.0", paths },
  };
}

describe("pricing (D6)", () => {
  it("counts operations under paths and webhooks, ignoring non-methods", () => {
    expect(
      countOperations({
        paths: {
          "/a": { get: {}, post: {}, parameters: [], summary: "x" },
          "/b": { delete: {} },
        },
        webhooks: { ping: { post: {} } },
      }),
    ).toBe(4);
    expect(countOperations(null)).toBe(0);
  });

  it("charges EUR 10 up to 50 operations and EUR 5 per further 50", () => {
    const row = DEFAULT_PRICES["api-governance"];
    const net = (ops: number) =>
      priceFor(row, openapi(ops), "reverse_charge").net;
    expect(net(0)).toBe(1000);
    expect(net(50)).toBe(1000);
    expect(net(51)).toBe(1500);
    expect(net(100)).toBe(1500);
    expect(net(101)).toBe(2000);
    expect(priceFor(row, openapi(120), "reverse_charge").operations).toBe(120);
  });

  it("prices skill design at EUR 5 and process review at EUR 15", () => {
    const skill: Artifact = { kind: "skill-design", files: [] };
    const process: Artifact = {
      kind: "process-review",
      format: "yaml",
      text: "",
      document: {},
    };
    expect(
      priceFor(DEFAULT_PRICES["skill-design"], skill, "nl_standard"),
    ).toMatchObject({ net: 500, vat: 105, total: 605, vatRateBp: 2100 });
    expect(
      priceFor(DEFAULT_PRICES["process-review"], process, "reverse_charge"),
    ).toMatchObject({ net: 1500, vat: 0, total: 1500, vatRateBp: 0 });
  });

  it("rounds VAT half up", () => {
    expect(vatAmount(1000, 2100)).toBe(210);
    expect(vatAmount(1, 2100)).toBe(0);
    expect(vatAmount(3, 2100)).toBe(1); // 0.63 → 1
    expect(vatAmount(50, 2100)).toBe(11); // 10.5 → 11
  });
});
