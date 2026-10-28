import type { Error as AcpError } from "./generated/checkout.ts";

/** JSON-RPC code for every ACP error; the meaning is in `data.type` and `data.code`. */
export const ACP_ERROR_CODE = -32000;
/** JSON-RPC code for malformed tool arguments (the `{ meta, id, payload }` envelope). */
export const INVALID_PARAMS_CODE = -32602;

export interface JsonRpcError<D = unknown> {
  code: number;
  message: string;
  data?: D;
}

export type AcpJsonRpcError = JsonRpcError<AcpError> & {
  code: typeof ACP_ERROR_CODE;
  data: AcpError;
};

export interface AcpErrorOptions {
  /** Top-level JSON-RPC `message`, when it should differ from the ACP message. */
  rpcMessage?: string;
  /** Versions the server accepts; only for version-related errors. */
  supportedVersions?: string[];
}

/**
 * An ACP `Error` wrapped as a JSON-RPC error, as the MCP binding requires:
 * code `-32000`, the ACP `Error` in `data`.
 */
export function acpError(
  type: AcpError["type"],
  code: string,
  message: string,
  param?: string,
  options: AcpErrorOptions = {},
): AcpJsonRpcError {
  const data: AcpError = { type, code, message };
  if (param !== undefined) data.param = param;
  if (options.supportedVersions)
    data.supported_versions = options.supportedVersions;
  return { code: ACP_ERROR_CODE, message: options.rpcMessage ?? message, data };
}

/** A JSON-RPC `-32602 Invalid params` error for a malformed tool envelope. */
export function invalidParams(
  message: string,
  data?: unknown,
): JsonRpcError & { code: typeof INVALID_PARAMS_CODE } {
  return data === undefined
    ? { code: INVALID_PARAMS_CODE, message }
    : { code: INVALID_PARAMS_CODE, message, data };
}
