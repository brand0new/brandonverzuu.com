// POST /webhooks/stripe (spec 03 "Stripe (MPP) operations"): verifies the
// signature, then handles payment success, refunds and disputes. A dispute
// freezes the account pending review: a chargeback after heavy use is an
// extraction pattern (spec 05).

import { log } from "../log";
import { readBodyText } from "../rest";
import { freezeAccount, paymentByExternalRef, transition } from "./store";
import { verifyStripeSignature } from "./stripe";

const MAX_WEBHOOK_BYTES = 512 * 1024;

interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

function paymentIntentOf(object: Record<string, unknown>): string | null {
  if (typeof object.payment_intent === "string") return object.payment_intent;
  if (typeof object.id === "string" && object.object === "payment_intent")
    return object.id;
  return null;
}

function text(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function handleStripeWebhook(
  request: Request,
  env: Env,
  now = Date.now(),
): Promise<Response> {
  if (!env.STRIPE_WEBHOOK_SECRET) return text("not configured", 503);
  let raw: string;
  try {
    raw = await readBodyText(request, MAX_WEBHOOK_BYTES);
  } catch {
    return text("too large", 413);
  }
  const valid = await verifyStripeSignature(
    request.headers.get("Stripe-Signature"),
    raw,
    env.STRIPE_WEBHOOK_SECRET,
    now,
  );
  if (!valid) return text("bad signature", 400);
  let event: StripeEvent;
  try {
    event = JSON.parse(raw) as StripeEvent;
  } catch {
    return text("bad payload", 400);
  }
  const object = event?.data?.object;
  if (
    typeof event?.type !== "string" ||
    typeof object !== "object" ||
    object === null
  )
    return text("bad payload", 400);

  const piId = paymentIntentOf(object);
  const payment = piId ? await paymentByExternalRef(env, piId) : null;
  switch (event.type) {
    case "payment_intent.succeeded":
      // The charge is synchronous, so verify already recorded it. Nothing to do
      // beyond acknowledging; a payment we don't know isn't ours (or a test event).
      break;
    case "charge.refunded":
    case "refund.created":
    case "refund.updated":
      if (payment)
        await transition(
          env,
          payment.id,
          ["verified", "settled", "voided"],
          "refunded",
        );
      break;
    case "charge.dispute.created":
      if (payment) {
        await transition(
          env,
          payment.id,
          ["verified", "settled", "refunded"],
          "disputed",
        );
        await freezeAccount(env, payment.account_id);
        log("warn", "account_frozen", { outcome: "dispute" });
      }
      break;
    default:
      break;
  }
  log("info", "stripe_webhook", { outcome: event.type.slice(0, 64) });
  return text("ok", 200);
}
