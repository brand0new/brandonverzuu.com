// Formatting for the expertise service's pricing data
// (content/expert/pricing.yml, the expertPricing schema in content.config.ts).
// An amount is a number or the literal "TBD", and "TBD" is printed as-is so a
// placeholder never looks like a real price.
import type { ExpertPricingCollectionItem } from "@nuxt/content";

export type ExpertCheckPrice = ExpertPricingCollectionItem["checks"][number];
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
