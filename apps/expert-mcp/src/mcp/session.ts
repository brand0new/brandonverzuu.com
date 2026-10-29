// One MCP session = one McpSession Durable Object, created in the EU
// jurisdiction (decision D11) by McpSession.serve(..., { jurisdiction: "eu" }).

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { createToolContext } from "../context";
import { GatewayError } from "../errors";
import { SKILLS } from "../generated/skills";
import { newRequestId } from "../log";
import { runPaidCheck } from "../pipeline";
import type { AuthProps } from "../types";
import { buildMcpServer } from "./server";
import type { RequestHeaders } from "./tools";

/**
 * Set by the Worker on every /mcp request from the verified bearer token, after
 * removing any value the client sent. The Durable Object has no public route,
 * so inside it this header is trustworthy.
 */
export const AUTHENTICATED_ACCOUNT_HEADER = "x-bvx-authenticated-account";

export class McpSession extends McpAgent<Env, unknown, AuthProps> {
  server: McpServer = buildMcpServer({
    env: this.env,
    skills: SKILLS,
    runPaidCheck,
    context: async (headers: RequestHeaders) => {
      // McpAgent keeps the props of the request that opened the session, so the
      // account of *this* request comes from the header. A session belongs to the
      // account that opened it: another account's token can't drive it, even
      // with a leaked session id.
      const header = headers?.[AUTHENTICATED_ACCOUNT_HEADER];
      const accountId = typeof header === "string" ? header : undefined;
      const bound = await this.ctx.storage.get<string>("accountId");
      if (!accountId || (bound && bound !== accountId)) {
        throw new GatewayError(
          "forbidden",
          "This MCP session belongs to another account.",
        );
      }
      const props: AuthProps = { accountId, via: this.props?.via ?? "oauth" };
      return createToolContext(this.env, props, newRequestId(), (p) =>
        this.ctx.waitUntil(p),
      );
    },
  });

  async init(): Promise<void> {
    const accountId = this.props?.accountId;
    if (accountId && !(await this.ctx.storage.get("accountId"))) {
      await this.ctx.storage.put("accountId", accountId);
    }
  }
}
