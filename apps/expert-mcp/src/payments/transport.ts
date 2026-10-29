// Where payments travel, per transport (spec 03; checked against the official
// sources listed in the spec 03 PR):
//
// HTTP (REST /v1/checks/*)
//   402      PAYMENT-REQUIRED: base64(x402 PaymentRequired)          x402 transports-v2/http.md
//            WWW-Authenticate: Payment id=…, header="Payment-Authorization", …   MPP core draft
//   retry    PAYMENT-SIGNATURE: base64(x402 PaymentPayload)    or
//            Payment-Authorization: Payment base64url(credential)   (Authorization holds the bearer token)
//   200      PAYMENT-RESPONSE: base64(SettlementResponse)  or  Payment-Receipt: base64url(receipt)
//
// MCP (tools/call)
//   402      tool result, isError: true, structuredContent = x402 PaymentRequired   x402 transports-v2/mcp.md
//            plus _meta["org.paymentauth/payment-required"] = { httpStatus: 402, challenges: [MPP] }
//   retry    params._meta["x402/payment"] or params._meta["org.paymentauth/credential"]
//   result   _meta["x402/payment-response"] or _meta["org.paymentauth/receipt"]

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { GatewayError, type PaymentRequired } from "../errors";
import type {
  MppChallenge,
  PaymentChallenge,
  PaymentProof,
  PaymentReceipt,
} from "../types";
import {
  base64Decode,
  base64Encode,
  base64UrlEncode,
  canonicalJson,
} from "./encoding";

export const X402_HEADERS = {
  required: "PAYMENT-REQUIRED",
  signature: "PAYMENT-SIGNATURE",
  response: "PAYMENT-RESPONSE",
} as const;

export const MPP_HEADERS = {
  challenge: "WWW-Authenticate",
  credential: "Payment-Authorization",
  receipt: "Payment-Receipt",
} as const;

export const MCP_META = {
  x402Payment: "x402/payment",
  x402Response: "x402/payment-response",
  mppCredential: "org.paymentauth/credential",
  mppPaymentRequired: "org.paymentauth/payment-required",
  mppReceipt: "org.paymentauth/receipt",
} as const;

/** Largest payment header accepted (MPP caps credentials at 64 KiB too). */
const MAX_PAYMENT_HEADER = 64 * 1024;

/**
 * Decodes a payment header. A malformed one decodes to `null`, which the gate
 * rejects as `payment_invalid`, so the caller still gets a fresh challenge.
 */
function decodeJsonHeader(value: string): unknown {
  if (value.length > MAX_PAYMENT_HEADER) return null;
  try {
    return JSON.parse(base64Decode(value));
  } catch {
    return null;
  }
}

/** The payment attached to an HTTP request, if any. */
export function proofFromHeaders(headers: Headers): PaymentProof | null {
  const x402 = headers.get(X402_HEADERS.signature);
  const mpp = headers.get(MPP_HEADERS.credential);
  if (x402 && mpp)
    throw new GatewayError(
      "invalid_request",
      "Send either an x402 payment or an MPP credential, not both.",
    );
  if (x402) return { rail: "x402", payload: decodeJsonHeader(x402) };
  if (mpp) {
    const match = /^Payment\s+([A-Za-z0-9_-]+={0,2})\s*$/i.exec(mpp);
    return {
      rail: "mpp",
      credential: match ? decodeJsonHeader(match[1]!) : null,
    };
  }
  return null;
}

/** The payment attached to an MCP tool call (`params._meta`), if any. */
export function proofFromMcpMeta(
  meta: Record<string, unknown> | undefined,
): PaymentProof | null {
  const x402 = meta?.[MCP_META.x402Payment];
  const mpp = meta?.[MCP_META.mppCredential];
  if (x402 !== undefined && mpp !== undefined)
    throw new GatewayError(
      "invalid_request",
      "Send either an x402 payment or an MPP credential, not both.",
    );
  if (x402 !== undefined) return { rail: "x402", payload: x402 };
  if (mpp !== undefined) return { rail: "mpp", credential: mpp };
  return null;
}

