import type { CheckKind } from "./types";

/**
 * Credits per artifact. Placeholders until Brandon sets pricing (decision D6);
 * spec 03 may move them into the products table.
 */
export const CHECK_PRICES: Record<CheckKind, number> = {
  "api-governance": 1,
  "skill-design": 1,
  "process-review": 1,
};

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
