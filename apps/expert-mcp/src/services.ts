// Wires the services a handler needs. In development and tests they're the
// in-memory stubs; in staging and production only what exists is wired, and
// everything else fails closed with `not_configured` instead of pretending.

import { isDevelopment } from "./config";
import { hmacSha256Hex } from "./crypto";
import { GatewayError } from "./errors";
import { createLivePaymentGate } from "./payments/gate";
import { D1IdempotencyStore } from "./payments/store";
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

/**
 * Development services. Payments use the stub gate unless the PAYMENT_GATE var
 * is "live" (x402 on Base Sepolia and Stripe test mode, with real keys in
 * .dev.vars); idempotency uses D1 when an env is given.
 */
export function createDevServices(env?: Env): Services {
  return {
    payments:
      env?.PAYMENT_GATE === "live"
        ? createLivePaymentGate(env)
        : new StubPaymentGate(),
    guard: new StubGuard(),
    rules: new StubRules(),
    idempotency: env
      ? new D1IdempotencyStore(env)
      : new MemoryIdempotencyStore(),
    flags: { checksEnabled: async () => true },
  };
}

export function getServices(env: Env): Services {
  if (isDevelopment(env)) {
    devServices ??= createDevServices(env);
    return devServices;
  }
  const missing = (what: string, spec: string) => () => {
    throw new GatewayError(
      "not_configured",
      `${what} isn't available yet (${spec}).`,
    );
  };
  let payments: PaymentGate;
  try {
    payments = createLivePaymentGate(env);
  } catch {
    // PAYMENT_HMAC_KEY missing: every paid check answers not_configured.
    const paymentsMissing = missing("Payments", "PAYMENT_HMAC_KEY");
    payments = {
      quote: paymentsMissing,
      challenge: paymentsMissing,
      verify: paymentsMissing,
      settle: paymentsMissing,
      void: paymentsMissing,
    };
  }
  return {
    payments,
    idempotency: new D1IdempotencyStore(env),
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
