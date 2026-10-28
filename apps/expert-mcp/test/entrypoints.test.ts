// Every paid entry point goes through runPaidCheck (spec 02 "Pipeline").
//
// MCP: every registered tool must be either paid (PAID_TOOLS) or free
// (FREE_TOOLS). Each paid tool must call runPaidCheck exactly once with its
// kind; no free tool may call it. A new tool in neither list fails here.
// REST: every check kind's route must call runPaidCheck.

import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createApiToken } from "../src/accounts";
import { FREE_TOOLS, PAID_TOOLS } from "../src/mcp/tools";
import { createRestHandler } from "../src/rest";
import { CHECK_KINDS, type AuthProps } from "../src/types";
import {
  connectMcp,
  createAccount,
  makeContext,
  ORIGIN,
  spyRunPaidCheck,
  VALID_INPUTS,
} from "./helpers";

const FREE_ARGS: Record<
  (typeof FREE_TOOLS)[number],
  Record<string, unknown>
> = {
  get_balance: {},
  get_usage: {},
  get_terms: {},
  get_purchase_link: { product_id: "pack_10" },
  get_process_schema: {},
  get_skill: {},
};

describe("every paid entry point goes through runPaidCheck", () => {
  it("covers every MCP tool", async () => {
    const account = await createAccount();
    const spy = spyRunPaidCheck();
    const { client } = await connectMcp({
      context: async () => makeContext(account).ctx,
      runPaidCheck: spy,
    });
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([...Object.keys(PAID_TOOLS), ...FREE_TOOLS].sort());

    for (const [name, kind] of Object.entries(PAID_TOOLS)) {
      spy.mockClear();
      const result = await client.callTool({
        name,
        arguments: VALID_INPUTS[kind],
      });
      expect(result.isError, name).toBeFalsy();
      expect(spy, name).toHaveBeenCalledOnce();
      expect(spy.mock.calls[0]![1], name).toBe(kind);
    }

    spy.mockClear();
    for (const name of FREE_TOOLS) {
      const result = await client.callTool({
        name,
        arguments: FREE_ARGS[name],
      });
      expect(result.isError, name).toBeFalsy();
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("covers every REST check route", async () => {
    const account = await createAccount();
    const spy = spyRunPaidCheck();
    const handler = createRestHandler({ runPaidCheck: spy });
    const props: AuthProps = { accountId: account.id, via: "api_token" };
    const ctx = {
      props,
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as unknown as ExecutionContext;

    for (const kind of CHECK_KINDS) {
      spy.mockClear();
      const response = await handler.fetch(
        new Request(`${ORIGIN}/v1/checks/${kind}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify(VALID_INPUTS[kind]),
        }),
        env,
        ctx,
      );
      expect(response.status, kind).toBe(200);
      expect(spy, kind).toHaveBeenCalledOnce();
      expect(spy.mock.calls[0]![1], kind).toBe(kind);
    }
    // The token is unused here: the handler trusts ctx.props, as OAuthProvider sets them.
    await createApiToken(env, account.id, null);
  });
});
