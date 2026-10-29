// The account surface for payments (spec 03 "Account surface"), shared by REST
// and the MCP free tools: payers, month-to-date spend, wallet binding, VAT.

import { isDevelopment } from "../config";
import { GatewayError } from "../errors";
import { monthToDate } from "../statements";
import type { Account } from "../types";
import { bindMessage, checkBinding } from "./eip191";
import { paymentHmacKey } from "./gate";
import { isAddress } from "./networks";
import {
  accountBilling,
  bindPayer,
  countActivePayers,
  findPayer,
  linkPayer,
  listPayers,
  restorePayer,
  setAccountVat,
  walletRefHash,
} from "./store";
import {
  normaliseVatId,
  StubVatValidator,
  vatTreatment,
  type VatValidator,
} from "./vat";

/** Wallets an account may bind, unless GUARD_CONFIG says otherwise (spec 05). */
export const DEFAULT_MAX_WALLETS = 3;

interface GuardConfig {
  maxWalletsPerAccount?: number;
  /** EUR minor units per rolling 30 days, if spec 05 sets one. */
  spendCeiling30d?: number;
}

export function guardConfig(env: Env): GuardConfig {
  if (!env.GUARD_CONFIG) return {};
  try {
    const parsed = JSON.parse(env.GUARD_CONFIG) as GuardConfig;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export async function accountSummary(env: Env, account: Account) {
  const [payers, spend, billing] = await Promise.all([
    listPayers(env, account.id),
    monthToDate(env, account.id),
    accountBilling(env, account.id),
  ]);
  const ceiling = guardConfig(env).spendCeiling30d;
  return {
    id: account.id,
    status: account.status,
    payers: payers.map((p) => ({
      id: p.id,
      rail: p.rail,
      // Wallets show their address; cards show nothing about the card.
      ...(p.rail === "x402" ? { address: p.ref } : { type: "card" }),
      bound_at: p.boundAt,
    })),
    month_to_date: spend,
    spending_ceiling:
      typeof ceiling === "number"
        ? { period: "30d", amount: ceiling, currency: "EUR" }
        : null,
    vat: {
      id: billing.vatId,
      status: billing.vatStatus,
      treatment: vatTreatment(billing),
    },
  };
}

/** Step one of binding: the message the wallet signs. */
export async function walletChallenge(
  env: Env,
  account: Account,
  address: string,
) {
  if (!isAddress(address))
    throw new GatewayError(
      "invalid_request",
      "address must be a 0x-prefixed 20-byte hex address.",
    );
  const { message, expiresAt } = await bindMessage(
    paymentHmacKey(env),
    env.PUBLIC_ORIGIN,
    address,
    account.id,
  );
  return {
    address,
    message,
    expires_at: expiresAt,
    how: "Sign the message with personal_sign (EIP-191) from this wallet, then POST /v1/wallets with { message, signature }.",
  };
}

/** Step two: checks the signature and binds the wallet. */
export async function bindWallet(
  env: Env,
  account: Account,
  message: string,
  signature: string,
) {
  const check = await checkBinding(
    paymentHmacKey(env),
    env.PUBLIC_ORIGIN,
    account.id,
    message,
    signature,
  );
  if (!check.ok) {
    const text: Record<typeof check.reason, string> = {
      malformed:
        "This isn't a binding message issued by this server. Ask for a new one.",
      expired: "The binding message has expired. Ask for a new one.",
      wrong_account: "This binding message is for another account.",
      bad_signature:
        "The signature doesn't come from the wallet in the message.",
    };
    throw new GatewayError("invalid_request", text[check.reason]);
  }
  const refHash = await walletRefHash(check.wallet);
  const existing = await findPayer(env, refHash);
  if (existing && existing.accountId !== account.id) {
    // Not silently re-bound: the accounts are linked for the guard (spec 05).
    await linkPayer(env, existing.id, account.id);
    throw new GatewayError(
      "payer_bound_elsewhere",
      "This wallet is already bound to another account.",
    );
  }
  if (existing && !existing.removedAt)
    return { payer: existing, created: false };
  const max = guardConfig(env).maxWalletsPerAccount ?? DEFAULT_MAX_WALLETS;
  if ((await countActivePayers(env, account.id, "x402")) >= max)
    throw new GatewayError(
      "wallet_limit",
      `An account can bind at most ${max} wallets. Remove one first.`,
    );
  if (existing) {
    await restorePayer(env, existing.id);
    return { payer: { ...existing, removedAt: null }, created: false };
  }
  return {
    payer: await bindPayer(env, {
      accountId: account.id,
      rail: "x402",
      refHash,
      ref: check.wallet,
    }),
    created: true,
  };
}

export function vatValidator(env: Env): VatValidator {
  // TODO(D5): VIES. Development accepts well-formed ids so reverse charge can be tried.
  return new StubVatValidator(isDevelopment(env));
}

export async function updateVat(
  env: Env,
  account: Account,
  vatId: string | null,
  validator = vatValidator(env),
) {
  if (vatId === null || vatId.trim() === "") {
    await setAccountVat(env, account.id, {
      vatId: null,
      country: null,
      status: "none",
    });
    return {
      id: null,
      status: "none" as const,
      treatment: "nl_standard" as const,
    };
  }
  const id = normaliseVatId(vatId);
  const result = await validator.validate(id);
  await setAccountVat(env, account.id, {
    vatId: id,
    country: result.country,
    status: result.status,
  });
  return {
    id,
    status: result.status,
    treatment: vatTreatment({
      vatStatus: result.status,
      vatCountry: result.country,
    }),
  };
}
