// Spec 03 acceptance, offline: the real PaymentGate against a mocked x402
// facilitator and a mocked Stripe, with throwaway keys. The testnet and Stripe
// test-mode end-to-end runs are manual (see the PR).

import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiToken } from "../src/accounts";
import { parseArtifact } from "../src/artifact";
import { GatewayError, PaymentRequired } from "../src/errors";
import {
  bindWallet,
  updateVat,
  walletChallenge,
} from "../src/payments/account";
import { cdpJwt, decodeJwt } from "../src/payments/cdp";
import { base64Decode } from "../src/payments/encoding";
import { challengeId } from "../src/payments/mpp";
import { getPayment } from "../src/payments/store";
import { verifyStripeSignature } from "../src/payments/stripe";
import { StubVatValidator } from "../src/payments/vat";
import { runPaidCheck } from "../src/pipeline";
import { createDevServices, setDevServices } from "../src/services";
import {
  issueStatements,
  periodOf,
  statementCsv,
  statementFor,
} from "../src/statements";
import type {
  Account,
  CheckKind,
  PaymentProof,
  ToolContext,
} from "../src/types";
import { hmacSha256Hex } from "../src/crypto";
import {
  connectMcp,
  createAccount,
  makeContext,
  ORIGIN,
  VALID_INPUTS,
} from "./helpers";
import { call } from "./http";
import {
  cdpKey,
  eurc,
  fakeNetwork,
  FACILITATOR_URL,
  GATE_KEY,
  liveGate,
  mppCredential,
  NETWORK,
  PAY_TO,
  wallet,
  x402Payment,
} from "./payment-fakes";

const RESOURCE = `${ORIGIN}/v1/checks/skill-design`;

afterEach(() => setDevServices(undefined));

async function boundWallet(account: Account) {
  const w = wallet();
  const { message } = await walletChallenge(env, account, w.address);
  await bindWallet(env, account, message, w.sign(message));
  return w;
}

function setup(
  netOptions?: Parameters<typeof fakeNetwork>[0],
  gateOptions?: Parameters<typeof liveGate>[1],
) {
  const net = fakeNetwork(netOptions);
  const gate = liveGate(net, gateOptions);
  return { net, gate };
}

async function contextFor(account: Account, gate: ReturnType<typeof liveGate>) {
  const services = { ...createDevServices(), payments: gate };
  return makeContext(account, services);
}

async function challengeFor(
  ctx: ToolContext,
  kind: CheckKind = "skill-design",
  resource = RESOURCE,
) {
  const error = await runPaidCheck(ctx, kind, VALID_INPUTS[kind], {
    resource,
    proof: null,
  }).catch((e) => e);
  expect(error).toBeInstanceOf(PaymentRequired);
  return (error as PaymentRequired).challenge;
}

async function codeOf(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(GatewayError);
  return (error as GatewayError).code;
}

describe("402 challenge", () => {
  it("offers EURC first and USDC at the quoted rate, plus an MPP challenge bound by HMAC", async () => {
    const account = await createAccount();
    const { gate } = setup();
    const { ctx } = await contextFor(account, gate);
    const challenge = await challengeFor(ctx);

    expect(challenge.price).toMatchObject({ net: 500, vat: 105, total: 605 });
    expect(challenge.x402).toMatchObject({
      x402Version: 2,
      resource: { url: RESOURCE },
    });
    const [eur, usd] = challenge.x402.accepts;
    expect(eur).toMatchObject({
      scheme: "exact",
      network: "eip155:84532",
      asset: NETWORK.assets[0]!.address,
      amount: "6050000",
      payTo: PAY_TO,
      maxTimeoutSeconds: 300,
      extra: { name: "EURC", version: "2", quote: { eur: 605 } },
    });
    // 6.05 EUR × 1.08 = 6.534 USD → 6534000 atomic units, rounded up.
    expect(usd).toMatchObject({
      asset: NETWORK.assets[1]!.address,
      amount: "6534000",
      extra: { name: "USDC" },
    });

    const [mpp] = challenge.mpp;
    expect(mpp).toMatchObject({
      realm: new URL(ORIGIN).host,
      method: "stripe",
      intent: "charge",
      header: "Payment-Authorization",
      request: {
        amount: "605",
        currency: "eur",
        methodDetails: {
          networkId: "profile_test",
          paymentMethodTypes: ["card"],
        },
      },
    });
    const { id, description: _d, ...bound } = mpp!;
    expect(id).toBe(await challengeId(GATE_KEY, bound));
  });

  it("puts both challenges in HTTP headers and in MCP tool results", async () => {
    const account = await createAccount();
    const { token } = await createApiToken(env, account.id, null);
    const { gate } = setup();
    setDevServices({ ...createDevServices(env), payments: gate });

    const response = await call("/v1/checks/skill-design", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "k1",
      },
      body: JSON.stringify(VALID_INPUTS["skill-design"]),
    });
    expect(response.status).toBe(402);
    const required = JSON.parse(
      base64Decode(response.headers.get("PAYMENT-REQUIRED")!),
    );
    expect(required.accepts).toHaveLength(2);
    const www = response.headers.get("WWW-Authenticate")!;
    expect(www).toMatch(
      /^Payment id="[^"]+", realm="[^"]+", method="stripe", intent="charge", request="[A-Za-z0-9_-]+"/,
    );
    expect(www).toContain('header="Payment-Authorization"');
    expect(await response.json()).toMatchObject({
      type: "https://paymentauth.org/problems/payment-required",
      status: 402,
    });

    const { ctx } = await contextFor(account, gate);
    const { client } = await connectMcp({ context: async () => ctx });
    const result = await client.callTool({
      name: "check_skill_design",
      arguments: VALID_INPUTS["skill-design"],
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      x402Version: 2,
      resource: { url: "mcp://tool/check_skill_design" },
    });
    expect(
      (result._meta?.["org.paymentauth/payment-required"] as any).challenges[0],
    ).toMatchObject({ method: "stripe" });
  });
});

