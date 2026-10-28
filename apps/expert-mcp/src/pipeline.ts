// The paid-check pipeline (README "Shared interfaces", spec 02 "Pipeline").
// Every paid entry point, MCP tool or REST route, calls `runPaidCheck`, so no
// entry point can skip admission, charging, shaping or recording.
//
//   authenticate → validate + parse → guard.admit → ledger.reserve → rules.run
//     → guard.shape → ledger.commit → respond → guard.record
//                   (on any failure after reserve: ledger.refund)

import { parseArtifact } from "./artifact";
import { CHECK_PRICES } from "./config";
import { GatewayError } from "./errors";
import { log } from "./log";
import { variantSeed } from "./services";
import type {
  CheckKind,
  PublicResult,
  Reservation,
  ToolContext,
} from "./types";

export interface PaidCheckOutcome {
  result: PublicResult;
  creditsCharged: number;
}

export async function runPaidCheck(
  ctx: ToolContext,
  kind: CheckKind,
  input: unknown,
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

  // 2. Validate + parse, before any credit moves. The kill switch is checked here
  //    too, so a disabled service never charges.
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
      "Checks are switched off for maintenance. No credits were charged.",
    );
  }

  // 3. Admission.
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

  // 4. Reserve. Throws InsufficientCredits; nothing to refund yet.
  const credits = CHECK_PRICES[kind];
  const reservation: Reservation = await ctx.ledger.reserve(
    account.id,
    credits,
    `check:${requestId}`,
  );

  // 5–7. Run, shape, commit. Any failure refunds the reservation.
  let result: PublicResult;
  let triggered: string[];
  try {
    const raw = await ctx.rules.run({
      kind,
      artifact: parsed.artifact,
      options: parsed.options,
      variantSeed: await variantSeed(ctx.env, account.id),
    });
    triggered = raw.telemetry.triggered;
    result = await ctx.guard.shape({ accountId: account.id, result: raw });
    await ctx.ledger.commit(reservation);
  } catch (error) {
    try {
      await ctx.ledger.refund(
        reservation,
        error instanceof GatewayError ? error.code : "check_failed",
      );
    } catch (refundError) {
      // The reservation expires and the sweep (spec 03) releases it.
      log("error", "refund_failed", {
        ...baseLog,
        errorName: (refundError as Error)?.name,
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
      "The check couldn't run. No credits were charged.",
      { cause: error },
    );
  }

  // 8. Respond (the caller does), then 9. record, after the response is on its way.
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
  return { result, creditsCharged: credits };
}
