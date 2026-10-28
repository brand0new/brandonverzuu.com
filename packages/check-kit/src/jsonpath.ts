/**
 * A small, eval-free JSONPath subset, enough to address nodes in OpenAPI, process
 * and skill documents:
 *
 *   $                root
 *   .name  ['name']  child by name (["name"] too)
 *   [0]              array index
 *   .*  [*]          every child
 *   [a,'b',0]        union of names / indices
 *   ..name  ..*      recursive descent (the node itself and every descendant)
 *   ~                at the very end: select the property names instead of values
 *
 * Filter expressions (`[?(...)]`) and slices are deliberately unsupported: they
 * need an expression evaluator, and the Workers runtime forbids `eval`.
 */

export type PathSegment = string | number;

export interface Match {
  value: unknown;
  /** Path in the queried value. */
  path: PathSegment[];
  /**
   * JSONPath of the match in the buyer's source. Equals `formatPath(path)` unless
   * the caller supplied a `locate` hook (the OpenAPI parser maps resolved `$ref`
   * targets back to where they are defined).
   */
  location: string;
}

type Selector =
  | { type: "names"; names: PathSegment[] }
  | { type: "wildcard" }
  | { type: "descendant"; inner: Selector };

export interface CompiledPath {
  selectors: Selector[];
  keys: boolean;
  source: string;
}

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$-]*/;

export function compilePath(expression: string): CompiledPath {
  const source = expression;
  let s = expression.trim();
  if (!s.startsWith("$"))
    throw new SyntaxError(`JSONPath must start with $: ${source}`);
  s = s.slice(1);
  let keys = false;
  if (s.endsWith("~")) {
    keys = true;
    s = s.slice(0, -1);
  }
  const selectors: Selector[] = [];
  while (s.length > 0) {
    let descendant = false;
    if (s.startsWith("..")) {
      descendant = true;
      s = s.slice(2);
    } else if (s.startsWith(".")) {
      s = s.slice(1);
    } else if (!s.startsWith("[")) {
      throw new SyntaxError(`Unexpected "${s[0]}" in JSONPath: ${source}`);
    }
    let selector: Selector;
    if (s.startsWith("*")) {
      selector = { type: "wildcard" };
      s = s.slice(1);
    } else if (s.startsWith("[")) {
      const end = findBracketEnd(s, source);
      selector = parseBracket(s.slice(1, end), source);
      s = s.slice(end + 1);
    } else {
      const m = IDENT.exec(s);
      if (!m) throw new SyntaxError(`Expected a name in JSONPath: ${source}`);
      selector = { type: "names", names: [m[0]] };
      s = s.slice(m[0].length);
    }
    selectors.push(
      descendant ? { type: "descendant", inner: selector } : selector,
    );
  }
  return { selectors, keys, source };
}

function findBracketEnd(s: string, source: string): number {
  let quote: string | undefined;
  for (let i = 1; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = undefined;
    } else if (c === "'" || c === '"') quote = c;
    else if (c === "]") return i;
  }
  throw new SyntaxError(`Unclosed [ in JSONPath: ${source}`);
}

function parseBracket(body: string, source: string): Selector {
  const trimmed = body.trim();
  if (trimmed === "*") return { type: "wildcard" };
  if (
    trimmed.startsWith("?") ||
    trimmed.startsWith("(") ||
    /^-?\d*:/.test(trimmed)
  ) {
    throw new SyntaxError(`Filters and slices are not supported: ${source}`);
  }
  const names: PathSegment[] = [];
  let rest = trimmed;
  while (rest.length > 0) {
    let item: PathSegment;
    if (rest[0] === "'" || rest[0] === '"') {
      const quote = rest[0];
      let out = "";
      let i = 1;
      for (; i < rest.length && rest[i] !== quote; i++) {
        if (rest[i] === "\\" && i + 1 < rest.length) i++;
        out += rest[i];
      }
      if (i >= rest.length)
        throw new SyntaxError(`Unclosed quote in JSONPath: ${source}`);
      item = out;
      rest = rest.slice(i + 1).trimStart();
    } else {
      const m = /^[^,\s]+/.exec(rest)!;
      item = /^-?\d+$/.test(m[0]) ? Number(m[0]) : m[0];
      rest = rest.slice(m[0].length).trimStart();
    }
    names.push(item);
    if (rest.startsWith(",")) rest = rest.slice(1).trimStart();
    else if (rest.length > 0)
      throw new SyntaxError(`Expected , in JSONPath: ${source}`);
  }
  return { type: "names", names };
}

export interface QueryOptions {
  /** Map a node's path to its location in the source. Defaults to `formatPath`. */
  locate?: (
    value: unknown,
    path: PathSegment[],
    parentLocation: string,
  ) => string;
}

interface Cursor {
  value: unknown;
  path: PathSegment[];
  location: string;
}

