import { exports } from "cloudflare:workers";
import { ORIGIN } from "./helpers";

const worker = (exports as unknown as { default: Fetcher }).default;

export function call(path: string, init: RequestInit = {}): Promise<Response> {
  return worker.fetch(
    new Request(`${ORIGIN}${path}`, { redirect: "manual", ...init }),
  );
}

/** Reads the JSON-RPC message from an MCP Streamable HTTP response (JSON or SSE). */
export async function rpcMessage(
  response: Response,
): Promise<{ result?: any; error?: any }> {
  const type = response.headers.get("Content-Type") ?? "";
  if (type.includes("application/json")) return response.json();
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    const event = buffer
      .split("\n")
      .find((line) => line.startsWith("data: ") && line.includes('"jsonrpc"'));
    if (event) {
      await reader.cancel().catch(() => {});
      return JSON.parse(event.slice(6));
    }
    if (done)
      throw new Error(`No JSON-RPC message in: ${buffer.slice(0, 200)}`);
  }
}

/** A minimal MCP client over the real HTTP route. */
export async function mcpSession(token: string) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  const init = await call("/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "http-test", version: "1" },
      },
    }),
  });
  if (init.status !== 200)
    throw new Error(`initialize: ${init.status} ${await init.text()}`);
  const sessionId = init.headers.get("mcp-session-id")!;
  const initialize = await rpcMessage(init);
  const sessionHeaders = {
    ...headers,
    "mcp-session-id": sessionId,
    "mcp-protocol-version": "2025-11-25",
  };
  await call("/mcp", {
    method: "POST",
    headers: sessionHeaders,
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }),
  });
  let id = 1;
  return {
    sessionId,
    initialize,
    async request(method: string, params: unknown = {}) {
      const response = await call("/mcp", {
        method: "POST",
        headers: sessionHeaders,
        body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
      });
      const message =
        response.status === 200
          ? await rpcMessage(response)
          : { error: await response.text() };
      return { status: response.status, message };
    },
  };
}

export function setCookies(response: Response): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const header of response.headers.getSetCookie()) {
    const [pair] = header.split(";");
    const [name, ...rest] = pair!.split("=");
    cookies[name!.trim()] = rest.join("=");
  }
  return cookies;
}

export function cookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .filter(([, value]) => value !== "")
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}