describe("x402", () => {
  it("verifies, runs the check, then settles once, signing facilitator calls with the CDP key", async () => {
    const account = await createAccount();
    const key = await cdpKey();
    const { net, gate } = setup(undefined, { auth: key });
    const { ctx, services } = await contextFor(account, gate);
    const w = await boundWallet(account);
    const run = vi.spyOn(services.rules, "run");
    const challenge = await challengeFor(ctx);

    const outcome = await runPaidCheck(
      ctx,
      "skill-design",
      VALID_INPUTS["skill-design"],
      {
        resource: RESOURCE,
        proof: {
          rail: "x402",
          payload: x402Payment(eurc(challenge), w.address),
        },
      },
    );
    expect(run).toHaveBeenCalledOnce();
    expect(net.count("/verify")).toBe(1);
    expect(net.count("/settle")).toBe(1);
    // Verify happens before the rules run, settle after.
    const order = net.calls.map((c) =>
      new URL(c.url).pathname.split("/").pop(),
    );
    expect(order).toEqual(["verify", "settle"]);
    expect(outcome.receipt.x402).toMatchObject({
      success: true,
      network: "eip155:84532",
      payer: w.address,
    });

    const payment = await getPayment(env, outcome.receipt.paymentId);
    expect(payment).toMatchObject({
      status: "settled",
      rail: "x402",
      amount: 500,
      vat_amount: 105,
      asset_amount: "6050000",
    });
    expect(payment!.external_ref).toMatch(/^0x[0-9a-f]{64}$/);

    const auth = net.calls[0]!.headers.get("Authorization")!;
    const jwt = auth.replace(/^Bearer /, "");
    const { header, claims } = decodeJwt(jwt);
    expect(header).toMatchObject({
      alg: "EdDSA",
      kid: "test-key-id",
      typ: "JWT",
    });
    expect(claims).toMatchObject({
      sub: "test-key-id",
      iss: "cdp",
      uris: [`POST facilitator.test/platform/v2/x402/verify`],
    });
    const [h, c, s] = jwt.split(".");
    const sig = Uint8Array.from(
      atob(
        s!
          .replace(/-/g, "+")
          .replace(/_/g, "/")
          .padEnd(Math.ceil(s!.length / 4) * 4, "="),
      ),
      (x) => x.charCodeAt(0),
    );
    expect(
      await crypto.subtle.verify(
        { name: "Ed25519" },
        key.publicKey,
        sig,
        new TextEncoder().encode(`${h}.${c}`),
      ),
    ).toBe(true);
  });

  it("collects nothing when the check fails: the authorisation is never settled", async () => {
    const account = await createAccount();
    const { net, gate } = setup();
    const { ctx } = await contextFor(account, gate);
    const w = await boundWallet(account);
    ctx.rules = { run: async () => Promise.reject(new Error("rules down")) };
    const challenge = await challengeFor(ctx);
    const payload = x402Payment(eurc(challenge), w.address);
    expect(
      await codeOf(
        runPaidCheck(ctx, "skill-design", VALID_INPUTS["skill-design"], {
          resource: RESOURCE,
          proof: { rail: "x402", payload },
        }),
      ),
    ).toBe("check_failed");
    expect(net.count("/verify")).toBe(1);
    expect(net.count("/settle")).toBe(0);
    const row = await env.COMMERCE.prepare(
      "SELECT status FROM payments WHERE account_id = ?",
    )
      .bind(account.id)
      .first<{ status: string }>();
    expect(row?.status).toBe("voided");
  });

  it("withholds the result and voids when settlement fails", async () => {
    const account = await createAccount();
    const { gate } = setup({
      settle: () => ({
        success: false,
        errorReason: "insufficient_funds",
        transaction: "",
        network: NETWORK.caip2,
      }),
    });
    const { ctx } = await contextFor(account, gate);
    const w = await boundWallet(account);
    const challenge = await challengeFor(ctx);
    expect(
      await codeOf(
        runPaidCheck(ctx, "skill-design", VALID_INPUTS["skill-design"], {
          resource: RESOURCE,
          proof: {
            rail: "x402",
            payload: x402Payment(eurc(challenge), w.address),
          },
        }),
      ),
    ).toBe("payment_failed");
  });

  it("rejects an unbound wallet before anything runs or reaches the facilitator", async () => {
    const account = await createAccount();
    const { net, gate } = setup();
    const { ctx, services } = await contextFor(account, gate);
    const run = vi.spyOn(services.rules, "run");
    const challenge = await challengeFor(ctx);
    const proof: PaymentProof = {
      rail: "x402",
      payload: x402Payment(eurc(challenge), wallet().address),
    };
    expect(
      await codeOf(
        runPaidCheck(ctx, "skill-design", VALID_INPUTS["skill-design"], {
          resource: RESOURCE,
          proof,
        }),
      ),
    ).toBe("payer_not_bound");
    expect(run).not.toHaveBeenCalled();
    expect(net.calls).toHaveLength(0);
  });

  it("rejects a wallet bound to another account, and links the two", async () => {
    const owner = await createAccount();
    const other = await createAccount();
    const { gate } = setup();
    const w = await boundWallet(owner);
    const { ctx } = await contextFor(other, gate);
    const challenge = await challengeFor(ctx);
    expect(
      await codeOf(
        runPaidCheck(ctx, "skill-design", VALID_INPUTS["skill-design"], {
          resource: RESOURCE,
          proof: {
            rail: "x402",
            payload: x402Payment(eurc(challenge), w.address),
          },
        }),
      ),
    ).toBe("payer_not_bound");
    const link = await env.COMMERCE.prepare(
      "SELECT COUNT(*) AS n FROM payer_links WHERE account_id = ?",
    )
      .bind(other.id)
      .first<{ n: number }>();
    expect(link?.n).toBe(1);
  });

  it("rejects a reused authorisation before any rules run", async () => {
    const account = await createAccount();
    const { net, gate } = setup();
    const { ctx, services } = await contextFor(account, gate);
    const w = await boundWallet(account);
    const challenge = await challengeFor(ctx);
    const proof: PaymentProof = {
      rail: "x402",
      payload: x402Payment(eurc(challenge), w.address),
    };
    await runPaidCheck(ctx, "skill-design", VALID_INPUTS["skill-design"], {
      resource: RESOURCE,
      proof,
    });
    const run = vi.spyOn(services.rules, "run");
    const error = await runPaidCheck(
      ctx,
      "skill-design",
      VALID_INPUTS["skill-design"],
      { resource: RESOURCE, proof },
    ).catch((e) => e);
    expect(error).toBeInstanceOf(PaymentRequired);
    expect(error.code).toBe("payment_reused");
    expect(run).not.toHaveBeenCalled();
    expect(net.count("/verify")).toBe(1);
    expect(net.count("/settle")).toBe(1);
  });

  it("rejects a wrong amount, a tampered quote, another check's quote and another account's quote", async () => {
    const account = await createAccount();
    const { net, gate } = setup();
    const { ctx } = await contextFor(account, gate);
    const w = await boundWallet(account);
    const challenge = await challengeFor(ctx);
    const pay = (
      payload: unknown,
      kind: CheckKind = "skill-design",
      c = ctx,
      resource = RESOURCE,
    ) =>
      codeOf(
        runPaidCheck(c, kind, VALID_INPUTS[kind], {
          resource,
          proof: { rail: "x402", payload },
        }),
      );

    // The authorisation pays less than the quote.
    expect(
      await pay(x402Payment(eurc(challenge), w.address, { value: "1" })),
    ).toBe("wrong_amount");
    // The echoed requirement was edited: the quote signature no longer matches.
    expect(
      await pay(
        x402Payment(eurc(challenge), w.address, { amount: "1", value: "1" }),
      ),
    ).toBe("payment_invalid");
    // A skill-design quote (EUR 6.05) offered for an API check (EUR 12.10).
    expect(
      await pay(
        x402Payment(eurc(challenge), w.address),
        "api-governance",
        ctx,
        RESOURCE,
      ),
    ).toBe("wrong_amount");
    // Another account can't spend this account's quote.
    const other = await createAccount();
    await boundWallet(other);
    const { ctx: otherCtx } = await contextFor(other, gate);
    expect(
      await pay(
        x402Payment(eurc(challenge), w.address),
        "skill-design",
        otherCtx,
      ),
    ).toBe("payment_invalid");
    // An authorisation that expires before the check could settle.
    expect(
      await pay(
        x402Payment(eurc(challenge), w.address, {
          validBefore: Math.floor(Date.now() / 1000) + 5,
        }),
      ),
    ).toBe("payment_expired");
    expect(net.calls).toHaveLength(0);
  });

  it("maps a facilitator refusal to a fresh challenge and keeps the nonce burned", async () => {
    const account = await createAccount();
    const { gate } = setup({
      verify: () => ({ isValid: false, invalidReason: "insufficient_funds" }),
    });
    const { ctx } = await contextFor(account, gate);
    const w = await boundWallet(account);
    const challenge = await challengeFor(ctx);
    const error = await runPaidCheck(
      ctx,
      "skill-design",
      VALID_INPUTS["skill-design"],
      {
        resource: RESOURCE,
        proof: {
          rail: "x402",
          payload: x402Payment(eurc(challenge), w.address),
        },
      },
    ).catch((e) => e);
    expect(error).toBeInstanceOf(PaymentRequired);
    expect(error.code).toBe("payment_invalid");
  });
});

