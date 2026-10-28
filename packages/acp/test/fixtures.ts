import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const examplesDir = new URL("../spec/2026-04-17/examples/", import.meta.url);

/** One upstream example file from `spec/2026-04-17/examples/`. */
export function loadExamples(name: string): Record<string, unknown> {
  const path = fileURLToPath(new URL(name, examplesDir));
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

export function loadSpec(path: string): Record<string, unknown> {
  const url = new URL(`../spec/2026-04-17/${path}`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), "utf8")) as Record<
    string,
    unknown
  >;
}
