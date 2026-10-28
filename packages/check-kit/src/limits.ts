/**
 * Input limits from docs/specs/expert-mcp/04-check-engine.md, plus generic parser
 * hardening. These protect the service; they say nothing about what is checked.
 */
export const LIMITS = {
  openapi: {
    /** Raw source and the size after internal `$ref` resolution. */
    maxBytes: 2 * 1024 * 1024,
    maxResolvedBytes: 2 * 1024 * 1024,
  },
  skill: {
    maxBytes: 1024 * 1024,
    maxFiles: 200,
    maxPathLength: 512,
  },
  process: {
    maxBytes: 1024 * 1024,
  },
  yaml: {
    /** Alias expansions allowed while converting YAML to data (billion-laughs guard). */
    maxAliasCount: 100,
    /** Maximum nesting of objects and arrays. */
    maxDepth: 128,
  },
  /** Maximum nesting while following `$ref` chains. */
  maxRefDepth: 256,
} as const;

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}
