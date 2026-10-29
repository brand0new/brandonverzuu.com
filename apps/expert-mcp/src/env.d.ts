// Secrets aren't in wrangler.jsonc, so `wrangler types` can't see them. They're
// optional here because development runs without them (src/services.ts).
interface GatewaySecrets {
  /** HMAC key for `accounts.email_hash`. */
  EMAIL_HMAC_KEY?: string;
  /** HMAC key for per-account phrasing variant seeds (spec 05). */
  VARIANT_KEY?: string;
  /** HMAC key binding x402 quotes, MPP challenge ids and wallet-binding messages (spec 03). */
  PAYMENT_HMAC_KEY?: string;
  /** Coinbase CDP API key secret for the x402 facilitator (key id: X402_FACILITATOR_KEY_ID). */
  X402_FACILITATOR_KEY?: string;
  /** Stripe secret key (MPP). Test mode until D5 is settled. */
  STRIPE_SECRET_KEY?: string;
  /** Stripe webhook signing secret for POST /webhooks/stripe. */
  STRIPE_WEBHOOK_SECRET?: string;
  /** Guard settings as JSON (spec 05), e.g. {"maxWalletsPerAccount":3}. */
  GUARD_CONFIG?: string;
}

interface Env extends GatewaySecrets {}

declare namespace Cloudflare {
  interface Env extends GatewaySecrets {}
}