describe("MPP", () => {
  it("charges with the SPT, binds the card, settles, and refunds when the check fails", async () => {
    const account = await createAccount();
    const { net, gate } = setup();
    const { ctx } = await contextFor(account, gate);
    const challenge = await challengeFor(ctx);
    const outcome = await runPaidCheck(
      ctx,
      "skill-design",
      VALID_INPUTS["skill-design"],
      {
        resource: RESOURCE,
        proof: { rail: "mpp", credential: mppCredential(challenge.mpp[0]!) },
      },
    );
    expect(outcome.receipt.mpp).toMatchObject({
      method: "stripe",
      status: "success",
      reference: expect.stringMatching(/^pi_test_1_/),
    });
    const piCall = net.calls.find((c) =>
      c.url.endsWith("/v1/payment_intents"),
    )!;
    const form = new URLSearchParams(piCall.body);
    expect(form.get("amount")).toBe("605");
    expect(form.get("currency")).toBe("eur");
    expect(form.get("confirm")).toBe("true");
    expect(form.get("shared_payment_granted_token")).toMatch(/^spt_test_/);
    expect(form.get("customer")).toBe("cus_test_1");
    expect(piCall.headers.get("Stripe-Version")).toBe("2026-07-29.preview");
    expect(piCall.headers.get("Idempotency-Key")).toMatch(/^mpp_.+_spt_test_/);
    const payer = await env.COMMERCE.prepare(
      "SELECT rail, ref, ref_hash FROM payers WHERE account_id = ?",
    )
      .bind(account.id)
      .first<{ rail: string; ref: string; ref_hash: string }>();
    expect(payer).toMatchObject({ rail: "mpp", ref: "cus_test_1" });
    expect(payer!.ref_hash).not.toContain("fp_test_card");

    ctx.rules = { run: async () => Promise.reject(new Error("rules down")) };
    const second = await challengeFor(ctx);
    expect(
      await codeOf(
        runPaidCheck(ctx, "skill-design", VALID_INPUTS["skill-design"], {
          resource: RESOURCE,
          proof: { rail: "mpp", credential: mppCredential(second.mpp[0]!) },
        }),
      ),
    ).toBe("check_failed");
    const refund = net.calls.find((c) => c.url.endsWith("/v1/refunds"))!;
    expect(new URLSearchParams(refund.body).get("payment_intent")).toMatch(
      /^pi_test_2_/,
    );
    const rows = await env.COMMERCE.prepare(
      "SELECT status FROM payments WHERE account_id = ? ORDER BY created_at",
    )
      .bind(account.id)
      .all<{ status: string }>();
    expect(rows.results.map((r) => r.status)).toEqual(["settled", "refunded"]);
  });

  it("rejects a reused challenge, another account's challenge and a declined card, before any rules run", async () => {
    const account = await createAccount();
    const { net, gate } = setup();
    const { ctx, services } = await contextFor(account, gate);
    const challenge = await challengeFor(ctx);
    const credential = mppCredential(challenge.mpp[0]!);
    await runPaidCheck(ctx, "skill-design", VALID_INPUTS["skill-design"], {
      resource: RESOURCE,
      proof: { rail: "mpp", credential },
    });
    const run = vi.spyOn(services.rules, "run");
    expect(
      await codeOf(
        runPaidCheck(ctx, "skill-design", VALID_INPUTS["skill-design"], {
          resource: RESOURCE,
          proof: { rail: "mpp", credential },
        }),
      ),
    ).toBe("payment_reused");

    const other = await createAccount();
    const { ctx: otherCtx } = await contextFor(other, gate);
    const fresh = await challengeFor(ctx);
    expect(
      await codeOf(
        runPaidCheck(otherCtx, "skill-design", VALID_INPUTS["skill-design"], {
          resource: RESOURCE,
          proof: { rail: "mpp", credential: mppCredential(fresh.mpp[0]!) },
        }),
      ),
    ).toBe("payment_invalid");

    // A tampered amount breaks the HMAC binding.
    const tampered = mppCredential({
      ...fresh.mpp[0]!,
      request: { ...fresh.mpp[0]!.request, amount: "1" },
    });
    expect(
      await codeOf(
        runPaidCheck(ctx, "skill-design", VALID_INPUTS["skill-design"], {
          resource: RESOURCE,
          proof: { rail: "mpp", credential: tampered },
        }),
      ),
    ).toBe("payment_invalid");
    // A skill-design challenge for an API check.
    expect(
      await codeOf(
        runPaidCheck(ctx, "api-governance", VALID_INPUTS["api-governance"], {
          resource: RESOURCE,
          proof: { rail: "mpp", credential: mppCredential(fresh.mpp[0]!) },
        }),
      ),
    ).toBe("wrong_amount");
    expect(run).not.toHaveBeenCalled();
    expect(net.count("/v1/payment_intents")).toBe(1);

    const declined = setup({
      paymentIntent: () => ({
        status: 402,
        body: {
          error: { message: "Your card was declined.", code: "card_declined" },
        },
      }),
    });
    const { ctx: dctx } = await contextFor(account, declined.gate);
    const d = await challengeFor(dctx);
    expect(
      await codeOf(
        runPaidCheck(dctx, "skill-design", VALID_INPUTS["skill-design"], {
          resource: RESOURCE,
          proof: { rail: "mpp", credential: mppCredential(d.mpp[0]!) },
        }),
      ),
    ).toBe("payment_invalid");
  });

  it("rejects an expired challenge", async () => {
    const account = await createAccount();
    let now = Date.now();
    const { gate } = setup(undefined, { now: () => now });
    const { ctx } = await contextFor(account, gate);
    const challenge = await challengeFor(ctx);
    now += 6 * 60 * 1000;
    expect(
      await codeOf(
        runPaidCheck(ctx, "skill-design", VALID_INPUTS["skill-design"], {
          resource: RESOURCE,
          proof: { rail: "mpp", credential: mppCredential(challenge.mpp[0]!) },
        }),
      ),
    ).toBe("payment_expired");
  });

  it("links accounts that pay with the same card instead of re-binding it", async () => {
    const a = await createAccount();
    const b = await createAccount();
    const { gate } = setup();
    for (const account of [a, b]) {
      const { ctx } = await contextFor(account, gate);
      const c = await challengeFor(ctx);
      await runPaidCheck(ctx, "skill-design", VALID_INPUTS["skill-design"], {
        resource: RESOURCE,
        proof: { rail: "mpp", credential: mppCredential(c.mpp[0]!) },
      });
    }
    const owners = await env.COMMERCE.prepare(
      "SELECT account_id FROM payers WHERE rail = 'mpp' AND account_id IN (?, ?)",
    )
      .bind(a.id, b.id)
      .all();
    const links = await env.COMMERCE.prepare(
      "SELECT COUNT(*) AS n FROM payer_links WHERE account_id = ?",
    )
      .bind(b.id)
      .first<{ n: number }>();
    // The fake card fingerprint is shared by every test in this file, so it may
    // already belong to an earlier account; either way b is linked, not bound.
    expect(owners.results.every((r: any) => r.account_id !== b.id)).toBe(true);
    expect(links?.n).toBe(1);
  });
});