function children(
  cursor: Cursor,
  locate: NonNullable<QueryOptions["locate"]>,
): Cursor[] {
  const { value } = cursor;
  if (value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return value.map((child, i) => {
      const path = [...cursor.path, i];
      return {
        value: child,
        path,
        location: locate(child, path, cursor.location),
      };
    });
  }
  return Object.keys(value).map((key) => {
    const child = (value as Record<string, unknown>)[key];
    const path = [...cursor.path, key];
    return {
      value: child,
      path,
      location: locate(child, path, cursor.location),
    };
  });
}

function child(
  cursor: Cursor,
  name: PathSegment,
  locate: NonNullable<QueryOptions["locate"]>,
): Cursor | undefined {
  const { value } = cursor;
  if (value === null || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    if (typeof name !== "number" && !/^\d+$/.test(name)) return undefined;
    const index = Number(name) < 0 ? value.length + Number(name) : Number(name);
    if (index < 0 || index >= value.length) return undefined;
    const path = [...cursor.path, index];
    return {
      value: value[index],
      path,
      location: locate(value[index], path, cursor.location),
    };
  }
  const key = String(name);
  if (!Object.prototype.hasOwnProperty.call(value, key)) return undefined;
  const childValue = (value as Record<string, unknown>)[key];
  const path = [...cursor.path, key];
  return {
    value: childValue,
    path,
    location: locate(childValue, path, cursor.location),
  };
}

function select(
  cursor: Cursor,
  selector: Selector,
  locate: NonNullable<QueryOptions["locate"]>,
): Cursor[] {
  switch (selector.type) {
    case "wildcard":
      return children(cursor, locate);
    case "names":
      return selector.names.flatMap((n) => {
        const c = child(cursor, n, locate);
        return c ? [c] : [];
      });
    case "descendant": {
      const out: Cursor[] = [];
      const stack: Cursor[] = [cursor];
      while (stack.length > 0) {
        const current = stack.pop()!;
        out.push(...select(current, selector.inner, locate));
        stack.push(...children(current, locate).reverse());
      }
      return out;
    }
  }
}

const defaultLocate = (_value: unknown, path: PathSegment[]) =>
  formatPath(path);

/** Evaluate a JSONPath (string or compiled) against a value. */
export function query(
  root: unknown,
  expression: string | CompiledPath,
  options: QueryOptions = {},
): Match[] {
  const compiled =
    typeof expression === "string" ? compilePath(expression) : expression;
  const locate = options.locate ?? defaultLocate;
  let cursors: Cursor[] = [
    { value: root, path: [], location: locate(root, [], "$") },
  ];
  for (const selector of compiled.selectors) {
    cursors = cursors.flatMap((c) => select(c, selector, locate));
  }
  if (compiled.keys) {
    return cursors
      .filter((c) => c.path.length > 0)
      .map((c) => ({
        value: c.path[c.path.length - 1],
        path: c.path,
        location: c.location,
      }));
  }
  return cursors.map((c) => ({
    value: c.value,
    path: c.path,
    location: c.location,
  }));
}

/** `['paths', '/pets', 'get']` → `$.paths['/pets'].get` */
export function formatPath(path: readonly PathSegment[]): string {
  let out = "$";
  for (const segment of path) {
    if (typeof segment === "number") out += `[${segment}]`;
    else if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(segment)) out += `.${segment}`;
    else out += `['${segment.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}']`;
  }
  return out;
}

/** Append one segment to an already formatted JSONPath. */
export function appendPath(base: string, segment: PathSegment): string {
  return base + formatPath([segment]).slice(1);
}

/** Decode a JSON Pointer (`/a/b~1c`, optionally URI-fragment encoded) into segments. */
export function parsePointer(pointer: string): string[] {
  let p = pointer;
  if (p.startsWith("#")) {
    p = p.slice(1);
    try {
      p = decodeURIComponent(p);
    } catch {
      throw new SyntaxError(`Invalid percent-encoding in pointer: ${pointer}`);
    }
  }
  if (p === "") return [];
  if (!p.startsWith("/"))
    throw new SyntaxError(`JSON Pointer must start with /: ${pointer}`);
  return p
    .slice(1)
    .split("/")
    .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
}

/** Read the value at a path, own properties only. */
export function getAt(root: unknown, path: readonly PathSegment[]): unknown {
  let node = root;
  for (const segment of path) {
    if (node === null || typeof node !== "object") return undefined;
    if (Array.isArray(node)) {
      if (!/^\d+$/.test(String(segment))) return undefined;
      node = node[Number(segment)];
    } else {
      if (!Object.prototype.hasOwnProperty.call(node, segment))
        return undefined;
      node = (node as Record<string, unknown>)[String(segment)];
    }
  }
  return node;
}
