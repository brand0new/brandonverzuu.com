// VAT (spec 03 "VAT"). Prices exclude VAT; what's charged includes it:
// - an EU business outside the Netherlands with a validated VAT id: reverse
//   charge, no VAT;
// - everyone else (Dutch customers, and accounts without a validated VAT id):
//   Dutch VAT at 21%.
// Brandon's accountant still has to confirm these rules (D5).

import type { VatTreatment } from "../types";
import type { AccountBilling, VatStatus } from "./store";

/** EU member states by VAT prefix (Greece uses EL). */
export const EU_VAT_PREFIXES = new Set([
  "AT",
  "BE",
  "BG",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "EL",
  "ES",
  "FI",
  "FR",
  "HR",
  "HU",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
]);

export function vatTreatment(
  billing: Pick<AccountBilling, "vatStatus" | "vatCountry">,
): VatTreatment {
  return billing.vatStatus === "valid" &&
    billing.vatCountry !== null &&
    billing.vatCountry !== "NL" &&
    EU_VAT_PREFIXES.has(billing.vatCountry)
    ? "reverse_charge"
    : "nl_standard";
}

/** Normalises a VAT id: uppercase, no spaces, dots or dashes. */
export function normaliseVatId(input: string): string {
  return input.toUpperCase().replace(/[\s.\-]/g, "");
}

export interface VatValidation {
  status: Exclude<VatStatus, "none">;
  country: string | null;
}

export interface VatValidator {
  validate(vatId: string): Promise<VatValidation>;
}

/**
 * Format check only. TODO(D5): validate against VIES
 * (ec.europa.eu/taxation_customs/vies) and keep the consultation number as
 * evidence for reverse charge. Until then, outside development a well-formed
 * id stays `pending`, which is charged Dutch VAT.
 */
export class StubVatValidator implements VatValidator {
  constructor(private readonly acceptWellFormed: boolean) {}

  async validate(vatId: string): Promise<VatValidation> {
    const id = normaliseVatId(vatId);
    const country = id.slice(0, 2);
    if (!EU_VAT_PREFIXES.has(country) || !/^[A-Z]{2}[0-9A-Z+*]{2,12}$/.test(id))
      return {
        status: "invalid",
        country: EU_VAT_PREFIXES.has(country) ? country : null,
      };
    return { status: this.acceptWellFormed ? "valid" : "pending", country };
  }
}
