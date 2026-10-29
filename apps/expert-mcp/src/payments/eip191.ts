// Wallet binding (spec 03 "Binding payers to accounts"): the account asks for a
// message, the wallet signs it with `personal_sign` (EIP-191 version 0x45), and
// POST /v1/wallets checks that the signature recovers to the wallet.
//
// The message is stateless: its nonce carries an HMAC over the wallet, the
// account and the expiry, so the gateway needn't store pending challenges.
// Replaying a signed message only re-binds the same wallet to the same account.
// Smart-contract wallets (EIP-1271) aren't supported: only EOA signatures.

import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { hmacSha256Hex, randomToken, timingSafeEqual, toHex } from "../crypto";
import { isAddress } from "./networks";

const encoder = new TextEncoder();

export const BIND_MESSAGE_TTL_SECONDS = 15 * 60;

/** keccak256("\x19Ethereum Signed Message:\n" + len + message) */
export function personalMessageHash(message: string): Uint8Array {
  const body = encoder.encode(message);
  const prefix = encoder.encode(
    `\x19Ethereum Signed Message:\n${body.byteLength}`,
  );
  const bytes = new Uint8Array(prefix.byteLength + body.byteLength);
  bytes.set(prefix);
  bytes.set(body, prefix.byteLength);
  return keccak_256(bytes);
}

/** The address of an uncompressed or compressed secp256k1 public key. */
export function addressOfPublicKey(publicKey: Uint8Array): string {
  const uncompressed = secp256k1.Point.fromBytes(publicKey).toBytes(false);
  return `0x${toHex(keccak_256(uncompressed.slice(1)).slice(12))}`;
}

function hexToBytes(hex: string): Uint8Array | null {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!/^[0-9a-fA-F]*$/.test(clean) || clean.length % 2) return null;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++)
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/**
 * Recovers the signer of a `personal_sign` signature (65 bytes r‖s‖v, v 27/28
 * or 0/1), lowercase. Null when the signature doesn't parse or recover.
 */
export function recoverPersonalSigner(
  message: string,
  signature: string,
): string | null {
  const sig = hexToBytes(signature);
  if (!sig || sig.length !== 65) return null;
  const v = sig[64]!;
  const recovery = v >= 27 ? v - 27 : v;
  if (recovery !== 0 && recovery !== 1) return null;
  // noble's "recovered" format puts the recovery byte first.
  const recovered = new Uint8Array(65);
  recovered[0] = recovery;
  recovered.set(sig.slice(0, 64), 1);
  try {
    const publicKey = secp256k1.recoverPublicKey(
      recovered,
      personalMessageHash(message),
      { prehash: false },
    );
    return addressOfPublicKey(publicKey);
  } catch {
    return null;
  }
}

interface BindFields {
  wallet: string;
  accountId: string;
  issued: string;
  expires: string;
  nonce: string;
}

async function bindTag(
  key: string,
  f: Omit<BindFields, "nonce"> & { random: string },
) {
  return (
    await hmacSha256Hex(
      key,
      `bind|${f.wallet.toLowerCase()}|${f.accountId}|${f.issued}|${f.expires}|${f.random}`,
    )
  ).slice(0, 32);
}

function render(origin: string, f: BindFields): string {
  return [
    `${new URL(origin).host} wants you to bind this wallet to your account, so it can pay for expertise checks.`,
    "",
    `Wallet: ${f.wallet}`,
    `Account: ${f.accountId}`,
    `Issued: ${f.issued}`,
    `Expires: ${f.expires}`,
    `Nonce: ${f.nonce}`,
  ].join("\n");
}

/** The message a wallet signs to be bound to `accountId`. */
export async function bindMessage(
  key: string,
  origin: string,
  wallet: string,
  accountId: string,
  now = Date.now(),
): Promise<{ message: string; expiresAt: string }> {
  const issued = new Date(now).toISOString();
  const expires = new Date(now + BIND_MESSAGE_TTL_SECONDS * 1000).toISOString();
  const random = randomToken(12);
  const tag = await bindTag(key, {
    wallet,
    accountId,
    issued,
    expires,
    random,
  });
  return {
    message: render(origin, {
      wallet,
      accountId,
      issued,
      expires,
      nonce: `${random}.${tag}`,
    }),
    expiresAt: expires,
  };
}

export type BindCheck =
  | { ok: true; wallet: string }
  | {
      ok: false;
      reason: "malformed" | "expired" | "wrong_account" | "bad_signature";
    };

/** Checks a signed binding message: issued by us, for this account, unexpired, signed by the wallet. */
export async function checkBinding(
  key: string,
  origin: string,
  accountId: string,
  message: string,
  signature: string,
  now = Date.now(),
): Promise<BindCheck> {
  const field = (name: string) =>
    new RegExp(`^${name}: (.+)$`, "m").exec(message)?.[1];
  const wallet = field("Wallet");
  const account = field("Account");
  const issued = field("Issued");
  const expires = field("Expires");
  const nonce = field("Nonce");
  if (!isAddress(wallet) || !account || !issued || !expires || !nonce)
    return { ok: false, reason: "malformed" };
  const [random, tag] = nonce.split(".");
  if (!random || !tag) return { ok: false, reason: "malformed" };
  const expected = await bindTag(key, {
    wallet,
    accountId: account,
    issued,
    expires,
    random,
  });
  if (!timingSafeEqual(tag, expected))
    return { ok: false, reason: "malformed" };
  // The message must be exactly what we issued, so nothing else is signed with it.
  if (
    render(origin, { wallet, accountId: account, issued, expires, nonce }) !==
    message
  )
    return { ok: false, reason: "malformed" };
  if (account !== accountId) return { ok: false, reason: "wrong_account" };
  if (Date.parse(expires) < now) return { ok: false, reason: "expired" };
  const signer = recoverPersonalSigner(message, signature);
  if (!signer || signer !== wallet.toLowerCase())
    return { ok: false, reason: "bad_signature" };
  return { ok: true, wallet: wallet.toLowerCase() };
}
