/**
 * The RPC contract between the gateway (`apps/expert-mcp`) and the private rules
 * Worker (`expert-rules`, repo `brand0new/expertise`). Types only: no runtime code,
 * no rule content. Changes go through a PR to `docs/specs/expert-mcp/README.md`.
 *
 * The private repo vendors a copy of this file (`vendor/engine-api`). Keep the two
 * in sync until this package is published.
 */

/** The three paid checks. No profiles in v1. */
export type CheckKind = "api-governance" | "skill-design" | "process-review";

/** One file of an Agent Skill folder, path relative to the skill root. */
export interface SkillFile {
  path: string;
  content: string;
}

/**
 * The buyer's artifact as it crosses the service binding.
 *
 * The gateway validates, size-checks and parses it with `@brandonverzuu/check-kit`
 * before anything is charged. What crosses the binding is the validated source,
 * not the parsed object graph: parsed forms hold locator maps that don't survive
 * structured cloning, and re-parsing with the same check-kit version is cheap and
 * deterministic. `artifact.kind` always equals `CheckRequest.kind`.
 */
export type Artifact =
  | { kind: "api-governance"; format: "json" | "yaml"; content: string }
  | { kind: "skill-design"; files: SkillFile[] }
  | { kind: "process-review"; format: "json" | "yaml"; content: string };

export interface CheckRequest {
  kind: CheckKind;
  /** Parsed and size-checked by the gateway. */
  artifact: Artifact;
  /** Profiles are a later option. */
  options: { locale?: string };
  /** Per-account HMAC, for phrasing variants (spec 05). */
  variantSeed: string;
}

export type Severity = "error" | "warning" | "info";

export interface Finding {
  /** Opaque per response, not a stable rule id. */
  id: string;
  severity: Severity;
  /** JSONPath / file:line / step id in the buyer's artifact. */
  location: string;
  message: string;
  fix: string;
  /** For example "naming", "security", "handoffs". */
  dimension: string;
}

export interface DimensionScore {
  dimension: string;
  /** Rating from 0 (worst) to 100 (best), a whole number (decision D14). */
  score: number;
}

export interface CheckResult {
  findings: Finding[];
  scores: DimensionScore[];
  /** Opaque label, for example "2026.10". */
  rulePackVersion: string;
  /** Stable rule ids: for the guard only, stripped before responding. */
  telemetry: { triggered: string[] };
}

/** The rules Worker entrypoint (WorkerEntrypoint RPC over the service binding). */
export interface RulesService {
  run(req: CheckRequest): Promise<CheckResult>;
}
