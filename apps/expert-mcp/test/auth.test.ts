// OAuth 2.1 end to end against the Worker: dynamic client registration, magic
// link sign-in, consent with terms, authorization code + PKCE, and the device
// authorization grant for the CLI.

import { env } from "cloudflare:workers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MemoryEmailSender, setEmailSender } from "../src/auth/email";
import { ORIGIN } from "./helpers";
import { call, cookieHeader, mcpSession, setCookies } from "./http";

const sender = new MemoryEmailSender();
beforeAll(() => setEmailSender(sender));
afterAll(() => setEmailSender(undefined));

const FORM = {
  "Content-Type": "application/x-www-form-urlencoded",
  Origin: ORIGIN,
};

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function pkce() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
    ),
  );
  return { verifier, challenge };
}

async function registerClient(name: string, redirectUri: string) {
  const response = await call("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: name,
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: "none",
    }),
  });
  expect(response.status).toBe(201);
  return (await response.json<{ client_id: string }>()).client_id;
}

/** Signs in by magic link from `continuePath` and returns the session cookies. */
async function signIn(
  email: string,
  continuePath: string,
): Promise<Record<string, string>> {
  const request = await call("/signin", {
    method: "POST",
    headers: FORM,
    body: new URLSearchParams({ email, continue: continuePath }).toString(),
  });
  expect(request.status).toBe(200);
  const browser = setCookies(request);
  const message = sender.sent.at(-1)!;
  expect(message.to).toBe(email);
  const link = new URL(/https?:\/\/\S+/.exec(message.text)![0]);
  expect(link.pathname).toBe("/signin/verify");

  // A GET only shows a button, so link scanners can't use up the link.
  const page = await call(`${link.pathname}${link.search}`);
  expect(page.status).toBe(200);

  const verify = await call("/signin/verify", {
    method: "POST",
    headers: { ...FORM, Cookie: cookieHeader(browser) },
    body: new URLSearchParams({
      token: link.searchParams.get("token")!,
    }).toString(),
  });
  expect(verify.status).toBe(303);
  expect(verify.headers.get("Location")).toBe(continuePath);
  return setCookies(verify);
}

describe("authorization code flow with magic link and consent", () => {
  it("signs in, records the terms version and issues a working token", async () => {
    const redirectUri = "http://127.0.0.1:33418/callback";
    const clientId = await registerClient("Test MCP Client", redirectUri);
    const { verifier, challenge } = await pkce();
    const authorize = `/authorize?${new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state: "xyz",
      scope: "expert",
      resource: ORIGIN,
    })}`;

    const first = await call(authorize);
    expect(first.status).toBe(200);
    expect(await first.text()).toContain("Email me a sign-in link");

    const email = `consent-${crypto.randomUUID()}@example.com`;
    const session = await signIn(email, authorize);

    const consent = await call(authorize, {
      headers: { Cookie: cookieHeader(session) },
    });
    expect(consent.status).toBe(200);
    const html = await consent.text();
    expect(html).toContain("Test MCP Client");
    expect(html).toContain(`version ${env.TERMS_VERSION}`);
    expect(html).toContain("app on your computer"); // loopback warning
    const handle = /name="handle" value="([^"]+)"/.exec(html)![1]!;
    const cookies = { ...session, ...setCookies(consent) };

    // Without accepting the terms nothing is granted and no account exists.
    const refused = await call("/authorize", {
      method: "POST",
      headers: { ...FORM, Cookie: cookieHeader(cookies) },
      body: new URLSearchParams({ handle, decision: "approve" }).toString(),
    });
    expect(refused.status).toBe(400);
    const none = await env.COMMERCE.prepare(
      "SELECT COUNT(*) AS n FROM accounts WHERE email = ?",
    )
      .bind(email)
      .first<{ n: number }>();
    expect(none?.n).toBe(0);

    const approved = await call("/authorize", {
      method: "POST",
      headers: { ...FORM, Cookie: cookieHeader(cookies) },
      body: new URLSearchParams({
        handle,
        decision: "approve",
        accept_terms: env.TERMS_VERSION,
      }).toString(),
    });
    expect(approved.status).toBe(302);
    const callback = new URL(approved.headers.get("Location")!);
    expect(callback.origin + callback.pathname).toBe(redirectUri);
    expect(callback.searchParams.get("state")).toBe("xyz");

    const account = await env.COMMERCE.prepare(
      "SELECT id, terms_version, email_hash FROM accounts WHERE email = ?",
    )
      .bind(email)
      .first<{ id: string; terms_version: string; email_hash: string }>();
    expect(account?.terms_version).toBe(env.TERMS_VERSION);
    expect(account?.id).toMatch(/^acct_[0-9A-Z]{26}$/);
    expect(account?.email_hash).toMatch(/^[0-9a-f]{64}$/);

    const token = await call("/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: callback.searchParams.get("code")!,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: verifier,
        resource: ORIGIN,
      }).toString(),
    });
    expect(token.status).toBe(200);
    const { access_token } = await token.json<{ access_token: string }>();

    const mcp = await mcpSession(access_token);
    const me1 = await mcp.request("tools/call", {
      name: "get_account",
      arguments: {},
    });
    expect(me1.message.result.structuredContent.id).toBe(account!.id);
    const me = await call("/v1/account", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    expect((await me.json<{ id: string }>()).id).toBe(account!.id);
  });

  it("only continues to its own sign-in-gated pages", async () => {
    const response = await call("/signin", {
      method: "POST",
      headers: FORM,
      body: new URLSearchParams({
        email: "a@example.com",
        continue: "https://evil.example/",
      }).toString(),
    });
    expect(response.status).toBe(400);
  });

  it("binds the magic link to the browser that asked for it", async () => {
    const email = `browser-${crypto.randomUUID()}@example.com`;
    await call("/signin", {
      method: "POST",
      headers: FORM,
      body: new URLSearchParams({ email, continue: "/device" }).toString(),
    });
    const token = new URL(
      /https?:\/\/\S+/.exec(sender.sent.at(-1)!.text)![0],
    ).searchParams.get("token")!;
    const verify = await call("/signin/verify", {
      method: "POST",
      headers: FORM,
      body: new URLSearchParams({ token }).toString(),
    });
    expect(verify.status).toBe(400);
  });
});

