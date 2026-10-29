// Stripe calls for the MPP `stripe` method, `charge` intent
// (tempoxyz/payment-auth-spec, draft-stripe-charge-00; mppx 0.16.0
// `stripe/server/Charge.js`): a PaymentIntent created with the buyer's Shared
// Payment Token, confirmed at once. The method has no deferred capture, so a
// check that fails on our side is refunded (spec 03 "MPP").
//
// Plain fetch with form encoding, like mppx's `secretKey` path. Never logs
// request or response bodies: they carry payment method details.

import { hmacSha256Hex, timingSafeEqual } from "../crypto";

/** Required for `shared_payment_granted_token` (SPTs are in preview); from mppx 0.16.0. */
export const STRIPE_PREVIEW_VERSION = "2026-07-29.preview";

const API = "https://api.stripe.com/v1";

export class StripeError extends Error {
  override name = "StripeError";
  constructor(
    message: string,
    readonly status: number,
    readonly stripeCode?: string,
  ) {
    super(message);
  }
}

export interface PaymentIntent {
  id: string;
  status: string;
  amount: number;
  currency: string;
  customer?: string | null;
  latest_charge?:
    | string
    | {
        id: string;
        payment_method_details?: {
          type?: string;
          card?: { fingerprint?: string | null } | null;
        } | null;
      }
    | null;
}

function form(fields: Record<string, string | undefined>): URLSearchParams {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields))
    if (value !== undefined) body.set(key, value);
  return body;
}

export class StripeClient {
  constructor(
    private readonly secretKey: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  private async request<T>(
    method: "POST" | "GET",
    path: string,
    body: URLSearchParams | null,
    idempotencyKey?: string,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Basic ${btoa(`${this.secretKey}:`)}`,
      "Stripe-Version": STRIPE_PREVIEW_VERSION,
    };
    if (body) headers["Content-Type"] = "application/x-www-form-urlencoded";
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    const response = await this.fetchFn(`${API}${path}`, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(20_000),
    });
    const json = (await response.json().catch(() => ({}))) as {
      error?: { message?: string; code?: string };
    };
    if (!response.ok)
      throw new StripeError(
        json.error?.message ?? `Stripe answered ${response.status}`,
        response.status,
        json.error?.code,
      );
    return json as T;
  }

  /** One Stripe customer per account, created on the first MPP payment. */
  createCustomer(accountId: string): Promise<{ id: string }> {
    return this.request(
      "POST",
      "/customers",
      form({ "metadata[account_id]": accountId }),
      `customer_${accountId}`,
    );
  }

  /** Creates and confirms a PaymentIntent with a Shared Payment Token. */
  chargeWithSpt(options: {
    amount: number;
    currency: string;
    spt: string;
    customer: string | null;
    challengeId: string;
    paymentId: string;
    accountId: string;
    kind: string;
  }): Promise<PaymentIntent> {
    return this.request(
      "POST",
      "/payment_intents",
      form({
        amount: String(options.amount),
        currency: options.currency,
        confirm: "true",
        "automatic_payment_methods[enabled]": "true",
        "automatic_payment_methods[allow_redirects]": "never",
        shared_payment_granted_token: options.spt,
        customer: options.customer ?? undefined,
        "metadata[machine_payment]": "true",
        "metadata[challenge_id]": options.challengeId,
        "metadata[payment_id]": options.paymentId,
        "metadata[account_id]": options.accountId,
        "metadata[check_kind]": options.kind,
        "expand[]": "latest_charge",
      }),
      // As the Stripe charge spec recommends: derived from challenge and SPT.
      `mpp_${options.challengeId}_${options.spt}`,
    );
  }

  refund(paymentIntentId: string, paymentId: string, reason: string) {
    return this.request<{ id: string; status: string }>(
      "POST",
      "/refunds",
      form({
        payment_intent: paymentIntentId,
        "metadata[payment_id]": paymentId,
        "metadata[reason]": reason.slice(0, 100),
      }),
      `refund_${paymentId}`,
    );
  }
}

/** The card fingerprint of a confirmed PaymentIntent, when it was paid by card. */
export function cardFingerprint(pi: PaymentIntent): string | null {
  const charge = pi.latest_charge;
  if (!charge || typeof charge === "string") return null;
  return charge.payment_method_details?.card?.fingerprint ?? null;
}

/**
 * Verifies a `Stripe-Signature` header: `t=<unix>,v1=<hex HMAC-SHA256 of
 * "<t>.<raw body>">`, within `toleranceSeconds` of now.
 */
export async function verifyStripeSignature(
  header: string | null,
  rawBody: string,
  secret: string,
  now = Date.now(),
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!header) return false;
  let timestamp: string | undefined;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key?.trim() === "t") timestamp = value?.trim();
    else if (key?.trim() === "v1" && value) signatures.push(value.trim());
  }
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0)
    return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > toleranceSeconds) return false;
  const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  return signatures.some((s) => timingSafeEqual(s, expected));
}
