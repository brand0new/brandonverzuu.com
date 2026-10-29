// Wires the services a handler needs. In development and tests they're the
// in-memory stubs; in staging and production only what exists is wired, and
// everything else fails closed with `not_configured` instead of pretending.

import { isDevelopment } from "./config";
import { hmacSha256Hex } from "./crypto";
import { GatewayError } from "./errors";
import {
  MemoryIdempotencyStore,
  StubGuard,
  StubPaymentGate,
  StubRules,
} from "./stubs";
import type {
  Flags,
  Guard,
  IdempotencyStore,
  PaymentGate,
  RulesService,
} from "./types";

export interface Services {
  payments: PaymentGate;
  guard: Guard;
  rules: RulesService;
  idempotency: IdempotencyStore;
  flags: Flags;
}

/** Development keys. Never used outside `ENVIRONMENT=development`. */
const DEV_EMAIL_HMAC_KEY = "dev-only-email-hmac-key";
const DEV_VARIANT_KEY = "dev-only-variant-key";

let devServices: Services | undefined;

/** Replaces the development services, for tests. */
export function setDevServices(services: Services | undefined): void {
  devServices = services;
}

export function createDevServices(): Services {
  return {
    payments: new StubPaymentGate(),
    guard: new StubGuard(),
    rules: new StubRules(),
    idempotency: new MemoryIdempotencyStore(),
    flags: { checksEnabled: async () => true },
  };
}

export function getServices(env: Env): Services {
  if (isDevelopment(env)) {
    devServices ??= createDevServices();
    return devServices;
  }
  const missing = (what: string, spec: string) => () => {
    throw new GatewayError(
      "not_configured",
      `${what} isn't available yet (${spec}).`,
    );
  };
  const paymentsMissing = missing("Payments", "spec 03");
  return {
    // TODO(spec 03): x402 and MPP behind PaymentGate, and the D1 idempotency store.
    payments: {
      quote: paymentsMissing,
      challenge: paymentsMissing,
      verify: paymentsMissing,
      settle: paymentsMissing,
      void: paymentsMissing,
    },
    idempotency: {
      get: missing("Idempotency", "spec 03"),
      put: missing("Idempotency", "spec 03"),
    },
    // TODO(spec 05): AccountGuard.
    guard: {
      admit: missing("Admission control", "spec 05"),
      shape: missing("Result shaping", "spec 05"),
      record: missing("Probing detection", "spec 05"),
    },
    rules: env.RULES as unknown as RulesService,
    flags: {
      // Fails closed: checks run only when the flag is explicitly "true".
      checksEnabled: async () =>
        (await env.FLAGS.get("CHECKS_ENABLED")) === "true",
    },
  };
}

export function emailHmacKey(env: Env): string {
  if (env.EMAIL_HMAC_KEY) return env.EMAIL_HMAC_KEY;
  if (isDevelopment(env)) return DEV_EMAIL_HMAC_KEY;
  throw new GatewayError("not_configured", "EMAIL_HMAC_KEY is not set.");
}

/** Per-account seed for phrasing variants (spec 05). */
export async function variantSeed(
  env: Env,
  accountId: string,
): Promise<string> {
  const key =
    env.VARIANT_KEY ?? (isDevelopment(env) ? DEV_VARIANT_KEY : undefined);
  if (!key) throw new GatewayError("not_configured", "VARIANT_KEY is not set.");
  return hmacSha256Hex(key, accountId);
}
