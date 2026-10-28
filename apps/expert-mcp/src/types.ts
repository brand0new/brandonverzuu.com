// Shared interfaces from docs/specs/expert-mcp/README.md ("Shared interfaces").
//
// TODO(spec 04): `CheckKind`, `Artifact`, `CheckRequest`, `Finding`, `CheckResult`
// and `RulesService` move to `packages/engine-api`. Once it merges, import them
// from there and delete the copies below. Keep these in step with the README
// until then: the rules Worker is built against the same shapes.
//
// TODO(spec 03): `PaymentGate` and `IdempotencyStore` get their D1 and rail
// implementations there. TODO(spec 05): `Guard` and `PublicResult`.

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
 * `requestId`, `payments`, `guard` and `env`; `rules`, `flags` and `waitUntil`
 * are added here so handlers never reach for globals.
 */
export interface ToolContext {
  account: Account;
  requestId: string;
  payments: PaymentGate;
  guard: Guard;
  rules: RulesService;
  flags: Flags;
  env: Env;
  /** Runs work after the response is sent (guard.record). */
  waitUntil(promise: Promise<unknown>): void;
}

// ---------------------------------------------------------------------------
// Payments (spec 03, decision D13): x402 and MPP, paid per check
// ---------------------------------------------------------------------------

export type Rail = "x402" | "mpp";

/** How VAT applies to one account (spec 03 "VAT"). */
export type VatTreatment = "reverse_charge" | "nl_standard";

/** A price for one check, in EUR minor units (cents). */
export interface Price {
  kind: CheckKind;
  currency: "EUR";
  /** Excluding VAT. */
  net: number;
  vat: number;
  /** What is charged: net + vat. */
  total: number;
  vatTreatment: VatTreatment;
  /** VAT rate in basis points (2100 = 21%). */
  vatRateBp: number;
  /** API governance only: operations counted in the parsed document. */
  operations?: number;
}

/** x402 v2 `PaymentRequirements` (one entry of `accepts`). */
export interface X402Requirements {
  scheme: "exact";
  /** CAIP-2, e.g. "eip155:8453". */
  network: string;
  /** Atomic token units, as a decimal string. */
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown>;
}

/** x402 v2 `PaymentRequired`. */
export interface X402PaymentRequired {
  x402Version: 2;
  error?: string;
  resource: { url: string; description?: string; mimeType?: string };
  accepts: X402Requirements[];
  extensions?: Record<string, unknown>;
}

/** An MPP challenge (Payment HTTP authentication scheme), with `request` as a JSON object. */
export interface MppChallenge {
  id: string;
  realm: string;
  method: string;
  intent: string;
  request: Record<string, unknown>;
  expires?: string;
  description?: string;
  header?: "Payment-Authorization";
  opaque?: string;
}

/** The body of a 402: every way this check can be paid. */
export interface PaymentChallenge {
  price: Price;
  x402: X402PaymentRequired;
  mpp: MppChallenge[];
}

/** A payment attached to a retried request, still unverified. */
export type PaymentProof =
  { rail: "x402"; payload: unknown } | { rail: "mpp"; credential: unknown };

/** A verified payment that hasn't been settled or voided yet. */
export interface Authorization {
  /** payments.id */
  id: string;
  rail: Rail;
  accountId: string;
  payerId: string;
  price: Price;
  /** Single-use reference of the proof (x402 nonce, MPP challenge id). */
  proofRef: string;
}

/** What the caller gets back after settlement, per transport. */
export interface PaymentReceipt {
  rail: Rail;
  paymentId: string;
  /** x402 `SettlementResponse` (sent as PAYMENT-RESPONSE / `x402/payment-response`). */
  x402?: Record<string, unknown>;
  /** MPP receipt (sent as Payment-Receipt / `org.paymentauth/receipt`). */
  mpp?: Record<string, unknown>;
}

export interface PaymentGate {
  /** EUR minor units, VAT applied per account. */
  quote(kind: CheckKind, artifact: Artifact, account: Account): Promise<Price>;
  /** The 402 body: x402 requirements + MPP challenge. */
  challenge(ctx: {
    account: Account;
    price: Price;
    resource: string;
  }): Promise<PaymentChallenge>;
  /** Throws payer_not_bound, wrong_amount, payment_reused or payment_invalid (src/errors.ts). */
  verify(ctx: {
    account: Account;
    price: Price;
    resource: string;
    payment: PaymentProof;
    checkRef: string;
  }): Promise<Authorization>;
  settle(a: Authorization): Promise<PaymentReceipt>;
  /** Nothing collected; refund on MPP, where capture can't be deferred. */
  void(a: Authorization, reason: string): Promise<void>;
}

/**
 * Replay store for `Idempotency-Key`s (spec 03 "Idempotency"): the same key
 * and body replay the stored response and charge nothing.
 */
export interface IdempotencyStore {
  get(
    accountId: string,
    route: string,
    key: string,
  ): Promise<{ bodyHash: string; response: string } | null>;
  put(
    accountId: string,
    route: string,
    key: string,
    bodyHash: string,
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
