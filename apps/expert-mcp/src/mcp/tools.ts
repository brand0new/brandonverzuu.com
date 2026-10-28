// The MCP tool registry: three paid checks and the free account and help tools.
// Paid tools follow the x402 MCP transport (spec 03): without a payment they
// return the payment requirements as an error result; the retry carries the
// payment in `_meta`.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
  CallToolResult,
  ServerNotification,
  ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { CHECK_INPUT_SCHEMAS, parseArtifact } from "../artifact";
import { DEFAULT_PRICES } from "../config";
import { GatewayError, PaymentRequired } from "../errors";
import { log } from "../log";
import {
  paymentRequiredToolResult,
  proofFromMcpMeta,
  receiptMeta,
} from "../payments/transport";
import { formatEur } from "../pricing";
import type { runPaidCheck as RunPaidCheck } from "../pipeline";
import { CHECK_KINDS, type CheckKind, type ToolContext } from "../types";
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
  "get_account",
  "get_prices",
  "quote_check",
  "bind_wallet",
  "get_terms",
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

const priceSchema = z.object({
  kind: z.string(),
  currency: z.literal("EUR"),
  net: z.number(),
  vat: z.number(),
  total: z.number(),
  vatTreatment: z.enum(["reverse_charge", "nl_standard"]),
  vatRateBp: z.number(),
  operations: z.number().optional(),
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
  price: priceSchema,
  payment: z.object({ rail: z.enum(["x402", "mpp"]), id: z.string() }),
});

/** "EUR 10 excl. VAT (+EUR 5 per further 50 operations over 50)" */
function priceText(kind: CheckKind): string {
  const row = DEFAULT_PRICES[kind];
  const step =
    row.stepOps && row.stepAmount
      ? ` for up to ${row.stepOps} operations, +${formatEur(row.stepAmount)} per further ${row.stepOps}`
      : "";
  return `${formatEur(row.baseAmount)} excl. VAT${step}`;
}

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
  if (error instanceof PaymentRequired) return paymentRequiredToolResult(error);
  if (error instanceof GatewayError) {
    const hint =
      error.code === "payer_not_bound"
        ? " Bind the wallet to this account first (bind_wallet), with the user's approval."
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
    mcp.registerTool(
      name,
      {
        title: name.replace(/_/g, " "),
        description: `${DESCRIPTIONS[kind]} This is expert review, paid per artifact: ${priceText(kind)}, plus Dutch VAT unless reverse charge applies. Paid over x402 (EURC or USDC on Base) or MPP (card, via Stripe); without a payment it returns the payment requirements and runs nothing. The payment is only collected if the check completes. Ask the user before paying. ${terms}`,
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
          const proof = proofFromMcpMeta(
            extra._meta as Record<string, unknown> | undefined,
          );
          const { result, price, receipt } = await deps.runPaidCheck(
            ctx,
            kind,
            args,
            { resource: `mcp://tool/${name}`, proof },
          );
          return {
            ...ok({
              ...result,
              price,
              payment: { rail: receipt.rail, id: receipt.paymentId },
            }),
            _meta: receiptMeta(receipt),
          };
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
    "get_account",
    "Return the account: status, bound payers (wallets and cards), month-to-date spend and spending ceiling.",
    undefined,
    async (_args, context) => {
      const ctx = await context();
      // TODO(spec 03, step 2): payers, month-to-date spend and the ceiling.
      return {
        id: ctx.account.id,
        status: ctx.account.status,
        payers: [],
        monthToDate: null,
        spendingCeiling: null,
      };
    },
  );

  free(
    "get_prices",
    "Return the price of each check in EUR, excluding VAT.",
    undefined,
    async () => ({
      currency: "EUR",
      vat: "excluded",
      prices: CHECK_KINDS.map((kind) => ({ kind, price: priceText(kind) })),
    }),
  );

  free(
    "quote_check",
    "Return what a check would cost for this artifact, including VAT for this account. Nothing is charged and nothing runs.",
    z.strictObject({
      kind: z.enum(CHECK_KINDS),
      input: z
        .record(z.string(), z.unknown())
        .describe("The same arguments the paid check tool takes."),
    }),
    async ({ kind, input }, context) => {
      const ctx = await context();
      const parsed = await parseArtifact(kind, input);
      return {
        price: await ctx.payments.quote(kind, parsed, ctx.account),
      };
    },
  );

  free(
    "bind_wallet",
    "Return the message a wallet must sign (EIP-191) to be bound to this account, so it can pay for checks. Submit the signature with POST /v1/wallets.",
    z.strictObject({
      address: z
        .string()
        .regex(/^0x[0-9a-fA-F]{40}$/)
        .describe("The wallet address to bind."),
    }),
    async (_args, context) => {
      await context();
      // TODO(spec 03, step 2): the signed-challenge message.
      throw new GatewayError(
        "not_implemented",
        "Wallet binding isn't available yet (spec 03, payments).",
      );
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
