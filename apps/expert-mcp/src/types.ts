// Shared interfaces from docs/specs/expert-mcp/README.md ("Shared interfaces").
//
// The contract with the rules Worker comes from `@brandonverzuu/engine-api`
// (spec 04); this file re-exports it and adds the gateway's own interfaces.
//
// TODO(spec 03): `PaymentGate` and `IdempotencyStore` get their D1 and rail
// implementations there. TODO(spec 05): `Guard` and `PublicResult`.

import type {
  Artifact,
  Band,
  CheckKind,
  CheckRequest,
  CheckResult,
  Finding,
  RulesService,
  SkillFile,
} from "@brandonverzuu/engine-api";

export type {
  Artifact,
  CheckKind,
  CheckRequest,
  CheckResult,
  Finding,
  RulesService,
};

// ---------------------------------------------------------------------------
// engine-api helpers
// ---------------------------------------------------------------------------

export const CHECK_KINDS = [
  "api-governance",
  "skill-design",
  "process-review",
] as const satisfies readonly CheckKind[];

export function isCheckKind(value: string): value is CheckKind {
  return (CHECK_KINDS as readonly string[]).includes(value);
}

export type ArtifactFile = SkillFile;
export type ScoreBand = Band;
export type CheckOptions = CheckRequest["options"];

/**
 * An artifact after the gateway has size-checked, parsed and validated it:
 * the engine-api `Artifact` that crosses the service binding, plus the parsed
 * document the gateway itself needs (the operation count for pricing).
 */
export interface ParsedArtifact {
  artifact: Artifact;
  /** The parsed JSON/YAML document; absent for skills. */
  document?: unknown;
  options: CheckOptions;
  /** Placeholder structural signature for guard.record (spec 05 replaces it). */
  signature: string;
  bytes: number;
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
  quote(
    kind: CheckKind,
    parsed: ParsedArtifact,
    account: Account,
  ): Promise<Price>;
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
