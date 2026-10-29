// MPP challenges and credentials ("Payment" HTTP authentication scheme,
// tempoxyz/mpp-specs draft-httpauth-payment-01; Stripe charge intent).
//
// The challenge id is the spec's recommended stateless HMAC-SHA256 binding over
// realm|method|intent|request|expires|digest|header|opaque. `opaque` carries a
// random nonce and a tag that ties the challenge to one account and resource,
// so a challenge issued to one account can't pay for another's check.
// Single use is enforced by storing the challenge id (payments.proof_ref).

import { hmacSha256Hex, randomToken, timingSafeEqual } from "../crypto";
import type { MppChallenge, Price } from "../types";
import { base64Decode, base64UrlEncode, canonicalJson } from "./encoding";

export const MPP_CHALLENGE_TTL_SECONDS = 5 * 60;
export const MPP_CREDENTIAL_HEADER = "Payment-Authorization" as const;

function hmacBase64Url(key: string, input: string): Promise<string> {
  return crypto.subtle
    .importKey(
      "raw",
      new TextEncoder().encode(key),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    )
    .then((k) => crypto.subtle.sign("HMAC", k, new TextEncoder().encode(input)))
    .then((mac) => base64UrlEncode(new Uint8Array(mac)));
}

/** The challenge id per the core draft's HMAC-SHA256 binding. */
export function challengeId(
  key: string,
  c: Omit<MppChallenge, "id" | "description"> & { digest?: string },
): Promise<string> {
  const values = [
    c.realm,
    c.method,
    c.intent,
    base64UrlEncode(canonicalJson(c.request)),
    c.expires ?? "",
    c.digest ?? "",
  ];
  if (c.header !== undefined) values.push(c.header);
  values.push(c.opaque ?? "");
  return hmacBase64Url(key, values.join("|"));
}

async function bindingTag(
  key: string,
  accountId: string,
  resource: string,
  nonce: string,
) {
  return (
    await hmacSha256Hex(key, `mpp|${accountId}|${resource}|${nonce}`)
  ).slice(0, 32);
}

/** A Stripe charge challenge for one check. */
export async function stripeChargeChallenge(options: {
  key: string;
  realm: string;
  networkId: string;
  price: Price;
  accountId: string;
  resource: string;
  description: string;
  now?: number;
}): Promise<MppChallenge> {
  const nonce = randomToken(12);
  const opaque = base64UrlEncode(
    canonicalJson({
      n: nonce,
      t: await bindingTag(
        options.key,
        options.accountId,
        options.resource,
        nonce,
      ),
    }),
  );
  const base = {
    realm: options.realm,
    method: "stripe",
    intent: "charge",
    request: {
      amount: String(options.price.total),
      currency: "eur",
      description: options.description,
      methodDetails: {
        networkId: options.networkId,
        paymentMethodTypes: ["card"],
      },
    },
    expires: new Date(
      (options.now ?? Date.now()) + MPP_CHALLENGE_TTL_SECONDS * 1000,
    )
      .toISOString()
      .replace(/\.\d{3}Z$/, "Z"),
    header: MPP_CREDENTIAL_HEADER,
    opaque,
  };
  return {
    id: await challengeId(options.key, base),
    ...base,
    description: options.description,
  };
}

export type MppCheck =
  | {
      ok: true;
      challengeId: string;
      spt: string;
      amount: number;
      currency: string;
    }
  | {
      ok: false;
      code: "payment_invalid" | "payment_expired" | "wrong_amount";
      reason: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Checks an MPP credential against the binding, the account, the resource and
 * the price. Accepts `challenge.request` as base64url (HTTP) or as a JSON
 * object (the MCP transport).
 */
export async function checkStripeCredential(options: {
  key: string;
  realm: string;
  credential: unknown;
  accountId: string;
  resource: string;
  price: Price;
  now?: number;
}): Promise<MppCheck> {
  const fail = (
    code: Extract<MppCheck, { ok: false }>["code"],
    reason: string,
  ): MppCheck => ({
    ok: false,
    code,
    reason,
  });
  const credential = options.credential;
  if (
    !isRecord(credential) ||
    !isRecord(credential.challenge) ||
    !isRecord(credential.payload)
  )
    return fail("payment_invalid", "Malformed MPP credential.");
  const c = credential.challenge;
  let request: unknown = c.request;
  if (typeof request === "string") {
    try {
      request = JSON.parse(base64Decode(request));
    } catch {
      return fail("payment_invalid", "Malformed MPP challenge request.");
    }
  }
  if (
    typeof c.id !== "string" ||
    typeof c.realm !== "string" ||
    typeof c.method !== "string" ||
    typeof c.intent !== "string" ||
    !isRecord(request) ||
    (c.expires !== undefined && typeof c.expires !== "string") ||
    (c.header !== undefined && c.header !== MPP_CREDENTIAL_HEADER) ||
    (c.opaque !== undefined && typeof c.opaque !== "string") ||
    (c.digest !== undefined && typeof c.digest !== "string")
  )
    return fail("payment_invalid", "Malformed MPP challenge.");
  const expectedId = await challengeId(options.key, {
    realm: c.realm,
    method: c.method,
    intent: c.intent,
    request,
    expires: c.expires as string | undefined,
    digest: c.digest as string | undefined,
    header: c.header as typeof MPP_CREDENTIAL_HEADER | undefined,
    opaque: c.opaque as string | undefined,
  });
  if (!timingSafeEqual(c.id, expectedId))
    return fail(
      "payment_invalid",
      "This MPP challenge wasn't issued by this server.",
    );
  if (
    c.realm !== options.realm ||
    c.method !== "stripe" ||
    c.intent !== "charge"
  )
    return fail("payment_invalid", "Unsupported MPP method or intent.");
  // Credentials sent in Authorization would collide with the bearer token: we
  // only issue challenges that select Payment-Authorization.
  if (c.header !== MPP_CREDENTIAL_HEADER)
    return fail(
      "payment_invalid",
      "The challenge must select Payment-Authorization.",
    );
  if (!c.expires || !(Date.parse(c.expires) > (options.now ?? Date.now())))
    return fail("payment_expired", "The MPP challenge has expired.");
  let opaque: unknown;
  try {
    opaque = JSON.parse(base64Decode(c.opaque as string));
  } catch {
    return fail("payment_invalid", "Malformed MPP challenge.");
  }
  if (
    !isRecord(opaque) ||
    typeof opaque.n !== "string" ||
    typeof opaque.t !== "string"
  )
    return fail("payment_invalid", "Malformed MPP challenge.");
  const tag = await bindingTag(
    options.key,
    options.accountId,
    options.resource,
    opaque.n,
  );
  if (!timingSafeEqual(opaque.t, tag))
    return fail(
      "payment_invalid",
      "This MPP challenge is for another account or check.",
    );
  if (
    request.amount !== String(options.price.total) ||
    request.currency !== "eur"
  )
    return fail(
      "wrong_amount",
      "The MPP challenge doesn't match this check's price.",
    );
  const spt = credential.payload.spt;
  if (typeof spt !== "string" || !/^spt_[A-Za-z0-9_]+$/.test(spt))
    return fail(
      "payment_invalid",
      "The MPP credential has no Shared Payment Token.",
    );
  return {
    ok: true,
    challengeId: c.id,
    spt,
    amount: options.price.total,
    currency: "eur",
  };
}
