// D1 access for payments (migrations/0003_payments.sql).

import { DEFAULT_PRICES, type PriceRow } from "../config";
import { sha256Hex, ulid } from "../crypto";
import type { CheckKind, IdempotencyStore, Price, Rail } from "../types";

// --- Prices ------------------------------------------------------------------

interface PriceDbRow {
  kind: string;
  base_amount: number;
  currency: string;
  step_ops: number | null;
  step_amount: number | null;
  active: number;
}

function toPriceRow(row: PriceDbRow): PriceRow {
  return {
    kind: row.kind as CheckKind,
    baseAmount: row.base_amount,
    currency: "EUR",
    stepOps: row.step_ops,
    stepAmount: row.step_amount,
    active: row.active === 1,
  };
}

export async function loadPrice(env: Env, kind: CheckKind): Promise<PriceRow> {
  const row = await env.COMMERCE.prepare("SELECT * FROM prices WHERE kind = ?")
    .bind(kind)
    .first<PriceDbRow>();
  // A missing row means the migration didn't run; sell nothing rather than guess.
  return row ? toPriceRow(row) : { ...DEFAULT_PRICES[kind], active: false };
}

export async function listPrices(env: Env): Promise<PriceRow[]> {
  const { results } = await env.COMMERCE.prepare(
    "SELECT * FROM prices ORDER BY kind",
  ).all<PriceDbRow>();
  return results.map(toPriceRow);
}

// --- Accounts: VAT and Stripe customer ----------------------------------------

export type VatStatus = "none" | "pending" | "valid" | "invalid";

export interface AccountBilling {
  vatId: string | null;
  vatCountry: string | null;
  vatStatus: VatStatus;
  stripeCustomerId: string | null;
}

export async function accountBilling(
  env: Env,
  accountId: string,
): Promise<AccountBilling> {
  const row = await env.COMMERCE.prepare(
    "SELECT vat_id, vat_country, vat_status, stripe_customer_id FROM accounts WHERE id = ?",
  )
    .bind(accountId)
    .first<{
      vat_id: string | null;
      vat_country: string | null;
      vat_status: VatStatus;
      stripe_customer_id: string | null;
    }>();
  return {
    vatId: row?.vat_id ?? null,
    vatCountry: row?.vat_country ?? null,
    vatStatus: row?.vat_status ?? "none",
    stripeCustomerId: row?.stripe_customer_id ?? null,
  };
}

export async function setAccountVat(
  env: Env,
  accountId: string,
  vat: { vatId: string | null; country: string | null; status: VatStatus },
): Promise<void> {
  await env.COMMERCE.prepare(
    "UPDATE accounts SET vat_id = ?, vat_country = ?, vat_status = ?, vat_checked_at = ? WHERE id = ?",
  )
    .bind(
      vat.vatId,
      vat.country,
      vat.status,
      new Date().toISOString(),
      accountId,
    )
    .run();
}

export async function setStripeCustomer(
  env: Env,
  accountId: string,
  customerId: string,
) {
  await env.COMMERCE.prepare(
    "UPDATE accounts SET stripe_customer_id = ? WHERE id = ? AND stripe_customer_id IS NULL",
  )
    .bind(customerId, accountId)
    .run();
}

export async function freezeAccount(
  env: Env,
  accountId: string,
): Promise<void> {
  await env.COMMERCE.prepare(
    "UPDATE accounts SET status = 'frozen' WHERE id = ?",
  )
    .bind(accountId)
    .run();
}

// --- Payers --------------------------------------------------------------------

export interface Payer {
  id: string;
  accountId: string;
  rail: Rail;
  ref: string;
  boundAt: string;
  removedAt: string | null;
}

interface PayerRow {
  id: string;
  account_id: string;
  rail: Rail;
  ref: string;
  bound_at: string;
  removed_at: string | null;
}

