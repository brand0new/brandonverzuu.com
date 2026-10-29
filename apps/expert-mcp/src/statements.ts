// Monthly statements (spec 03 "Statements and accounting"): every settled
// payment per account and calendar month (UTC), with VAT. A statement works as
// the invoice for reverse-charge purposes; Brandon's accountant confirms the
// format (D5). Payments refunded later drop out of the totals.

import { getEmailSender } from "./auth/email";
import { log } from "./log";
import { formatEur } from "./pricing";

/** Statuses whose money was collected: a later dispute doesn't undo the booking. */
const COLLECTED = ["settled", "disputed"] as const;

export interface StatementLine {
  date: string;
  paymentId: string;
  kind: string;
  rail: string;
  asset: string | null;
  assetAmount: string | null;
  network: string | null;
  reference: string | null;
  net: number;
  vat: number;
  total: number;
  vatTreatment: string;
  payer: string;
}

export interface Statement {
  period: string;
  status: "open" | "issued";
  issuedAt: string | null;
  currency: "EUR";
  count: number;
  net: number;
  vat: number;
  total: number;
  lines: StatementLine[];
}

export function isPeriod(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function periodOf(date: Date): string {
  return date.toISOString().slice(0, 7);
}

export function previousPeriod(date: Date): string {
  return periodOf(
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1)),
  );
}

function bounds(period: string): [string, string] {
  const [y, m] = period.split("-").map(Number) as [number, number];
  return [
    new Date(Date.UTC(y, m - 1, 1)).toISOString(),
    new Date(Date.UTC(y, m, 1)).toISOString(),
  ];
}

interface LineRow {
  id: string;
  kind: string;
  rail: string;
  asset: string | null;
  asset_amount: string | null;
  network: string | null;
  external_ref: string | null;
  amount: number;
  vat_amount: number;
  vat_treatment: string;
  settled_at: string;
  payer_ref: string | null;
}

async function lines(
  env: Env,
  accountId: string | null,
  period: string,
): Promise<(StatementLine & { accountId: string })[]> {
  const [from, to] = bounds(period);
  const { results } = await env.COMMERCE.prepare(
    `SELECT p.*, r.ref AS payer_ref FROM payments p LEFT JOIN payers r ON r.id = p.payer_id
     WHERE (?1 IS NULL OR p.account_id = ?1) AND p.status IN ('settled', 'disputed')
       AND p.settled_at >= ?2 AND p.settled_at < ?3
     ORDER BY p.settled_at, p.id`,
  )
    .bind(accountId, from, to)
    .all<LineRow & { account_id: string }>();
  return results.map((r) => ({
    accountId: r.account_id,
    date: r.settled_at,
    paymentId: r.id,
    kind: r.kind,
    rail: r.rail,
    asset: r.asset,
    assetAmount: r.asset_amount,
    network: r.network,
    reference: r.external_ref,
    net: r.amount,
    vat: r.vat_amount,
    total: r.amount + r.vat_amount,
    vatTreatment: r.vat_treatment,
    // Wallet address or Stripe customer id: never card data.
    payer: r.payer_ref ?? "",
  }));
}

function summarise(
  period: string,
  items: StatementLine[],
  issuedAt: string | null,
): Statement {
  const net = items.reduce((s, l) => s + l.net, 0);
  const vat = items.reduce((s, l) => s + l.vat, 0);
  return {
    period,
    status: issuedAt ? "issued" : "open",
    issuedAt,
    currency: "EUR",
    count: items.length,
    net,
    vat,
    total: net + vat,
    lines: items.map(
      ({ accountId: _a, ...l }: StatementLine & { accountId?: string }) => l,
    ),
  };
}

export async function statementFor(
  env: Env,
  accountId: string,
  period: string,
): Promise<Statement> {
  const issued = await env.COMMERCE.prepare(
    "SELECT issued_at FROM statements WHERE account_id = ? AND period = ?",
  )
    .bind(accountId, period)
    .first<{ issued_at: string }>();
  return summarise(
    period,
    await lines(env, accountId, period),
    issued?.issued_at ?? null,
  );
}

/** Issued statements, newest first, plus the open current month. */
export async function listStatements(
  env: Env,
  accountId: string,
  now = new Date(),
) {
  const { results } = await env.COMMERCE.prepare(
    "SELECT period, total, vat_total, currency, issued_at FROM statements WHERE account_id = ? ORDER BY period DESC LIMIT 36",
  )
    .bind(accountId)
    .all<{
      period: string;
      total: number;
      vat_total: number;
      currency: string;
      issued_at: string;
    }>();
  const current = await statementFor(env, accountId, periodOf(now));
  return {
    current: {
      period: current.period,
      status: "open" as const,
      count: current.count,
      net: current.net,
      vat: current.vat,
      total: current.total,
    },
    issued: results.map((r) => ({
      period: r.period,
      status: "issued" as const,
      net: r.total - r.vat_total,
      vat: r.vat_total,
      total: r.total,
      currency: r.currency,
      issued_at: r.issued_at,
    })),
  };
}

