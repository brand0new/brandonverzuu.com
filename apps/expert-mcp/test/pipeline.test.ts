import { describe, expect, it, vi } from "vitest";
import { CHECK_PRICES } from "../src/config";
import { GatewayError } from "../src/errors";
import { runPaidCheck } from "../src/pipeline";
import { StubGuard, StubLedger, STUB_STARTING_CREDITS } from "../src/stubs";
import {
  createAccount,
  makeContext,
  setAccountStatus,
  VALID_INPUTS,
} from "./helpers";

async function expectGatewayError(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(GatewayError);
  expect((error as GatewayError).code).toBe(code);
}

describe("runPaidCheck", () => {
  it("charges once, strips telemetry and records after responding", async () => {
    const account = await createAccount();
    const { ctx, services, settle } = makeContext(account);
    const outcome = await runPaidCheck(
      ctx,
      "api-governance",
      VALID_INPUTS["api-governance"],
    );

    expect(outcome.creditsCharged).toBe(CHECK_PRICES["api-governance"]);
    expect(outcome.result).not.toHaveProperty("telemetry");
    expect(outcome.result.findings[0]?.message).toMatch(/^STUB FINDING/);
    expect(await services.ledger.balance(account.id)).toBe(
      STUB_STARTING_CREDITS - CHECK_PRICES["api-governance"],
    );
    expect((services.ledger as StubLedger).openReservations()).toHaveLength(0);

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

  it("refunds when the rules Worker fails", async () => {
    const account = await createAccount();
    const { ctx, services, settle } = makeContext(account);
    ctx.rules = {
      run: vi.fn(async () => Promise.reject(new Error("rules down"))),
    };
    const refund = vi.spyOn(services.ledger, "refund");

    await expectGatewayError(
      runPaidCheck(ctx, "skill-design", VALID_INPUTS["skill-design"]),
      "check_failed",
    );

    expect(refund).toHaveBeenCalledOnce();
    expect(await services.ledger.balance(account.id)).toBe(
      STUB_STARTING_CREDITS,
    );
    expect((services.ledger as StubLedger).openReservations()).toHaveLength(0);
    await settle();
    expect((services.guard as StubGuard).recorded).toHaveLength(0);
  });

  it("refunds when shaping fails", async () => {
    const account = await createAccount();
    const { ctx, services } = makeContext(account);
    vi.spyOn(services.guard, "shape").mockRejectedValue(
      new Error("shape failed"),
    );
    const refund = vi.spyOn(services.ledger, "refund");

    await expectGatewayError(
      runPaidCheck(ctx, "process-review", VALID_INPUTS["process-review"]),
      "check_failed",
    );
    expect(refund).toHaveBeenCalledOnce();
    expect(await services.ledger.balance(account.id)).toBe(
      STUB_STARTING_CREDITS,
    );
  });

  it("refunds when committing fails", async () => {
    const account = await createAccount();
    const { ctx, services } = makeContext(account);
    vi.spyOn(services.ledger, "commit").mockRejectedValue(new Error("d1 down"));
    const refund = vi.spyOn(services.ledger, "refund");

    await expectGatewayError(
      runPaidCheck(ctx, "api-governance", VALID_INPUTS["api-governance"]),
      "check_failed",
    );
    expect(refund).toHaveBeenCalledOnce();
    expect(await services.ledger.balance(account.id)).toBe(
      STUB_STARTING_CREDITS,
    );
  });

  it("surfaces the original error when the refund itself fails", async () => {
    const account = await createAccount();
    const { ctx, services } = makeContext(account);
    ctx.rules = {
      run: async () =>
        Promise.reject(new GatewayError("not_configured", "rules missing")),
    };
    vi.spyOn(services.ledger, "refund").mockRejectedValue(
      new Error("refund failed"),
    );

    await expectGatewayError(
      runPaidCheck(ctx, "api-governance", VALID_INPUTS["api-governance"]),
      "not_configured",
    );
  });

  it("doesn't run the check without enough credits", async () => {
    const account = await createAccount();
    const { ctx, services } = makeContext(account);
    const ledger = new StubLedger(0);
    ctx.ledger = ledger;
    const run = vi.spyOn(services.rules, "run");

    await expectGatewayError(
      runPaidCheck(ctx, "api-governance", VALID_INPUTS["api-governance"]),
      "insufficient_credits",
    );
    expect(run).not.toHaveBeenCalled();
    expect(ledger.openReservations()).toHaveLength(0);
  });

  it("charges nothing for an invalid artifact", async () => {
    const account = await createAccount();
    const { ctx, services } = makeContext(account);
    const reserve = vi.spyOn(services.ledger, "reserve");

    await expectGatewayError(
      runPaidCheck(ctx, "api-governance", { document: '{"swagger": "2.0"}' }),
      "invalid_artifact",
    );
    await expectGatewayError(
      runPaidCheck(ctx, "api-governance", { document: "{}", extra: true }),
      "invalid_request",
    );
    expect(reserve).not.toHaveBeenCalled();
  });

  it("charges nothing when admission is refused", async () => {
    const account = await createAccount();
    const { ctx, services } = makeContext(account);
    vi.spyOn(services.guard, "admit").mockResolvedValue({
      admitted: false,
      reason: "rate_limited",
      retryAfterSeconds: 30,
    });
    const reserve = vi.spyOn(services.ledger, "reserve");

    const error = await runPaidCheck(
      ctx,
      "api-governance",
      VALID_INPUTS["api-governance"],
    ).catch((e: unknown) => e);
    expect(error).toMatchObject({
      code: "rate_limited",
      retryAfterSeconds: 30,
    });
    expect(reserve).not.toHaveBeenCalled();
  });

  it("charges nothing when the kill switch is off", async () => {
    const account = await createAccount();
    const { ctx, services } = makeContext(account);
    ctx.flags = { checksEnabled: async () => false };
    const reserve = vi.spyOn(services.ledger, "reserve");

    await expectGatewayError(
      runPaidCheck(ctx, "api-governance", VALID_INPUTS["api-governance"]),
      "checks_disabled",
    );
    expect(reserve).not.toHaveBeenCalled();
  });

  it("runs nothing for a frozen account", async () => {
    const account = await createAccount();
    await setAccountStatus(account.id, "frozen");
    const { ctx, services } = makeContext({ ...account, status: "frozen" });
    const admit = vi.spyOn(services.guard, "admit");

    await expectGatewayError(
      runPaidCheck(ctx, "api-governance", VALID_INPUTS["api-governance"]),
      "forbidden",
    );
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
      await runPaidCheck(ctx, "api-governance", VALID_INPUTS["api-governance"]);
    }
    expect(seeds[0]).toBe(seeds[1]);
    expect(seeds[0]).not.toBe(seeds[2]);
  });
});
