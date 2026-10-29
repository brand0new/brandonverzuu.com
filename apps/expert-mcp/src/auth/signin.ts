// Email magic-link sign-in. It only establishes who is at the browser, for the
// length of one OAuth consent or device approval; accounts are created or
// updated when consent is given (src/auth/consent.ts).
//
// - POST /signin           email + continue path → emails a one-time link
// - GET  /signin/verify    shows a button (link scanners prefetch GETs, so a GET never consumes the link)
// - POST /signin/verify    consumes the link → session cookie → back to the continue path

import { emailHash, normaliseEmail } from "../accounts";
import {
  MAGIC_LINK_TTL_SECONDS,
  MAGIC_LINKS_PER_WINDOW,
  SESSION_COOKIE,
  SIGNIN_SESSION_TTL_SECONDS,
} from "../config";
import { randomToken, sha256Hex, timingSafeEqual } from "../crypto";
import { GatewayError } from "../errors";
import { getEmailSender } from "./email";
import { errorPage, escape, page } from "./html";

const BROWSER_COOKIE = "__Host-bvx_signin";
const EMAIL_PATTERN = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,255}$/;

export interface SignInSession {
  email: string;
  emailHash: string;
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

function cookie(name: string, value: string, maxAge: number): string {
  return `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

/** Only paths back into our own sign-in-gated flows are allowed as a continue target. */
export function safeContinuePath(value: string | null): string | null {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  )
    return null;
  const path = value.split("?")[0];
  return path === "/authorize" || path === "/device" ? value : null;
}

export async function getSignInSession(
  request: Request,
  env: Env,
): Promise<SignInSession | null> {
  const value = readCookie(request, SESSION_COOKIE);
  if (!value) return null;
  const row = await env.COMMERCE.prepare(
    "SELECT email, email_hash, expires_at FROM signin_sessions WHERE id_hash = ?",
  )
    .bind(await sha256Hex(value))
    .first<{ email: string; email_hash: string; expires_at: string }>();
  if (!row || Date.parse(row.expires_at) < Date.now()) return null;
  return { email: row.email, emailHash: row.email_hash };
}

export async function handleSignInRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  const form = await request.formData();
  const email = normaliseEmail(String(form.get("email") ?? ""));
  const continuePath = safeContinuePath(String(form.get("continue") ?? ""));
  if (!EMAIL_PATTERN.test(email))
    return errorPage("That doesn't look like an email address.");
  if (!continuePath)
    return errorPage(
      "This sign-in link is incomplete. Start again from your app.",
    );

  const hash = await emailHash(env, email);
  const since = new Date(
    Date.now() - MAGIC_LINK_TTL_SECONDS * 1000,
  ).toISOString();
  const recent = await env.COMMERCE.prepare(
    "SELECT COUNT(*) AS n FROM magic_links WHERE email_hash = ? AND created_at > ?",
  )
    .bind(hash, since)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= MAGIC_LINKS_PER_WINDOW) {
    return errorPage(
      "Too many sign-in links for this address. Wait a few minutes and try again.",
      429,
    );
  }

  const token = randomToken(32);
  const browser = randomToken(16);
  const now = Date.now();
  await env.COMMERCE.prepare(
    `INSERT INTO magic_links (token_hash, email_hash, email, browser_hash, continue_path, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      await sha256Hex(token),
      hash,
      email,
      await sha256Hex(browser),
      continuePath,
      new Date(now).toISOString(),
      new Date(now + MAGIC_LINK_TTL_SECONDS * 1000).toISOString(),
    )
    .run();

  const link = `${env.PUBLIC_ORIGIN}/signin/verify?token=${encodeURIComponent(token)}`;
  try {
    await getEmailSender(env).send({
      to: email,
      subject: "Your sign-in link",
      text: `Open this link in the browser where you asked for it to sign in:\n\n${link}\n\nIt works once and expires in 15 minutes. If you didn't ask for it, ignore this email.`,
    });
  } catch (error) {
    if (error instanceof GatewayError)
      return errorPage(error.message, error.status);
    throw error;
  }

  const headers = new Headers({
    "Set-Cookie": cookie(BROWSER_COOKIE, browser, MAGIC_LINK_TTL_SECONDS),
  });
  return page(
    "Check your email",
    `<h1>Check your email</h1><p>We sent a sign-in link to <strong>${escape(email)}</strong>. Open it in this browser to continue.</p>`,
    { headers },
  );
}

export function handleVerifyPage(request: Request): Response {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  return page(
    "Sign in",
    `<h1>Continue signing in</h1>
<form method="post" action="/signin/verify">
  <input type="hidden" name="token" value="${escape(token)}">
  <p><button class="primary" type="submit">Continue</button></p>
</form>`,
  );
}

export async function handleVerify(
  request: Request,
  env: Env,
): Promise<Response> {
  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  const browser = readCookie(request, BROWSER_COOKIE);
  if (!token) return errorPage("This sign-in link is incomplete.");

  // Single use: the row is deleted as it's read.
  const row = await env.COMMERCE.prepare(
    "DELETE FROM magic_links WHERE token_hash = ? RETURNING email, email_hash, browser_hash, continue_path, expires_at",
  )
    .bind(await sha256Hex(token))
    .first<{
      email: string;
      email_hash: string;
      browser_hash: string;
      continue_path: string;
      expires_at: string;
    }>();
  if (!row || Date.parse(row.expires_at) < Date.now()) {
    return errorPage(
      "This sign-in link has expired or was already used. Start again from your app.",
    );
  }
  if (
    !browser ||
    !timingSafeEqual(await sha256Hex(browser), row.browser_hash)
  ) {
    return errorPage(
      "Open the sign-in link in the same browser where you asked for it.",
    );
  }

  const session = randomToken(32);
  const now = Date.now();
  await env.COMMERCE.prepare(
    "INSERT INTO signin_sessions (id_hash, email_hash, email, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(
      await sha256Hex(session),
      row.email_hash,
      row.email,
      new Date(now).toISOString(),
      new Date(now + SIGNIN_SESSION_TTL_SECONDS * 1000).toISOString(),
    )
    .run();

  const headers = new Headers({ Location: row.continue_path });
  headers.append(
    "Set-Cookie",
    cookie(SESSION_COOKIE, session, SIGNIN_SESSION_TTL_SECONDS),
  );
  headers.append("Set-Cookie", cookie(BROWSER_COOKIE, "", 0));
  return new Response(null, { status: 303, headers });
}