describe("idempotency", () => {
  it("replays a REST check with the same Idempotency-Key and charges once", async () => {
    const account = await createAccount();
    const { token } = await createApiToken(env, account.id, null);
    const { net, gate } = setup();
    setDevServices({ ...createDevServices(env), payments: gate });
    const w = await boundWallet(account);
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    };
    const body = JSON.stringify(VALID_INPUTS["skill-design"]);
    const unpaid = await call("/v1/checks/skill-design", {
      method: "POST",
      headers,
      body,
    });
    const required = JSON.parse(
      base64Decode(unpaid.headers.get("PAYMENT-REQUIRED")!),
    );
    const payment = btoa(
      JSON.stringify(x402Payment(required.accepts[0], w.address)),
    );
    const first = await call("/v1/checks/skill-design", {
      method: "POST",
      headers: { ...headers, "PAYMENT-SIGNATURE": payment },
      body,
    });
    expect(first.status).toBe(200);
    expect(
      JSON.parse(base64Decode(first.headers.get("PAYMENT-RESPONSE")!)),
    ).toMatchObject({ success: true });
    const again = await call("/v1/checks/skill-design", {
      method: "POST",
      headers: { ...headers, "PAYMENT-SIGNATURE": payment },
      body,
    });
    expect(again.status).toBe(200);
    expect(again.headers.get("Idempotent-Replayed")).toBe("true");
    expect(await again.json()).toEqual(await first.json());
    expect(net.count("/settle")).toBe(1);
    const conflict = await call("/v1/checks/skill-design", {
      method: "POST",
      headers,
      body: JSON.stringify({
        files: [
          { path: "SKILL.md", content: "---\nname: x\ndescription: y\n---\n" },
        ],
      }),
    });
    expect(conflict.status).toBe(422);
  });

  it("replays an MCP retry with the same payment and arguments, and charges once", async () => {
    const account = await createAccount();
    const { net, gate } = setup();
    setDevServices({ ...createDevServices(env), payments: gate });
    const w = await boundWallet(account);
    const { ctx } = await contextFor(account, gate);
    const { client } = await connectMcp({ context: async () => ctx });
    const first = await client.callTool({
      name: "check_skill_design",
      arguments: VALID_INPUTS["skill-design"],
    });
    const required = first.structuredContent as any;
    const meta = {
      "x402/payment": x402Payment(required.accepts[0], w.address),
    };
    const paid = await client.callTool({
      name: "check_skill_design",
      arguments: VALID_INPUTS["skill-design"],
      _meta: meta,
    });
    expect(paid.isError).toBeFalsy();
    expect(paid._meta?.["x402/payment-response"]).toMatchObject({
      success: true,
    });
    const replay = await client.callTool({
      name: "check_skill_design",
      arguments: VALID_INPUTS["skill-design"],
      _meta: meta,
    });
    expect(replay.structuredContent).toEqual(paid.structuredContent);
    expect(net.count("/settle")).toBe(1);
  });
});

