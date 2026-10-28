import { Validator } from "@cfworker/json-schema";
import type { Schema, SchemaDraft } from "@cfworker/json-schema";

/**
 * Generic predicates of the kind every linter has. Each factory returns a function
 * that is `true` when the value passes. Except for `exists`, a predicate passes on
 * `undefined`: whether something must be present is `exists`'s job.
 *
 * Which predicate applies where, with which options, is decided elsewhere.
 */
export type Predicate = (value: unknown) => boolean;

/** Present: not `undefined` and not `null`. */
export function exists(): Predicate {
  return (value) => value !== undefined && value !== null;
}

/** Not present: `undefined` or `null`. */
export function absent(): Predicate {
  return (value) => value === undefined || value === null;
}

export interface PatternOptions {
  /** RegExp, or a string: either a bare pattern or `/pattern/flags`. */
  match?: string | RegExp;
  notMatch?: string | RegExp;
}

export function toRegExp(pattern: string | RegExp): RegExp {
  if (pattern instanceof RegExp) return pattern;
  const literal = /^\/(.+)\/([dgimsuvy]*)$/s.exec(pattern);
  return literal
    ? new RegExp(literal[1]!, literal[2]!.replace(/[gy]/g, ""))
    : new RegExp(pattern);
}

/** String matches `match` and doesn't match `notMatch`. Non-strings fail. */
export function pattern(options: PatternOptions): Predicate {
  const match =
    options.match !== undefined ? toRegExp(options.match) : undefined;
  const notMatch =
    options.notMatch !== undefined ? toRegExp(options.notMatch) : undefined;
  return (value) => {
    if (value === undefined) return true;
    if (typeof value !== "string") return false;
    if (match && !match.test(value)) return false;
    if (notMatch && notMatch.test(value)) return false;
    return true;
  };
}

export type CasingType =
  "flat" | "camel" | "pascal" | "kebab" | "cobol" | "snake" | "macro";

export interface CasingOptions {
  type: CasingType;
  /** Default `false`: digits are allowed after the first character. */
  disallowDigits?: boolean;
  /** Allow these characters between cased words, e.g. `{ char: '/' }` for paths. */
  separator?: { char: string; allowLeading?: boolean };
}

const CASING: Record<CasingType, { word: string; digits: string }> = {
  flat: { word: "[a-z][a-z{d}]*", digits: "0-9" },
  camel: { word: "[a-z][a-z{d}]*(?:[A-Z{d}](?:[a-z{d}]+|$))*", digits: "0-9" },
  pascal: { word: "[A-Z][a-z{d}]*(?:[A-Z{d}](?:[a-z{d}]+|$))*", digits: "0-9" },
  kebab: { word: "[a-z][a-z{d}]*(?:-[a-z{d}]+)*", digits: "0-9" },
  cobol: { word: "[A-Z][A-Z{d}]*(?:-[A-Z{d}]+)*", digits: "0-9" },
  snake: { word: "[a-z][a-z{d}]*(?:_[a-z{d}]+)*", digits: "0-9" },
  macro: { word: "[A-Z][A-Z{d}]*(?:_[A-Z{d}]+)*", digits: "0-9" },
};

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&");
}

/** Build the RegExp a casing check uses. Exported for tests and reuse. */
export function casingRegExp(options: CasingOptions): RegExp {
  const spec = CASING[options.type];
  if (!spec) throw new Error(`Unknown casing type: ${options.type}`);
  const word = spec.word.replace(
    /\{d\}/g,
    options.disallowDigits ? "" : spec.digits,
  );
  if (!options.separator) return new RegExp(`^${word}$`);
  const sep = escapeRegExp(options.separator.char);
  const leading = options.separator.allowLeading ? `(?:${sep})?` : "";
  return new RegExp(`^${leading}${word}(?:${sep}${word})*$`);
}

/** String is in the given casing. Non-strings fail. */
export function casing(options: CasingOptions): Predicate {
  const re = casingRegExp(options);
  return (value) =>
    value === undefined || (typeof value === "string" && re.test(value));
}

export interface LengthOptions {
  min?: number;
  max?: number;
}

/** Length of a string (in code points), array (items) or object (keys) is within bounds. */
export function length(options: LengthOptions): Predicate {
  return (value) => {
    if (value === undefined) return true;
    let n: number;
    if (typeof value === "string") n = [...value].length;
    else if (Array.isArray(value)) n = value.length;
    else if (value !== null && typeof value === "object")
      n = Object.keys(value).length;
    else return false;
    if (options.min !== undefined && n < options.min) return false;
    if (options.max !== undefined && n > options.max) return false;
    return true;
  };
}

export interface EnumerationOptions {
  values: readonly unknown[];
  /** Compare strings case-insensitively. */
  ignoreCase?: boolean;
}

/** Value is one of `values` (strict equality for primitives). */
export function enumeration(options: EnumerationOptions): Predicate {
  const values = options.ignoreCase
    ? options.values.map((v) => (typeof v === "string" ? v.toLowerCase() : v))
    : options.values;
  return (value) => {
    if (value === undefined) return true;
    const v =
      options.ignoreCase && typeof value === "string"
        ? value.toLowerCase()
        : value;
    return values.includes(v);
  };
}

export interface SchemaOptions {
  schema: Schema | boolean;
  draft?: SchemaDraft;
}

/** Value validates against a JSON Schema (2020-12 by default). */
export function schema(options: SchemaOptions): Predicate {
  const validator = new Validator(
    options.schema as Schema,
    options.draft ?? "2020-12",
    true,
  );
  return (value) => value === undefined || validator.validate(value).valid;
}

/** Passes when the inner predicate fails. Note: `not(pattern(...))` fails on `undefined`. */
export function not(predicate: Predicate): Predicate {
  return (value) => !predicate(value);
}

export function all(...predicates: Predicate[]): Predicate {
  return (value) => predicates.every((p) => p(value));
}

export function any(...predicates: Predicate[]): Predicate {
  return (value) => predicates.some((p) => p(value));
}
