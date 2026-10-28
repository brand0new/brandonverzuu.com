// Encodings the two payment protocols use on the wire.

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBinary(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return binary;
}

/** Standard base64 of UTF-8 text (x402 headers). */
export function base64Encode(text: string): string {
  return btoa(bytesToBinary(encoder.encode(text)));
}

/** base64url without padding of UTF-8 text (MPP, RFC 4648 §5). */
export function base64UrlEncode(text: string | Uint8Array): string {
  const bytes = typeof text === "string" ? encoder.encode(text) : text;
  return btoa(bytesToBinary(bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Decodes standard or URL-safe base64, with or without padding. Throws on bad input. */
export function base64Decode(value: string): string {
  const normalised = value.trim().replace(/-/g, "+").replace(/_/g, "/");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalised)) throw new Error("not base64");
  const padded = normalised.padEnd(
    normalised.length + ((4 - (normalised.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return decoder.decode(bytes);
}

/**
 * JSON Canonicalization Scheme (RFC 8785) for the values MPP requests carry:
 * objects with sorted keys, arrays, strings, finite numbers, booleans and null.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("non-finite number");
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  throw new Error(`unsupported JSON value: ${typeof value}`);
}
