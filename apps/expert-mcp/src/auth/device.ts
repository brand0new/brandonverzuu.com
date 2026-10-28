// OAuth 2.0 Device Authorization Grant (RFC 8628), for the CLI.
//
// @cloudflare/workers-oauth-provider has no device flow, so this is a minimal
// implementation on top of it that reuses the library for everything token-
// related: on approval, the gateway mints an ordinary authorization code (with
// a server-held PKCE verifier) through `completeAuthorization`, and the CLI's
// next poll exchanges it at the library's own token endpoint. Tokens, refresh,
// revocation and storage are therefore exactly those of the browser flow.
//
// The CLI registers itself first through dynamic client registration as a
// public client (token_endpoint_auth_method "none") with one loopback redirect
// URI. That URI is never visited in this flow; it only satisfies the code's
// redirect binding.
//
// - POST /device_authorization   client_id → device_code, user_code, verification URIs
// - GET  /device                 sign in, enter or confirm the user code
// - POST /device                 approve or deny
// - POST /token (grant_type=urn:ietf:params:oauth:grant-type:device_code)   polling

import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { findAccountByEmailHash, upsertAccountOnConsent } from "../accounts";
import {
  DEVICE_CODE_TTL_SECONDS,
  DEVICE_POLL_INTERVAL_SECONDS,
  OAUTH_SCOPE,
} from "../config";
import { randomToken, sha256Hex } from "../crypto";
import type { AuthProps } from "../types";
import { oauthHelpers } from "./consent";
import { emailForm, errorPage, escape, page, termsCheckbox } from "./html";
import { getSignInSession } from "./signin";

export const DEVICE_CODE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";
// No vowels or look-alikes, so codes don't spell words and are easy to type (RFC 8628 §6.1).
const USER_CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ";

