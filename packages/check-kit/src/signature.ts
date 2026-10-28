/**
 * Structural signatures for the near-duplicate gate (spec 05): a hash of the
 * artifact's normalised shape, and a MinHash of its paths and keys so similarity
 * between two artifacts can be estimated without storing either.
 *
 * Normalisation keeps object keys (sorted), array order and value *types*; it drops
 * scalar values, so two documents that differ only in text or numbers share a
 * shape hash. The MinHash feature set is every key path with array indices
 * collapsed (`paths./pets.get.responses.200`), plus each path's value type.
 *
 * Everything here is deterministic and runtime-independent (no WebCrypto, no
 * randomness), so the gateway and tests compute identical signatures.
 */
import type { ParsedSkill } from "./skill.ts";

export interface StructuralSignature {
  /** 32 hex characters: hash of the normalised shape. */
  shape: string;
  /** MinHash of the feature set, `permutations` values. */
  minhash: number[];
  /** Number of distinct features. */
  features: number;
}

export interface SignatureOptions {
  /** MinHash size. Default 128. */
  permutations?: number;
}

const DEFAULT_PERMUTATIONS = 128;

/** FNV-1a over UTF-16 code units, 32 bits, with a seed. */
export function fnv1a32(text: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** MurmurHash3 finaliser: spreads bits so derived hashes are independent enough. */
function fmix32(x: number): number {
  let h = x >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** 128-bit hex digest built from four seeded 32-bit hashes. Not cryptographic. */
export function hash128(text: string): string {
  const seeds = [0x811c9dc5, 0x01234567, 0x89abcdef, 0xdeadbeef];
  return seeds
    .map((s) => fmix32(fnv1a32(text, s)).toString(16).padStart(8, "0"))
    .join("");
}

function typeTag(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

/** Canonical shape string: keys sorted, scalars replaced by their type. */
export function normalisedShape(value: unknown): string {
  type Item = { value: unknown } | { text: string };
  const out: string[] = [];
  const stack: Item[] = [{ value }];
  // Iterative, so deeply nested input can't overflow the call stack.
  while (stack.length > 0) {
    const item = stack.pop()!;
    if ("text" in item) {
      out.push(item.text);
      continue;
    }
    const node = item.value;
    if (Array.isArray(node)) {
      out.push("[");
      stack.push({ text: "]" });
      for (let i = node.length - 1; i >= 0; i--)
        stack.push({ text: "," }, { value: node[i] });
    } else if (node !== null && typeof node === "object") {
      out.push("{");
      stack.push({ text: "}" });
      const keys = Object.keys(node).sort().reverse();
      for (const key of keys) {
        stack.push(
          { text: "," },
          { value: (node as Record<string, unknown>)[key] },
        );
        stack.push({ text: `${JSON.stringify(key)}:` });
      }
    } else {
      out.push(typeTag(node));
    }
  }
  return out.join("");
}

/** Every key path (array indices collapsed to `[]`) with its value type. */
export function structuralFeatures(value: unknown): Set<string> {
  const out = new Set<string>();
  const stack: { node: unknown; path: string }[] = [{ node: value, path: "$" }];
  while (stack.length > 0) {
    const { node, path } = stack.pop()!;
    out.add(path);
    out.add(`${path}=${typeTag(node)}`);
    if (Array.isArray(node)) {
      for (const item of node) stack.push({ node: item, path: `${path}[]` });
    } else if (node !== null && typeof node === "object") {
      for (const key of Object.keys(node)) {
        stack.push({
          node: (node as Record<string, unknown>)[key],
          path: `${path}.${key}`,
        });
      }
    }
  }
  return out;
}

/** MinHash of a feature set, using double hashing (h1 + i·h2) per permutation. */
export function minhash(
  features: Iterable<string>,
  permutations = DEFAULT_PERMUTATIONS,
): number[] {
  const mins = new Array<number>(permutations).fill(0xffffffff);
  for (const feature of features) {
    const h1 = fnv1a32(feature);
    const h2 = fnv1a32(feature, 0x9747b28c) | 1;
    for (let i = 0; i < permutations; i++) {
      const h = fmix32((h1 + Math.imul(i, h2)) >>> 0);
      if (h < mins[i]!) mins[i] = h;
    }
  }
  return mins;
}

/** Estimated Jaccard similarity of the two feature sets, 0…1. */
export function similarity(
  a: StructuralSignature | number[],
  b: StructuralSignature | number[],
): number {
  const x = Array.isArray(a) ? a : a.minhash;
  const y = Array.isArray(b) ? b : b.minhash;
  if (x.length !== y.length || x.length === 0) {
    throw new Error("MinHash signatures must have the same, non-zero length");
  }
  let same = 0;
  for (let i = 0; i < x.length; i++) if (x[i] === y[i]) same++;
  return same / x.length;
}

/**
 * The JSON-like value a skill's signature is computed from: frontmatter, the file
 * tree with each file's kind, and the heading outline of `SKILL.md`.
 */
export function skillSignatureInput(
  skill: ParsedSkill,
): Record<string, unknown> {
  return {
    frontmatter: skill.frontmatter.data ?? null,
    files: Object.fromEntries(skill.files.map((f) => [f.path, f.kind])),
    outline: skill.headings.map((h) => `h${h.depth}`),
  };
}

/** Signature of any JSON-like value (an OpenAPI source, a process document …). */
export function structuralSignature(
  value: unknown,
  options: SignatureOptions = {},
): StructuralSignature {
  const features = structuralFeatures(value);
  return {
    shape: hash128(normalisedShape(value)),
    minhash: minhash(features, options.permutations ?? DEFAULT_PERMUTATIONS),
    features: features.size,
  };
}
