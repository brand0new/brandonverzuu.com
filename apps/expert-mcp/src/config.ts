import type { CheckKind } from "./types";

/** One row of the `prices` table (spec 03), amounts in EUR minor units, excl. VAT. */
export interface PriceRow {
  kind: CheckKind;
  baseAmount: number;
  currency: "EUR";
  /** API governance: operations included in the base price, and per step. */
  stepOps: number | null;
  stepAmount: number | null;
  active: boolean;
}

/**
 * Prices per check from decision D6, excluding VAT. Spec 03 seeds the D1
 * `prices` table with the same numbers; this copy is the development default.
 */
export const DEFAULT_PRICES: Record<CheckKind, PriceRow> = {
  "skill-design": {
    kind: "skill-design",
    baseAmount: 500,
    currency: "EUR",
    stepOps: null,
    stepAmount: null,
    active: true,
  },
  "api-governance": {
    kind: "api-governance",
    baseAmount: 1000,
    currency: "EUR",
    stepOps: 50,
    stepAmount: 500,
    active: true,
  },
  "process-review": {
    kind: "process-review",
    baseAmount: 1500,
    currency: "EUR",
    stepOps: null,
    stepAmount: null,
    active: true,
  },
};

/** Dutch standard VAT rate, in basis points (spec 03 "VAT"). */
export const NL_VAT_RATE_BP = 2100;

/** Input limits per kind (spec 04), enforced before anything is parsed. */
export const LIMITS = {
  "api-governance": { maxBytes: 2 * 1024 * 1024 },
  "skill-design": { maxBytes: 1024 * 1024, maxFiles: 200, maxPathLength: 512 },
  "process-review": { maxBytes: 1024 * 1024 },
  /** Nesting depth of a parsed JSON/YAML document. */
  maxDepth: 64,
  /** YAML anchors/aliases: caps alias expansion ("billion laughs"). */
  maxYamlAliases: 50,
} as const;

export const OAUTH_SCOPE = "expert";

export const MAGIC_LINK_TTL_SECONDS = 15 * 60;
export const MAGIC_LINKS_PER_WINDOW = 3;
export const SIGNIN_SESSION_TTL_SECONDS = 60 * 60;
export const DEVICE_CODE_TTL_SECONDS = 10 * 60;
export const DEVICE_POLL_INTERVAL_SECONDS = 5;

export const SESSION_COOKIE = "__Host-bvx_session";
export const API_TOKEN_PREFIX = "bvx_";

export function isDevelopment(env: Env): boolean {
  return env.ENVIRONMENT === "development";
}
