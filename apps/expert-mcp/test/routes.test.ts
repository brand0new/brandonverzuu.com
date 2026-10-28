import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createApiToken } from "../src/accounts";
import { createAccount, ORIGIN, stubPayloadFor, VALID_INPUTS } from "./helpers";
import { call, mcpSession } from "./http";

async function apiToken() {
  const account = await createAccount();
  const { token, summary } = await createApiToken(env, account.id, "test");
  return { account, token, tokenId: summary.id };
}

describe("public routes", () => {
  it("answers /healthz without data", async () => {
    const response = await call("/healthz");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
  });

  it("returns 401 with the resource metadata pointer for an unauthenticated /mcp", async () => {
    const response = await call("/mcp", { method: "POST", body: "{}" });
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toContain(
      `resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource"`,
    );
  });

  it("publishes protected resource and authorization server metadata", async () => {
    const resource = await (
      await call("/.well-known/oauth-protected-resource")
    ).json<Record<string, unknown>>();
    expect(resource).toMatchObject({
      resource: ORIGIN,
      authorization_servers: [ORIGIN],
      scopes_supported: ["expert"],
    });

    const as = await (
      await call("/.well-known/oauth-authorization-server")
    ).json<Record<string, unknown>>();
    expect(as).toMatchObject({
      issuer: ORIGIN,
      authorization_endpoint: `${ORIGIN}/authorize`,
      token_endpoint: `${ORIGIN}/token`,
      registration_endpoint: `${ORIGIN}/register`,
      device_authorization_endpoint: `${ORIGIN}/device_authorization`,
    });
    expect(as.grant_types_supported).toContain(
      "urn:ietf:params:oauth:grant-type:device_code",
    );
    expect(as.code_challenge_methods_supported).toEqual(["S256"]);
  });

  it("returns 404 for webhooks (until spec 03), ACP discovery and unknown routes", async () => {
    expect((await call("/.well-known/acp.json")).status).toBe(404);
    expect((await call("/webhooks/stripe", { method: "POST" })).status).toBe(
      404,
    );
    expect((await call("/admin")).status).toBe(404);
    expect((await call("/")).status).toBe(404);
  });

  it("refuses cross-origin form posts", async () => {
    const response = await call("/signin", {
      method: "POST",
      headers: {
        Origin: "https://evil.example",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "email=a%40b.c&continue=%2Fdevice",
    });
    expect(response.status).toBe(403);
  });
});

describe("REST", () => {
  it("rejects requests without a token", async () => {
    expect((await call("/v1/account")).status).toBe(401);
  });

  it("returns the account", async () => {
    const { account, token } = await apiToken();
    const response = await call("/v1/account", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Request-Id")).toMatch(/^req_/);
    expect(await response.json()).toEqual({
      id: account.id,
      status: "active",
      terms_version: env.TERMS_VERSION,
      current_terms_version: env.TERMS_VERSION,
      payers: [],
      month_to_date: null,
      spending_ceiling: null,
    });
  });

  it("runs checks with an Idempotency-Key and replays them", async () => {
    const { token } = await apiToken();
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    const body = JSON.stringify(VALID_INPUTS["api-governance"]);

    const missing = await call("/v1/checks/api-governance", {
      method: "POST",
      headers,
      body,
    });
    expect(missing.status).toBe(400);

    const key = crypto.randomUUID();
    const unpaid = await call("/v1/checks/api-governance", {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": key },
      body,
    });
    expect(unpaid.status).toBe(402);
    const required = JSON.parse(
      atob(unpaid.headers.get("PAYMENT-REQUIRED")!),
    ) as { accepts: { amount: string }[] };
    expect(required).toMatchObject({
      x402Version: 2,
      resource: { url: `${ORIGIN}/v1/checks/api-governance` },
    });
    expect(await unpaid.json()).toMatchObject({
      status: 402,
      price: { net: 1000, total: 1210 },
    });

    const payment = btoa(JSON.stringify(stubPayloadFor(required)));
    const first = await call("/v1/checks/api-governance", {
      method: "POST",
      headers: {
        ...headers,
        "Idempotency-Key": key,
        "PAYMENT-SIGNATURE": payment,
      },
      body,
    });
    expect(first.status).toBe(200);
    expect(first.headers.get("PAYMENT-RESPONSE")).toBeTruthy();
    const result = await first.json<Record<string, unknown>>();
    expect(result).toMatchObject({
      rulePackVersion: "stub",
      price: { total: 1210 },
      payment: { rail: "x402" },
    });
    expect(result).not.toHaveProperty("telemetry");

    // The same key and body replay the stored result and charge nothing, even
    // without a payment attached.
    const replay = await call("/v1/checks/api-governance", {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": key },
      body,
    });
    expect(replay.status).toBe(200);
    expect(replay.headers.get("Idempotent-Replayed")).toBe("true");
    expect(await replay.json()).toEqual(result);

    // A reused payment under a new key is refused with a fresh challenge.
    const reused = await call("/v1/checks/api-governance", {
      method: "POST",
      headers: {
        ...headers,
        "Idempotency-Key": crypto.randomUUID(),
        "PAYMENT-SIGNATURE": payment,
      },
      body,
    });
    expect(reused.status).toBe(402);
    expect(reused.headers.get("PAYMENT-REQUIRED")).toBeTruthy();

    const conflict = await call("/v1/checks/api-governance", {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": key },
      body: JSON.stringify({
        document: '{"openapi":"3.0.3","info":{},"paths":{}}',
      }),
    });
    expect(conflict.status).toBe(422);

    expect(
      (
        await call("/v1/checks/nonsense", {
          method: "POST",
          headers: { ...headers, "Idempotency-Key": "k" },
          body,
        })
      ).status,
    ).toBe(404);
  });

  it("rejects oversized bodies before parsing", async () => {
    const { token } = await apiToken();
    const response = await call("/v1/checks/api-governance", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "big",
      },
      body: "x".repeat(4 * 1024 * 1024 + 1),
    });
    expect(response.status).toBe(413);
  });

  it("creates and revokes API tokens", async () => {
    const { token } = await apiToken();
    const auth = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    const created = await call("/v1/tokens", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ label: "ci" }),
    });
    expect(created.status).toBe(201);
    const { id, token: newToken } = await created.json<{
      id: string;
      token: string;
    }>();
    expect(newToken).toMatch(/^bvx_/);
    expect(
      (
        await call("/v1/account", {
          headers: { Authorization: `Bearer ${newToken}` },
        })
      ).status,
    ).toBe(200);

    expect(
      (await call(`/v1/tokens/${id}`, { method: "DELETE", headers: auth }))
        .status,
    ).toBe(204);
    expect(
      (
        await call("/v1/account", {
          headers: { Authorization: `Bearer ${newToken}` },
        })
      ).status,
    ).toBe(401);
    expect(
      (await call(`/v1/tokens/${id}`, { method: "DELETE", headers: auth }))
        .status,
    ).toBe(404);
  });

  it("can't revoke another account's token", async () => {
    const a = await apiToken();
    const b = await apiToken();
    const response = await call(`/v1/tokens/${b.tokenId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${a.token}` },
    });
    expect(response.status).toBe(404);
    expect(
      (
        await call("/v1/account", {
          headers: { Authorization: `Bearer ${b.token}` },
        })
      ).status,
    ).toBe(200);
  });

  it("serves prices, and answers 501 for the payment routes spec 03 adds", async () => {
    const { token } = await apiToken();
    const auth = { Authorization: `Bearer ${token}` };
    const prices = await call("/v1/prices", { headers: auth });
    expect(prices.status).toBe(200);
    expect(await prices.json()).toMatchObject({
      currency: "EUR",
      prices: [
        { kind: "api-governance", amount: 1000, step_amount: 500 },
        { kind: "skill-design", amount: 500 },
        { kind: "process-review", amount: 1500 },
      ],
    });
    expect(
      (await call("/v1/wallets", { method: "POST", headers: auth })).status,
    ).toBe(501);
    expect(
      (await call("/v1/wallets/w1", { method: "DELETE", headers: auth }))
        .status,
    ).toBe(501);
    expect((await call("/v1/statements", { headers: auth })).status).toBe(501);
    expect(
      (await call("/v1/purchase-links", { method: "POST", headers: auth }))
        .status,
    ).toBe(404);
  });
});

