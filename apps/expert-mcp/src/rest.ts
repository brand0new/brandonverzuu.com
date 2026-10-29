// REST surface for the CLI and CI (/v1/*). Requests arrive here only with a
// verified bearer token (OAuth access token or API token); `ctx.props` says whose.

import { z } from "zod";
import { createApiToken, revokeApiToken } from "./accounts";
import { createToolContext } from "./context";
import { sha256Hex } from "./crypto";
import { GatewayError, PaymentRequired } from "./errors";
import { log, newRequestId } from "./log";
import {
  accountSummary,
  bindWallet,
  updateVat,
  walletChallenge,
} from "./payments/account";
import { listPrices, removePayer } from "./payments/store";
import {
  isPeriod,
  listStatements,
  statementCsv,
  statementFor,
} from "./statements";
import {
  challengeBody,
  challengeHeaders,
  proofFromHeaders,
  receiptHeaders,
} from "./payments/transport";
import { runPaidCheck as defaultRunPaidCheck } from "./pipeline";
import { getServices } from "./services";
import { isCheckKind, type AuthProps, type ToolContext } from "./types";

/** Largest JSON body accepted on /v1 and /mcp, before any parsing. */
export const MAX_BODY_BYTES = 4 * 1024 * 1024;

const IDEMPOTENCY_KEY = /^[\x21-\x7e]{1,255}$/;

const tokenBody = z.strictObject({ label: z.string().max(100).optional() });
const walletBody = z.union([
  z.strictObject({ address: z.string().regex(/^0x[0-9a-fA-F]{40}$/) }),
  z.strictObject({
    message: z.string().min(1).max(2000),
    signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
  }),
]);
const vatBody = z.strictObject({ vat_id: z.string().max(20).nullable() });

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
  if (error instanceof PaymentRequired) {
    const headers = challengeHeaders(error.challenge);
    headers.set("Content-Type", "application/problem+json");
    headers.set("X-Request-Id", requestId);
    return new Response(JSON.stringify(challengeBody(error, requestId)), {
      status: 402,
      headers,
    });
  }
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
          route: route.startsWith("/v1/tokens/")
            ? "/v1/tokens/{id}"
            : route.startsWith("/v1/wallets/")
              ? "/v1/wallets/{id}"
              : route.startsWith("/v1/statements/")
                ? "/v1/statements/{period}"
                : route,
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
    const proof = proofFromHeaders(request.headers);
    const tool = await context();
    const { idempotency } = getServices(env);
    const scope = `checks/${kind}`;
    const bodyHash = await sha256Hex(text);
    const previous = await idempotency.get(tool.account.id, scope, key);
    if (previous) {
      if (previous.bodyHash !== bodyHash) {
        throw new GatewayError(
          "request_not_idempotent",
          "This Idempotency-Key was used with a different request.",
        );
      }
      // Replays charge nothing: the payment attached to the replay is ignored.
      return new Response(previous.response, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": requestId,
          "Idempotent-Replayed": "true",
        },
      });
    }
    const { result, price, receipt } = await deps.runPaidCheck(
      tool,
      kind,
      body,
      { resource: `${env.PUBLIC_ORIGIN}${path}`, proof },
    );
    const responseBody = JSON.stringify({
      ...result,
      price,
      payment: { rail: receipt.rail, id: receipt.paymentId },
      request_id: requestId,
    });
    await idempotency.put(tool.account.id, scope, key, bodyHash, responseBody);
    return new Response(responseBody, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": requestId,
        "Cache-Control": "no-store",
        ...receiptHeaders(receipt),
      },
    });
  }

  if (path === "/v1/account" && method === "GET") {
    const tool = await context();
    return json(
      {
        ...(await accountSummary(env, tool.account)),
        terms_version: tool.account.termsVersion,
        current_terms_version: env.TERMS_VERSION,
      },
      200,
      requestId,
    );
  }

  if (path === "/v1/account/vat" && method === "PUT") {
    const parsed = vatBody.safeParse(parseJson(await readBodyText(request)));
    if (!parsed.success)
      throw new GatewayError("invalid_request", z.prettifyError(parsed.error));
    const tool = await context();
    return json(
      await updateVat(env, tool.account, parsed.data.vat_id),
      200,
      requestId,
    );
  }

  if (path === "/v1/prices" && method === "GET") {
    await context();
    return json(
      {
        currency: "EUR",
        vat: "excluded",
        prices: (await listPrices(env))
          .filter((row) => row.active)
          .map((row) => ({
            kind: row.kind,
            amount: row.baseAmount,
            ...(row.stepOps
              ? {
                  included_operations: row.stepOps,
                  step_operations: row.stepOps,
                  step_amount: row.stepAmount,
                }
              : {}),
          })),
      },
      200,
      requestId,
    );
  }

  if (path === "/v1/wallets" && method === "POST") {
    const parsed = walletBody.safeParse(parseJson(await readBodyText(request)));
    if (!parsed.success)
      throw new GatewayError("invalid_request", z.prettifyError(parsed.error));
    const tool = await context();
    if ("address" in parsed.data)
      return json(
        await walletChallenge(env, tool.account, parsed.data.address),
        200,
        requestId,
      );
    const { payer, created } = await bindWallet(
      env,
      tool.account,
      parsed.data.message,
      parsed.data.signature,
    );
    return json(
      {
        id: payer.id,
        rail: payer.rail,
        address: payer.ref,
        bound_at: payer.boundAt,
      },
      created ? 201 : 200,
      requestId,
    );
  }

  const walletPath = /^\/v1\/wallets\/(payer_[0-9A-Z]{26})$/.exec(path);
  if (walletPath && method === "DELETE") {
    const tool = await context();
    if (!(await removePayer(env, tool.account.id, walletPath[1]!)))
      throw new GatewayError("not_found", "No such wallet.");
    return new Response(null, {
      status: 204,
      headers: { "X-Request-Id": requestId },
    });
  }

  if (path === "/v1/statements" && method === "GET") {
    const tool = await context();
    return json(await listStatements(env, tool.account.id), 200, requestId);
  }

  const statementPath = /^\/v1\/statements\/(\d{4}-\d{2})(\.csv)?$/.exec(path);
  if (statementPath && method === "GET" && isPeriod(statementPath[1]!)) {
    const tool = await context();
    const statement = await statementFor(
      env,
      tool.account.id,
      statementPath[1]!,
    );
    if (statementPath[2])
      return new Response(statementCsv(statement.lines), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="statement-${statement.period}.csv"`,
          "Cache-Control": "no-store",
          "X-Request-Id": requestId,
        },
      });
    return json(statement, 200, requestId);
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
