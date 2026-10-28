import { z } from "zod";
import {
  CancelSessionRequestSchema,
  CheckoutSessionCompleteRequestSchema,
  CheckoutSessionCreateRequestSchema,
  CheckoutSessionSchema,
  CheckoutSessionUpdateRequestSchema,
  CheckoutSessionWithOrderSchema,
} from "./generated/checkout.ts";
import {
  acpError,
  invalidParams,
  type AcpJsonRpcError,
  type JsonRpcError,
} from "./errors.ts";
import { MetaSchema, type Meta } from "./meta.ts";

/** Per tool: whether `id` is required, and the `payload` schema (if any). */
const toolShapes = {
  create_checkout_session: {
    id: false,
    payload: CheckoutSessionCreateRequestSchema,
    payloadRequired: true,
  },
  get_checkout_session: { id: true, payload: null, payloadRequired: false },
  update_checkout_session: {
    id: true,
    payload: CheckoutSessionUpdateRequestSchema,
    payloadRequired: true,
  },
  complete_checkout_session: {
    id: true,
    payload: CheckoutSessionCompleteRequestSchema,
    payloadRequired: true,
  },
  cancel_checkout_session: {
    id: true,
    payload: CancelSessionRequestSchema,
    payloadRequired: false,
  },
} as const;

export type CheckoutToolName = keyof typeof toolShapes;
export const checkoutToolNames = Object.keys(toolShapes) as CheckoutToolName[];

export interface CheckoutToolArguments {
  create_checkout_session: {
    meta: Meta;
    payload: z.infer<typeof CheckoutSessionCreateRequestSchema>;
  };
  get_checkout_session: { meta: Meta; id: string };
  update_checkout_session: {
    meta: Meta;
    id: string;
    payload: z.infer<typeof CheckoutSessionUpdateRequestSchema>;
  };
  complete_checkout_session: {
    meta: Meta;
    id: string;
    payload: z.infer<typeof CheckoutSessionCompleteRequestSchema>;
  };
  cancel_checkout_session: {
    meta: Meta;
    id: string;
    payload?: z.infer<typeof CancelSessionRequestSchema>;
  };
}

/** The schema each tool's successful `result` must match. */
export const checkoutToolResultSchemas = {
  create_checkout_session: CheckoutSessionSchema,
  get_checkout_session: CheckoutSessionSchema,
  update_checkout_session: CheckoutSessionSchema,
  complete_checkout_session: CheckoutSessionWithOrderSchema,
  cancel_checkout_session: CheckoutSessionSchema,
} as const;

export type ParseResult<T> =
  { ok: true; value: T } | { ok: false; error: JsonRpcError | AcpJsonRpcError };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** An RFC 9535 JSONPath for a zod issue path, e.g. `$.payload.line_items[0].id`. */
export function toJsonPath(path: readonly PropertyKey[], root = "$"): string {
  return path.reduce<string>((acc, key) => {
    if (typeof key === "number") return `${acc}[${key}]`;
    const name = String(key);
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)
      ? `${acc}.${name}`
      : `${acc}['${name.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}']`;
  }, root);
}

function payloadError(issue: z.core.$ZodIssue): AcpJsonRpcError {
  const path = [...issue.path];
  if (issue.code === "invalid_type" && issue.input === undefined) {
    const field = String(path.at(-1) ?? "payload");
    return acpError(
      "invalid_request",
      "missing_required_field",
      `Missing required field: ${field}`,
      toJsonPath(path, "$.payload"),
    );
  }
  if (issue.code === "unrecognized_keys") {
    const key = issue.keys[0] ?? "";
    return acpError(
      "invalid_request",
      "unknown_field",
      `Unknown field: ${key}`,
      toJsonPath([...path, key], "$.payload"),
    );
  }
  return acpError(
    "invalid_request",
    "invalid_field",
    issue.message,
    toJsonPath(path, "$.payload"),
  );
}

/**
 * Validates the arguments of an ACP checkout tool call.
 *
 * Envelope problems (arguments not an object, missing or invalid `meta`, `id`
 * or a required `payload`) give a `-32602` error. A `payload` that fails its
 * ACP schema gives a `-32000` ACP `invalid_request` error whose `param` is a
 * JSONPath into the arguments, e.g. `$.payload.currency`.
 */
export function parseToolArguments<N extends CheckoutToolName>(
  name: N,
  args: unknown,
): ParseResult<CheckoutToolArguments[N]> {
  const shape = Object.hasOwn(toolShapes, name) ? toolShapes[name] : undefined;
  if (!shape) {
    return { ok: false, error: invalidParams(`Unknown tool: ${String(name)}`) };
  }
  if (!isRecord(args)) {
    return { ok: false, error: invalidParams("Arguments must be an object") };
  }

  const meta = MetaSchema.safeParse(args.meta);
  if (!meta.success) {
    const issue = meta.error.issues[0];
    const where = toJsonPath(issue?.path ?? [], "$.meta");
    return {
      ok: false,
      error: invalidParams(`Invalid meta at ${where}: ${issue?.message}`),
    };
  }
  const value: Record<string, unknown> = { meta: meta.data };

  if (shape.id) {
    if (typeof args.id !== "string" || args.id === "") {
      return {
        ok: false,
        error: invalidParams("Missing or invalid argument: id"),
      };
    }
    value.id = args.id;
  }

  if (shape.payload) {
    if (args.payload === undefined) {
      if (shape.payloadRequired) {
        return {
          ok: false,
          error: invalidParams("Missing required argument: payload"),
        };
      }
    } else if (!isRecord(args.payload)) {
      return { ok: false, error: invalidParams("payload must be an object") };
    } else {
      const payload = shape.payload.safeParse(args.payload, {
        reportInput: true,
      });
      if (!payload.success) {
        return { ok: false, error: payloadError(payload.error.issues[0]!) };
      }
      value.payload = payload.data;
    }
  }

  return { ok: true, value: value as CheckoutToolArguments[N] };
}
