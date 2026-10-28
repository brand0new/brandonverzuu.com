import { CheckKitError } from "./errors.ts";
import type { CheckKitIssue } from "./errors.ts";
import { LIMITS } from "./limits.ts";
import {
  formatPath,
  getAt,
  parsePointer,
  query as runQuery,
} from "./jsonpath.ts";
import type { CompiledPath, Match, PathSegment } from "./jsonpath.ts";
import { parseSource } from "./yaml.ts";
import type { SourceFormat } from "./yaml.ts";

export interface OpenApiRef {
  /** JSONPath of the `$ref` site in the source. */
  at: string;
  /** The `$ref` value, e.g. `#/components/schemas/Pet`. */
  ref: string;
}

export interface OpenApiDocument {
  /** `3.0` or `3.1`. */
  version: "3.0" | "3.1";
  /** The exact `openapi` field, e.g. `3.1.0`. */
  openapi: string;
  format: SourceFormat;
  /** The document as submitted, `$ref`s intact. */
  source: Record<string, unknown>;
  /**
   * The document with every internal `$ref` replaced by its target. Targets are
   * shared, not copied, so one definition is one object wherever it's used. A `$ref`
   * that would close a cycle stays a `{ $ref }` object and is listed in `cycles`.
   */
  resolved: Record<string, unknown>;
  refs: OpenApiRef[];
  cycles: OpenApiRef[];
  /** Approximate JSON size of the fully expanded document (cycles counted once). */
  resolvedBytes: number;
  /** JSONPath in the source where a resolved object or array is defined. */
  locate(node: unknown): string | undefined;
  /** 1-based source line for a path in the source document. */
  lineOf(path: readonly PathSegment[]): number | undefined;
  /**
   * JSONPath query over the resolved document. Each match's `location` points into
   * the submitted document: a node reached through a `$ref` is located where its
   * definition lives, which is where the buyer would fix it.
   */
  query(expression: string | CompiledPath): Match[];
}

export interface ParseOpenApiOptions {
  format?: SourceFormat;
  maxBytes?: number;
  maxResolvedBytes?: number;
}

/** Keys whose values are literal data, never OpenAPI objects, so `$ref` inside is text. */
const LITERAL_KEYS = new Set(["example", "default", "const", "enum"]);

/** Maps whose keys are names chosen by the author, not OpenAPI / JSON Schema keywords. */
const NAME_MAPS = new Set([
  "properties",
  "patternProperties",
  "$defs",
  "definitions",
  "dependentSchemas",
  "schemas",
  "responses",
  "parameters",
  "examples",
  "requestBodies",
  "headers",
  "securitySchemes",
  "links",
  "callbacks",
  "pathItems",
  "paths",
  "webhooks",
  "content",
  "encoding",
  "variables",
]);

function isLiteralPosition(path: readonly PathSegment[]): boolean {
  const key = path[path.length - 1];
  if (typeof key !== "string") return false;
  const parent = path[path.length - 2];
  if (typeof parent === "string" && NAME_MAPS.has(parent)) return false;
  if (LITERAL_KEYS.has(key) || key.startsWith("x-")) return true;
  // Example Object `value`: …/examples/<name>/value
  if (key === "value" && path[path.length - 3] === "examples") return true;
  return false;
}

/**
 * Parse an OpenAPI 3.0 or 3.1 document (JSON or YAML) and resolve its internal
 * `$ref`s. External references (anything not starting with `#`) are rejected: the
 * buyer bundles first. Resolution is cycle-safe and memoised, and the expanded size
 * is bounded so a chain of shared references can't blow up.
 */
