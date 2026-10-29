// In-memory stand-ins for the services other specs build, used only in local
// development (`ENVIRONMENT=development`) and in tests. They are never wired up
// in staging or production: src/services.ts fails closed there instead.
//
// - StubPaymentGate: spec 03 replaces it with x402 and MPP.
// - StubGuard:    spec 05 replaces it with AccountGuard.
// - StubRules:    spec 04 replaces it with the private rules Worker. It returns
//                 one fixed, obviously fake finding and knows nothing about any rule.

import { DEFAULT_PRICES } from "./config";
import { GatewayError } from "./errors";
import { priceFor } from "./pricing";
import type {
  Account,
  Admission,
  Artifact,
  Authorization,
  CheckKind,
  CheckRequest,
  CheckResult,
  Guard,
  IdempotencyStore,
  ParsedArtifact,
  PaymentChallenge,
  PaymentGate,
  PaymentProof,
  PaymentReceipt,
  Price,
  PublicResult,
  RulesService,
} from "./types";

/** EUR cents to the 6-decimal token units the stub asks for. */
export function stubAtomicAmount(price: Price): string {
  return String(price.total * 10_000);
}

/**
 * Builds a payment the stub gate accepts: an x402-shaped payload whose
 * authorization carries the amount and a fresh nonce. Development and tests only.
 */
export function stubPayment(
  price: Price,
  overrides: { nonce?: string; value?: string; from?: string } = {},
): PaymentProof {
  return {
    rail: "x402",
    payload: {
      x402Version: 2,
      accepted: {
        scheme: "exact",
        network: "stub",
        amount: stubAtomicAmount(price),
      },
      payload: {
        signature: "0xstub",
        authorization: {
          from: overrides.from ?? "0x000000000000000000000000000000000000dEaD",
          to: "0x0000000000000000000000000000000000000000",
          value: overrides.value ?? stubAtomicAmount(price),
          nonce:
            overrides.nonce ?? `0x${crypto.randomUUID().replace(/-/g, "")}`,
        },
      },
    },
  };
}

/**
 * In-memory payment gate. Every price is quoted as Dutch VAT, the challenge
 * names a placeholder network and asset, and `verify` accepts any payload built
 * by `stubPayment` with the right amount and an unused nonce. Nothing is ever
 * collected.
 */
export class StubPaymentGate implements PaymentGate {
  readonly settled: Authorization[] = [];
  readonly voided: { authorization: Authorization; reason: string }[] = [];
  private readonly usedNonces = new Set<string>();
  private nextId = 1;

  async quote(kind: CheckKind, parsed: ParsedArtifact, _account: Account) {
    return priceFor(DEFAULT_PRICES[kind], parsed, "nl_standard");
  }

  async challenge({
    price,
    resource,
  }: {
    account: Account;
    price: Price;
    resource: string;
  }): Promise<PaymentChallenge> {
    return {
      price,
      x402: {
        x402Version: 2,
        error: "Payment required (development stub: nothing is collected).",
        resource: { url: resource, mimeType: "application/json" },
        accepts: [
          {
            scheme: "exact",
            network: "stub",
            amount: stubAtomicAmount(price),
            asset: "stub",
            payTo: "0x0000000000000000000000000000000000000000",
            maxTimeoutSeconds: 300,
            extra: { stub: true },
          },
        ],
      },
      mpp: [],
    };
  }

  async verify({
    account,
    price,
    payment,
  }: {
    account: Account;
    price: Price;
    resource: string;
    payment: PaymentProof;
    checkRef: string;
  }): Promise<Authorization> {
    if (payment.rail !== "x402")
      throw new GatewayError(
        "payment_invalid",
        "The development stub only takes x402-shaped payments.",
      );
    const auth = (
      payment.payload as {
        payload?: { authorization?: { value?: string; nonce?: string } };
      }
    )?.payload?.authorization;
    if (!auth?.nonce || typeof auth.value !== "string")
      throw new GatewayError("payment_invalid", "Malformed payment payload.");
    if (auth.value !== stubAtomicAmount(price))
      throw new GatewayError(
        "wrong_amount",
        "The payment doesn't match this check's price.",
      );
    if (this.usedNonces.has(auth.nonce))
      throw new GatewayError(
        "payment_reused",
        "This payment authorisation was already used.",
      );
    this.usedNonces.add(auth.nonce);
    return {
      id: `pay_stub_${this.nextId++}`,
      rail: "x402",
      accountId: account.id,
      payerId: "payer_stub",
      price,
      proofRef: `x402:${auth.nonce}`,
    };
  }

  async settle(a: Authorization): Promise<PaymentReceipt> {
    this.settled.push(a);
    return {
      rail: a.rail,
      paymentId: a.id,
      x402: { success: true, transaction: "", network: "stub" },
    };
  }

  async void(a: Authorization, reason: string): Promise<void> {
    this.voided.push({ authorization: a, reason });
  }
}

/** A whole number 0–100 (decision D14). */
export function clampScore(score: number): number {
  return Math.min(100, Math.max(0, Math.round(score)));
}

/** Rounded to the nearest 10, for throttled accounts (spec 05). */
export function coarseScore(score: number): number {
  return Math.round(clampScore(score) / 10) * 10;
}

export class StubGuard implements Guard {
  readonly recorded: {
    accountId: string;
    kind: CheckKind;
    artifactSignature: string;
    triggered: string[];
  }[] = [];

  async admit(_ctx: {
    accountId: string;
    kind: CheckKind;
    artifact: Artifact;
  }): Promise<Admission> {
    return { admitted: true };
  }

  /** Accounts the stub treats as throttled (spec 05 decides this for real). */
  readonly throttled = new Set<string>();

  async shape({
    accountId,
    result,
  }: {
    accountId: string;
    result: CheckResult;
  }): Promise<PublicResult> {
    // The real guard also randomises ids and caps findings when throttled.
    const throttled = this.throttled.has(accountId);
    return {
      findings: result.findings,
      scores: result.scores.map(({ dimension, score }) => ({
        dimension,
        score: throttled ? coarseScore(score) : clampScore(score),
      })),
      rulePackVersion: result.rulePackVersion,
    };
  }

  async record(ctx: {
    accountId: string;
    kind: CheckKind;
    artifactSignature: string;
    triggered: string[];
  }): Promise<void> {
    this.recorded.push(ctx);
  }
}

export class StubRules implements RulesService {
  async run(req: CheckRequest): Promise<CheckResult> {
    return {
      findings: [
        {
          id: crypto.randomUUID(),
          severity: "info",
          location: req.artifact.kind === "skill-design" ? "SKILL.md:1" : "$",
          message:
            "STUB FINDING: the rules Worker isn't connected, so no real check ran.",
          fix: "Nothing to fix. This finding comes from the development stub (apps/expert-mcp/src/stubs.ts).",
          dimension: "stub",
        },
      ],
      scores: [{ dimension: "stub", score: 73 }],
      rulePackVersion: "stub",
      telemetry: { triggered: ["stub"] },
    };
  }
}

export class MemoryIdempotencyStore implements IdempotencyStore {
  private readonly entries = new Map<
    string,
    { bodyHash: string; response: string }
  >();

  async get(accountId: string, scope: string, key: string) {
    return this.entries.get(`${accountId}\u0000${scope}\u0000${key}`) ?? null;
  }

  async put(
    accountId: string,
    scope: string,
    key: string,
    bodyHash: string,
    response: string,
  ) {
    this.entries.set(`${accountId}\u0000${scope}\u0000${key}`, {
      bodyHash,
      response,
    });
  }
}
