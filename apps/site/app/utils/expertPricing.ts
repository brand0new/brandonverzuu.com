// Formatting for the expertise service's pricing data
// (content/expert/pricing.yml, the expertPricing schema in content.config.ts).
// Amounts are a number or the literal "TBD" until Brandon sets prices, and
// "TBD" is printed as-is so a placeholder never looks like a real price.
import type { ExpertPricingCollectionItem } from "@nuxt/content";

export type ExpertPack = ExpertPricingCollectionItem["packs"][number];
export type ExpertCheckPrice = ExpertPricingCollectionItem["checks"][number];
export type CheckKind = ExpertCheckPrice["kind"];
export type Amount = number | "TBD";

export function formatPrice(price: Amount, currency: string): string {
  if (price === "TBD") return "TBD";
  return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(
    price,
  );
}

export function formatCredits(credits: Amount): string {
  if (credits === "TBD") return "TBD";
  return `${credits} ${credits === 1 ? "credit" : "credits"}`;
}

/** Price per credit, or "TBD" while the pack price isn't set. */
export function pricePerCredit(pack: ExpertPack, currency: string): string {
  if (pack.price === "TBD") return "TBD";
  return formatPrice(pack.price / pack.credits, currency);
}
