// The paid-check pipeline (README "Shared interfaces", spec 02 "Pipeline",
// spec 03 "The payment flow"). Every paid entry point, MCP tool or REST route,
// calls `runPaidCheck`, so no entry point can skip admission, payment, shaping
// or recording.
//
//   authenticate → validate + parse → payments.quote → guard.admit
//     → no payment? 402 with payments.challenge (nothing runs)
//     → payments.verify → rules.run → guard.shape → payments.settle → respond
//     → guard.record
//                   (on any failure after verify: payments.void)

import { parseArtifact } from "./artifact";
import { GatewayError, PaymentRequired } from "./errors";
import { log } from "./log";
import { variantSeed } from "./services";
import type {
  Authorization,
  CheckKind,
  PaymentProof,
  PaymentReceipt,
  Price,
  PublicResult,
  ToolContext,
} from "./types";

/** Payment errors the caller fixes by paying again: they come with a fresh challenge. */
const RETRYABLE_PAYMENT_ERRORS = new Set([
  "payment_invalid",
  "payment_reused",
  "payment_expired",
  "wrong_amount",
]);

export interface PaymentInput {
  /** What the payment is for: the REST URL or `mcp://tool/<name>`. */
  resource: string;
  /** The payment attached to this request, if any. */
  proof: PaymentProof | null;
}

export interface PaidCheckOutcome {
  result: PublicResult;
  price: Price;
  receipt: PaymentReceipt;
}

export async function runPaidCheck(
  ctx: ToolContext,
  kind: CheckKind,
  input: unknown,
  payment: PaymentInput,
): Promise<PaidCheckOutcome> {
  const started = Date.now();
  const { account, requestId } = ctx;

  // 1. Authenticate. The bearer token was verified before the handler ran; this
  //    is the account-level gate. A frozen account runs nothing and pays nothing.
  if (account.status === "frozen") {
    throw new GatewayError(
      "forbidden",
      "This account is frozen. Contact support.",
    );
  }

  // 2. Validate + parse, before anything is quoted. The kill switch is checked
  //    here too, so a disabled service never asks for money.
  const parsed = await parseArtifact(kind, input);
  const baseLog = {
    requestId,
    kind,
    artifactBytes: parsed.bytes,
    artifactSha256: parsed.signature,
  };
  if (!(await ctx.flags.checksEnabled())) {
    throw new GatewayError(
      "checks_disabled",
      "Checks are switched off for maintenance. Nothing was charged.",
    );
  }

  // 3. Quote: the price is known from the parsed artifact before any payment.
  const price = await ctx.payments.quote(kind, parsed.artifact, account);

  // 4. Admission.
  const admission = await ctx.guard.admit({
    accountId: account.id,
    kind,
    artifact: parsed.artifact,
  });
  if (!admission.admitted) {
    if (admission.reason === "frozen")
      throw new GatewayError(
        "forbidden",
        "This account is frozen. Contact support.",
      );
    throw new GatewayError(
      admission.reason,
      admission.reason === "rate_limited"
        ? "Too many checks. Try again later."
        : "This account's spending limit is reached for now.",
      { retryAfterSeconds: admission.retryAfterSeconds },
    );
  }

  // 5. No payment attached: 402 with every way to pay. Nothing runs.
  const challenge = () =>
    ctx.payments.challenge({ account, price, resource: payment.resource });
  if (!payment.proof) throw new PaymentRequired(await challenge());

  // 6. Verify: valid, right amount, single use, payer bound to this account.
  //    Nothing is collected yet (x402), or it is refunded on void (MPP).
  let authorization: Authorization;
  try {
    authorization = await ctx.payments.verify({
      account,
      price,
      resource: payment.resource,
      payment: payment.proof,
      checkRef: requestId,
    });
  } catch (error) {
    log("warn", "payment_rejected", {
      ...baseLog,
      errorCode: error instanceof GatewayError ? error.code : undefined,
      errorName: (error as Error)?.name,
    });
    if (
      error instanceof GatewayError &&
      RETRYABLE_PAYMENT_ERRORS.has(error.code)
    )
      throw new PaymentRequired(await challenge(), error);
    throw error;
  }

  // 7–9. Run, shape, settle. Any failure voids the payment: nothing is collected.
  let result: PublicResult;
  let triggered: string[];
  let receipt: PaymentReceipt;
  try {
    const raw = await ctx.rules.run({
      kind,
      artifact: parsed.artifact,
      options: parsed.options,
      variantSeed: await variantSeed(ctx.env, account.id),
    });
    triggered = raw.telemetry.triggered;
    result = await ctx.guard.shape({ accountId: account.id, result: raw });
    try {
      receipt = await ctx.payments.settle(authorization);
    } catch (settleError) {
      throw new GatewayError(
        "payment_failed",
        "The payment couldn't be settled, so the result is withheld. Nothing was collected.",
        { cause: settleError },
      );
    }
  } catch (error) {
    try {
      await ctx.payments.void(
        authorization,
        error instanceof GatewayError ? error.code : "check_failed",
      );
    } catch (voidError) {
      // An unsettled x402 authorisation lapses at validBefore; an MPP payment
      // left `verified` is refunded by the reconciliation sweep (spec 03).
      log("error", "void_failed", {
        ...baseLog,
        errorName: (voidError as Error)?.name,
      });
    }
    log("warn", "check_failed", {
      ...baseLog,
      durationMs: Date.now() - started,
      errorName: (error as Error)?.name,
      errorCode: error instanceof GatewayError ? error.code : undefined,
    });
    if (error instanceof GatewayError) throw error;
    throw new GatewayError(
      "check_failed",
      "The check couldn't run. Nothing was charged.",
      { cause: error },
    );
  }

  // 10. Respond (the caller does), then 11. record, after the response is on its way.
  ctx.waitUntil(
    ctx.guard
      .record({
        accountId: account.id,
        kind,
        artifactSignature: parsed.signature,
        triggered,
      })
      .catch((error: unknown) =>
        log("error", "guard_record_failed", {
          ...baseLog,
          errorName: (error as Error)?.name,
        }),
      ),
  );
  log("info", "check_completed", {
    ...baseLog,
    durationMs: Date.now() - started,
    outcome: "ok",
  });
  return { result, price, receipt };
}
