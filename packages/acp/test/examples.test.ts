import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  AuthenticationResultSchema,
  CancelSessionRequestSchema,
  CheckoutSessionCompleteRequestSchema,
  CheckoutSessionCreateRequestSchema,
  CheckoutSessionSchema,
  CheckoutSessionUpdateRequestSchema,
  CheckoutSessionWithOrderSchema,
  DelegatePaymentErrorSchema,
  DelegatePaymentRequestSchema,
  DelegatePaymentResponseSchema,
  DiscoveryResponseSchema,
  ErrorSchema,
  acpError,
} from "../src/index.ts";
import { loadExamples } from "./fixtures.ts";

type Schema = z.ZodType;

/**
 * Which schema each upstream example key must parse with. Every key in the
 * file must be listed, so a new upstream example fails until it is mapped.
 */
const checkoutExamples: Record<string, Schema | "webhook"> = {
  create_checkout_session_request: CheckoutSessionCreateRequestSchema,
  create_checkout_session_request_with_first_touch_attribution:
    CheckoutSessionCreateRequestSchema,
  create_checkout_session_response: CheckoutSessionSchema,
  update_checkout_session_request: CheckoutSessionUpdateRequestSchema,
  update_checkout_session_response: CheckoutSessionSchema,
  complete_checkout_session_request: CheckoutSessionCompleteRequestSchema,
  complete_checkout_session_request_seller_backed:
    CheckoutSessionCompleteRequestSchema,
  complete_checkout_session_request_with_last_touch_attribution:
    CheckoutSessionCompleteRequestSchema,
  complete_checkout_session_response: CheckoutSessionWithOrderSchema,
  get_checkout_session_response: CheckoutSessionSchema,
  cancel_checkout_session_request: CancelSessionRequestSchema,
  cancel_checkout_session_request_timing_deferred: CancelSessionRequestSchema,
  cancel_checkout_session_response: CheckoutSessionSchema,
  // Webhooks are a separate API surface (openapi.agentic_checkout_webhook.yaml),
  // not in the checkout JSON Schema bundle.
  webhook_order_create_event: "webhook",
  webhook_order_update_event: "webhook",
  checkout_session_authentication_required: CheckoutSessionSchema,
  complete_session_with_authentication_result_request:
    CheckoutSessionCompleteRequestSchema,
  authentication_result_example: AuthenticationResultSchema,
  error_400_requires_3ds: ErrorSchema,
  authentication_result_denied_example: AuthenticationResultSchema,
  authentication_result_frictionless_example: AuthenticationResultSchema,
  complete_session_with_denied_authentication_request:
    CheckoutSessionCompleteRequestSchema,
  error_400_invalid_item: ErrorSchema,
  checkout_session_with_out_of_stock: CheckoutSessionSchema,
  checkout_session_with_payment_declined: CheckoutSessionSchema,
  discovery_response_full: DiscoveryResponseSchema,
  discovery_response_minimal: DiscoveryResponseSchema,
  error_400_idempotency_key_required: ErrorSchema,
  error_422_idempotency_conflict: ErrorSchema,
  error_409_idempotency_in_flight: ErrorSchema,
};

const multiItemExamples: Record<string, Schema> = {
  create_multi_item_checkout_request: CheckoutSessionCreateRequestSchema,
  create_multi_item_checkout_response: CheckoutSessionSchema,
};

const delegatePaymentExamples: Record<string, Schema> = {
  delegate_payment_request: DelegatePaymentRequestSchema,
  delegate_payment_success_response: DelegatePaymentResponseSchema,
  delegate_payment_error_invalid_card: DelegatePaymentErrorSchema,
  delegate_payment_error_idempotency_conflict: DelegatePaymentErrorSchema,
  delegate_payment_error_rate_limit: DelegatePaymentErrorSchema,
  delegate_payment_error_idempotency_key_required: DelegatePaymentErrorSchema,
  delegate_payment_error_idempotency_in_flight: DelegatePaymentErrorSchema,
};

/**
 * Upstream examples that do not match the upstream schemas (checked with ajv
 * as well). The test pins the exact issues, so it fails once upstream fixes
 * them and the entry can go.
 */
const knownInvalid: Record<string, string[]> = {
  // outcome "denied" is not in the if/then enum, but outcome_details still
  // requires three_ds_cryptogram and electronic_commerce_indicator.
  authentication_result_denied_example: [
    "outcome_details.three_ds_cryptogram",
    "outcome_details.electronic_commerce_indicator",
  ],
  // Predates required `capabilities`; nests capabilities in `protocol`; uses
  // total type "base_amount" (not in the enum; "items_base_amount" is).
  create_multi_item_checkout_request: ["capabilities"],
  create_multi_item_checkout_response: [
    "protocol",
    "capabilities",
    "line_items.0.totals.0.type",
    "line_items.1.totals.0.type",
  ],
};

function expectParses(schema: Schema, value: unknown) {
  const result = schema.safeParse(value);
  expect(result.error?.issues ?? []).toEqual([]);
  // Parsing must not drop or change anything the example contains.
  expect(result.data).toEqual(value);
}

describe.each([
  ["examples.agentic_checkout.json", checkoutExamples],
  ["examples.multi_item_checkout.json", multiItemExamples],
  ["examples.delegate_payment.json", delegatePaymentExamples],
] as const)("%s", (file, mapping) => {
  const examples = loadExamples(file);

  it("maps every upstream example to a schema", () => {
    expect(Object.keys(mapping).sort()).toEqual(Object.keys(examples).sort());
  });

  for (const [key, schema] of Object.entries(mapping)) {
    if (schema === "webhook") continue;
    const known = knownInvalid[key];
    if (known) {
      it(`rejects ${key} exactly where upstream is inconsistent`, () => {
        const result = schema.safeParse(examples[key]);
        const paths = result.error?.issues.map((i) => i.path.join("."));
        expect(paths?.sort()).toEqual([...known].sort());
      });
      continue;
    }
    it(`parses ${key}`, () => expectParses(schema, examples[key]));
  }
});

describe("REST error examples as JSON-RPC errors", () => {
  const errors = [
    ...Object.entries(loadExamples("examples.agentic_checkout.json")),
    ...Object.entries(loadExamples("examples.delegate_payment.json")),
  ].filter(([key]) => key.includes("error_")) as [
    string,
    { type: string; code: string; message: string; param?: string },
  ][];

  it("covers every error example", () => {
    expect(errors.length).toBe(10);
  });

  for (const [key, example] of errors) {
    it(`wraps ${key} with code -32000 and the Error in data`, () => {
      const error = acpError(
        example.type as never,
        example.code,
        example.message,
        example.param,
      );
      expect(error).toEqual({
        code: -32000,
        message: example.message,
        data: example,
      });
    });
  }
});