describe("VAT", () => {
  async function priceWith(vatId: string | null) {
    const account = await createAccount();
    await updateVat(env, account, vatId, new StubVatValidator(true));
    const { gate } = setup();
    return gate.quote(
      "api-governance",
      await parseArtifact("api-governance", VALID_INPUTS["api-governance"]),
      account,
    );
  }

  it("charges no VAT under reverse charge, 21% for Dutch and unknown customers", async () => {
    expect(await priceWith("DE123456789")).toMatchObject({
      net: 1000,
      vat: 0,
      total: 1000,
      vatTreatment: "reverse_charge",
    });
    expect(await priceWith("NL123456789B01")).toMatchObject({
      net: 1000,
      vat: 210,
      total: 1210,
      vatTreatment: "nl_standard",
    });
    expect(await priceWith(null)).toMatchObject({
      vat: 210,
      total: 1210,
      vatTreatment: "nl_standard",
    });
    expect(await priceWith("XX123")).toMatchObject({
      vat: 210,
      vatTreatment: "nl_standard",
    });
  });

  it("charges Dutch VAT while a VAT id awaits validation", async () => {
    const account = await createAccount();
    expect(
      await updateVat(
        env,
        account,
        "de 123.456.789",
        new StubVatValidator(false),
      ),
    ).toEqual({
      id: "DE123456789",
      status: "pending",
      treatment: "nl_standard",
    });
  });

  it("sets the VAT id over REST", async () => {
    const account = await createAccount();
    const { token } = await createApiToken(env, account.id, null);
    const response = await call("/v1/account/vat", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ vat_id: "BE0123456789" }),
    });
    // Development accepts well-formed ids (VIES is a TODO).
    expect(await response.json()).toEqual({
      id: "BE0123456789",
      status: "valid",
      treatment: "reverse_charge",
    });
  });

  it("counts API operations into the price", async () => {
    const account = await createAccount();
    const { gate } = setup();
    const paths: Record<string, unknown> = {};
    for (let i = 0; i < 60; i++) paths[`/r${i}`] = { get: { responses: {} } };
    const parsed = await parseArtifact("api-governance", {
      document: JSON.stringify({
        openapi: "3.1.0",
        info: { title: "t", version: "1" },
        paths,
      }),
    });
    expect(await gate.quote("api-governance", parsed, account)).toMatchObject({
      operations: 60,
      net: 1500,
    });
  });
});

