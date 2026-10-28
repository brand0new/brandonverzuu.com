import { describe, expect, it, vi } from "vitest";
import { parseArtifact } from "../src/artifact";
import { GatewayError, PaymentRequired } from "../src/errors";
import { runPaidCheck } from "../src/pipeline";
import { StubGuard, StubPaymentGate, stubPayment } from "../src/stubs";
import type { CheckKind, PaymentProof, ToolContext } from "../src/types";
import {
  createAccount,
  makeContext,
  setAccountStatus,
  VALID_INPUTS,
} from "./helpers";

const RESOURCE = "https://example.test/v1/checks/x";

async function expectGatewayError(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(GatewayError);
  expect((error as GatewayError).code).toBe(code);
  return error as GatewayError;
}

/** A stub payment for exactly this check's price. */
async function paymentFor(
  ctx: ToolContext,
  kind: CheckKind,
  input: unknown,
  overrides?: Parameters<typeof stubPayment>[1],
): Promise<PaymentProof> {
  const { artifact } = await parseArtifact(kind, input);
  return stubPayment(
    await ctx.payments.quote(kind, artifact, ctx.account),
    overrides,
  );
}

async function paid(ctx: ToolContext, kind: CheckKind, input?: unknown) {
  const body = input ?? VALID_INPUTS[kind];
  return runPaidCheck(ctx, kind, body, {
    resource: RESOURCE,
    proof: await paymentFor(ctx, kind, body),
  });
}

