// REST surface for the CLI and CI (/v1/*). Requests arrive here only with a
// verified bearer token (OAuth access token or API token); `ctx.props` says whose.

import { z } from "zod";
import { createApiToken, revokeApiToken } from "./accounts";
import { createToolContext } from "./context";
import { sha256Hex } from "./crypto";
import { GatewayError } from "./errors";
import { log, newRequestId } from "./log";
import { runPaidCheck as defaultRunPaidCheck } from "./pipeline";
import { getServices } from "./services";
import { isCheckKind, type AuthProps, type ToolContext } from "./types";

/** Largest JSON body accepted on /v1 and /mcp, before any parsing. */
export const MAX_BODY_BYTES = 4 * 1024 * 1024;

const IDEMPOTENCY_KEY = /^[\x21-\x7e]{1,255}$/;

const purchaseLinkBody = z.strictObject({
  product_id: z.string().min(1).max(64),
  quantity: z.number().int().min(1).max(10).optional(),
});
const tokenBody = z.strictObject({ label: z.string().max(100).optional() });

interface RestDeps {
  runPaidCheck: typeof defaultRunPaidCheck;
}

function json(
  body: unknown,
  status: number,
  requestId: string,
  extra: Record<string, string> = {},
): Response {
  return Response.json(body, {
    status,
    headers: {
      "X-Request-Id": requestId,
      "Cache-Control": "no-store",
      ...extra,
    },
  });
}

function errorResponse(error: unknown, requestId: string): Response {
  if (error instanceof GatewayError) {
    const headers: Record<string, string> = {};
    if (error.retryAfterSeconds !== undefined)
      headers["Retry-After"] = String(error.retryAfterSeconds);
    return json(
      { error: error.toJSON(), request_id: requestId },
      error.status,
      requestId,
      headers,
    );
  }
  log("error", "rest_failed", { requestId, errorName: (error as Error)?.name });
  return json(
    {
      error: { code: "internal_error", message: "Something went wrong." },
      request_id: requestId,
    },
    500,
    requestId,
  );
}

/** Reads a body as text, refusing more than `max` bytes even without Content-Length. */
export async function readBodyText(
  request: Request,
  max = MAX_BODY_BYTES,
): Promise<string> {
  const declared = Number(request.headers.get("Content-Length") ?? "0");
  if (declared > max)
    throw new GatewayError(
      "artifact_too_large",
      `The request body exceeds ${max} bytes.`,
    );
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      throw new GatewayError(
        "artifact_too_large",
        `The request body exceeds ${max} bytes.`,
      );
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new GatewayError("invalid_request", "The request body must be JSON.");
  }
}

export function createRestHandler(
  deps: RestDeps = { runPaidCheck: defaultRunPaidCheck },
) {
  return {
    async fetch(
      request: Request,
      env: Env,
      ctx: ExecutionContext,
    ): Promise<Response> {
      const requestId = newRequestId();
      const started = Date.now();
      const url = new URL(request.url);
      const route = url.pathname;
      let status = 500;
      try {
        const response = await route_(request, env, ctx, url, requestId, deps);
        status = response.status;
        return response;
      } catch (error) {
        const response = errorResponse(error, requestId);
        status = response.status;
        return response;
      } finally {
        log("info", "rest_request", {
          requestId,
          method: request.method,
          route: route.startsWith("/v1/tokens/") ? "/v1/tokens/{id}" : route,
          status,
          durationMs: Date.now() - started,
        });
      }
    },
  };
}

async function route_(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  url: URL,
  requestId: string,
  deps: RestDeps,
): Promise<Response> {
  const path = url.pathname;
  const method = request.method;
  const context = (): Promise<ToolContext> =>
    createToolContext(env, ctx.props as AuthProps | undefined, requestId, (p) =>
      ctx.waitUntil(p),
    );

  const check = /^\/v1\/checks\/([a-z-]+)$/.exec(path);
  if (check && method === "POST") {
    const kind = check[1]!;
    if (!isCheckKind(kind))
      throw new GatewayError("not_found", `Unknown check kind: ${kind}`);
    const key = request.headers.get("Idempotency-Key");
    if (!key || !IDEMPOTENCY_KEY.test(key)) {
      throw new GatewayError(
        "invalid_request",
        "An Idempotency-Key header (1–255 visible ASCII characters) is required.",
      );
    }
    const text = await readBodyText(request);
    const body = parseJson(text);
    const tool = await context();
    const { idempotency } = getServices(env);
    const scope = `checks/${kind}`;
    const requestHash = await sha256Hex(text);
    const previous = await idempotency.get(tool.account.id, scope, key);
    if (previous) {
      if (previous.requestHash !== requestHash) {
        throw new GatewayError(
          "request_not_idempotent",
          "This Idempotency-Key was used with a different request.",
        );
      }
      return new Response(previous.response, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": requestId,
          "Idempotent-Replayed": "true",
        },
      });
    }
    const { result, creditsCharged } = await deps.runPaidCheck(
      tool,
      kind,
      body,
    );
    const responseBody = JSON.stringify({
      ...result,
      creditsCharged,
      request_id: requestId,
    });
    await idempotency.put(
      tool.account.id,
      scope,
      key,
      requestHash,
      responseBody,
    );
    return new Response(responseBody, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": requestId,
        "Cache-Control": "no-store",
      },
    });
  }

  if (path === "/v1/account" && method === "GET") {
    const tool = await context();
    return json(
      {
        id: tool.account.id,
        status: tool.account.status,
        terms_version: tool.account.termsVersion,
        current_terms_version: env.TERMS_VERSION,
        balance: await tool.ledger.balance(tool.account.id),
      },
      200,
      requestId,
    );
  }

  if (path === "/v1/purchase-links" && method === "POST") {
    const parsed = purchaseLinkBody.safeParse(
      parseJson(await readBodyText(request)),
    );
    if (!parsed.success)
      throw new GatewayError("invalid_request", z.prettifyError(parsed.error));
    const tool = await context();
    const link = await tool.purchases.create(
      tool.account.id,
      parsed.data.product_id,
      parsed.data.quantity ?? 1,
    );
    return json(link, 201, requestId);
  }

  if (path === "/v1/tokens" && method === "POST") {
    const text = await readBodyText(request);
    const parsed = tokenBody.safeParse(text ? parseJson(text) : {});
    if (!parsed.success)
      throw new GatewayError("invalid_request", z.prettifyError(parsed.error));
    const tool = await context();
    const { token, summary } = await createApiToken(
      env,
      tool.account.id,
      parsed.data.label ?? null,
    );
    // The token is shown exactly once; only its hash is stored.
    return json({ ...summary, token }, 201, requestId);
  }

  const tokenPath = /^\/v1\/tokens\/(tok_[0-9A-Z]{26})$/.exec(path);
  if (tokenPath && method === "DELETE") {
    const tool = await context();
    const revoked = await revokeApiToken(env, tool.account.id, tokenPath[1]!);
    if (!revoked) throw new GatewayError("not_found", "No such token.");
    return new Response(null, {
      status: 204,
      headers: { "X-Request-Id": requestId },
    });
  }

  throw new GatewayError("not_found", "Not found.");
}
