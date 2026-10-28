// Small runtime helpers the generated schemas use for JSON Schema keywords
// that zod has no direct equivalent for.

import type { z } from "zod";

export const UNIQUE_ITEMS = { message: "Array items must be unique" };

/** `uniqueItems: true`, compared by JSON value. */
export function uniqueItems(items: readonly unknown[]): boolean {
  const seen = new Set(items.map((item) => JSON.stringify(item)));
  return seen.size === items.length;
}

const has = (value: object, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

/** `anyOf: [{ required: [...] }, ...]`: at least one group must be present. */
export function requireOneGroup(groups: readonly (readonly string[])[]) {
  return (value: object, ctx: z.RefinementCtx) => {
    if (groups.some((keys) => keys.every((key) => has(value, key)))) return;
    ctx.addIssue({
      code: "custom",
      message: `Expected one of: ${groups.map((keys) => keys.join(" + ")).join(", ")}`,
      path: [],
    });
  };
}

/** `if: { properties: { k: { enum } } }, then: { required: [...] }`. */
export function requireWhen(spec: {
  when: Record<string, readonly unknown[]>;
  required: readonly string[];
}) {
  return (value: object, ctx: z.RefinementCtx) => {
    const record = value as Record<string, unknown>;
    const applies = Object.entries(spec.when).every(([key, allowed]) =>
      allowed.includes(record[key]),
    );
    if (!applies) return;
    for (const key of spec.required) {
      if (!has(value, key)) {
        ctx.addIssue({
          code: "invalid_type",
          expected: "nonoptional",
          message: `Missing required field: ${key}`,
          path: [key],
        });
      }
    }
  };
}
