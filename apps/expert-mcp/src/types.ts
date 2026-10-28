// Shared interfaces from docs/specs/expert-mcp/README.md ("Shared interfaces").
//
// TODO(spec 04): `CheckKind`, `Artifact`, `CheckRequest`, `Finding`, `CheckResult`
// and `RulesService` move to `packages/engine-api`. Once it merges, import them
// from there and delete the copies below. Keep these in step with the README
// until then: the rules Worker is built against the same shapes.
//
// TODO(spec 03): `Ledger` (and the usage, purchase-link and idempotency stores)
// get their D1 implementations there. TODO(spec 05): `Guard` and `PublicResult`.

// ---------------------------------------------------------------------------
// engine-api (spec 04)
// ---------------------------------------------------------------------------

export const CHECK_KINDS = [
  "api-governance",
  "skill-design",
  "process-review",
] as const;
export type CheckKind = (typeof CHECK_KINDS)[number];

export function isCheckKind(value: string): value is CheckKind {
  return (CHECK_KINDS as readonly string[]).includes(value);
}

export interface ArtifactFile {
  path: string;
  content: string;
}

/**
 * An artifact after the gateway has size-checked, parsed and validated it.
 * Placeholder shape until `packages/engine-api` defines `Artifact`; `check-kit`
 * parsers will replace the gateway's own parsing in src/artifact.ts.
 */
export type Artifact =
  | {
      kind: "api-governance";
      format: "json" | "yaml";
      /** The submitted text, kept so locations can be mapped to lines. */
      text: string;
      document: unknown;
    }
  | {
      kind: "skill-design";
      files: ArtifactFile[];
    }
  | {
      kind: "process-review";
      format: "json" | "yaml";
      text: string;
      document: unknown;
    };

export interface CheckOptions {
  locale?: string;
}

export interface CheckRequest {
  kind: CheckKind;
  artifact: Artifact;
  options: CheckOptions;
  /** Per-account HMAC, for phrasing variants (spec 05). */
  variantSeed: string;
}

export interface Finding {
  /** Opaque per response, not a stable rule id. */
  id: string;
  severity: "error" | "warning" | "info";
  /** JSONPath, file:line or step id in the buyer's artifact. */
  location: string;
  message: string;
  fix: string;
  dimension: string;
}

export type ScoreBand = "A" | "B" | "C" | "D" | "E";

export interface CheckResult {
  findings: Finding[];
  scores: { dimension: string; band: ScoreBand }[];
  /** Opaque label, e.g. "2026.10". */
  rulePackVersion: string;
  /** Stable rule ids, for the guard only. Stripped before responding. */
  telemetry: { triggered: string[] };
}

/** The rules Worker's entrypoint, reached over the RULES service binding. */
export interface RulesService {
  run(req: CheckRequest): Promise<CheckResult>;
}

// ---------------------------------------------------------------------------
// Gateway (spec 02)
// ---------------------------------------------------------------------------

export type AccountStatus = "active" | "throttled" | "frozen";

export interface Account {
  id: string;
  status: AccountStatus;
  termsVersion: string;
  createdAt: string;
}

/** What a verified bearer credential carries into a handler (`ctx.props`). */
export interface AuthProps extends Record<string, unknown> {
  accountId: string;
  /** How the caller authenticated: an OAuth access token or an API token. */
  via: "oauth" | "api_token";
}

/**
 * Everything a tool or REST handler needs. The README fixes `account`,
 * `requestId`, `ledger`, `guard` and `env`; `rules`, `waitUntil` and the
 * spec 03 stores are added here so handlers never reach for globals.
 */
export interface ToolContext {
  account: Account;
  requestId: string;
  ledger: Ledger;
  guard: Guard;
  rules: RulesService;
  usage: UsageLog;
  purchases: PurchaseLinks;
  flags: Flags;
  env: Env;
  /** Runs work after the response is sent (guard.record). */
  waitUntil(promise: Promise<unknown>): void;
}

// ---------------------------------------------------------------------------
// Commerce (spec 03)
// ---------------------------------------------------------------------------

export interface Reservation {
  id: string;
  accountId: string;
  credits: number;
  ref: string;
}

export interface Ledger {
  balance(accountId: string): Promise<number>;
  /** Throws `InsufficientCredits` (src/errors.ts) when the balance is too low. */
  reserve(
    accountId: string,
    credits: number,
    ref: string,
  ): Promise<Reservation>;
  commit(r: Reservation): Promise<void>;
  refund(r: Reservation, reason: string): Promise<void>;
  grant(accountId: string, credits: number, orderId: string): Promise<void>;
}

/**
 * Not in the README: `get_usage` needs the account's ledger history, which the
 * `Ledger` interface doesn't expose. Spec 03 implements it over the ledger table.
 */
export interface UsageEntry {
  at: string;
  delta: number;
  kind: string;
}

export interface UsageLog {
  recent(accountId: string, limit: number): Promise<UsageEntry[]>;
}

/** Spec 03: a Stripe Checkout link as the fallback purchase path. */
export interface PurchaseLinks {
  create(
    accountId: string,
    productId: string,
    quantity: number,
  ): Promise<{ url: string; expiresAt: string }>;
}

/**
 * Replay store for REST `Idempotency-Key`s. Spec 03 owns the `idempotency`
 * table; this is the gateway's view of it.
 */
export interface IdempotencyStore {
  get(
    accountId: string,
    scope: string,
    key: string,
  ): Promise<{ requestHash: string; response: string } | null>;
  put(
    accountId: string,
    scope: string,
    key: string,
    requestHash: string,
    response: string,
  ): Promise<void>;
}

// ---------------------------------------------------------------------------
// Guard (spec 05)
// ---------------------------------------------------------------------------

export type Admission =
  | { admitted: true }
  | {
      admitted: false;
      reason: "rate_limited" | "spend_ceiling" | "frozen";
      retryAfterSeconds?: number;
    };

/** A `CheckResult` as it may leave the gateway: no telemetry, bands only. */
export interface PublicResult {
  findings: Finding[];
  scores: { dimension: string; band: ScoreBand }[];
  rulePackVersion: string;
}

export interface Guard {
  admit(ctx: {
    accountId: string;
    kind: CheckKind;
    artifact: Artifact;
  }): Promise<Admission>;
  /** Strips telemetry, coarsens if throttled. */
  shape(ctx: { accountId: string; result: CheckResult }): Promise<PublicResult>;
  record(ctx: {
    accountId: string;
    kind: CheckKind;
    artifactSignature: string;
    triggered: string[];
  }): Promise<void>;
}

/** The kill switch (spec 05): `CHECKS_ENABLED` in KV. */
export interface Flags {
  checksEnabled(): Promise<boolean>;
}
