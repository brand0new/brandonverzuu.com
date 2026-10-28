// Validate + parse: the second step of the paid-check pipeline. Runs before any
// credit is reserved, so a malformed or oversized artifact costs nothing.
//
// TODO(spec 04): the parsers move to `packages/check-kit` (OpenAPI with $ref
// resolution, Markdown + frontmatter AST, the process schema). This module keeps
// the gateway's own job: limits enforced before parsing, and parsing that can't
// be made to blow up (YAML alias bombs, deep nesting, external references).

import { parseDocument } from "yaml";
import { z } from "zod";
import { LIMITS } from "./config";
import { sha256Hex } from "./crypto";
import { GatewayError } from "./errors";
import type { Artifact, ArtifactFile, CheckKind, CheckOptions } from "./types";

const encoder = new TextEncoder();

// --- Input schemas, shared by the MCP tools and the REST routes -------------

const optionsSchema = z
  .strictObject({
    locale: z
      .string()
      .regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, "a BCP 47 language tag")
      .max(35)
      .optional()
      .describe("Language for messages, as a BCP 47 tag. Defaults to English."),
  })
  .optional();

const documentInput = (what: string) =>
  z.strictObject({
    document: z.string().min(1).describe(`The ${what} as JSON or YAML text.`),
    format: z
      .enum(["json", "yaml"])
      .optional()
      .describe("Defaults to detecting JSON, then YAML."),
    options: optionsSchema,
  });

export const CHECK_INPUT_SCHEMAS = {
  "api-governance": documentInput(
    "OpenAPI 3.0 or 3.1 document, bundled into one file (external $refs are rejected)",
  ),
  "skill-design": z.strictObject({
    files: z
      .array(
        z.strictObject({
          path: z
            .string()
            .min(1)
            .describe(
              "Path relative to the skill folder, e.g. SKILL.md or scripts/run.sh.",
            ),
          content: z.string().describe("The file's text."),
        }),
      )
      .min(1)
      .describe(
        "Every file of the skill folder, SKILL.md included. Text files only.",
      ),
    options: optionsSchema,
  }),
  "process-review": documentInput(
    "process description in the public Process Description format",
  ),
} as const satisfies Record<CheckKind, z.ZodType>;

export type CheckInput<K extends CheckKind> = z.infer<
  (typeof CHECK_INPUT_SCHEMAS)[K]
>;
export type AnyCheckInput = CheckInput<CheckKind>;

// --- Parsing -----------------------------------------------------------------

export interface ParsedArtifact {
  artifact: Artifact;
  options: CheckOptions;
  /** Placeholder structural signature for guard.record (spec 05 replaces it). */
  signature: string;
  bytes: number;
}

export async function parseArtifact(
  kind: CheckKind,
  input: unknown,
): Promise<ParsedArtifact> {
  const schema = CHECK_INPUT_SCHEMAS[kind];
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new GatewayError(
      "invalid_request",
      `Invalid input: ${z.prettifyError(parsed.error)}`,
    );
  }
  const value = parsed.data as AnyCheckInput;
  const options: CheckOptions = value.options?.locale
    ? { locale: value.options.locale }
    : {};

  if (kind === "skill-design") {
    const files = (value as CheckInput<"skill-design">).files;
    const bytes = checkSkillFiles(files);
    const canonical = [...files]
      .sort((a, b) => (a.path < b.path ? -1 : 1))
      .map((f) => `${f.path}\u0000${f.content}`)
      .join("\u0000");
    return {
      artifact: { kind, files },
      options,
      signature: await sha256Hex(canonical),
      bytes,
    };
  }

  const { document: text, format } = value as CheckInput<"api-governance">;
  const bytes = encoder.encode(text).byteLength;
  const maxBytes = LIMITS[kind].maxBytes;
  if (bytes > maxBytes) {
    throw new GatewayError(
      "artifact_too_large",
      `The document is ${bytes} bytes; the limit is ${maxBytes}.`,
    );
  }
  const { document, format: detected } = parseStructured(text, format);
  if (kind === "api-governance") checkOpenApi(document);
  else checkProcess(document);
  return {
    artifact: { kind, format: detected, text, document },
    options,
    signature: await sha256Hex(text),
    bytes,
  };
}