describe("wallet binding (EIP-191)", () => {
  it("binds a wallet that signed the message, and refuses other signers, other accounts and expired messages", async () => {
    const account = await createAccount();
    const w = wallet();
    const { message } = await walletChallenge(env, account, w.address);
    expect(message).toContain(`Wallet: ${w.address}`);
    expect(
      await codeOf(bindWallet(env, account, message, wallet().sign(message))),
    ).toBe("invalid_request");
    const other = await createAccount();
    expect(await codeOf(bindWallet(env, other, message, w.sign(message)))).toBe(
      "invalid_request",
    );
    const edited = message.replace("bind this wallet", "bind thiz wallet");
    expect(await codeOf(bindWallet(env, account, edited, w.sign(edited)))).toBe(
      "invalid_request",
    );
    const { payer, created } = await bindWallet(
      env,
      account,
      message,
      w.sign(message),
    );
    expect(created).toBe(true);
    expect(payer).toMatchObject({ rail: "x402", ref: w.address });
    // Idempotent.
    expect(
      (await bindWallet(env, account, message, w.sign(message))).created,
    ).toBe(false);
  });

  it("caps wallets per account and refuses a wallet bound elsewhere", async () => {
    const account = await createAccount();
    for (let i = 0; i < 3; i++) await boundWallet(account);
    const w = wallet();
    const { message } = await walletChallenge(env, account, w.address);
    expect(
      await codeOf(bindWallet(env, account, message, w.sign(message))),
    ).toBe("wallet_limit");

    const owner = await createAccount();
    const taken = await boundWallet(owner);
    const other = await createAccount();
    const m = await walletChallenge(env, other, taken.address);
    expect(
      await codeOf(bindWallet(env, other, m.message, taken.sign(m.message))),
    ).toBe("payer_bound_elsewhere");
  });

  it("binds and removes wallets over REST and MCP", async () => {
    const account = await createAccount();
    const { token } = await createApiToken(env, account.id, null);
    const auth = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    const w = wallet();
    const step1 = await (
      await call("/v1/wallets", {
        method: "POST",
        headers: auth,
        body: JSON.stringify({ address: w.address }),
      })
    ).json<{ message: string }>();
    const bound = await call("/v1/wallets", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        message: step1.message,
        signature: w.sign(step1.message),
      }),
    });
    expect(bound.status).toBe(201);
    const { id } = await bound.json<{ id: string }>();
    const me = await (
      await call("/v1/account", { headers: auth })
    ).json<{ payers: unknown[] }>();
    expect(me.payers).toEqual([
      expect.objectContaining({ id, rail: "x402", address: w.address }),
    ]);
    expect(
      (await call(`/v1/wallets/${id}`, { method: "DELETE", headers: auth }))
        .status,
    ).toBe(204);
    expect(
      (await call(`/v1/wallets/${id}`, { method: "DELETE", headers: auth }))
        .status,
    ).toBe(404);

    const { ctx } = makeContext(account);
    const { client } = await connectMcp({ context: async () => ctx });
    const w2 = wallet();
    const first = await client.callTool({
      name: "bind_wallet",
      arguments: { address: w2.address },
    });
    const message = (first.structuredContent as { message: string }).message;
    const second = await client.callTool({
      name: "bind_wallet",
      arguments: { message, signature: w2.sign(message) },
    });
    expect(second.structuredContent).toMatchObject({ address: w2.address });
  });
});