const toPayer = (r: PayerRow): Payer => ({
  id: r.id,
  accountId: r.account_id,
  rail: r.rail,
  ref: r.ref,
  boundAt: r.bound_at,
  removedAt: r.removed_at,
});

export function walletRefHash(address: string): Promise<string> {
  return sha256Hex(`wallet:${address.toLowerCase()}`);
}

export function cardRefHash(fingerprint: string): Promise<string> {
  return sha256Hex(`card:${fingerprint}`);
}

export async function findPayer(
  env: Env,
  refHash: string,
): Promise<Payer | null> {
  const row = await env.COMMERCE.prepare(
    "SELECT * FROM payers WHERE ref_hash = ?",
  )
    .bind(refHash)
    .first<PayerRow>();
  return row ? toPayer(row) : null;
}

export async function listPayers(
  env: Env,
  accountId: string,
): Promise<Payer[]> {
  const { results } = await env.COMMERCE.prepare(
    "SELECT * FROM payers WHERE account_id = ? AND removed_at IS NULL ORDER BY bound_at",
  )
    .bind(accountId)
    .all<PayerRow>();
  return results.map(toPayer);
}

export async function countActivePayers(
  env: Env,
  accountId: string,
  rail: Rail,
) {
  const row = await env.COMMERCE.prepare(
    "SELECT COUNT(*) AS n FROM payers WHERE account_id = ? AND rail = ? AND removed_at IS NULL",
  )
    .bind(accountId, rail)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/** Binds a payer, or returns the existing one if `ref_hash` is taken. */
export async function bindPayer(
  env: Env,
  p: { accountId: string; rail: Rail; refHash: string; ref: string },
): Promise<Payer> {
  const id = `payer_${ulid()}`;
  const now = new Date().toISOString();
  await env.COMMERCE.prepare(
    "INSERT INTO payers (id, account_id, rail, ref_hash, ref, bound_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (ref_hash) DO NOTHING",
  )
    .bind(id, p.accountId, p.rail, p.refHash, p.ref, now)
    .run();
  return (await findPayer(env, p.refHash))!;
}

export async function restorePayer(env: Env, payerId: string): Promise<void> {
  await env.COMMERCE.prepare("UPDATE payers SET removed_at = NULL WHERE id = ?")
    .bind(payerId)
    .run();
}

export async function removePayer(
  env: Env,
  accountId: string,
  payerId: string,
) {
  const result = await env.COMMERCE.prepare(
    "UPDATE payers SET removed_at = ? WHERE id = ? AND account_id = ? AND removed_at IS NULL",
  )
    .bind(new Date().toISOString(), payerId, accountId)
    .run();
  return result.meta.changes > 0;
}

/** Records that a payer bound to one account also turned up on another (spec 05 links them). */
export async function linkPayer(env: Env, payerId: string, accountId: string) {
  await env.COMMERCE.prepare(
    "INSERT INTO payer_links (payer_id, account_id, linked_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
  )
    .bind(payerId, accountId, new Date().toISOString())
    .run();
}

// --- Payments ----------------------------------------------------------------

export type PaymentStatus =
  | "pending"
  | "verified"
  | "settled"
  | "voided"
  | "refunded"
  | "disputed"
  | "failed";

export interface PaymentRow {
  id: string;
  account_id: string;
  payer_id: string;
  rail: Rail;
  kind: CheckKind;
  check_ref: string;
  amount: number;
  vat_amount: number;
  vat_treatment: string;
  currency: string;
  asset: string | null;
  asset_amount: string | null;
  network: string | null;
  proof_ref: string;
  external_ref: string | null;
  status: PaymentStatus;
  created_at: string;
  settled_at: string | null;
}

/**
 * Inserts a pending payment, claiming its proof. Returns null when the proof
 * (x402 nonce, MPP challenge id) was already used: payments are single use.
 */
export async function claimProof(
  env: Env,
  p: {
    accountId: string;
    payerId: string;
    rail: Rail;
    price: Price;
    checkRef: string;
    proofRef: string;
    asset?: string;
    assetAmount?: string;
    network?: string;
  },
): Promise<string | null> {
  const id = `pay_${ulid()}`;
  const result = await env.COMMERCE.prepare(
    `INSERT INTO payments (id, account_id, payer_id, rail, kind, check_ref, amount, vat_amount, vat_treatment,
       currency, asset, asset_amount, network, proof_ref, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'EUR', ?, ?, ?, ?, 'pending', ?)
     ON CONFLICT (proof_ref) DO NOTHING`,
  )
    .bind(
      id,
      p.accountId,
      p.payerId,
      p.rail,
      p.price.kind,
      p.checkRef,
      p.price.net,
      p.price.vat,
      p.price.vatTreatment,
      p.asset ?? null,
      p.assetAmount ?? null,
      p.network ?? null,
      p.proofRef,
      new Date().toISOString(),
    )
    .run();
  return result.meta.changes > 0 ? id : null;
}

/** Moves a payment from one of `from` to `to`. False when it wasn't in `from`. */
export async function transition(
  env: Env,
  id: string,
  from: PaymentStatus[],
  to: PaymentStatus,
  fields: { payerId?: string; externalRef?: string; settledAt?: string } = {},
): Promise<boolean> {
  const result = await env.COMMERCE.prepare(
    `UPDATE payments SET status = ?,
       payer_id = COALESCE(?, payer_id),
       external_ref = COALESCE(?, external_ref),
       settled_at = COALESCE(?, settled_at)
     WHERE id = ? AND status IN (${from.map(() => "?").join(", ")})`,
  )
    .bind(
      to,
      fields.payerId ?? null,
      fields.externalRef ?? null,
      fields.settledAt ?? null,
      id,
      ...from,
    )
    .run();
  return result.meta.changes > 0;
}

export async function getPayment(
  env: Env,
  id: string,
): Promise<PaymentRow | null> {
  return env.COMMERCE.prepare("SELECT * FROM payments WHERE id = ?")
    .bind(id)
    .first<PaymentRow>();
}

export async function paymentByExternalRef(
  env: Env,
  ref: string,
): Promise<PaymentRow | null> {
  return env.COMMERCE.prepare("SELECT * FROM payments WHERE external_ref = ?")
    .bind(ref)
    .first<PaymentRow>();
}

/** Payments verified but neither settled nor voided for `olderThanMs`: a crash left them. */
export async function strandedPayments(
  env: Env,
  olderThanMs: number,
): Promise<PaymentRow[]> {
  const { results } = await env.COMMERCE.prepare(
    "SELECT * FROM payments WHERE status IN ('pending', 'verified') AND created_at < ? LIMIT 100",
  )
    .bind(new Date(Date.now() - olderThanMs).toISOString())
    .all<PaymentRow>();
  return results;
}

// --- Idempotency -------------------------------------------------------------

export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export class D1IdempotencyStore implements IdempotencyStore {
  constructor(private readonly env: Env) {}

  async get(accountId: string, route: string, key: string) {
    const row = await this.env.COMMERCE.prepare(
      "SELECT body_hash, response, created_at FROM idempotency WHERE key = ? AND account_id = ? AND route = ?",
    )
      .bind(key, accountId, route)
      .first<{ body_hash: string; response: string; created_at: string }>();
    if (!row || Date.parse(row.created_at) < Date.now() - IDEMPOTENCY_TTL_MS)
      return null;
    return { bodyHash: row.body_hash, response: row.response };
  }

  async put(
    accountId: string,
    route: string,
    key: string,
    bodyHash: string,
    response: string,
  ) {
    await this.env.COMMERCE.prepare(
      `INSERT INTO idempotency (key, account_id, route, body_hash, response, created_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (key, account_id, route) DO UPDATE SET body_hash = excluded.body_hash,
         response = excluded.response, created_at = excluded.created_at`,
    )
      .bind(key, accountId, route, bodyHash, response, new Date().toISOString())
      .run();
  }
}