/** Month-to-date spend, for get_account. */
export async function monthToDate(
  env: Env,
  accountId: string,
  now = new Date(),
) {
  const s = await statementFor(env, accountId, periodOf(now));
  return {
    period: s.period,
    count: s.count,
    net: s.net,
    vat: s.vat,
    total: s.total,
    currency: "EUR" as const,
  };
}

function csvField(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  // Quote everything that could break a row or be read as a formula.
  return /[",\n\r]|^[=+\-@\t]/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

const eur = (minor: number) => (minor / 100).toFixed(2);

export function statementCsv(
  items: (StatementLine & { accountId?: string })[],
  withAccount = false,
): string {
  const header = [
    ...(withAccount ? ["account_id"] : []),
    "settled_at",
    "payment_id",
    "check",
    "rail",
    "asset",
    "asset_amount",
    "network",
    "reference",
    "net_eur",
    "vat_eur",
    "total_eur",
    "vat_treatment",
    "payer",
  ];
  const rows = items.map((l) =>
    [
      ...(withAccount ? [l.accountId ?? ""] : []),
      l.date,
      l.paymentId,
      l.kind,
      l.rail,
      l.asset,
      l.assetAmount,
      l.network,
      l.reference,
      eur(l.net),
      eur(l.vat),
      eur(l.total),
      l.vatTreatment,
      l.payer,
    ]
      .map(csvField)
      .join(","),
  );
  return `${[header.join(","), ...rows].join("\r\n")}\r\n`;
}

/**
 * Every collected payment of a period across accounts, for Brandon's booking
 * (converting EURC/USDC and booking it happens outside the gateway). Reached
 * through the admin CLI (spec 05), never over HTTP.
 */
export async function exportPaymentsCsv(
  env: Env,
  period: string,
): Promise<string> {
  return statementCsv(await lines(env, null, period), true);
}

/** Cron: issues last month's statements and emails them. Safe to run more than once. */
export async function issueStatements(
  env: Env,
  period: string,
): Promise<number> {
  const all = await lines(env, null, period);
  const byAccount = new Map<string, StatementLine[]>();
  for (const line of all) {
    const list = byAccount.get(line.accountId) ?? [];
    list.push(line);
    byAccount.set(line.accountId, list);
  }
  let issued = 0;
  for (const [accountId, items] of byAccount) {
    const s = summarise(period, items, new Date().toISOString());
    const result = await env.COMMERCE.prepare(
      `INSERT INTO statements (id, account_id, period, total, vat_total, currency, issued_at)
       VALUES (?, ?, ?, ?, ?, 'EUR', ?) ON CONFLICT (account_id, period) DO NOTHING`,
    )
      .bind(
        `stmt_${period}_${accountId}`,
        accountId,
        period,
        s.total,
        s.vat,
        s.issuedAt,
      )
      .run();
    if (result.meta.changes === 0) continue;
    issued++;
    await emailStatement(env, accountId, s).catch((error: unknown) =>
      log("warn", "statement_email_failed", {
        errorName: (error as Error)?.name,
      }),
    );
  }
  return issued;
}

async function emailStatement(env: Env, accountId: string, s: Statement) {
  const row = await env.COMMERCE.prepare(
    "SELECT email FROM accounts WHERE id = ?",
  )
    .bind(accountId)
    .first<{ email: string }>();
  if (!row) return;
  // TODO(D5): the accountant confirms what the statement must say to serve as
  // the invoice (seller details, VAT ids, reverse-charge wording).
  await getEmailSender(env).send({
    to: row.email,
    subject: `Statement ${s.period}: expertise checks`,
    text: [
      `Statement for ${s.period}, account ${accountId}.`,
      "",
      `Checks: ${s.count}`,
      `Net: ${formatEur(s.net)}`,
      `VAT: ${formatEur(s.vat)}`,
      `Total: ${formatEur(s.total)}`,
      "",
      `Every payment is listed at ${env.PUBLIC_ORIGIN}/v1/statements/${s.period} (CSV: ${env.PUBLIC_ORIGIN}/v1/statements/${s.period}.csv).`,
    ].join("\n"),
  });
}

export { COLLECTED };