function oauthError(
  error: string,
  description: string,
  status = 400,
): Response {
  return Response.json(
    { error, error_description: description },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function newUserCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = [...bytes]
    .map((b) => USER_CODE_ALPHABET[b % USER_CODE_ALPHABET.length])
    .join("");
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

export function normaliseUserCode(value: string): string {
  const chars = value.toUpperCase().replace(/[^A-Z]/g, "");
  return chars.length === 8 ? `${chars.slice(0, 4)}-${chars.slice(4)}` : chars;
}

async function s256(verifier: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
  );
  let binary = "";
  for (const b of digest) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function handleDeviceAuthorization(
  request: Request,
  env: Env,
): Promise<Response> {
  const form = await request.formData();
  const clientId = String(form.get("client_id") ?? "");
  if (!clientId) return oauthError("invalid_request", "client_id is required");
  const client = await oauthHelpers(env)
    .lookupClient(clientId)
    .catch(() => null);
  if (!client) return oauthError("invalid_client", "Unknown client", 401);
  if (client.tokenEndpointAuthMethod !== "none") {
    return oauthError(
      "unauthorized_client",
      "The device flow is for public clients",
    );
  }
  const redirectUri = client.redirectUris[0];
  if (!redirectUri)
    return oauthError("invalid_client", "The client has no redirect URI");
  const requested = String(form.get("scope") ?? OAUTH_SCOPE)
    .split(" ")
    .filter(Boolean);
  if (requested.some((s) => s !== OAUTH_SCOPE && s !== "offline_access")) {
    return oauthError("invalid_scope", `Supported scope: ${OAUTH_SCOPE}`);
  }

  const deviceCode = randomToken(32);
  const userCode = newUserCode();
  const now = Date.now();
  await env.COMMERCE.prepare(
    `INSERT INTO device_authorizations
       (device_code_hash, user_code, client_id, scope, code_verifier, redirect_uri, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      await sha256Hex(deviceCode),
      userCode,
      clientId,
      OAUTH_SCOPE,
      randomToken(32),
      redirectUri,
      new Date(now).toISOString(),
      new Date(now + DEVICE_CODE_TTL_SECONDS * 1000).toISOString(),
    )
    .run();

  const verificationUri = `${env.PUBLIC_ORIGIN}/device`;
  return Response.json(
    {
      device_code: deviceCode,
      user_code: userCode,
      verification_uri: verificationUri,
      verification_uri_complete: `${verificationUri}?user_code=${encodeURIComponent(userCode)}`,
      expires_in: DEVICE_CODE_TTL_SECONDS,
      interval: DEVICE_POLL_INTERVAL_SECONDS,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

interface DeviceRow {
  device_code_hash: string;
  user_code: string;
  client_id: string;
  status: string;
  code_verifier: string;
  redirect_uri: string;
  expires_at: string;
  last_polled_at: string | null;
}

async function pendingByUserCode(
  env: Env,
  userCode: string,
): Promise<DeviceRow | null> {
  const row = await env.COMMERCE.prepare(
    "SELECT * FROM device_authorizations WHERE user_code = ? AND status = 'pending'",
  )
    .bind(userCode)
    .first<DeviceRow>();
  return row && Date.parse(row.expires_at) > Date.now() ? row : null;
}

export async function handleDevicePage(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const session = await getSignInSession(request, env);
  if (!session) {
    return page(
      "Sign in",
      emailForm(
        "/signin",
        url.pathname + url.search,
        "Sign in to connect the command-line tool to your account.",
      ),
    );
  }
  const userCode = normaliseUserCode(url.searchParams.get("user_code") ?? "");
  const row = userCode ? await pendingByUserCode(env, userCode) : null;
  if (!row) {
    return page(
      "Connect a device",
      `<h1>Connect the command-line tool</h1>
${userCode ? '<p class="warn">That code isn\'t valid or has expired.</p>' : ""}
<form method="get" action="/device">
  <label>Code shown in your terminal<input type="text" name="user_code" required autocomplete="off" autocapitalize="characters"></label>
  <p><button class="primary" type="submit">Continue</button></p>
</form>`,
    );
  }
  const client = await oauthHelpers(env).lookupClient(row.client_id);
  const account = await findAccountByEmailHash(env, session.emailHash);
  const name = escape(client?.clientName ?? "A command-line tool");
  return page(
    "Connect a device",
    `<h1>Allow ${name} to use your account?</h1>
<p>Code <strong>${escape(row.user_code)}</strong>. Check that it matches the code in your terminal.</p>
<p class="muted">This app registered itself; its name is not verified.</p>
<p>It will be able to see your credit balance and usage, and run paid checks that spend your credits.</p>
<form method="post" action="/device">
  <input type="hidden" name="user_code" value="${escape(row.user_code)}">
  ${termsCheckbox(env.TERMS_URL, env.TERMS_VERSION, account?.termsVersion)}
  <p><button class="primary" name="decision" value="approve">Allow</button>
  <button class="secondary" name="decision" value="deny" formnovalidate>Deny</button></p>
</form>`,
  );
}

export async function handleDeviceDecision(
  request: Request,
  env: Env,
): Promise<Response> {
  const session = await getSignInSession(request, env);
  if (!session)
    return errorPage(
      "Your sign-in expired. Open the link from your terminal again.",
    );
  const form = await request.formData();
  const row = await pendingByUserCode(
    env,
    normaliseUserCode(String(form.get("user_code") ?? "")),
  );
  if (!row)
    return errorPage(
      "That code isn't valid or has expired. Start again from your terminal.",
    );

  if (form.get("decision") !== "approve") {
    await env.COMMERCE.prepare(
      "UPDATE device_authorizations SET status = 'denied' WHERE device_code_hash = ?",
    )
      .bind(row.device_code_hash)
      .run();
    return page(
      "Denied",
      "<h1>Access denied</h1><p>The command-line tool was not connected. You can close this tab.</p>",
    );
  }
  if (form.get("accept_terms") !== env.TERMS_VERSION) {
    return errorPage(
      "Accepting the current terms is required to continue. Go back and tick the box.",
    );
  }

  const account = await upsertAccountOnConsent(
    env,
    session.email,
    session.emailHash,
    env.TERMS_VERSION,
  );
  if (account.status === "frozen")
    return errorPage("This account is frozen. Contact support.", 403);
  const props: AuthProps = { accountId: account.id, via: "oauth" };
  const helpers: OAuthHelpers = oauthHelpers(env);
  const { redirectTo } = await helpers.completeAuthorization({
    request: {
      responseType: "code",
      clientId: row.client_id,
      redirectUri: row.redirect_uri,
      scope: [OAUTH_SCOPE],
      state: "",
      codeChallenge: await s256(row.code_verifier),
      codeChallengeMethod: "S256",
      resource: env.PUBLIC_ORIGIN,
    },
    userId: account.id,
    metadata: { flow: "device" },
    scope: [OAUTH_SCOPE],
    props,
  });
  const code = new URL(redirectTo).searchParams.get("code");
  if (!code) throw new Error("completeAuthorization returned no code");
  const updated = await env.COMMERCE.prepare(
    `UPDATE device_authorizations SET status = 'approved', account_id = ?, auth_code = ?
     WHERE device_code_hash = ? AND status = 'pending'`,
  )
    .bind(account.id, code, row.device_code_hash)
    .run();
  if (updated.meta.changes === 0)
    return errorPage("That code was already used.");
  return page(
    "Connected",
    "<h1>Connected</h1><p>The command-line tool is now signed in. You can close this tab.</p>",
  );
}

/**
 * Answers a device_code poll at the token endpoint. On success it forwards an
 * authorization_code exchange to the OAuth library and returns its response.
 */
export async function handleDeviceTokenRequest(
  form: FormData,
  env: Env,
  forwardToTokenEndpoint: (body: URLSearchParams) => Promise<Response>,
): Promise<Response> {
  const deviceCode = String(form.get("device_code") ?? "");
  const clientId = String(form.get("client_id") ?? "");
  if (!deviceCode || !clientId)
    return oauthError(
      "invalid_request",
      "device_code and client_id are required",
    );
  const hash = await sha256Hex(deviceCode);
  const row = await env.COMMERCE.prepare(
    "SELECT * FROM device_authorizations WHERE device_code_hash = ?",
  )
    .bind(hash)
    .first<DeviceRow>();
  if (!row || row.client_id !== clientId)
    return oauthError("invalid_grant", "Unknown device_code");
  if (Date.parse(row.expires_at) < Date.now()) {
    await env.COMMERCE.prepare(
      "DELETE FROM device_authorizations WHERE device_code_hash = ?",
    )
      .bind(hash)
      .run();
    return oauthError("expired_token", "The device code expired. Start again.");
  }
  if (row.status === "denied") {
    await env.COMMERCE.prepare(
      "DELETE FROM device_authorizations WHERE device_code_hash = ?",
    )
      .bind(hash)
      .run();
    return oauthError("access_denied", "The user denied the request.");
  }
  if (row.status === "pending") {
    const now = Date.now();
    const tooSoon =
      row.last_polled_at &&
      now - Date.parse(row.last_polled_at) <
        DEVICE_POLL_INTERVAL_SECONDS * 1000;
    await env.COMMERCE.prepare(
      "UPDATE device_authorizations SET last_polled_at = ? WHERE device_code_hash = ?",
    )
      .bind(new Date(now).toISOString(), hash)
      .run();
    return tooSoon
      ? oauthError(
          "slow_down",
          `Poll at most every ${DEVICE_POLL_INTERVAL_SECONDS} seconds.`,
        )
      : oauthError("authorization_pending", "Waiting for the user to approve.");
  }
  // Approved: take the code exactly once.
  const taken = await env.COMMERCE.prepare(
    "DELETE FROM device_authorizations WHERE device_code_hash = ? AND status = 'approved' RETURNING auth_code, code_verifier, redirect_uri",
  )
    .bind(hash)
    .first<{
      auth_code: string;
      code_verifier: string;
      redirect_uri: string;
    }>();
  if (!taken)
    return oauthError("invalid_grant", "The device code was already used.");
  return forwardToTokenEndpoint(
    new URLSearchParams({
      grant_type: "authorization_code",
      code: taken.auth_code,
      redirect_uri: taken.redirect_uri,
      client_id: clientId,
      code_verifier: taken.code_verifier,
      resource: env.PUBLIC_ORIGIN,
    }),
  );
}