export function parseOpenApi(
  text: string,
  options: ParseOpenApiOptions = {},
): OpenApiDocument {
  const maxBytes = options.maxBytes ?? LIMITS.openapi.maxBytes;
  const maxResolvedBytes =
    options.maxResolvedBytes ?? LIMITS.openapi.maxResolvedBytes;
  const parsed = parseSource(text, {
    maxBytes,
    format: options.format,
    label: "OpenAPI document",
  });
  const source = parsed.value;
  if (source === null || typeof source !== "object" || Array.isArray(source)) {
    throw new CheckKitError(
      "invalid_document",
      "OpenAPI document must be an object",
    );
  }
  const root = source as Record<string, unknown>;
  const openapi = root.openapi;
  if (typeof openapi !== "string") {
    const swagger =
      typeof root.swagger === "string"
        ? ` (found swagger: ${root.swagger})`
        : "";
    throw new CheckKitError(
      "unsupported_version",
      `Not an OpenAPI 3.x document: the "openapi" field is missing${swagger}`,
    );
  }
  const versionMatch = /^3\.([01])\.\d+(-[0-9A-Za-z.-]+)?$/.exec(openapi);
  if (!versionMatch) {
    throw new CheckKitError(
      "unsupported_version",
      `OpenAPI ${openapi} is not supported; send 3.0.x or 3.1.x`,
    );
  }

  const resolver = new Resolver(root);
  const resolved = resolver.resolve(root, []) as Record<string, unknown>;
  if (resolver.errors.length > 0) {
    const external = resolver.errors.some((e) => e.code === "external_ref");
    throw new CheckKitError(
      external ? "external_ref" : "unresolved_ref",
      external
        ? "External $refs are not supported; bundle the document into one file first"
        : "Some $refs point to nothing in this document",
      resolver.errors.slice(0, 50).map(({ at, message }) => ({ at, message })),
    );
  }
  const resolvedBytes = expandedSize(resolved, maxResolvedBytes);
  if (resolvedBytes > maxResolvedBytes) {
    throw new CheckKitError(
      "too_large",
      `OpenAPI document exceeds ${maxResolvedBytes} bytes after $ref resolution`,
    );
  }

  const origin = resolver.origin;
  return {
    version: `3.${versionMatch[1]}` as "3.0" | "3.1",
    openapi,
    format: parsed.format,
    source: root,
    resolved,
    refs: resolver.refs,
    cycles: resolver.cycles,
    resolvedBytes,
    locate(node) {
      if (node === null || typeof node !== "object") return undefined;
      const path = origin.get(node);
      return path ? formatPath(path) : undefined;
    },
    lineOf: parsed.lineOf,
    query(expression) {
      return runQuery(resolved, expression, {
        locate(value, path, parentLocation) {
          if (path.length === 0) return "$";
          if (value !== null && typeof value === "object") {
            const defined = origin.get(value);
            if (defined) return formatPath(defined);
          }
          return parentLocation + formatPath([path[path.length - 1]!]).slice(1);
        },
      });
    },
  };
}

interface ResolveError extends CheckKitIssue {
  code: "external_ref" | "unresolved_ref" | "too_deep";
  at: string;
}

class Resolver {
  readonly origin = new WeakMap<object, PathSegment[]>();
  readonly refs: OpenApiRef[] = [];
  readonly cycles: OpenApiRef[] = [];
  readonly errors: ResolveError[] = [];
  private readonly memo = new WeakMap<object, unknown>();
  private readonly inProgress = new Set<object>();
  private depth = 0;

  constructor(private readonly root: Record<string, unknown>) {}

  resolve(value: unknown, path: PathSegment[]): unknown {
    if (value === null || typeof value !== "object") return value;
    if (path.length > 0 && isLiteralPosition(path)) return value;
    if (
      !Array.isArray(value) &&
      typeof (value as { $ref?: unknown }).$ref === "string"
    ) {
      return this.resolveRef(value as Record<string, unknown>, path);
    }
    const cached = this.memo.get(value);
    if (cached !== undefined) return cached;
    if (this.inProgress.has(value)) return value;
    if (++this.depth > LIMITS.maxRefDepth) {
      this.depth--;
      this.errors.push({
        code: "too_deep",
        at: formatPath(path),
        message: `Nesting through $refs exceeds ${LIMITS.maxRefDepth} levels`,
      });
      return value;
    }
    this.inProgress.add(value);
    let out: unknown;
    if (Array.isArray(value)) {
      const arr: unknown[] = [];
      this.origin.set(arr, path);
      this.memo.set(value, arr);
      value.forEach((item, i) => arr.push(this.resolve(item, [...path, i])));
      out = arr;
    } else {
      const obj: Record<string, unknown> = {};
      this.origin.set(obj, path);
      this.memo.set(value, obj);
      for (const key of Object.keys(value)) {
        obj[key] = this.resolve((value as Record<string, unknown>)[key], [
          ...path,
          key,
        ]);
      }
      out = obj;
    }
    this.inProgress.delete(value);
    this.depth--;
    return out;
  }