function checkSkillFiles(files: ArtifactFile[]): number {
  const limits = LIMITS["skill-design"];
  if (files.length > limits.maxFiles) {
    throw new GatewayError(
      "artifact_too_large",
      `The skill has ${files.length} files; the limit is ${limits.maxFiles}.`,
    );
  }
  const seen = new Set<string>();
  let total = 0;
  for (const file of files) {
    const path = file.path;
    if (
      path.length > limits.maxPathLength ||
      path.startsWith("/") ||
      path.includes("\\") ||
      path.includes("\u0000") ||
      path
        .split("/")
        .some(
          (segment) => segment === "" || segment === "." || segment === "..",
        )
    ) {
      throw new GatewayError(
        "invalid_artifact",
        `Invalid file path: paths are relative, use "/", and have no "." or ".." segments.`,
      );
    }
    if (seen.has(path))
      throw new GatewayError(
        "invalid_artifact",
        `Duplicate file path: ${path}`,
      );
    seen.add(path);
    total += encoder.encode(file.content).byteLength;
    if (total > limits.maxBytes) {
      throw new GatewayError(
        "artifact_too_large",
        `The skill's files exceed ${limits.maxBytes} bytes in total.`,
      );
    }
  }
  if (!seen.has("SKILL.md"))
    throw new GatewayError(
      "invalid_artifact",
      "The skill folder has no SKILL.md at its root.",
    );
  return total;
}

/** Parses JSON or YAML text into plain data, refusing anything pathological. */
export function parseStructured(
  text: string,
  format?: "json" | "yaml",
): { document: unknown; format: "json" | "yaml" } {
  const detected = format ?? (/^\s*[[{]/.test(text) ? "json" : "yaml");
  // Depth is checked on the raw text before parsing, so a deeply nested input
  // never reaches a recursive parser. Brackets inside strings are skipped.
  if (bracketDepth(text) > LIMITS.maxDepth) {
    throw new GatewayError(
      "invalid_artifact",
      `The document is nested deeper than ${LIMITS.maxDepth} levels.`,
    );
  }
  let document: unknown;
  if (detected === "json") {
    try {
      document = JSON.parse(text);
    } catch {
      throw new GatewayError(
        "invalid_artifact",
        "The document isn't valid JSON.",
      );
    }
  } else {
    const doc = parseDocument(text, {
      schema: "core",
      uniqueKeys: true,
      prettyErrors: false,
    });
    if (doc.errors.length > 0) {
      throw new GatewayError(
        "invalid_artifact",
        `The document isn't valid YAML (line ${lineOf(doc.errors[0]!)}).`,
      );
    }
    try {
      document = doc.toJS({ maxAliasCount: LIMITS.maxYamlAliases });
    } catch {
      throw new GatewayError(
        "invalid_artifact",
        "The document uses too many YAML aliases.",
      );
    }
  }
  if (valueDepth(document) > LIMITS.maxDepth) {
    // Catches block-style YAML nesting, which has no brackets.
    throw new GatewayError(
      "invalid_artifact",
      `The document is nested deeper than ${LIMITS.maxDepth} levels.`,
    );
  }
  if (
    document === null ||
    typeof document !== "object" ||
    Array.isArray(document)
  ) {
    throw new GatewayError(
      "invalid_artifact",
      "The document must be a JSON or YAML object.",
    );
  }
  return { document, format: detected };
}

function lineOf(error: { linePos?: [{ line: number }, ...unknown[]] }): number {
  return error.linePos?.[0]?.line ?? 0;
}

function bracketDepth(text: string): number {
  let depth = 0;
  let max = 0;
  let quote: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"') quote = c;
    else if (c === "{" || c === "[") max = Math.max(max, ++depth);
    else if (c === "}" || c === "]") depth = Math.max(0, depth - 1);
  }
  return max;
}

/** Iterative, so it can't overflow the stack itself. */
function valueDepth(root: unknown): number {
  let max = 0;
  const stack: [unknown, number][] = [[root, 0]];
  while (stack.length > 0) {
    const [value, depth] = stack.pop()!;
    if (value === null || typeof value !== "object") continue;
    max = Math.max(max, depth + 1);
    if (max > LIMITS.maxDepth) return max;
    for (const child of Object.values(value)) stack.push([child, depth + 1]);
  }
  return max;
}

function checkOpenApi(document: unknown): void {
  const version = (document as { openapi?: unknown }).openapi;
  if (typeof version !== "string" || !/^3\.[01]\.\d+$/.test(version)) {
    throw new GatewayError(
      "invalid_artifact",
      'Only OpenAPI 3.0 and 3.1 documents are accepted (an "openapi" field of 3.0.x or 3.1.x).',
    );
  }
  // External references are rejected: the buyer bundles first (spec 04).
  // Internal ones are left for check-kit to resolve, with its cycle detection.
  const stack: unknown[] = [document];
  while (stack.length > 0) {
    const value = stack.pop();
    if (value === null || typeof value !== "object") continue;
    for (const [key, child] of Object.entries(value)) {
      if (
        key === "$ref" &&
        typeof child === "string" &&
        !child.startsWith("#")
      ) {
        throw new GatewayError(
          "invalid_artifact",
          "External $refs aren't accepted. Bundle the document into one file first.",
        );
      }
      stack.push(child);
    }
  }
}

function checkProcess(_document: unknown): void {
  // TODO(spec 04): validate against the Process Description JSON Schema
  // (packages/check-kit/schemas/process-description.schema.json).
}
