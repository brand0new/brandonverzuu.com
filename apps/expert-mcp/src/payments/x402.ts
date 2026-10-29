// x402 v2 payment requirements and local checks (x402-specification-v2.md,
// schemes/exact/scheme_exact_evm.md, EIP-3009 `transferWithAuthorization`).
//
// The requirements carry a signed quote in `extra.quote`: the EUR total it was
// computed from, the quote's expiry (5 minutes) and an HMAC that ties it to one
// account, resource, network, asset, amount and recipient. Clients echo
// `accepted` unchanged, so the gateway can check the payment against what it
// offered without storing the offer.

import { hmacSha256Hex, randomToken, timingSafeEqual } from "../crypto";
import type { Price, X402Requirements } from "../types";
import {
  eurCentsToAtomic,
  eurCentsToUsdAtomic,
  isAddress,
  sameAddress,
  type X402Asset,
  type X402Network,
} from "./networks";

export const X402_QUOTE_TTL_SECONDS = 5 * 60;
/** An authorisation must stay valid this long after verify, to leave time to run and settle. */
export const MIN_AUTHORIZATION_HEADROOM_SECONDS = 30;

interface Quote {
  id: string;
  expires: number;
  eur: number;
  sig: string;
}

function quoteInput(
  q: Omit<Quote, "sig">,
  ctx: {
    accountId: string;
    resource: string;
    network: string;
    asset: string;
    amount: string;
    payTo: string;
  },
) {
  return [
    "x402",
    ctx.accountId,
    ctx.resource,
    ctx.network,
    ctx.asset.toLowerCase(),
    ctx.amount,
    ctx.payTo.toLowerCase(),
    q.eur,
    q.id,
    q.expires,
  ].join("|");
}

/** One `accepts` entry per asset: EURC first (preferred), then USDC when a rate is known. */
export async function buildRequirements(options: {
  key: string;
  network: X402Network;
  payTo: string;
  price: Price;
  accountId: string;
  resource: string;
  usdPerEur: number | null;
  now?: number;
}): Promise<X402Requirements[]> {
  const expires =
    Math.floor((options.now ?? Date.now()) / 1000) + X402_QUOTE_TTL_SECONDS;
  const id = randomToken(12);
  const accepts: X402Requirements[] = [];
  for (const asset of options.network.assets) {
    let amount: bigint;
    if (asset.pegged === "EUR")
      amount = eurCentsToAtomic(options.price.total, asset.decimals);
    else if (options.usdPerEur !== null)
      amount = eurCentsToUsdAtomic(
        options.price.total,
        options.usdPerEur,
        asset.decimals,
      );
    else continue;
    const base = { id, expires, eur: options.price.total };
    const sig = await hmacSha256Hex(
      options.key,
      quoteInput(base, {
        accountId: options.accountId,
        resource: options.resource,
        network: options.network.caip2,
        asset: asset.address,
        amount: amount.toString(),
        payTo: options.payTo,
      }),
    );
    accepts.push({
      scheme: "exact",
      network: options.network.caip2,
      amount: amount.toString(),
      asset: asset.address,
      payTo: options.payTo,
      maxTimeoutSeconds: X402_QUOTE_TTL_SECONDS,
      extra: {
        name: asset.name,
        version: asset.version,
        quote: {
          ...base,
          ...(asset.pegged === "USD" ? { usdPerEur: options.usdPerEur } : {}),
          sig,
        },
      },
    });
  }
  return accepts;
}