function authParam(name: string, value: string): string {
  if (/[\r\n]/.test(value)) throw new Error("invalid auth-param value");
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(
      /[Ā-￿]/g,
      (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
    );
  return `${name}="${escaped}"`;
}

/** base64url(JCS(request)), the `request` auth-param and HMAC input. */
export function encodeMppRequest(request: Record<string, unknown>): string {
  return base64UrlEncode(canonicalJson(request));
}

/** One `Payment …` challenge for `WWW-Authenticate` (MPP core draft §Challenge). */
export function serializeMppChallenge(challenge: MppChallenge): string {
  const parts = [
    authParam("id", challenge.id),
    authParam("realm", challenge.realm),
    authParam("method", challenge.method),
    authParam("intent", challenge.intent),
    authParam("request", encodeMppRequest(challenge.request)),
  ];
  if (challenge.description !== undefined)
    parts.push(authParam("description", challenge.description));
  if (challenge.expires !== undefined)
    parts.push(authParam("expires", challenge.expires));
  if (challenge.header !== undefined)
    parts.push(authParam("header", challenge.header));
  if (challenge.opaque !== undefined)
    parts.push(authParam("opaque", challenge.opaque));
  return `Payment ${parts.join(", ")}`;
}

/** Headers of a 402 response. */
export function challengeHeaders(challenge: PaymentChallenge): Headers {
  const headers = new Headers({ "Cache-Control": "no-store" });
  headers.set(
    X402_HEADERS.required,
    base64Encode(JSON.stringify(challenge.x402)),
  );
  for (const mpp of challenge.mpp)
    headers.append(MPP_HEADERS.challenge, serializeMppChallenge(mpp));
  return headers;
}

/** The JSON body of a 402 response: problem details plus both challenges, for clients that read bodies. */
export function challengeBody(error: PaymentRequired, requestId: string) {
  return {
    type: `https://paymentauth.org/problems/${problemType(error.code)}`,
    title: "Payment Required",
    status: 402,
    detail: error.message,
    error: error.toJSON(),
    request_id: requestId,
    price: error.challenge.price,
    x402: error.challenge.x402,
    mpp: { challenges: error.challenge.mpp },
  };
}

function problemType(code: string): string {
  switch (code) {
    case "payment_reused":
      return "invalid-challenge";
    case "payment_expired":
      return "payment-expired";
    case "wrong_amount":
      return "payment-insufficient";
    case "payment_invalid":
      return "verification-failed";
    default:
      return "payment-required";
  }
}

/** Headers of a paid 200 response. */
export function receiptHeaders(
  receipt: PaymentReceipt,
): Record<string, string> {
  if (receipt.x402)
    return {
      [X402_HEADERS.response]: base64Encode(JSON.stringify(receipt.x402)),
    };
  if (receipt.mpp)
    return {
      [MPP_HEADERS.receipt]: base64UrlEncode(JSON.stringify(receipt.mpp)),
    };
  return {};
}

/** A 402 as an MCP tool result (x402 MCP transport, plus the MPP challenges in `_meta`). */
export function paymentRequiredToolResult(
  error: PaymentRequired,
): CallToolResult {
  const x402 = {
    ...error.challenge.x402,
    error: `${error.code}: ${error.message}`,
  };
  return {
    isError: true,
    structuredContent: x402 as unknown as Record<string, unknown>,
    content: [{ type: "text", text: JSON.stringify(x402) }],
    _meta: {
      [MCP_META.mppPaymentRequired]: {
        httpStatus: 402,
        challenges: error.challenge.mpp,
        problem: {
          type: `https://paymentauth.org/problems/${problemType(error.code)}`,
          title: "Payment Required",
          status: 402,
          detail: error.message,
        },
      },
    },
  };
}

/** `_meta` of a paid tool result. */
export function receiptMeta(receipt: PaymentReceipt): Record<string, unknown> {
  if (receipt.x402) return { [MCP_META.x402Response]: receipt.x402 };
  if (receipt.mpp) return { [MCP_META.mppReceipt]: receipt.mpp };
  return {};
}
