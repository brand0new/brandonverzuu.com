// Gateway Worker entry point (spec 02). Routes:
//
//   POST/GET/DELETE /mcp                 MCP Streamable HTTP (McpSession DO), bearer token required
//   /v1/*                                REST for the CLI and CI, bearer token required
//   /.well-known/oauth-*                 OAuth metadata (the OAuth library)
//   /authorize /token /register          OAuth 2.1: code + PKCE, DCR (library) with our consent page
//   /device_authorization /device        RFC 8628 device flow (src/auth/device.ts)
//   /signin /signin/verify               magic-link sign-in
//   /healthz                             liveness, no data
//   /.well-known/acp.json                TODO(spec 01/03): ACP discovery, 404 until packages/acp lands
//   /webhooks/stripe                     TODO(spec 03), 404 until then
//
// Everything else is 404. There are no admin routes.

import {
  OAuthProvider,
  type OAuthProviderOptions,
} from "@cloudflare/workers-oauth-provider";
import { resolveApiToken } from "./accounts";
import { handleAuthorizeGet, handleAuthorizePost } from "./auth/consent";
import {
  DEVICE_CODE_GRANT,
  handleDeviceAuthorization,
  handleDeviceDecision,
  handleDevicePage,
  handleDeviceTokenRequest,
} from "./auth/device";
import {
  handleSignInRequest,
  handleVerify,
  handleVerifyPage,
} from "./auth/signin";
import { isDevelopment, OAUTH_SCOPE } from "./config";
import { GatewayError } from "./errors";
import { log } from "./log";
import { AUTHENTICATED_ACCOUNT_HEADER, McpSession } from "./mcp/session";
import { createRestHandler, MAX_BODY_BYTES, readBodyText } from "./rest";
import type { AuthProps } from "./types";

export { McpSession };

// Sessions live in the EU jurisdiction (decision D11). Local workerd doesn't
// implement jurisdictions, so development uses the plain namespace.
const mcpHandlerEu = McpSession.serve("/mcp", {
  binding: "MCP_SESSION",
  jurisdiction: "eu",
});
const mcpHandlerLocal = McpSession.serve("/mcp", { binding: "MCP_SESSION" });
const restHandler = createRestHandler();

function notFound(): Response {
  return Response.json(
    { error: { code: "not_found", message: "Not found." } },
    { status: 404 },
  );
}

/** Form posts must come from our own pages (on top of SameSite=Lax cookies). */
function sameOrigin(request: Request, env: Env): boolean {
  const origin = request.headers.get("Origin");
  return origin === null || origin === env.PUBLIC_ORIGIN;
}

/**
 * Caps the MCP request body before the transport parses it, and tells the
 * session which account this request's token belongs to.
 */
const mcpApiHandler = {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const headers = new Headers(request.headers);
    headers.delete(AUTHENTICATED_ACCOUNT_HEADER);
    const accountId = (ctx.props as AuthProps | undefined)?.accountId;
    if (accountId) headers.set(AUTHENTICATED_ACCOUNT_HEADER, accountId);
    request = new Request(request, { headers });
    if (request.method === "POST") {
      try {
        const body = await readBodyText(request, MAX_BODY_BYTES);
        request = new Request(request, { body });
      } catch (error) {
        if (error instanceof GatewayError) {
          return Response.json(
            {
              jsonrpc: "2.0",
              id: null,
              error: { code: -32600, message: error.message },
            },
            { status: error.status },
          );
        }
        throw error;
      }
    }
    return (isDevelopment(env) ? mcpHandlerLocal : mcpHandlerEu).fetch(
      request,
      env,
      ctx,
    );
  },
};

const defaultHandler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    const method = request.method;
    if (
      method === "POST" &&
      pathname !== "/device_authorization" &&
      !sameOrigin(request, env)
    ) {
      return new Response("Cross-origin form posts aren't accepted.", {
        status: 403,
      });
    }
    switch (`${method} ${pathname}`) {
      case "GET /authorize":
        return handleAuthorizeGet(request, env);
      case "POST /authorize":
        return handleAuthorizePost(request, env);
      case "POST /signin":
        return handleSignInRequest(request, env);
      case "GET /signin/verify":
        return handleVerifyPage(request);
      case "POST /signin/verify":
        return handleVerify(request, env);
      case "POST /device_authorization":
        return handleDeviceAuthorization(request, env);
      case "GET /device":
        return handleDevicePage(request, env);
      case "POST /device":
        return handleDeviceDecision(request, env);
      // TODO(spec 01/03): serve the ACP discovery document from packages/acp
      // (transports: ["mcp"]) once that package merges.
      case "GET /.well-known/acp.json":
        return notFound();
      // TODO(spec 03): Stripe webhooks.
      case "POST /webhooks/stripe":
        return notFound();
      default:
        return notFound();
    }
  },
};

