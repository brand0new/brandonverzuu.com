// The MCP tool registry: three paid checks and the free account and help tools.
// ACP checkout tools (spec 03) are added by that spec.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
  CallToolResult,
  ServerNotification,
  ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { CHECK_INPUT_SCHEMAS } from "../artifact";
import { CHECK_PRICES } from "../config";
import { GatewayError } from "../errors";
import { log } from "../log";
import type { runPaidCheck as RunPaidCheck } from "../pipeline";
import type { CheckKind, ToolContext } from "../types";
import { sdkSchema } from "./sdk-schema";
import { findSkill, skillEntry, type BundledSkill } from "./skills";

/** Paid tools and the check each one runs. Every one goes through runPaidCheck. */
export const PAID_TOOLS = {
  check_api_governance: "api-governance",
  check_skill_design: "skill-design",
  review_process: "process-review",
} as const satisfies Record<string, CheckKind>;

/** Tools that never charge. A tool in neither list fails the entry-point test. */
export const FREE_TOOLS = [
  "get_balance",
  "get_usage",
  "get_terms",
  "get_purchase_link",
  "get_process_schema",
  "get_skill",
] as const;

type ToolExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

/** HTTP headers of the request that carried a tool call, when there was one. */
export type RequestHeaders =
  Record<string, string | string[] | undefined> | undefined;

export interface ToolDeps {
  /** Resolves the caller's context for one tool call (account, services, env). */
  context(headers: RequestHeaders): Promise<ToolContext>;
  skills: BundledSkill[];
  env: Env;
  /** Injected so tests can assert every paid tool calls it. */
  runPaidCheck: typeof RunPaidCheck;
}

const DESCRIPTIONS: Record<CheckKind, string> = {
  "api-governance":
    "Run Brandon Verzuu's API governance check on an OpenAPI 3.0 or 3.1 document. Returns findings (severity, JSONPath location, issue, fix) and a governance score band per dimension.",
  "skill-design":
    "Run Brandon Verzuu's skill design check on an Agent Skill folder (SKILL.md plus files). Returns findings by file and line and a score band per dimension.",
  "process-review":
    "Review a process description in the public Process Description format (see get_process_schema). Returns findings by element id and a score band per dimension.",
};

const findingSchema = z.object({
  id: z.string(),
  severity: z.enum(["error", "warning", "info"]),
  location: z.string(),
  message: z.string(),
  fix: z.string(),
  dimension: z.string(),
});

const paidOutputSchema = z.object({
  findings: z.array(findingSchema),
  scores: z.array(
    z.object({
      dimension: z.string(),
      band: z.enum(["A", "B", "C", "D", "E"]),
    }),
  ),
  rulePackVersion: z.string(),
  creditsCharged: z.number(),
});

function ok(structured: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(structured) }],
    structuredContent: structured,
  };
}

function toolError(
  error: unknown,
  tool: string,
  requestId?: string,
): CallToolResult {
  if (error instanceof GatewayError) {
    const hint =
      error.code === "insufficient_credits"
        ? " Use get_purchase_link to buy credits, with the user's approval."
        : "";
    return {
      isError: true,
      content: [
        { type: "text", text: `${error.code}: ${error.message}${hint}` },
      ],
    };
  }
  log("error", "tool_failed", {
    tool,
    requestId,
    errorName: (error as Error)?.name,
  });
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: `internal_error: Something went wrong${requestId ? ` (request ${requestId})` : ""}.`,
      },
    ],
  };
}

