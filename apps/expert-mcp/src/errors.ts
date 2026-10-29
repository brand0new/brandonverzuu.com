// Errors a handler can turn into a precise answer. Anything else is an
// internal error: the caller sees a generic message and the request id.

import type { PaymentChallenge } from "./types";

export type ErrorCode =
  | "invalid_request"
  | "invalid_artifact"
  | "artifact_too_large"
  | "payment_required"
  | "payment_invalid"
  | "payment_reused"
  | "payment_expired"
  | "wrong_amount"
  | "payment_failed"
  | "payer_not_bound"
  | "payer_bound_elsewhere"
  | "wallet_limit"
  | "not_implemented"
  | "rate_limited"
  | "spend_ceiling"
  | "forbidden"
  | "checks_disabled"
  | "check_failed"
  | "not_configured"
  | "request_not_idempotent"
  | "not_found"
  | "conflict";

const STATUS: Record<ErrorCode, number> = {
  invalid_request: 400,
  invalid_artifact: 400,
  artifact_too_large: 413,
  payment_required: 402,
  payment_invalid: 402,
  payment_reused: 402,
  payment_expired: 402,
  wrong_amount: 402,
  payment_failed: 402,
  payer_not_bound: 403,
  payer_bound_elsewhere: 409,
  wallet_limit: 409,
  not_implemented: 501,
  rate_limited: 429,
  spend_ceiling: 429,
  forbidden: 403,
  checks_disabled: 503,
  check_failed: 502,
  not_configured: 503,
  request_not_idempotent: 422,
  not_found: 404,
  conflict: 409,
};

export class GatewayError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly retryAfterSeconds?: number;

  constructor(
    code: ErrorCode,
    message: string,
    options: { retryAfterSeconds?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "GatewayError";
    this.code = code;
    this.status = STATUS[code];
    this.retryAfterSeconds = options.retryAfterSeconds;
  }

  toJSON(): { code: ErrorCode; message: string; retry_after_seconds?: number } {
    return {
      code: this.code,
      message: this.message,
      ...(this.retryAfterSeconds !== undefined
        ? { retry_after_seconds: this.retryAfterSeconds }
        : {}),
    };
  }
}

/**
 * No payment attached, or the attached one was refused in a way the caller can
 * fix by paying again: carries a fresh challenge (spec 03 "The payment flow").
 */
export class PaymentRequired extends GatewayError {
  readonly challenge: PaymentChallenge;

  constructor(
    challenge: PaymentChallenge,
    cause?: GatewayError,
    message = "This check is paid per artifact. Pay with x402 or MPP and retry.",
  ) {
    super(cause?.code ?? "payment_required", cause?.message ?? message, {
      cause,
    });
    this.name = "PaymentRequired";
    // A refused payment that the caller can retry is still a 402.
    (this as { status: number }).status = 402;
    this.challenge = challenge;
  }
}
