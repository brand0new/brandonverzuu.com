// The OAuth authorization endpoint: sign in by magic link, then consent,
// which requires accepting the current terms version and records it on the
// account (creating the account on first consent).

import {
  AuthorizationError,
  CimdFetchError,
  type AuthRequest,
  type ConsentDescription,
  type OAuthHelpers,
} from "@cloudflare/workers-oauth-provider";
import { findAccountByEmailHash, upsertAccountOnConsent } from "../accounts";
import { OAUTH_SCOPE } from "../config";
import type { AuthProps } from "../types";
import { emailForm, errorPage, escape, page, termsCheckbox } from "./html";
import { getSignInSession } from "./signin";

export function oauthHelpers(env: Env): OAuthHelpers {
  const helpers = (env as Env & { OAUTH_PROVIDER?: OAuthHelpers })
    .OAUTH_PROVIDER;
  if (!helpers)
    throw new Error(
      "OAUTH_PROVIDER helpers missing: the request didn't come through OAuthProvider",
    );
  return helpers;
}

function handleAuthError(error: unknown): Response {
  if (error instanceof AuthorizationError && error.redirectTo) {
    return Response.redirect(error.redirectTo, 302);
  }
  if (error instanceof AuthorizationError)
    return errorPage(error.description ?? "This sign-in request isn't valid.");
  if (error instanceof CimdFetchError)
    return errorPage("This app could not be verified.");
  throw error;
}

function consentBody(
  details: ConsentDescription,
  handle: string,
  env: Env,
  acceptedTerms?: string,
): string {
  const name = escape(details.clientName);
  const origin = details.clientDomain
    ? `Published by <strong>${escape(details.clientDomain)}</strong>.`
    : "This app registered itself; its name is not verified.";
  return `<h1>Allow ${name} to use your account?</h1>
<p>${origin} Access will be sent to <strong>${escape(details.redirectHost)}</strong>.</p>
${details.redirectIsLoopback ? '<p class="warn"><strong>This sends access to an app on your computer.</strong> Continue only if you just started signing in from it.</p>' : ""}
<p>It will be able to see your account, payers and statements, and run paid checks. Each check is paid separately, from a wallet or card you approve.</p>
<form method="post" action="/authorize">
  <input type="hidden" name="handle" value="${escape(handle)}">
  ${termsCheckbox(env.TERMS_URL, env.TERMS_VERSION, acceptedTerms)}
  <p><button class="primary" name="decision" value="approve">Allow</button>
  <button class="secondary" name="decision" value="deny" formnovalidate>Deny</button></p>
</form>
<p class="muted">Privacy: <a href="${escape(env.PRIVACY_URL)}">${escape(env.PRIVACY_URL)}</a></p>`;
}

export async function handleAuthorizeGet(
  request: Request,
  env: Env,
): Promise<Response> {
  const oauth = oauthHelpers(env);
  let authRequest: AuthRequest;
  try {
    authRequest = await oauth.parseAuthRequest(request);
  } catch (error) {
    return handleAuthError(error);
  }
  const session = await getSignInSession(request, env);
  if (!session) {
    const url = new URL(request.url);
    return page(
      "Sign in",
      emailForm(
        "/signin",
        url.pathname + url.search,
        "Sign in to connect an app to your account.",
      ),
    );
  }
  const account = await findAccountByEmailHash(env, session.emailHash);
  if (account?.status === "frozen")
    return errorPage("This account is frozen. Contact support.", 403);
  try {
    const details = await oauth.describeConsent(authRequest);
    const consent = await oauth.beginConsent(authRequest);
    return page(
      `Authorize ${details.clientName}`,
      consentBody(details, consent.handle, env, account?.termsVersion),
      {
        headers: consent.headers,
      },
    );
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function handleAuthorizePost(
  request: Request,
  env: Env,
): Promise<Response> {
  const oauth = oauthHelpers(env);
  const form = await request.clone().formData();
  const handle = String(form.get("handle") ?? "");
  const session = await getSignInSession(request, env);
  if (!session)
    return errorPage("Your sign-in expired. Start again from your app.");
  try {
    if (form.get("decision") !== "approve") {
      const denied = await oauth.denyConsent(request, handle);
      return new Response(null, { status: 302, headers: denied.headers });
    }
    // Checked before approveConsent, which consumes the handle.
    if (form.get("accept_terms") !== env.TERMS_VERSION) {
      return errorPage(
        "Accepting the current terms is required to continue. Go back and tick the box.",
      );
    }
    const approved = await oauth.approveConsent(request, handle, {
      scope: [OAUTH_SCOPE],
    });
    const account = await upsertAccountOnConsent(
      env,
      session.email,
      session.emailHash,
      env.TERMS_VERSION,
    );
    if (account.status === "frozen")
      return errorPage("This account is frozen. Contact support.", 403);
    const props: AuthProps = { accountId: account.id, via: "oauth" };
    const { redirectTo } = await oauth.completeAuthorization({
      request: approved.request,
      userId: account.id,
      metadata: {},
      scope: approved.request.scope,
      props,
    });
    approved.headers.set("Location", redirectTo);
    return new Response(null, { status: 302, headers: approved.headers });
  } catch (error) {
    return handleAuthError(error);
  }
}
