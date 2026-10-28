import { z } from "zod";

/** The ACP API version this package implements. */
export const ACP_API_VERSION = "2026-04-17";

/**
 * The `meta` tool argument from the MCP binding: protocol metadata that REST
 * carries in HTTP headers. `api_version` is required; unknown fields are
 * accepted and stripped, as the binding asks servers to ignore them.
 */
export const MetaSchema = z.object({
  /** Maps to the `API-Version` header, e.g. "2026-04-17". */
  api_version: z.string(),
  /** Maps to `Idempotency-Key`. Recommended for create and complete. */
  idempotency_key: z.string().optional(),
  /** Maps to `Request-Id`. */
  request_id: z.string().optional(),
  /** Maps to `User-Agent`. */
  user_agent: z.string().optional(),
  /** Maps to `Accept-Language`. */
  accept_language: z.string().optional(),
  /** Maps to `Signature`. */
  signature: z.string().optional(),
  /** Maps to `Timestamp` (RFC 3339). */
  timestamp: z.iso.datetime({ offset: true }).optional(),
});
export type Meta = z.infer<typeof MetaSchema>;
