// The real PaymentGate (spec 03): x402 through a facilitator and MPP through
// Stripe, verify-then-settle, single-use proofs, payers bound to accounts.
//
//   x402  verify = local checks + facilitator /verify (nothing moves)
//         settle = facilitator /settle          void = don't settle; the authorisation lapses
//   MPP   verify = local checks + PaymentIntent confirmed (the Stripe charge
//         intent has no deferred capture, so the money moves here)
//         settle = record it                    void = refund

import { isDevelopment } from "../config";
import { GatewayError } from "../errors";
import { log } from "../log";
import { priceFor } from "../pricing";
import type {
  Account,
  Authorization,
  CheckKind,
  MppChallenge,
  ParsedArtifact,
  PaymentChallenge,
  PaymentGate,
  PaymentProof,
  PaymentReceipt,
  Price,
  X402PaymentRequired,
  X402Requirements,
} from "../types";
import {
  CDP_FACILITATOR_URL,
  FacilitatorError,
  HttpFacilitator,
  type Facilitator,
} from "./facilitator";
import { EcbRates, type FxRates } from "./fx";
import { checkStripeCredential, stripeChargeChallenge } from "./mpp";
import { isAddress, x402Network, type X402Network } from "./networks";
import {
  accountBilling,
  bindPayer,
  cardRefHash,
  claimProof,
  findPayer,
  linkPayer,
  loadPrice,
  setStripeCustomer,
  strandedPayments,
  transition,
  walletRefHash,
} from "./store";
import { cardFingerprint, StripeClient, StripeError } from "./stripe";
import { vatTreatment } from "./vat";
import { buildRequirements, checkX402Payload, invalidReasonCode } from "./x402";
import { sha256Hex } from "../crypto";

const DEV_PAYMENT_HMAC_KEY = "dev-only-payment-hmac-key";
const ZERO_ADDRESS = /^0x0{40}$/;

export interface GateConfig {
  hmacKey: string;
  origin: string;
  x402: {
    network: X402Network;
    payTo: string;
    facilitator: Facilitator;
  } | null;
  mpp: { networkId: string; stripe: StripeClient } | null;
  fx: FxRates;
  now?: () => number;
}

type X402State = {
  rail: "x402";
  payload: unknown;
  requirements: X402Requirements;
  from: string;
};
type MppState = { rail: "mpp"; paymentIntentId: string };

const KIND_LABEL: Record<CheckKind, string> = {
  "api-governance": "API governance check",
  "skill-design": "Skill design check",
  "process-review": "Process description review",
};

function paymentError(
  code:
    "payment_invalid" | "payment_expired" | "wrong_amount" | "payment_reused",
  message: string,
): GatewayError {
  return new GatewayError(code, message);
}

export class LivePaymentGate implements PaymentGate {
  private readonly now: () => number;

  constructor(
    private readonly env: Env,
    private readonly config: GateConfig,
  ) {
    this.now = config.now ?? Date.now;
  }

  async quote(
    kind: CheckKind,
    parsed: ParsedArtifact,
    account: Account,
  ): Promise<Price> {
    const [row, billing] = await Promise.all([
      loadPrice(this.env, kind),
      accountBilling(this.env, account.id),
    ]);
    return priceFor(row, parsed, vatTreatment(billing));
  }

  async challenge({
    account,
    price,
    resource,
  }: {
    account: Account;
    price: Price;
    resource: string;
  }): Promise<PaymentChallenge> {
    const { x402, mpp } = this.config;
    if (!x402 && !mpp)
      throw new GatewayError(
        "not_configured",
        "Payments aren't available yet.",
      );
    const description = KIND_LABEL[price.kind];
    const accepts = x402
      ? await buildRequirements({
          key: this.config.hmacKey,
          network: x402.network,
          payTo: x402.payTo,
          price,
          accountId: account.id,
          resource,
          usdPerEur: (await this.config.fx.usdPerEur())?.rate ?? null,
          now: this.now(),
        })
      : [];
    const required: X402PaymentRequired = {
      x402Version: 2,
      error: "Payment required",
      resource: { url: resource, description, mimeType: "application/json" },
      accepts,
    };
    const challenges: MppChallenge[] = mpp
      ? [
          await stripeChargeChallenge({
            key: this.config.hmacKey,
            realm: new URL(this.config.origin).host,
            networkId: mpp.networkId,
            price,
            accountId: account.id,
            resource,
            description,
            now: this.now(),
          }),
        ]
      : [];
    return { price, x402: required, mpp: challenges };
  }

