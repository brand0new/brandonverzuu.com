// Prices per check (decision D6) and VAT (spec 03 "VAT"). Pure functions: the
// payment gate reads the price row and the account's VAT status and calls these.

import { NL_VAT_RATE_BP, type PriceRow } from "./config";
import { GatewayError } from "./errors";
import type { Artifact, Price, VatTreatment } from "./types";

const HTTP_METHODS = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function countIn(container: unknown): number {
  if (!isObject(container)) return 0;
  let count = 0;
  for (const item of Object.values(container)) {
    if (!isObject(item)) continue;
    for (const method of HTTP_METHODS) if (isObject(item[method])) count++;
  }
  return count;
}

/**
 * Operations in a parsed OpenAPI document: every HTTP method under `paths`,
 * plus `webhooks` (OpenAPI 3.1). Path items behind a `$ref` count only once
 * spec 04's resolver inlines them; until then they count as zero.
 */
export function countOperations(document: unknown): number {
  if (!isObject(document)) return 0;
  return countIn(document.paths) + countIn(document.webhooks);
}

/** Net price in EUR minor units for one artifact, before VAT. */
export function netAmount(
  row: PriceRow,
  artifact: Artifact,
): { net: number; operations?: number } {
  if (!row.active)
    throw new GatewayError(
      "checks_disabled",
      "This check isn't on sale right now. Nothing was charged.",
    );
  if (artifact.kind !== "api-governance" || !row.stepOps || !row.stepAmount)
    return { net: row.baseAmount };
  const operations = countOperations(artifact.document);
  const steps = Math.ceil(Math.max(0, operations - row.stepOps) / row.stepOps);
  return { net: row.baseAmount + steps * row.stepAmount, operations };
}

/** VAT in minor units, rounded half up. */
export function vatAmount(net: number, rateBp: number): number {
  return Math.floor((net * rateBp + 5000) / 10000);
}

export function priceFor(
  row: PriceRow,
  artifact: Artifact,
  treatment: VatTreatment,
): Price {
  const { net, operations } = netAmount(row, artifact);
  const vatRateBp = treatment === "reverse_charge" ? 0 : NL_VAT_RATE_BP;
  const vat = vatAmount(net, vatRateBp);
  return {
    kind: row.kind,
    currency: "EUR",
    net,
    vat,
    total: net + vat,
    vatTreatment: treatment,
    vatRateBp,
    ...(operations !== undefined ? { operations } : {}),
  };
}

/** "EUR 10.00" */
export function formatEur(minor: number): string {
  return `EUR ${(minor / 100).toFixed(2)}`;
}