describe("device authorization grant", () => {
  async function start(clientId: string) {
    const response = await call("/device_authorization", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        scope: "expert",
      }).toString(),
    });
    expect(response.status).toBe(200);
    return response.json<{
      device_code: string;
      user_code: string;
      verification_uri_complete: string;
      interval: number;
    }>();
  }

  const poll = (clientId: string, deviceCode: string) =>
    call("/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: deviceCode,
        client_id: clientId,
      }).toString(),
    });

  it("completes for the CLI", async () => {
    const clientId = await registerClient(
      "bv-expertise",
      "http://127.0.0.1/bv-expertise/callback",
    );
    const device = await start(clientId);
    expect(device.user_code).toMatch(/^[B-Z]{4}-[B-Z]{4}$/);
    expect(device.verification_uri_complete).toBe(
      `${ORIGIN}/device?user_code=${encodeURIComponent(device.user_code)}`,
    );

    const pending = await poll(clientId, device.device_code);
    expect(pending.status).toBe(400);
    expect((await pending.json<{ error: string }>()).error).toBe(
      "authorization_pending",
    );
    expect(
      (
        await (
          await poll(clientId, device.device_code)
        ).json<{ error: string }>()
      ).error,
    ).toBe("slow_down");

    const devicePath =
      new URL(device.verification_uri_complete).pathname +
      new URL(device.verification_uri_complete).search;
    const session = await signIn(
      `device-${crypto.randomUUID()}@example.com`,
      devicePath,
    );
    const page = await call(devicePath, {
      headers: { Cookie: cookieHeader(session) },
    });
    const html = await page.text();
    expect(html).toContain("bv-expertise");
    expect(html).toContain(device.user_code);

    const approve = await call("/device", {
      method: "POST",
      headers: { ...FORM, Cookie: cookieHeader(session) },
      body: new URLSearchParams({
        user_code: device.user_code,
        decision: "approve",
        accept_terms: env.TERMS_VERSION,
      }).toString(),
    });
    expect(approve.status).toBe(200);
    expect(await approve.text()).toContain("Connected");

    const granted = await poll(clientId, device.device_code);
    expect(granted.status).toBe(200);
    const { access_token, refresh_token } = await granted.json<{
      access_token: string;
      refresh_token: string;
    }>();
    expect(refresh_token).toBeTruthy();
    expect(
      (
        await call("/v1/account", {
          headers: { Authorization: `Bearer ${access_token}` },
        })
      ).status,
    ).toBe(200);

    // The device code works once.
    expect(
      (
        await (
          await poll(clientId, device.device_code)
        ).json<{ error: string }>()
      ).error,
    ).toBe("invalid_grant");
  });

  it("reports a denial", async () => {
    const clientId = await registerClient(
      "bv-expertise",
      "http://127.0.0.1/bv-expertise/callback",
    );
    const device = await start(clientId);
    const session = await signIn(
      `deny-${crypto.randomUUID()}@example.com`,
      "/device",
    );
    const deny = await call("/device", {
      method: "POST",
      headers: { ...FORM, Cookie: cookieHeader(session) },
      body: new URLSearchParams({
        user_code: device.user_code,
        decision: "deny",
      }).toString(),
    });
    expect(deny.status).toBe(200);
    expect(
      (
        await (
          await poll(clientId, device.device_code)
        ).json<{ error: string }>()
      ).error,
    ).toBe("access_denied");
  });

  it("rejects unknown clients and wrong client ids", async () => {
    const unknown = await call("/device_authorization", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "client_id=nope",
    });
    expect(unknown.status).toBe(401);
    const clientId = await registerClient(
      "bv-expertise",
      "http://127.0.0.1/bv-expertise/callback",
    );
    const device = await start(clientId);
    expect(
      (
        await (
          await poll("someone-else", device.device_code)
        ).json<{ error: string }>()
      ).error,
    ).toBe("invalid_grant");
  });
});
