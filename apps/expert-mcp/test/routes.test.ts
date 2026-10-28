import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createApiToken } from "../src/accounts";
import { STUB_STARTING_CREDITS } from "../src/stubs";
import { createAccount, ORIGIN, VALID_INPUTS } from "./helpers";
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

  it("returns 404 for ACP discovery (until packages/acp), webhooks and unknown routes", async () => {
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
      balance: STUB_STARTING_CREDITS,
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
    const first = await call("/v1/checks/api-governance", {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": key },
      body,
    });
    expect(first.status).toBe(200);
    const result = await first.json<Record<string, unknown>>();
    expect(result).toMatchObject({
      rulePackVersion: "stub",
      creditsCharged: 1,
    });
    expect(result).not.toHaveProperty("telemetry");

    const replay = await call("/v1/checks/api-governance", {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": key },
      body,
    });
    expect(replay.status).toBe(200);
    expect(replay.headers.get("Idempotent-Replayed")).toBe("true");

    const account = await (
      await call("/v1/account", { headers })
    ).json<{ balance: number }>();
    expect(account.balance).toBe(STUB_STARTING_CREDITS - 1);

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

  it("stays out of reach when purchase links aren't wired (dev stub answers)", async () => {
    const { token } = await apiToken();
    const response = await call("/v1/purchase-links", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ product_id: "pack_10" }),
    });
    expect(response.status).toBe(201);
    expect((await response.json<{ url: string }>()).url).toMatch(
      /^https:\/\/example\.invalid\/stub-checkout/,
    );
  });
});

describe("MCP over HTTP", () => {
  it("initialises, lists tools and calls get_balance", async () => {
    const { token } = await apiToken();
    const session = await mcpSession(token);
    expect(session.initialize.result.capabilities.extensions).toEqual({
      "io.modelcontextprotocol/skills": { directoryRead: true },
    });
    const tools = await session.request("tools/list");
    expect(tools.message.result.tools.length).toBe(9);
    const balance = await session.request("tools/call", {
      name: "get_balance",
      arguments: {},
    });
    expect(balance.message.result.structuredContent).toEqual({
      balance: STUB_STARTING_CREDITS,
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
    expect(result.message.result?.isError).toBeFalsy();
    expect(result.message.result.structuredContent.creditsCharged).toBe(1);
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
        params: { name: "get_balance", arguments: {} },
      }),
    });
    const { rpcMessage } = await import("./http");
    const message = await rpcMessage(response);
    expect(message.result.isError).toBe(true);
    expect(JSON.stringify(message.result.content)).toContain("forbidden");
  });
});
