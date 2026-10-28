import { describe, expect, it } from "vitest";
import {
  ErrorSchema,
  MetaSchema,
  acpError,
  checkoutToolNames,
  checkoutToolResultSchemas,
  invalidParams,
  mcpTools,
  parseToolArguments,
  toJsonPath,
  type CheckoutToolName,
} from "../src/index.ts";
import { loadExamples, loadSpec } from "./fixtures.ts";

const openrpc = loadSpec("openrpc/openrpc.agentic_checkout.json") as {
  methods: { name: string; params: { name: string; required: boolean }[] }[];
  components: { schemas: { meta: { properties: Record<string, unknown> } } };
};
const mcpExamples = loadExamples(
  "examples.mcp.agentic_checkout.json",
) as Record<
  string,
  {
    params?: { name: CheckoutToolName; arguments: Record<string, unknown> };
    result?: unknown;
    error?: {
      code: number;
      message: string;
      data: { type: string; code: string; message: string; param?: string };
    };
  }
>;

function findRefs(node: unknown, path = "$"): string[] {
  if (Array.isArray(node))
    return node.flatMap((n, i) => findRefs(n, `${path}[${i}]`));
  if (!node || typeof node !== "object") return [];
  return Object.entries(node).flatMap(([key, value]) =>
    key === "$ref" ? [path] : findRefs(value, `${path}.${key}`),
  );
}

describe("mcpTools", () => {
  it("defines the five checkout tools from the OpenRPC document", () => {
    expect(mcpTools.map((t) => t.name)).toEqual(
      openrpc.methods.map((m) => m.name),
    );
    expect(mcpTools.map((t) => t.name)).toEqual(checkoutToolNames);
  });

  it("contains no $ref", () => {
    expect(findRefs(mcpTools)).toEqual([]);
  });

  it.each(openrpc.methods)("$name takes the binding's arguments", (method) => {
    const tool = mcpTools.find((t) => t.name === method.name)!;
    expect(tool.inputSchema.type).toBe("object");
    expect(Object.keys(tool.inputSchema.properties as object)).toEqual(
      method.params.map((p) => p.name),
    );
    expect(tool.inputSchema.required).toEqual(
      method.params.filter((p) => p.required).map((p) => p.name),
    );
  });

  it("inlines domain schemas, e.g. the create payload", () => {
    const create = mcpTools[0]!.inputSchema.properties as Record<
      string,
      { required?: string[]; properties?: Record<string, unknown> }
    >;
    expect(create.payload!.required).toEqual(
      expect.arrayContaining(["currency", "line_items", "capabilities"]),
    );
    expect(create.meta!.required).toEqual(["api_version"]);
  });
});

describe("MetaSchema", () => {
  it("has the fields of the OpenRPC meta object", () => {
    expect(Object.keys(MetaSchema.shape).sort()).toEqual(
      Object.keys(openrpc.components.schemas.meta.properties).sort(),
    );
  });

  it("requires api_version and ignores unknown fields", () => {
    expect(MetaSchema.safeParse({}).success).toBe(false);
    expect(
      MetaSchema.parse({ api_version: "2026-04-17", future_header: "x" }),
    ).toEqual({ api_version: "2026-04-17" });
  });
});

/**
 * Upstream MCP examples that don't match the upstream schemas (ajv agrees).
 * Pinned so the test fails, and the entry can go, once upstream fixes them.
 * Paths are relative to the payload or the result.
 */
const knownInvalid: Record<string, string[]> = {
  // selected_fulfillment_options[0] uses an older shape (no option_id/item_ids).
  update_checkout_session_request: [
    "selected_fulfillment_options[0].option_id",
    "selected_fulfillment_options[0].item_ids",
    "selected_fulfillment_options[0]",
  ],
  // payment_data.instrument lacks the required type and credential.
  complete_checkout_session_request: [
    "payment_data.instrument.type",
    "payment_data.instrument.credential",
  ],
  // links[0].type is not in the Link type enum.
  create_checkout_session_response: ["links[0].type"],
  // fulfillment_options is required but missing.
  get_checkout_session_response: ["fulfillment_options"],
  update_checkout_session_response: ["fulfillment_options"],
  complete_checkout_session_response: ["fulfillment_options"],
  cancel_checkout_session_response: ["fulfillment_options"],
};

