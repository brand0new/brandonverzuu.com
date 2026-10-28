// Errors a handler can turn into a precise answer. Anything else is an
// internal error: the caller sees a generic message and the request id.

export type ErrorCode =
  | "invalid_request"
  | "invalid_artifact"
  | "artifact_too_large"
  | "insufficient_credits"
  | "rate_limited"
  | "spend_ceiling"
  | "forbidden"
  | "checks_disabled"
  | "check_failed"
  | "not_configured"
  | "request_not_idempotent"
  | "not_found";

const STATUS: Record<ErrorCode, number> = {
  invalid_request: 400,
  invalid_artifact: 400,
  artifact_too_large: 413,
  insufficient_credits: 402,
  rate_limited: 429,
  spend_ceiling: 429,
  forbidden: 403,
  checks_disabled: 503,
  check_failed: 502,
  not_configured: 503,
  request_not_idempotent: 422,
  not_found: 404,
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

/** Thrown by `Ledger.reserve` when the balance can't cover the check. */
export class InsufficientCredits extends GatewayError {
  readonly balance: number;
  readonly required: number;

  constructor(balance: number, required: number) {
    super(
      "insufficient_credits",
      `This check costs ${required} credits and the balance is ${balance}.`,
    );
    this.name = "InsufficientCredits";
    this.balance = balance;
    this.required = required;
  }
}
