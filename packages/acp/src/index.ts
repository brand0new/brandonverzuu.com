// @brandonverzuu/acp: the Agentic Commerce Protocol 2026-04-17 data model
// (checkout and delegated payment) and its MCP binding. Types and validators
// only; no business logic.
//
// Every upstream definition is exported twice: `XSchema` (zod) and `X` (type).

import { z } from "zod";
import {
  FulfillmentOptionDigitalSchema,
  FulfillmentOptionLocalDeliverySchema,
  FulfillmentOptionPickupSchema,
  FulfillmentOptionShippingSchema,
} from "./generated/checkout.ts";

export * from "./generated/checkout.ts";
export * from "./generated/delegate-payment.ts";
export { mcpTools } from "./generated/mcp-tools.ts";
export * from "./discovery.ts";
export * from "./errors.ts";
export * from "./meta.ts";
export * from "./tools.ts";
export type { JsonSchema, McpToolDefinition } from "./types.ts";

/** Any entry of `CheckoutSession.fulfillment_options` (upstream has no named union). */
export const FulfillmentOptionSchema = z.union([
  FulfillmentOptionShippingSchema,
  FulfillmentOptionDigitalSchema,
  FulfillmentOptionPickupSchema,
  FulfillmentOptionLocalDeliverySchema,
]);
export type FulfillmentOption = z.infer<typeof FulfillmentOptionSchema>;