describe("upstream MCP examples", () => {
  const requests = Object.entries(mcpExamples).filter(([, ex]) => ex.params);
  const responses = Object.entries(mcpExamples).filter(([, ex]) => ex.result);
  const errors = Object.entries(mcpExamples).filter(([, ex]) => ex.error);

  it("has one request and one response per tool, plus errors", () => {
    expect(requests.length).toBe(5);
    expect(responses.length).toBe(5);
    expect(errors.length).toBe(2);
  });

  for (const [key, ex] of requests) {
    const known = knownInvalid[key];
    it(`${known ? "rejects" : "accepts"} the arguments of ${key}`, () => {
      const parsed = parseToolArguments(ex.params!.name, ex.params!.arguments);
      if (!known) {
        expect(parsed).toEqual({ ok: true, value: ex.params!.arguments });
        return;
      }
      // Only the first issue is reported, as an ACP invalid_request.
      expect(parsed.ok).toBe(false);
      if (parsed.ok) return;
      expect(parsed.error.code).toBe(-32000);
      const param = (parsed.error.data as { param: string }).param;
      expect(known).toContain(param.replace("$.payload.", ""));
    });
  }

  for (const [key, ex] of responses) {
    const tool = key.replace(/_response$/, "") as CheckoutToolName;
    const known = knownInvalid[key] ?? [];
    it(`parses the result of ${key}`, () => {
      const result = checkoutToolResultSchemas[tool].safeParse(ex.result);
      const paths = (result.error?.issues ?? []).map((i) =>
        toJsonPath(i.path, "").slice(1),
      );
      expect(paths.sort()).toEqual([...known].sort());
    });
  }

  it.each(errors)("reproduces %s with acpError", (_, ex) => {
    const { data, message } = ex.error!;
    expect(ErrorSchema.safeParse(data).success).toBe(true);
    const error = acpError(
      data.type as never,
      data.code,
      data.message,
      data.param,
      {
        rpcMessage: message,
      },
    );
    expect(error).toEqual(ex.error);
  });

  it("produces error_invalid_request for a payload without currency", () => {
    const { payload, ...rest } = mcpExamples.create_checkout_session_request!
      .params!.arguments as { payload: Record<string, unknown> };
    const { currency: _, ...withoutCurrency } = payload;
    const parsed = parseToolArguments("create_checkout_session", {
      ...rest,
      payload: withoutCurrency,
    });
    expect(parsed).toEqual({
      ok: false,
      error: mcpExamples.error_invalid_request!.error,
    });
  });
});

describe("parseToolArguments envelope errors", () => {
  const meta = { api_version: "2026-04-17" };

  it.each([
    ["non-object arguments", "get_checkout_session", "nope"],
    ["missing meta", "get_checkout_session", { id: "cs_1" }],
    [
      "meta without api_version",
      "get_checkout_session",
      { meta: {}, id: "cs_1" },
    ],
    ["missing id", "get_checkout_session", { meta }],
    ["non-string id", "update_checkout_session", { meta, id: 1, payload: {} }],
    ["missing required payload", "create_checkout_session", { meta }],
    [
      "non-object payload",
      "complete_checkout_session",
      { meta, id: "cs_1", payload: [] },
    ],
  ] as const)("%s gives -32602", (_, name, args) => {
    const parsed = parseToolArguments(name, args);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error.code).toBe(-32602);
  });

  it("rejects unknown tool names with -32602", () => {
    const parsed = parseToolArguments("constructor" as CheckoutToolName, {
      meta,
    });
    expect(parsed).toEqual({
      ok: false,
      error: invalidParams("Unknown tool: constructor"),
    });
  });

  it("allows cancel without payload (and does not require null)", () => {
    expect(
      parseToolArguments("cancel_checkout_session", { meta, id: "cs_1" }),
    ).toEqual({
      ok: true,
      value: { meta, id: "cs_1" },
    });
  });

  it("reports unknown payload fields as an ACP error with a JSONPath", () => {
    const parsed = parseToolArguments("update_checkout_session", {
      meta,
      id: "cs_1",
      payload: { nope: true },
    });
    expect(parsed).toEqual({
      ok: false,
      error: acpError(
        "invalid_request",
        "unknown_field",
        "Unknown field: nope",
        "$.payload.nope",
      ),
    });
  });

  it("builds -32602 errors with optional data", () => {
    expect(invalidParams("bad")).toEqual({ code: -32602, message: "bad" });
    expect(invalidParams("bad", { x: 1 })).toEqual({
      code: -32602,
      message: "bad",
      data: { x: 1 },
    });
  });
});
