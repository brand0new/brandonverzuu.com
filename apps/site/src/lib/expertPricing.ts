// Formatting for the expertise service's pricing data
// (content/expert/pricing.yml, the expertPricing schema in src/content.config.ts).
// An amount is a number or the literal "TBD", and "TBD" is printed as-is so a
// placeholder never looks like a real price.
import type { CollectionEntry } from "astro:content";

export type ExpertCheckPrice = CollectionEntry<"expertPricing">["data"]["checks"][number];
export type CheckKind = ExpertCheckPrice["kind"];
export type Amount = number | "TBD";

export function formatPrice(price: Amount, currency: string): string {
  if (price === "TBD") return "TBD";
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    // Whole-euro prices read as "€10", not "€10.00".
    minimumFractionDigits: Number.isInteger(price) ? 0 : 2,
  }).format(price);
}
