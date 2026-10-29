// Accounts and API tokens in D1 `commerce`.

import { API_TOKEN_PREFIX } from "./config";
import { hmacSha256Hex, randomToken, sha256Hex, ulid } from "./crypto";
import { emailHmacKey } from "./services";
import type { Account, AccountStatus } from "./types";

interface AccountRow {
  id: string;
  status: string;
  terms_version: string;
  created_at: string;
}

function toAccount(row: AccountRow): Account {
  const status: AccountStatus =
    row.status === "throttled" || row.status === "frozen"
      ? row.status
      : "active";
  return {
    id: row.id,
    status,
    termsVersion: row.terms_version,
    createdAt: row.created_at,
  };
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function emailHash(env: Env, email: string): Promise<string> {
  return hmacSha256Hex(emailHmacKey(env), normaliseEmail(email));
}

export async function getAccount(
  env: Env,
  id: string,
): Promise<Account | null> {
  const row = await env.COMMERCE.prepare(
    "SELECT id, status, terms_version, created_at FROM accounts WHERE id = ?",
  )
    .bind(id)
    .first<AccountRow>();
  return row ? toAccount(row) : null;
}

export async function findAccountByEmailHash(
  env: Env,
  hash: string,
): Promise<Account | null> {
  const row = await env.COMMERCE.prepare(
    "SELECT id, status, terms_version, created_at FROM accounts WHERE email_hash = ?",
  )
    .bind(hash)
    .first<AccountRow>();
  return row ? toAccount(row) : null;
}

/**
 * Creates the account on first consent, or records the newly accepted terms
 * version on an existing one. Returns the account either way.
 */
export async function upsertAccountOnConsent(
  env: Env,
  email: string,
  hash: string,
  termsVersion: string,
): Promise<Account> {
  const now = new Date().toISOString();
  await env.COMMERCE.prepare(
    `INSERT INTO accounts (id, email_hash, email, status, terms_version, created_at)
     VALUES (?, ?, ?, 'active', ?, ?)
     ON CONFLICT (email_hash) DO UPDATE SET terms_version = excluded.terms_version`,
  )
    .bind(`acct_${ulid()}`, hash, normaliseEmail(email), termsVersion, now)
    .run();
  const account = await findAccountByEmailHash(env, hash);
  if (!account) throw new Error("account upsert failed");
  return account;
}

// --- API tokens ---------------------------------------------------------------

export interface ApiTokenSummary {
  id: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export async function createApiToken(
  env: Env,
  accountId: string,
  label: string | null,
): Promise<{ token: string; summary: ApiTokenSummary }> {
  const token = `${API_TOKEN_PREFIX}${randomToken(32)}`;
  const id = `tok_${ulid()}`;
  const createdAt = new Date().toISOString();
  await env.COMMERCE.prepare(
    "INSERT INTO api_tokens (id, account_id, token_hash, label, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(id, accountId, await sha256Hex(token), label, createdAt)
    .run();
  return { token, summary: { id, label, createdAt, lastUsedAt: null } };
}

/** Revokes one of the account's own tokens. Returns false if there was none. */
export async function revokeApiToken(
  env: Env,
  accountId: string,
  id: string,
): Promise<boolean> {
  const result = await env.COMMERCE.prepare(
    "UPDATE api_tokens SET revoked_at = ? WHERE id = ? AND account_id = ? AND revoked_at IS NULL",
  )
    .bind(new Date().toISOString(), id, accountId)
    .run();
  return result.meta.changes > 0;
}

/** Resolves a presented API token to its account id, or null. */
export async function resolveApiToken(
  env: Env,
  token: string,
): Promise<{ accountId: string; tokenId: string } | null> {
  if (!token.startsWith(API_TOKEN_PREFIX)) return null;
  const hash = await sha256Hex(token);
  const row = await env.COMMERCE.prepare(
    "SELECT id, account_id, last_used_at FROM api_tokens WHERE token_hash = ? AND revoked_at IS NULL",
  )
    .bind(hash)
    .first<{ id: string; account_id: string; last_used_at: string | null }>();
  if (!row) return null;
  // Coarse last-used tracking: at most one write per token per minute.
  const now = Date.now();
  if (!row.last_used_at || now - Date.parse(row.last_used_at) > 60_000) {
    await env.COMMERCE.prepare(
      "UPDATE api_tokens SET last_used_at = ? WHERE id = ?",
    )
      .bind(new Date(now).toISOString(), row.id)
      .run();
  }
  return { accountId: row.account_id, tokenId: row.id };
}
