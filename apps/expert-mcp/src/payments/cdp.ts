// Coinbase CDP facilitator authentication, ported from @coinbase/x402 2.1.0
// and @coinbase/cdp-sdk 1.60.0 (`generateJwt`) to WebCrypto, so the Worker
// doesn't pull in the Node SDK.
//
// Every request carries `Authorization: Bearer <JWT>`, signed with the CDP API
// key secret, valid 120 s, for exactly one `METHOD host/path`:
//   header  { alg: "EdDSA" | "ES256", kid: <key id>, typ: "JWT", nonce: <16 random bytes hex> }
//   claims  { sub: <key id>, iss: "cdp", uris: ["POST api.cdp.coinbase.com/platform/v2/x402/verify"],
//             iat, nbf, exp }
// The secret is either a base64 Ed25519 key (64 bytes: seed ‖ public key) or a
// PKCS#8 PEM EC (P-256) key. SEC1 ("BEGIN EC PRIVATE KEY") isn't supported.

import { toHex } from "../crypto";
import { base64Decode, base64UrlEncode } from "./encoding";

function binary(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
  return bytes;
}

async function importSecret(
  secret: string,
): Promise<{ key: CryptoKey; alg: "EdDSA" | "ES256" }> {
  const pem =
    /-----BEGIN PRIVATE KEY-----([\s\S]+?)-----END PRIVATE KEY-----/.exec(
      secret,
    );
  if (pem) {
    const der = binary(atob(pem[1]!.replace(/\s+/g, "")));
    const key = await crypto.subtle.importKey(
      "pkcs8",
      der,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    );
    return { key, alg: "ES256" };
  }
  let raw: Uint8Array;
  try {
    raw = binary(atob(secret.trim()));
  } catch {
    throw new Error("CDP key secret is neither base64 Ed25519 nor PKCS#8 PEM");
  }
  if (raw.length !== 64)
    throw new Error("CDP Ed25519 key secret must be 64 bytes");
  const key = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "OKP",
      crv: "Ed25519",
      d: base64UrlEncode(raw.slice(0, 32)),
      x: base64UrlEncode(raw.slice(32)),
    },
    { name: "Ed25519" },
    false,
    ["sign"],
  );
  return { key, alg: "EdDSA" };
}

/** A CDP bearer JWT for one request. */
export async function cdpJwt(options: {
  keyId: string;
  keySecret: string;
  method: string;
  url: string;
  now?: number;
}): Promise<string> {
  const { key, alg } = await importSecret(options.keySecret);
  const url = new URL(options.url);
  const now = Math.floor((options.now ?? Date.now()) / 1000);
  const header = {
    alg,
    kid: options.keyId,
    typ: "JWT",
    nonce: toHex(crypto.getRandomValues(new Uint8Array(16))),
  };
  const claims = {
    sub: options.keyId,
    iss: "cdp",
    uris: [`${options.method} ${url.host}${url.pathname}`],
    iat: now,
    nbf: now,
    exp: now + 120,
  };
  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claims))}`;
  const signature = await crypto.subtle.sign(
    alg === "EdDSA" ? { name: "Ed25519" } : { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/** Decodes a JWT's header and claims without verifying it (tests and debugging). */
export function decodeJwt(token: string): {
  header: Record<string, unknown>;
  claims: Record<string, unknown>;
} {
  const [h, c] = token.split(".");
  return {
    header: JSON.parse(base64Decode(h!)),
    claims: JSON.parse(base64Decode(c!)),
  };
}