export function registerTools(mcp: McpServer, deps: ToolDeps): void {
  const { env } = deps;
  const terms = `Terms: ${env.TERMS_URL} (version ${env.TERMS_VERSION}).`;

  for (const [name, kind] of Object.entries(PAID_TOOLS) as [
    keyof typeof PAID_TOOLS,
    CheckKind,
  ][]) {
    const price = CHECK_PRICES[kind];
    mcp.registerTool(
      name,
      {
        title: name.replace(/_/g, " "),
        description: `${DESCRIPTIONS[kind]} Costs ${price} credit${price === 1 ? "" : "s"} per artifact, charged only if the check completes. Ask the user before spending credits. ${terms}`,
        inputSchema: sdkSchema(CHECK_INPUT_SCHEMAS[kind]),
        outputSchema: sdkSchema(paidOutputSchema),
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      async (args: unknown, extra: ToolExtra) => {
        let ctx: ToolContext | undefined;
        try {
          ctx = await deps.context(extra.requestInfo?.headers);
          const { result, creditsCharged } = await deps.runPaidCheck(
            ctx,
            kind,
            args,
          );
          return ok({ ...result, creditsCharged });
        } catch (error) {
          return toolError(error, name, ctx?.requestId);
        }
      },
    );
  }

  const free = <S extends z.ZodType | undefined>(
    name: (typeof FREE_TOOLS)[number],
    description: string,
    inputSchema: S,
    handler: (
      args: S extends z.ZodType ? z.infer<S> : Record<string, never>,
      context: () => Promise<ToolContext>,
    ) => Promise<Record<string, unknown>>,
  ) => {
    mcp.registerTool(
      name,
      {
        title: name.replace(/_/g, " "),
        description: `${description} Free.`,
        inputSchema: sdkSchema(inputSchema ?? z.strictObject({})),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async (args: unknown, extra: ToolExtra) => {
        try {
          return ok(
            await handler(args as never, () =>
              deps.context(extra.requestInfo?.headers),
            ),
          );
        } catch (error) {
          return toolError(error, name);
        }
      },
    );
  };

  free(
    "get_balance",
    "Return the account's credit balance.",
    undefined,
    async (_args, context) => {
      const ctx = await context();
      return { balance: await ctx.ledger.balance(ctx.account.id) };
    },
  );

  free(
    "get_usage",
    "Return the account's recent credit movements (purchases and checks), newest first.",
    z.strictObject({ limit: z.number().int().min(1).max(100).optional() }),
    async ({ limit }, context) => {
      const ctx = await context();
      return { entries: await ctx.usage.recent(ctx.account.id, limit ?? 20) };
    },
  );

  free(
    "get_terms",
    "Return the current terms version and where to read the terms and privacy statement.",
    undefined,
    async (_args, context) => {
      const ctx = await context();
      return {
        version: env.TERMS_VERSION,
        url: env.TERMS_URL,
        privacyUrl: env.PRIVACY_URL,
        acceptedVersion: ctx.account.termsVersion,
      };
    },
  );

  free(
    "get_purchase_link",
    "Create a checkout link where the user buys a credit pack in the browser. Only call this after the user agreed to buy.",
    z.strictObject({
      product_id: z.string().min(1).max(64).describe("Credit pack id."),
      quantity: z.number().int().min(1).max(10).optional(),
    }),
    async ({ product_id, quantity }, context) => {
      const ctx = await context();
      return await ctx.purchases.create(
        ctx.account.id,
        product_id,
        quantity ?? 1,
      );
    },
  );

  free(
    "get_process_schema",
    "Return where to find the JSON Schema for the Process Description format that review_process accepts.",
    undefined,
    async () => ({
      url: env.PROCESS_SCHEMA_URL,
      formats: ["json", "yaml"],
      filePatterns: ["*.process.yaml", "*.process.json"],
    }),
  );

  free(
    "get_skill",
    "Return one of this server's public skills (how to prepare input for a check and read its result), for clients without the MCP Skills extension. Without arguments, lists the skills.",
    z.strictObject({
      name: z
        .string()
        .max(200)
        .optional()
        .describe("Skill name, e.g. api-governance-check."),
      file: z
        .string()
        .max(512)
        .optional()
        .describe("A file inside the skill; defaults to SKILL.md."),
    }),
    async ({ name, file }) => {
      if (!name) {
        return {
          skills: deps.skills.map((s) => ({
            name: s.frontmatter.name,
            description: s.frontmatter.description,
          })),
        };
      }
      const skill = findSkill(deps.skills, name);
      if (!skill)
        throw new GatewayError(
          "not_found",
          `No skill named ${name}. Call get_skill without arguments to list them.`,
        );
      const entry = skill.files.find((f) => f.path === (file ?? "SKILL.md"));
      if (!entry || entry.text === undefined) {
        throw new GatewayError(
          "not_found",
          `The skill ${name} has no text file ${file ?? "SKILL.md"}.`,
        );
      }
      return { ...skillEntry(skill), file: entry.path, content: entry.text };
    },
  );
}
