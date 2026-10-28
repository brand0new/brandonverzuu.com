import {
  isAlias,
  isMap,
  isScalar,
  isSeq,
  LineCounter,
  parseDocument,
} from "yaml";
import type { Document, Node as YamlNode } from "yaml";
import { CheckKitError } from "./errors.ts";
import { byteLength, LIMITS } from "./limits.ts";
import type { PathSegment } from "./jsonpath.ts";

export type SourceFormat = "json" | "yaml";

export interface ParsedSource {
  value: unknown;
  format: SourceFormat;
  /** 1-based line of the value (or, for an object member, its key) at `path`. */
  lineOf(path: readonly PathSegment[]): number | undefined;
}

export interface ParseSourceOptions {
  maxBytes: number;
  /** Defaults to detecting JSON by a leading `{` or `[`. */
  format?: SourceFormat;
  /** Label used in error messages, e.g. "OpenAPI document". */
  label?: string;
}

export function detectFormat(text: string): SourceFormat {
  const first = text.trimStart()[0];
  return first === "{" || first === "[" ? "json" : "yaml";
}

/**
 * Parse JSON or YAML into plain data with the service's hardening applied: a byte
 * limit before parsing, YAML 1.2 core schema only (no custom tags, no merge keys),
 * a single document, unique keys, a cap on alias expansion (billion laughs), a
 * nesting limit, and no `__proto__` keys. JSON goes through the same YAML 1.2
 * parser so line numbers work for both.
 */
export function parseSource(
  text: string,
  options: ParseSourceOptions,
): ParsedSource {
  const label = options.label ?? "document";
  if (typeof text !== "string") {
    throw new CheckKitError("invalid_syntax", `${label} must be text`);
  }
  const bytes = byteLength(text);
  if (bytes > options.maxBytes) {
    throw new CheckKitError(
      "too_large",
      `${label} is ${bytes} bytes; the limit is ${options.maxBytes}`,
    );
  }
  const format = options.format ?? detectFormat(text);
  const lineCounter = new LineCounter();
  let doc: Document.Parsed;
  try {
    doc = parseDocument(text, {
      lineCounter,
      version: "1.2",
      schema: "core",
      merge: false,
      uniqueKeys: true,
      strict: true,
      prettyErrors: false,
      customTags: [],
    });
  } catch (error) {
    throw new CheckKitError(
      "invalid_syntax",
      `${label} could not be parsed: ${String(error)}`,
    );
  }
  // An unknown tag (`!!js/function`, `!custom`) is only a warning to the YAML
  // library; here it's a rejection, so no tag ever changes what a value means.
  const problems = [
    ...doc.errors,
    ...doc.warnings.filter((w) => w.code === "TAG_RESOLVE_FAILED"),
  ];
  if (problems.length > 0) {
    throw new CheckKitError(
      "invalid_syntax",
      `${label} is not valid ${format === "json" ? "JSON" : "YAML"}`,
      problems.slice(0, 20).map((e) => ({
        at: e.linePos ? `line ${e.linePos[0].line}` : undefined,
        message: e.message.split("\n")[0] ?? e.message,
      })),
    );
  }
  let value: unknown;
  try {
    value = doc.toJS({ maxAliasCount: LIMITS.yaml.maxAliasCount });
  } catch (error) {
    throw new CheckKitError(
      "too_large",
      `${label} expands too far: ${String(error)}`,
    );
  }
  assertPlainData(value, label);

  return {
    value,
    format,
    lineOf(path) {
      return lineOf(doc, lineCounter, path);
    },
  };
}

/** Reject excessive nesting and prototype-polluting keys, without recursion. */
export function assertPlainData(value: unknown, label = "document"): void {
  const stack: { node: unknown; depth: number }[] = [{ node: value, depth: 0 }];
  const seen = new Set<object>();
  while (stack.length > 0) {
    const { node, depth } = stack.pop()!;
    if (node === null || typeof node !== "object") continue;
    if (seen.has(node)) continue;
    seen.add(node);
    if (depth > LIMITS.yaml.maxDepth) {
      throw new CheckKitError(
        "too_deep",
        `${label} nests deeper than ${LIMITS.yaml.maxDepth} levels`,
      );
    }
    if (Array.isArray(node)) {
      for (const child of node) stack.push({ node: child, depth: depth + 1 });
    } else {
      for (const key of Object.keys(node)) {
        if (key === "__proto__") {
          throw new CheckKitError(
            "invalid_document",
            `${label} uses the reserved key "__proto__"`,
          );
        }
        stack.push({
          node: (node as Record<string, unknown>)[key],
          depth: depth + 1,
        });
      }
    }
  }
}

function keyString(key: unknown): string | undefined {
  if (isScalar(key)) return String(key.value);
  return undefined;
}

function lineOf(
  doc: Document.Parsed,
  lineCounter: LineCounter,
  path: readonly PathSegment[],
): number | undefined {
  let node: unknown = doc.contents;
  let keyNode: YamlNode | undefined;
  for (const segment of path) {
    if (isAlias(node)) node = node.resolve(doc);
    if (isMap(node)) {
      const pair = node.items.find((p) => keyString(p.key) === String(segment));
      if (!pair) return undefined;
      keyNode = pair.key as YamlNode;
      node = pair.value;
    } else if (isSeq(node)) {
      if (typeof segment !== "number") return undefined;
      node = node.items[segment];
      keyNode = undefined;
    } else {
      return undefined;
    }
  }
  const target = (keyNode ?? node) as YamlNode | null | undefined;
  const offset = target?.range?.[0] ?? (path.length === 0 ? 0 : undefined);
  return offset === undefined ? undefined : lineCounter.linePos(offset).line;
}