export type X402Check =
  | {
      ok: true;
      requirements: X402Requirements;
      asset: X402Asset;
      from: string;
      nonce: string;
      value: string;
    }
  | {
      ok: false;
      code: "payment_invalid" | "payment_expired" | "wrong_amount";
      reason: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const DECIMAL = /^\d{1,78}$/;

/**
 * Checks an x402 PaymentPayload locally, before the facilitator sees it: our
 * quote, unexpired, for this account and resource and price, paying our
 * address the quoted amount. The signature itself is the facilitator's job.
 */
export async function checkX402Payload(options: {
  key: string;
  network: X402Network;
  payTo: string;
  payload: unknown;
  accountId: string;
  resource: string;
  price: Price;
  now?: number;
}): Promise<X402Check> {
  const fail = (
    code: Extract<X402Check, { ok: false }>["code"],
    reason: string,
  ): X402Check => ({
    ok: false,
    code,
    reason,
  });
  const now = Math.floor((options.now ?? Date.now()) / 1000);
  const p = options.payload;
  if (
    !isRecord(p) ||
    p.x402Version !== 2 ||
    !isRecord(p.accepted) ||
    !isRecord(p.payload)
  )
    return fail(
      "payment_invalid",
      "Malformed x402 payment payload (x402Version 2 expected).",
    );
  const accepted = p.accepted;
  const auth = p.payload.authorization;
  if (typeof p.payload.signature !== "string" || !isRecord(auth))
    return fail(
      "payment_invalid",
      "Only EIP-3009 authorisations are accepted.",
    );
  const extra = isRecord(accepted.extra) ? accepted.extra : {};
  if (
    extra.assetTransferMethod !== undefined &&
    extra.assetTransferMethod !== "eip3009"
  )
    return fail(
      "payment_invalid",
      "Only the eip3009 transfer method is accepted.",
    );
  const asset = options.network.assets.find(
    (a) =>
      typeof accepted.asset === "string" &&
      sameAddress(a.address, accepted.asset),
  );
  if (
    accepted.scheme !== "exact" ||
    accepted.network !== options.network.caip2 ||
    !asset ||
    typeof accepted.payTo !== "string" ||
    !sameAddress(accepted.payTo, options.payTo) ||
    typeof accepted.amount !== "string" ||
    !DECIMAL.test(accepted.amount)
  )
    return fail(
      "payment_invalid",
      "The payment doesn't match any requirement this server offered.",
    );
  const quote = extra.quote;
  if (
    !isRecord(quote) ||
    typeof quote.id !== "string" ||
    typeof quote.expires !== "number" ||
    typeof quote.eur !== "number" ||
    typeof quote.sig !== "string"
  )
    return fail(
      "payment_invalid",
      "The payment carries no quote from this server.",
    );
  const expectedSig = await hmacSha256Hex(
    options.key,
    quoteInput(
      { id: quote.id, expires: quote.expires, eur: quote.eur },
      {
        accountId: options.accountId,
        resource: options.resource,
        network: options.network.caip2,
        asset: asset.address,
        amount: accepted.amount,
        payTo: options.payTo,
      },
    ),
  );
  if (!timingSafeEqual(quote.sig, expectedSig))
    return fail(
      "payment_invalid",
      "This quote wasn't issued for this account and check.",
    );
  if (quote.expires < now)
    return fail("payment_expired", "The quote has expired.");
  if (quote.eur !== options.price.total)
    return fail("wrong_amount", "The quote doesn't match this check's price.");
  const { from, to, value, validAfter, validBefore, nonce } = auth;
  if (
    !isAddress(from) ||
    !isAddress(to) ||
    typeof value !== "string" ||
    !DECIMAL.test(value) ||
    typeof validAfter !== "string" ||
    !DECIMAL.test(validAfter) ||
    typeof validBefore !== "string" ||
    !DECIMAL.test(validBefore) ||
    typeof nonce !== "string" ||
    !/^0x[0-9a-fA-F]{64}$/.test(nonce)
  )
    return fail("payment_invalid", "Malformed EIP-3009 authorisation.");
  if (!sameAddress(to, options.payTo))
    return fail("payment_invalid", "The authorisation pays another address.");
  if (value !== accepted.amount)
    return fail(
      "wrong_amount",
      "The authorised amount doesn't match the quote.",
    );
  if (Number(validAfter) > now)
    return fail("payment_invalid", "The authorisation isn't valid yet.");
  if (Number(validBefore) < now + MIN_AUTHORIZATION_HEADROOM_SECONDS)
    return fail("payment_expired", "The authorisation expires too soon.");
  // What we pass to the facilitator: our offer exactly, as the client echoed it.
  const requirements: X402Requirements = {
    scheme: "exact",
    network: options.network.caip2,
    amount: accepted.amount,
    asset: asset.address,
    payTo: options.payTo,
    maxTimeoutSeconds: X402_QUOTE_TTL_SECONDS,
    extra,
  };
  return {
    ok: true,
    requirements,
    asset,
    from: from.toLowerCase(),
    nonce: nonce.toLowerCase(),
    value,
  };
}

/** Facilitator `invalidReason` → our error code (x402 v2 spec §9). */
export function invalidReasonCode(
  reason: string | undefined,
): "payment_invalid" | "payment_expired" | "wrong_amount" {
  if (!reason) return "payment_invalid";
  if (reason.endsWith("value_mismatch")) return "wrong_amount";
  if (reason.endsWith("valid_before")) return "payment_expired";
  return "payment_invalid";
}
