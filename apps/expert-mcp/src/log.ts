// Structured logs for Workers Logs. The field list is closed on purpose: logs
// carry hashes, sizes, timings and outcomes, and never artifacts, results,
// emails, tokens or account ids (spec 02 "Hardening", spec 06 EU data).

export interface LogFields {
  requestId?: string;
  route?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  kind?: string;
  tool?: string;
  /** Size of the submitted artifact in bytes. */
  artifactBytes?: number;
  /** SHA-256 of the submitted artifact, hex. */
  artifactSha256?: string;
  outcome?: string;
  errorCode?: string;
  /** Error class name only, never the message (it may echo input). */
  errorName?: string;
}

export function log(
  level: "info" | "warn" | "error",
  event: string,
  fields: LogFields = {},
): void {
  const line = JSON.stringify({ level, event, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function newRequestId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return `req_${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}