  async verify(ctx: {
    account: Account;
    price: Price;
    resource: string;
    payment: PaymentProof;
    checkRef: string;
  }): Promise<Authorization> {
    if (ctx.payment.rail === "x402")
      return this.verifyX402(ctx, ctx.payment.payload);
    return this.verifyMpp(ctx, ctx.payment.credential);
  }

  private async verifyX402(
    ctx: { account: Account; price: Price; resource: string; checkRef: string },
    payload: unknown,
  ): Promise<Authorization> {
    const x402 = this.config.x402;
    if (!x402)
      throw paymentError("payment_invalid", "x402 isn't accepted here.");
    const check = await checkX402Payload({
      key: this.config.hmacKey,
      network: x402.network,
      payTo: x402.payTo,
      payload,
      accountId: ctx.account.id,
      resource: ctx.resource,
      price: ctx.price,
      now: this.now(),
    });
    if (!check.ok) throw paymentError(check.code, check.reason);

    // The paying wallet must be bound to this account (spec 03), before anything else.
    const payer = await findPayer(this.env, await walletRefHash(check.from));
    if (!payer || payer.accountId !== ctx.account.id || payer.removedAt) {
      if (payer && payer.accountId !== ctx.account.id)
        await linkPayer(this.env, payer.id, ctx.account.id);
      throw new GatewayError(
        "payer_not_bound",
        "This wallet isn't bound to this account. Bind it with bind_wallet or POST /v1/wallets first. Nothing was charged.",
      );
    }

    const paymentId = await claimProof(this.env, {
      accountId: ctx.account.id,
      payerId: payer.id,
      rail: "x402",
      price: ctx.price,
      checkRef: ctx.checkRef,
      proofRef: `x402:${x402.network.caip2}:${check.asset.address.toLowerCase()}:${check.nonce}`,
      asset: check.asset.address,
      assetAmount: check.value,
      network: x402.network.caip2,
    });
    if (!paymentId)
      throw paymentError(
        "payment_reused",
        "This payment authorisation was already used.",
      );

    let verdict;
    try {
      verdict = await x402.facilitator.verify(payload, check.requirements);
    } catch (error) {
      await transition(this.env, paymentId, ["pending"], "failed");
      throw new GatewayError(
        "payment_unavailable",
        "The payment facilitator isn't answering. Nothing was charged; try again shortly.",
        { cause: error },
      );
    }
    if (
      !verdict.isValid ||
      (verdict.payer !== undefined &&
        verdict.payer.toLowerCase() !== check.from)
    ) {
      await transition(this.env, paymentId, ["pending"], "failed");
      throw paymentError(
        invalidReasonCode(verdict.invalidReason),
        `The payment was refused${verdict.invalidReason ? ` (${verdict.invalidReason})` : ""}.`,
      );
    }
    await transition(this.env, paymentId, ["pending"], "verified");
    const state: X402State = {
      rail: "x402",
      payload,
      requirements: check.requirements,
      from: check.from,
    };
    return {
      id: paymentId,
      rail: "x402",
      accountId: ctx.account.id,
      payerId: payer.id,
      price: ctx.price,
      proofRef: check.nonce,
      state,
    };
  }

