// Offline fakes for the payment rails: throwaway wallets, a mocked facilitator
// and a mocked Stripe. Nothing here touches a network.

import { secp256k1 } from "@noble/curves/secp256k1.js";
import { env } from "cloudflare:workers";
import { toHex } from "../src/crypto";
import {
  addressOfPublicKey,
  personalMessageHash,
} from "../src/payments/eip191";
import { base64UrlEncode } from "../src/payments/encoding";
import { HttpFacilitator } from "../src/payments/facilitator";
import { FixedRates } from "../src/payments/fx";
import { LivePaymentGate } from "../src/payments/gate";
import { X402_NETWORKS } from "../src/payments/networks";
import { StripeClient } from "../src/payments/stripe";
import type {
  MppChallenge,
  PaymentChallenge,
  X402Requirements,
} from "../src/types";

export const PAY_TO = "0x1111111111111111111111111111111111111111";
export const FACILITATOR_URL = "https://facilitator.test/platform/v2/x402";
export const NETWORK = X402_NETWORKS["base-sepolia"];
export const GATE_KEY = "test-payment-hmac-key";

/** A throwaway wallet, generated per test. */
export function wallet() {
  const secretKey = secp256k1.utils.randomSecretKey();
  const address = addressOfPublicKey(secp256k1.getPublicKey(secretKey, false));
  return {
    address,
    secretKey,
    /** personal_sign: 65 bytes r‖s‖v, v = 27/28. */
    sign(message: string): string {
      const sig = secp256k1.sign(personalMessageHash(message), secretKey, {
        prehash: false,
        format: "recovered",
      });
      const out = new Uint8Array(65);
      out.set(sig.slice(1), 0);
      out[64] = sig[0]! + 27;
      return `0x${toHex(out)}`;
    },
  };
}

export interface FakeCall {
  url: string;
  method: string;
  headers: Headers;
  body: string;
}

/** A fetch that answers like the facilitator and Stripe, and records every call. */
export function fakeNetwork(
  options: {
    verify?: (body: any) => unknown;
    settle?: (body: any) => unknown;
    paymentIntent?: (form: URLSearchParams) => {
      status: number;
      body: unknown;
    };
    fingerprint?: string | null;
  } = {},
) {
  const calls: FakeCall[] = [];
  let pi = 0;
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const body = await request.text();
    calls.push({
      url: request.url,
      method: request.method,
      headers: request.headers,
      body,
    });
    const url = new URL(request.url);
    const json = (data: unknown, status = 200) =>
      Response.json(data, { status });
    if (url.host === "facilitator.test") {
      const parsed = JSON.parse(body);
      const payer = parsed.paymentPayload?.payload?.authorization?.from;
      if (url.pathname.endsWith("/verify"))
        return json(options.verify?.(parsed) ?? { isValid: true, payer });
      if (url.pathname.endsWith("/settle"))
        return json(
          options.settle?.(parsed) ?? {
            success: true,
            transaction: `0x${toHex(crypto.getRandomValues(new Uint8Array(32)))}`,
            network: NETWORK.caip2,
            payer,
          },
        );
    }
    if (url.host === "api.stripe.com") {
      const form = new URLSearchParams(body);
      if (url.pathname === "/v1/customers") return json({ id: "cus_test_1" });
      if (url.pathname === "/v1/payment_intents") {
        if (options.paymentIntent) {
          const r = options.paymentIntent(form);
          return json(r.body, r.status);
        }
        const fingerprint =
          options.fingerprint === undefined
            ? "fp_test_card"
            : options.fingerprint;
        return json({
          id: `pi_test_${++pi}_${crypto.randomUUID().slice(0, 8)}`,
          status: "succeeded",
          amount: Number(form.get("amount")),
          currency: form.get("currency"),
          customer: form.get("customer"),
          latest_charge: {
            id: `ch_test_${pi}`,
            payment_method_details: { type: "card", card: { fingerprint } },
          },
        });
      }
      if (url.pathname === "/v1/refunds")
        return json({ id: `re_test_${calls.length}`, status: "succeeded" });
    }
    return json(
      { error: { message: `unexpected ${request.method} ${url}` } },
      599,
    );
  }) as typeof fetch;
  const count = (fragment: string) =>
    calls.filter((c) => c.url.includes(fragment)).length;
  return { fetch: fetchFn, calls, count };
}

/** A throwaway Ed25519 CDP key: base64(seed ‖ public key), and its public key for checking JWTs. */
export async function cdpKey() {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey(
    "jwk",
    pair.privateKey,
  )) as JsonWebKey;
  const decode = (v: string) =>
    Uint8Array.from(
      atob(
        v
          .replace(/-/g, "+")
          .replace(/_/g, "/")
          .padEnd(Math.ceil(v.length / 4) * 4, "="),
      ),
      (c) => c.charCodeAt(0),
    );
  const raw = new Uint8Array(64);
  raw.set(decode(jwk.d!), 0);
  raw.set(decode(jwk.x!), 32);
  return {
    keyId: "test-key-id",
    keySecret: btoa(String.fromCharCode(...raw)),
    publicKey: pair.publicKey,
  };
}

export function liveGate(
  net: ReturnType<typeof fakeNetwork>,
  options: {
    auth?: { keyId: string; keySecret: string };
    rails?: "both" | "x402" | "mpp";
    now?: () => number;
  } = {},
) {
  const rails = options.rails ?? "both";
  return new LivePaymentGate(env, {
    hmacKey: GATE_KEY,
    origin: env.PUBLIC_ORIGIN,
    x402:
      rails === "mpp"
        ? null
        : {
            network: NETWORK,
            payTo: PAY_TO,
            facilitator: new HttpFacilitator(
              FACILITATOR_URL,
              options.auth ?? null,
              net.fetch,
            ),
          },
    mpp:
      rails === "x402"
        ? null
        : {
            networkId: "profile_test",
            stripe: new StripeClient("sk_test_placeholder", net.fetch),
          },
    fx: new FixedRates(1.08),
    now: options.now,
  });
}

/** An EIP-3009 payment for one `accepts` entry, from `from`. The signature is a placeholder: the fake facilitator checks it. */
export function x402Payment(
  requirements: X402Requirements,
  from: string,
  overrides: {
    value?: string;
    nonce?: string;
    validBefore?: number;
    amount?: string;
  } = {},
) {
  const now = Math.floor(Date.now() / 1000);
  return {
    x402Version: 2,
    resource: { url: "ignored" },
    accepted: {
      ...requirements,
      ...(overrides.amount ? { amount: overrides.amount } : {}),
    },
    payload: {
      signature: `0x${"11".repeat(65)}`,
      authorization: {
        from,
        to: requirements.payTo,
        value: overrides.value ?? requirements.amount,
        validAfter: String(now - 60),
        validBefore: String(overrides.validBefore ?? now + 300),
        nonce:
          overrides.nonce ??
          `0x${toHex(crypto.getRandomValues(new Uint8Array(32)))}`,
      },
    },
  };
}

/** An MPP credential for a Stripe charge challenge, as a client would build it. */
export function mppCredential(
  challenge: MppChallenge,
  spt = `spt_test_${crypto.randomUUID().replace(/-/g, "")}`,
) {
  const { description: _d, ...echoed } = challenge;
  return {
    challenge: {
      ...echoed,
      request: base64UrlEncode(JSON.stringify(challenge.request)),
    },
    payload: { spt },
  };
}

export function eurc(challenge: PaymentChallenge): X402Requirements {
  return challenge.x402.accepts.find(
    (a) => a.asset === NETWORK.assets[0]!.address,
  )!;
}