function providerOptions(env: Env): OAuthProviderOptions<Env> {
  const origin = env.PUBLIC_ORIGIN;
  // One protected resource for the whole origin: the library requires every API
  // route (/mcp and /v1) to sit under the resource, and MCP clients accept a
  // resource that covers the server URL (RFC 9728 metadata at the origin).
  const resource = origin;
  return {
    apiHandlers: { "/mcp": mcpApiHandler, "/v1/": restHandler },
    defaultHandler,
    authorizeEndpoint: "/authorize",
    tokenEndpoint: "/token",
    clientRegistrationEndpoint: "/register",
    scopesSupported: [OAUTH_SCOPE, "offline_access"],
    requiredScopes: [OAUTH_SCOPE],
    resourceMetadata: {
      resource,
      authorization_servers: [origin],
      resource_name: "Brandon Verzuu expertise checks",
    },
    // MCP clients that publish a Client ID Metadata Document can skip DCR.
    clientIdMetadataDocumentEnabled: true,
    // API tokens for CI (POST /v1/tokens) are accepted wherever OAuth tokens are.
    resolveExternalToken: async ({ token, env }) => {
      const match = await resolveApiToken(env, token);
      if (!match) return null;
      const props: AuthProps = { accountId: match.accountId, via: "api_token" };
      return { props, audience: resource };
    },
  };
}

const providers = new Map<string, OAuthProvider<Env>>();

function providerFor(env: Env): OAuthProvider<Env> {
  let provider = providers.get(env.PUBLIC_ORIGIN);
  if (!provider) {
    provider = new OAuthProvider<Env>(providerOptions(env));
    providers.set(env.PUBLIC_ORIGIN, provider);
  }
  return provider;
}

async function isDeviceTokenRequest(
  request: Request,
): Promise<FormData | null> {
  if (request.method !== "POST") return null;
  if (
    !request.headers
      .get("Content-Type")
      ?.startsWith("application/x-www-form-urlencoded")
  )
    return null;
  const form = await request.clone().formData();
  return form.get("grant_type") === DEVICE_CODE_GRANT ? form : null;
}

/** Adds the device flow to the authorization server metadata (RFC 8628 §4). */
async function withDeviceMetadata(
  response: Response,
  env: Env,
): Promise<Response> {
  if (!response.ok) return response;
  const metadata = (await response.json()) as Record<string, unknown>;
  const grants = Array.isArray(metadata.grant_types_supported)
    ? metadata.grant_types_supported
    : [];
  metadata.device_authorization_endpoint = `${env.PUBLIC_ORIGIN}/device_authorization`;
  metadata.grant_types_supported = [...grants, DEVICE_CODE_GRANT];
  const headers = new Headers(response.headers);
  headers.delete("Content-Length");
  return new Response(JSON.stringify(metadata), {
    status: response.status,
    headers,
  });
}

async function route(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (pathname === "/healthz") {
    return new Response("ok", {
      headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
    });
  }
  const provider = providerFor(env);
  if (pathname === "/token") {
    const form = await isDeviceTokenRequest(request);
    if (form) {
      return handleDeviceTokenRequest(form, env, (body) =>
        provider.fetch(
          new Request(`${env.PUBLIC_ORIGIN}/token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
          }),
          env,
          ctx,
        ),
      );
    }
  }
  const response = await provider.fetch(request, env, ctx);
  if (
    pathname === "/.well-known/oauth-authorization-server" &&
    request.method === "GET"
  ) {
    return withDeviceMetadata(response, env);
  }
  return response;
}

/** Route labels for logs: paths only, never query strings (they can carry tokens). */
function routeLabel(pathname: string): string {
  if (pathname.startsWith("/v1/tokens/")) return "/v1/tokens/{id}";
  if (pathname.startsWith("/.well-known/oauth-protected-resource"))
    return "/.well-known/oauth-protected-resource";
  return pathname.length > 64 ? `${pathname.slice(0, 64)}…` : pathname;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const started = Date.now();
    const { pathname } = new URL(request.url);
    try {
      const response = await route(request, env, ctx);
      if (!pathname.startsWith("/v1/")) {
        // /v1 logs its own line, with a request id.
        log("info", "request", {
          method: request.method,
          route: routeLabel(pathname),
          status: response.status,
          durationMs: Date.now() - started,
        });
      }
      return response;
    } catch (error) {
      // Full errors only on a developer's machine: messages can echo input.
      if (isDevelopment(env)) console.error(error);
      log("error", "request_failed", {
        method: request.method,
        route: routeLabel(pathname),
        errorName: (error as Error)?.name,
        durationMs: Date.now() - started,
      });
      return Response.json(
        { error: { code: "internal_error", message: "Something went wrong." } },
        { status: 500 },
      );
    }
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    const now = new Date().toISOString();
    await env.COMMERCE.batch([
      env.COMMERCE.prepare("DELETE FROM magic_links WHERE expires_at < ?").bind(
        now,
      ),
      env.COMMERCE.prepare(
        "DELETE FROM signin_sessions WHERE expires_at < ?",
      ).bind(now),
      env.COMMERCE.prepare(
        "DELETE FROM device_authorizations WHERE expires_at < ?",
      ).bind(now),
    ]);
    await providerFor(env).purgeExpiredData(env);
  },
} satisfies ExportedHandler<Env>;