describe("runPaidCheck", () => {
  it("answers 402 with a challenge and runs nothing without a payment", async () => {
    const account = await createAccount();
    const { ctx, services } = makeContext(account);
    const run = vi.spyOn(services.rules, "run");
    const error = await expectGatewayError(
      runPaidCheck(ctx, "skill-design", VALID_INPUTS["skill-design"], {
        resource: RESOURCE,
        proof: null,
      }),
      "payment_required",
    );
    expect(error).toBeInstanceOf(PaymentRequired);
    expect(error.status).toBe(402);
    const { challenge } = error as PaymentRequired;
    expect(challenge.price).toMatchObject({ net: 500, vat: 105, total: 605 });
    expect(challenge.x402).toMatchObject({
      x402Version: 2,
      resource: { url: RESOURCE },
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("verifies, runs, settles once, strips telemetry and records after responding", async () => {
    const account = await createAccount();
    const { ctx, services, settle } = makeContext(account);
    const outcome = await paid(ctx, "api-governance");

    expect(outcome.price).toMatchObject({ kind: "api-governance", net: 1000 });
    expect(outcome.result).not.toHaveProperty("telemetry");
    expect(outcome.result.findings[0]?.message).toMatch(/^STUB FINDING/);
    const gate = services.payments as StubPaymentGate;
    expect(gate.settled).toHaveLength(1);
    expect(gate.voided).toHaveLength(0);
    expect(outcome.receipt.paymentId).toBe(gate.settled[0]!.id);

    await settle();
    const recorded = (services.guard as StubGuard).recorded;
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      accountId: account.id,
      kind: "api-governance",
      triggered: ["stub"],
    });
    expect(recorded[0]!.artifactSignature).toMatch(/^[0-9a-f]{64}$/);
  });

  it("voids when the rules Worker fails", async () => {
    const account = await createAccount();
    const { ctx, services, settle } = makeContext(account);
    ctx.rules = {
      run: vi.fn(async () => Promise.reject(new Error("rules down"))),
    };
    await expectGatewayError(paid(ctx, "skill-design"), "check_failed");
    const gate = services.payments as StubPaymentGate;
    expect(gate.voided).toHaveLength(1);
    expect(gate.settled).toHaveLength(0);
    await settle();
    expect((services.guard as StubGuard).recorded).toHaveLength(0);
  });

  it("voids when shaping fails", async () => {
    const account = await createAccount();
    const { ctx, services } = makeContext(account);
    vi.spyOn(services.guard, "shape").mockRejectedValue(
      new Error("shape failed"),
    );
    await expectGatewayError(paid(ctx, "process-review"), "check_failed");
    const gate = services.payments as StubPaymentGate;
    expect(gate.voided).toHaveLength(1);
    expect(gate.settled).toHaveLength(0);
  });

  it("voids and withholds the result when settling fails", async () => {
    const account = await createAccount();
    const { ctx, services } = makeContext(account);
    vi.spyOn(services.payments, "settle").mockRejectedValue(
      new Error("facilitator down"),
    );
    await expectGatewayError(paid(ctx, "api-governance"), "payment_failed");
    expect((services.payments as StubPaymentGate).voided).toHaveLength(1);
  });

  it("surfaces the original error when voiding itself fails", async () => {
    const account = await createAccount();
    const { ctx, services } = makeContext(account);
    ctx.rules = {
      run: async () =>
        Promise.reject(new GatewayError("not_configured", "rules missing")),
    };
    vi.spyOn(services.payments, "void").mockRejectedValue(
      new Error("void failed"),
    );
    await expectGatewayError(paid(ctx, "api-governance"), "not_configured");
  });

  it("rejects a wrong amount and a reused authorisation before any rules run, with a fresh challenge", async () => {
    const account = await createAccount();
    const { ctx, services } = makeContext(account);
    const run = vi.spyOn(services.rules, "run");
    const input = VALID_INPUTS["api-governance"];

    const wrong = await expectGatewayError(
      runPaidCheck(ctx, "api-governance", input, {
        resource: RESOURCE,
        proof: await paymentFor(ctx, "api-governance", input, { value: "1" }),
      }),
      "wrong_amount",
    );
    expect(wrong).toBeInstanceOf(PaymentRequired);
    expect(wrong.status).toBe(402);

    const proof = await paymentFor(ctx, "api-governance", input);
    await runPaidCheck(ctx, "api-governance", input, {
      resource: RESOURCE,
      proof,
    });
    run.mockClear();
    await expectGatewayError(
      runPaidCheck(ctx, "api-governance", input, { resource: RESOURCE, proof }),
      "payment_reused",
    );
    expect(run).not.toHaveBeenCalled();
  });

  it("asks for nothing for an invalid artifact", async () => {
    const account = await createAccount();
    const { ctx, services } = makeContext(account);
    const quote = vi.spyOn(services.payments, "quote");
    const noPayment = { resource: RESOURCE, proof: null };

    await expectGatewayError(
      runPaidCheck(
        ctx,
        "api-governance",
        { document: '{"swagger": "2.0"}' },
        noPayment,
      ),
      "invalid_artifact",
    );
    await expectGatewayError(
      runPaidCheck(
        ctx,
        "api-governance",
        { document: "{}", extra: true },
        noPayment,
      ),
      "invalid_request",
    );
    expect(quote).not.toHaveBeenCalled();
  });

  it("verifies nothing when admission is refused", async () => {
    const account = await createAccount();
    const { ctx, services } = makeContext(account);
    vi.spyOn(services.guard, "admit").mockResolvedValue({
      admitted: false,
      reason: "rate_limited",
      retryAfterSeconds: 30,
    });
    const verify = vi.spyOn(services.payments, "verify");

    const error = await paid(ctx, "api-governance").catch((e: unknown) => e);
    expect(error).toMatchObject({
      code: "rate_limited",
      retryAfterSeconds: 30,
    });
    expect(verify).not.toHaveBeenCalled();
  });

  it("charges nothing when the kill switch is off", async () => {
    const account = await createAccount();
    const { ctx, services } = makeContext(account);
    ctx.flags = { checksEnabled: async () => false };
    const verify = vi.spyOn(services.payments, "verify");
    await expectGatewayError(paid(ctx, "api-governance"), "checks_disabled");
    expect(verify).not.toHaveBeenCalled();
  });

  it("runs nothing for a frozen account", async () => {
    const account = await createAccount();
    await setAccountStatus(account.id, "frozen");
    const { ctx, services } = makeContext({ ...account, status: "frozen" });
    const admit = vi.spyOn(services.guard, "admit");
    await expectGatewayError(paid(ctx, "api-governance"), "forbidden");
    expect(admit).not.toHaveBeenCalled();
  });

  it("passes a per-account variant seed to the rules", async () => {
    const a = await createAccount();
    const b = await createAccount();
    const seeds: string[] = [];
    for (const account of [a, a, b]) {
      const { ctx } = makeContext(account);
      ctx.rules = {
        run: async (req) => {
          seeds.push(req.variantSeed);
          return {
            findings: [],
            scores: [],
            rulePackVersion: "t",
            telemetry: { triggered: [] },
          };
        },
      };
      await paid(ctx, "api-governance");
    }
    expect(seeds[0]).toBe(seeds[1]);
    expect(seeds[0]).not.toBe(seeds[2]);
  });
});
