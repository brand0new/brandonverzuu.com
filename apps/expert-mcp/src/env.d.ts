// Secrets aren't in wrangler.jsonc, so `wrangler types` can't see them. They're
// optional here because development runs without them (src/services.ts).
interface GatewaySecrets {
  /** HMAC key for `accounts.email_hash`. */
  EMAIL_HMAC_KEY?: string;
  /** HMAC key for per-account phrasing variant seeds (spec 05). */
  VARIANT_KEY?: string;
}

interface Env extends GatewaySecrets {}

declare namespace Cloudflare {
  interface Env extends GatewaySecrets {}
}