  private resolveRef(
    node: Record<string, unknown>,
    path: PathSegment[],
  ): unknown {
    const ref = node.$ref as string;
    const at = formatPath(path);
    if (!ref.startsWith("#")) {
      this.errors.push({
        code: "external_ref",
        at,
        message: `External $ref "${ref}"`,
      });
      return node;
    }
    let targetPath: string[];
    try {
      targetPath = parsePointer(ref);
    } catch (error) {
      this.errors.push({
        code: "unresolved_ref",
        at,
        message: (error as Error).message,
      });
      return node;
    }
    const target = getAt(this.root, targetPath);
    if (target === undefined) {
      this.errors.push({
        code: "unresolved_ref",
        at,
        message: `$ref "${ref}" points to nothing`,
      });
      return node;
    }
    this.refs.push({ at, ref });
    if (target !== null && typeof target === "object" && this.isCycle(target)) {
      this.cycles.push({ at, ref });
      const kept = { ...node };
      this.origin.set(kept, path);
      return kept;
    }
    const resolvedTarget = this.resolve(target, targetPath);
    const siblings = Object.keys(node).filter((k) => k !== "$ref");
    if (
      siblings.length === 0 ||
      resolvedTarget === null ||
      typeof resolvedTarget !== "object" ||
      Array.isArray(resolvedTarget)
    ) {
      return resolvedTarget;
    }
    // OpenAPI 3.1 allows `summary` / `description` next to `$ref`; they win.
    const merged: Record<string, unknown> = {
      ...(resolvedTarget as Record<string, unknown>),
    };
    for (const key of siblings)
      merged[key] = this.resolve(node[key], [...path, key]);
    this.origin.set(merged, path);
    return merged;
  }

  /** A target is cyclic if it, or a `$ref` chain from it, is still being resolved. */
  private isCycle(target: object): boolean {
    if (this.inProgress.has(target)) return true;
    let current: unknown = target;
    const seen = new Set<unknown>();
    while (
      current !== null &&
      typeof current === "object" &&
      typeof (current as { $ref?: unknown }).$ref === "string"
    ) {
      if (seen.has(current)) return true;
      seen.add(current);
      const ref = (current as { $ref: string }).$ref;
      if (!ref.startsWith("#")) return false;
      let next: unknown;
      try {
        next = getAt(this.root, parsePointer(ref));
      } catch {
        return false;
      }
      if (
        next !== null &&
        typeof next === "object" &&
        this.inProgress.has(next)
      )
        return true;
      current = next;
    }
    return false;
  }
}

/** Approximate serialised size of a DAG, memoised per node, stopping past `limit`. */
function expandedSize(root: unknown, limit: number): number {
  const memo = new WeakMap<object, number>();
  const size = (value: unknown): number => {
    if (value === null) return 4;
    switch (typeof value) {
      case "string":
        return value.length + 2;
      case "number":
      case "boolean":
        return String(value).length;
      case "object": {
        const cached = memo.get(value);
        if (cached !== undefined) return cached;
        let total = 2;
        if (Array.isArray(value)) {
          for (const item of value) {
            total += size(item) + 1;
            if (total > limit) break;
          }
        } else {
          for (const [key, item] of Object.entries(value)) {
            total += key.length + 4 + size(item);
            if (total > limit) break;
          }
        }
        memo.set(value, total);
        return total;
      }
      default:
        return 0;
    }
  };
  return size(root);
}