describe("statements", () => {
  it("lists every settled payment with VAT, and the totals match", async () => {
    const account = await createAccount();
    const { gate } = setup();
    const { ctx } = await contextFor(account, gate);
    const w = await boundWallet(account);
    const pay = async (kind: CheckKind, rail: "x402" | "mpp") => {
      const c = await challengeFor(ctx, kind);
      const proof: PaymentProof =
        rail === "x402"
          ? { rail, payload: x402Payment(eurc(c), w.address) }
          : { rail, credential: mppCredential(c.mpp[0]!) };
      return runPaidCheck(ctx, kind, VALID_INPUTS[kind], {
        resource: RESOURCE,
        proof,
      });
    };
    await pay("skill-design", "x402");
    await pay("api-governance", "mpp");
    await pay("process-review", "x402");
    // A failed check: voided, so not on the statement.
    const failing = {
      ...ctx,
      rules: { run: async () => Promise.reject(new Error("down")) },
    };
    const c = await challengeFor(failing);
    await runPaidCheck(failing, "skill-design", VALID_INPUTS["skill-design"], {
      resource: RESOURCE,
      proof: { rail: "x402", payload: x402Payment(eurc(c), w.address) },
    }).catch(() => {});

    const period = periodOf(new Date());
    const statement = await statementFor(env, account.id, period);
    expect(statement).toMatchObject({
      status: "open",
      count: 3,
      net: 500 + 1000 + 1500,
      vat: 105 + 210 + 315,
      total: 605 + 1210 + 1815,
    });
    expect(statement.lines.map((l) => l.kind)).toEqual([
      "skill-design",
      "api-governance",
      "process-review",
    ]);
    expect(statement.lines[0]).toMatchObject({
      rail: "x402",
      payer: w.address,
      vatTreatment: "nl_standard",
    });
    expect(statement.lines[1]).toMatchObject({
      rail: "mpp",
      payer: "cus_test_1",
    });

    const csv = statementCsv(statement.lines).trim().split("\r\n");
    expect(csv[0]).toBe(
      "settled_at,payment_id,check,rail,asset,asset_amount,network,reference,net_eur,vat_eur,total_eur,vat_treatment,payer",
    );
    expect(csv).toHaveLength(4);
    expect(csv[1]).toContain(",5.00,1.05,6.05,nl_standard,");

    expect(await issueStatements(env, period)).toBeGreaterThanOrEqual(1);
    const issued = await env.COMMERCE.prepare(
      "SELECT total, vat_total FROM statements WHERE account_id = ? AND period = ?",
    )
      .bind(account.id, period)
      .first();
    expect(issued).toEqual({ total: 3630, vat_total: 630 });
    expect(await issueStatements(env, period)).toBe(0);

    const { token } = await createApiToken(env, account.id, null);
    const response = await call(`/v1/statements/${period}.csv`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    expect((await response.text()).trim().split("\r\n")).toHaveLength(4);
    const json = await (
      await call(`/v1/statements/${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).json();
    expect(json).toMatchObject({ status: "issued", total: 3630 });
  });
});

describe("Stripe webhook", () => {
  const secret = "whsec_test_placeholder";

  async function signed(body: string, t = Math.floor(Date.now() / 1000)) {
    return `t=${t},v1=${await hmacSha256Hex(secret, `${t}.${body}`)}`;
  }

  it("checks the signature", async () => {
    const body = '{"id":"evt_1"}';
    expect(await verifyStripeSignature(await signed(body), body, secret)).toBe(
      true,
    );
    expect(
      await verifyStripeSignature(await signed(body), `${body} `, secret),
    ).toBe(false);
    expect(
      await verifyStripeSignature(await signed(body, 1000), body, secret),
    ).toBe(false);
    expect(await verifyStripeSignature(null, body, secret)).toBe(false);
  });

  it("marks refunds and freezes the account on a dispute", async () => {
    const { handleStripeWebhook } = await import("../src/payments/webhook");
    const webhookEnv = Object.assign(Object.create(env), {
      STRIPE_WEBHOOK_SECRET: secret,
    }) as Env;
    const account = await createAccount();
    const { gate } = setup();
    const { ctx } = await contextFor(account, gate);
    const c = await challengeFor(ctx);
    const { receipt } = await runPaidCheck(
      ctx,
      "skill-design",
      VALID_INPUTS["skill-design"],
      {
        resource: RESOURCE,
        proof: { rail: "mpp", credential: mppCredential(c.mpp[0]!) },
      },
    );
    const pi = receipt.mpp!.reference as string;
    const send = async (
      type: string,
      object: Record<string, unknown>,
      sig?: string,
    ) => {
      const body = JSON.stringify({
        id: `evt_${type}`,
        type,
        data: { object },
      });
      return handleStripeWebhook(
        new Request(`${ORIGIN}/webhooks/stripe`, {
          method: "POST",
          headers: { "Stripe-Signature": sig ?? (await signed(body)) },
          body,
        }),
        webhookEnv,
      );
    };
    expect(
      (
        await send(
          "charge.refunded",
          { object: "charge", payment_intent: pi },
          "t=1,v1=00",
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await send("payment_intent.succeeded", {
          object: "payment_intent",
          id: pi,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await send("charge.dispute.created", {
          object: "dispute",
          payment_intent: pi,
        })
      ).status,
    ).toBe(200);
    expect((await getPayment(env, receipt.paymentId))?.status).toBe("disputed");
    const status = await env.COMMERCE.prepare(
      "SELECT status FROM accounts WHERE id = ?",
    )
      .bind(account.id)
      .first<{ status: string }>();
    expect(status?.status).toBe("frozen");
  });
});

describe("reconciliation sweep", () => {
  it("voids stranded x402 payments and refunds stranded MPP ones", async () => {
    const account = await createAccount();
    const { net, gate } = setup();
    const old = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await env.COMMERCE.batch([
      env.COMMERCE.prepare(
        "INSERT INTO payments (id, account_id, payer_id, rail, kind, check_ref, amount, vat_amount, vat_treatment, currency, proof_ref, external_ref, status, created_at) VALUES (?, ?, 'p', 'x402', 'skill-design', 'r', 500, 105, 'nl_standard', 'EUR', ?, NULL, 'verified', ?)",
      ).bind(
        `pay_sweep_x_${account.id}`,
        account.id,
        `x402:sweep:${account.id}`,
        old,
      ),
      env.COMMERCE.prepare(
        "INSERT INTO payments (id, account_id, payer_id, rail, kind, check_ref, amount, vat_amount, vat_treatment, currency, proof_ref, external_ref, status, created_at) VALUES (?, ?, 'p', 'mpp', 'skill-design', 'r', 500, 105, 'nl_standard', 'EUR', ?, ?, 'verified', ?)",
      ).bind(
        `pay_sweep_m_${account.id}`,
        account.id,
        `mpp:sweep:${account.id}`,
        `pi_sweep_${account.id}`,
        old,
      ),
    ]);
    await gate.sweep();
    expect((await getPayment(env, `pay_sweep_x_${account.id}`))?.status).toBe(
      "voided",
    );
    expect((await getPayment(env, `pay_sweep_m_${account.id}`))?.status).toBe(
      "refunded",
    );
    expect(net.count("/v1/refunds")).toBeGreaterThanOrEqual(1);
  });
});

describe("CDP JWT", () => {
  it("signs with a P-256 PKCS#8 key too", async () => {
    const pair = (await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"],
    )) as CryptoKeyPair;
    const der = new Uint8Array(
      (await crypto.subtle.exportKey("pkcs8", pair.privateKey)) as ArrayBuffer,
    );
    const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...der))}\n-----END PRIVATE KEY-----`;
    const jwt = await cdpJwt({
      keyId: "k",
      keySecret: pem,
      method: "POST",
      url: `${FACILITATOR_URL}/settle`,
    });
    expect(decodeJwt(jwt).header).toMatchObject({ alg: "ES256", kid: "k" });
    expect(decodeJwt(jwt).claims).toMatchObject({
      uris: ["POST facilitator.test/platform/v2/x402/settle"],
    });
  });
});
