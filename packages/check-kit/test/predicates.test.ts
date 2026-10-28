import { describe, expect, it } from "vitest";
import {
  all,
  any,
  casing,
  enumeration,
  exists,
  length,
  not,
  pattern,
  schema,
} from "../src/index.ts";

describe("predicates", () => {
  it("exists", () => {
    expect(exists()("")).toBe(true);
    expect(exists()(0)).toBe(true);
    expect(exists()(undefined)).toBe(false);
    expect(exists()(null)).toBe(false);
  });

  it("pattern", () => {
    expect(pattern({ match: "^a" })("abc")).toBe(true);
    expect(pattern({ match: "/^A/i" })("abc")).toBe(true);
    expect(pattern({ notMatch: /c$/ })("abc")).toBe(false);
    expect(pattern({ match: "^a" })(42)).toBe(false);
    expect(pattern({ match: "^a" })(undefined)).toBe(true);
  });

  it.each([
    ["camel", "fooBar", "FooBar"],
    ["pascal", "FooBar", "fooBar"],
    ["kebab", "foo-bar", "foo_bar"],
    ["snake", "foo_bar", "foo-bar"],
    ["macro", "FOO_BAR", "foo_bar"],
    ["cobol", "FOO-BAR", "FOO_BAR"],
    ["flat", "foobar", "fooBar"],
  ] as const)("casing %s", (type, good, bad) => {
    expect(casing({ type })(good)).toBe(true);
    expect(casing({ type })(bad)).toBe(false);
  });

  it("casing options", () => {
    expect(casing({ type: "kebab" })("v2-items")).toBe(true);
    expect(casing({ type: "kebab", disallowDigits: true })("v2-items")).toBe(
      false,
    );
    const paths = casing({
      type: "kebab",
      separator: { char: "/", allowLeading: true },
    });
    expect(paths("/foo-bar/baz")).toBe(true);
    expect(paths("/fooBar/baz")).toBe(false);
  });

  it("length, enumeration, schema and combinators", () => {
    expect(length({ min: 2, max: 3 })("ab")).toBe(true);
    expect(length({ max: 1 })(["a", "b"])).toBe(false);
    expect(length({ min: 1 })({})).toBe(false);
    expect(length({ max: 2 })("😀😀")).toBe(true);
    expect(enumeration({ values: ["a", "b"] })("b")).toBe(true);
    expect(enumeration({ values: ["A"], ignoreCase: true })("a")).toBe(true);
    expect(enumeration({ values: ["a"] })("c")).toBe(false);
    const isObj = schema({ schema: { type: "object", required: ["x"] } });
    expect(isObj({ x: 1 })).toBe(true);
    expect(isObj({})).toBe(false);
    expect(not(exists())(undefined)).toBe(true);
    expect(all(exists(), length({ min: 1 }))("a")).toBe(true);
    expect(
      any(enumeration({ values: [1] }), enumeration({ values: [2] }))(3),
    ).toBe(false);
  });
});