  private async verifyMpp(
    ctx: { account: Account; price: Price; resource: string; checkRef: string },
    credential: unknown,
  ): Promise<Authorization> {
    const mpp = this.config.mpp;
    if (!mpp) throw paymentError("payment_invalid", "MPP isn't accepted here.");
    const check = await checkStripeCredential({
      key: this.config.hmacKey,
      realm: new URL(this.config.origin).host,
      credential,
      accountId: ctx.account.id,
      resource: ctx.resource,
      price: ctx.price,
      now: this.now(),
    });
    if (!check.ok) throw paymentError(check.code, check.reason);

    const paymentId = await claimProof(this.env, {
      accountId: ctx.account.id,
      payerId: "pending",
      rail: "mpp",
      price: ctx.price,
      checkRef: ctx.checkRef,
      proofRef: `mpp:${check.challengeId}`,
    });
    if (!paymentId)
      throw paymentError(
        "payment_reused",
        "This MPP challenge was already used.",
      );

    let customer: string;
    let pi;
    try {
      const billing = await accountBilling(this.env, ctx.account.id);
      customer =
        billing.stripeCustomerId ??
        (await mpp.stripe.createCustomer(ctx.account.id)).id;
      if (!billing.stripeCustomerId)
        await setStripeCustomer(this.env, ctx.account.id, customer);
      pi = await mpp.stripe.chargeWithSpt({
        amount: check.amount,
        currency: check.currency,
        spt: check.spt,
        customer,
        challengeId: check.challengeId,
        paymentId,
        accountId: ctx.account.id,
        kind: ctx.price.kind,
      });
    } catch (error) {
      await transition(this.env, paymentId, ["pending"], "failed");
      if (error instanceof StripeError && error.status < 500)
        throw paymentError(
          "payment_invalid",
          "The card payment was declined. Nothing was charged.",
        );
      throw new GatewayError(
        "payment_unavailable",
        "Stripe isn't answering. Nothing was charged; try again shortly.",
        { cause: error },
      );
    }
    if (pi.status !== "succeeded") {
      await transition(this.env, paymentId, ["pending"], "failed", {
        externalRef: pi.id,
      });
      throw paymentError(
        "payment_invalid",
        pi.status === "requires_action"
          ? "The card payment needs further action from the payer."
          : "The card payment didn't complete. Nothing was charged.",
      );
    }

    // The money has moved: from here on, any failure refunds it.
    try {
      const fingerprint = cardFingerprint(pi);
      const refHash = fingerprint
        ? await cardRefHash(fingerprint)
        : await sha256Hex(`customer:${customer}`);
      let payer = await findPayer(this.env, refHash);
      if (!payer)
        payer = await bindPayer(this.env, {
          accountId: ctx.account.id,
          rail: "mpp",
          refHash,
          ref: customer,
        });
      // A card bound to another account links the two (shared budget, spec 05);
      // it isn't re-bound.
      if (payer.accountId !== ctx.account.id)
        await linkPayer(this.env, payer.id, ctx.account.id);
      await transition(this.env, paymentId, ["pending"], "verified", {
        payerId: payer.id,
        externalRef: pi.id,
      });
      const state: MppState = { rail: "mpp", paymentIntentId: pi.id };
      return {
        id: paymentId,
        rail: "mpp",
        accountId: ctx.account.id,
        payerId: payer.id,
        price: ctx.price,
        proofRef: check.challengeId,
        state,
      };
    } catch (error) {
      await mpp.stripe
        .refund(pi.id, paymentId, "verify_failed")
        .catch(() => undefined);
      await transition(
        this.env,
        paymentId,
        ["pending", "verified"],
        "refunded",
        {
          externalRef: pi.id,
        },
      );
      throw error;
    }
  }

  async settle(a: Authorization): Promise<PaymentReceipt> {
    const state = a.state as X402State | MppState | undefined;
    if (state?.rail === "x402") {
      const x402 = this.config.x402!;
      const result = await x402.facilitator.settle(
        state.payload,
        state.requirements,
      );
      // `settlement_pending` is non-terminal: the transaction was broadcast and
      // may still confirm. It's booked as settled and reconciled on chain.
      const pending =
        result.errorReason === "settlement_pending" && !!result.transaction;
      if (!result.success && !pending)
        throw new FacilitatorError(
          `settle refused: ${result.errorReason ?? "unknown"}`,
        );
      if (pending)
        log("warn", "settlement_pending", { outcome: "settlement_pending" });
      const settledAt = new Date(this.now()).toISOString();
      await transition(this.env, a.id, ["verified"], "settled", {
        externalRef: result.transaction || undefined,
        settledAt,
      });
      return {
        rail: "x402",
        paymentId: a.id,
        x402: {
          success: true,
          transaction: result.transaction,
          network: result.network || x402.network.caip2,
          payer: result.payer ?? state.from,
        },
      };
    }
    if (state?.rail === "mpp") {
      const timestamp = new Date(this.now()).toISOString();
      await transition(this.env, a.id, ["verified"], "settled", {
        settledAt: timestamp,
      });
      return {
        rail: "mpp",
        paymentId: a.id,
        mpp: {
          method: "stripe",
          reference: state.paymentIntentId,
          status: "success",
          timestamp: timestamp.replace(/\.\d{3}Z$/, "Z"),
        },
      };
    }
    throw new Error("authorisation without rail state");
  }