describe("MCP over HTTP", () => {
  it("initialises, lists tools and calls get_account", async () => {
    const { token } = await apiToken();
    const session = await mcpSession(token);
    expect(session.initialize.result.capabilities.extensions).toEqual({
      "io.modelcontextprotocol/skills": { directoryRead: true },
    });
    const tools = await session.request("tools/list");
    expect(tools.message.result.tools.length).toBe(10);
    const me = await session.request("tools/call", {
      name: "get_account",
      arguments: {},
    });
    expect(me.message.result.structuredContent).toMatchObject({
      status: "active",
    });
    expect(
      (await session.request("prompts/list")).message.result.prompts,
    ).toEqual([]);
  });

  it("accepts an artifact near the 2 MB limit", async () => {
    const { token } = await apiToken();
    const session = await mcpSession(token);
    const paths: Record<string, unknown> = {};
    const operation = {
      get: {
        summary: "x".repeat(200),
        responses: { "200": { description: "ok" } },
      },
    };
    const perPath = JSON.stringify(operation).length + 20;
    for (let i = 0; i * perPath < 1.9 * 1024 * 1024; i++)
      paths[`/resource-${i}`] = operation;
    const document = JSON.stringify({
      openapi: "3.1.0",
      info: { title: "big", version: "1" },
      paths,
    });
    const result = await session.request("tools/call", {
      name: "check_api_governance",
      arguments: { document },
    });
    expect(result.status).toBe(200);
    // Parsed and quoted: the near-2 MB document gets a 402 with its price, not a size error.
    expect(result.message.result.isError).toBe(true);
    expect(result.message.result.structuredContent).toMatchObject({
      x402Version: 2,
    });
  });

  it("won't let another account drive a session", async () => {
    const a = await apiToken();
    const b = await apiToken();
    const session = await mcpSession(a.token);
    const response = await call("/mcp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${b.token}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "mcp-session-id": session.sessionId,
        "mcp-protocol-version": "2025-11-25",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 9,
        method: "tools/call",
        params: { name: "get_account", arguments: {} },
      }),
    });
    const { rpcMessage } = await import("./http");
    const message = await rpcMessage(response);
    expect(message.result.isError).toBe(true);
    expect(JSON.stringify(message.result.content)).toContain("forbidden");
  });
});