  async void(a: Authorization, reason: string): Promise<void> {
    const state = a.state as X402State | MppState | undefined;
    if (state?.rail === "mpp") {
      await this.config.mpp!.stripe.refund(state.paymentIntentId, a.id, reason);
      await transition(this.env, a.id, ["verified", "pending"], "refunded");
      return;
    }
    // x402: never settled, so nothing moves; the authorisation lapses at validBefore.
    await transition(this.env, a.id, ["verified", "pending"], "voided");
  }

  /**
   * Cron: payments a crash left between verify and settle. x402 ones are
   * voided (never settled); MPP ones are refunded.
   */
  async sweep(olderThanMs = 15 * 60 * 1000): Promise<number> {
    let handled = 0;
    for (const row of await strandedPayments(this.env, olderThanMs)) {
      try {
        if (
          row.rail === "mpp" &&
          row.external_ref &&
          row.status === "verified"
        ) {
          await this.config.mpp?.stripe.refund(
            row.external_ref,
            row.id,
            "stranded",
          );
          await transition(this.env, row.id, ["verified"], "refunded");
        } else {
          await transition(
            this.env,
            row.id,
            ["pending", "verified"],
            row.rail === "x402" ? "voided" : "failed",
          );
        }
        handled++;
      } catch (error) {
        log("error", "payment_sweep_failed", {
          errorName: (error as Error)?.name,
        });
      }
    }
    return handled;
  }
}

export function paymentHmacKey(env: Env): string {
  if (env.PAYMENT_HMAC_KEY) return env.PAYMENT_HMAC_KEY;
  if (isDevelopment(env)) return DEV_PAYMENT_HMAC_KEY;
  throw new GatewayError("not_configured", "PAYMENT_HMAC_KEY is not set.");
}

/** Shared per isolate, so the ECB rate is fetched about once an hour. */
const sharedRates = new EcbRates();

/** The gate as configured by vars and secrets. Rails without configuration aren't offered. */
export function createLivePaymentGate(
  env: Env,
  deps: { fetch?: typeof fetch; fx?: FxRates; now?: () => number } = {},
): LivePaymentGate {
  const fetchFn = deps.fetch ?? fetch;
  const network = x402Network(env.X402_NETWORK);
  const payTo = env.X402_PAY_TO;
  const x402 =
    network && isAddress(payTo) && !ZERO_ADDRESS.test(payTo)
      ? {
          network,
          payTo,
          facilitator: new HttpFacilitator(
            env.X402_FACILITATOR_URL || CDP_FACILITATOR_URL,
            env.X402_FACILITATOR_KEY_ID && env.X402_FACILITATOR_KEY
              ? {
                  keyId: env.X402_FACILITATOR_KEY_ID,
                  keySecret: env.X402_FACILITATOR_KEY,
                }
              : null,
            fetchFn,
          ),
        }
      : null;
  const mpp =
    env.STRIPE_SECRET_KEY && env.MPP_STRIPE_NETWORK_ID
      ? {
          networkId: env.MPP_STRIPE_NETWORK_ID,
          stripe: new StripeClient(env.STRIPE_SECRET_KEY, fetchFn),
        }
      : null;
  return new LivePaymentGate(env, {
    hmacKey: paymentHmacKey(env),
    origin: env.PUBLIC_ORIGIN,
    x402,
    mpp,
    fx: deps.fx ?? (deps.fetch ? new EcbRates(fetchFn) : sharedRates),
    now: deps.now,
  });
}
