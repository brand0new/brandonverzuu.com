# 03: Commerce: checkout, payment, ledger

## Scope

ACP checkout over MCP for credit packs, Stripe payment, the credit ledger, and the
human fallback purchase link.

## Catalogue

Credit packs are configuration, not code: a `products` table seeded by a
migration, amounts in minor units, currency EUR (decision D6).

```sql
CREATE TABLE products (id TEXT PRIMARY KEY, title TEXT, credits INTEGER, unit_amount INTEGER, currency TEXT, active INTEGER);
CREATE TABLE checkout_sessions (id TEXT PRIMARY KEY, account_id TEXT, status TEXT, body TEXT, created_at TEXT, updated_at TEXT);
CREATE TABLE orders (id TEXT PRIMARY KEY, checkout_session_id TEXT UNIQUE, account_id TEXT, stripe_payment_intent TEXT UNIQUE, amount INTEGER, currency TEXT, status TEXT, created_at TEXT);
CREATE TABLE ledger (id TEXT PRIMARY KEY, account_id TEXT, delta INTEGER, kind TEXT, ref TEXT, created_at TEXT);   -- append-only
CREATE TABLE reservations (id TEXT PRIMARY KEY, account_id TEXT, credits INTEGER, ref TEXT, state TEXT, expires_at TEXT);
CREATE TABLE idempotency (key TEXT, account_id TEXT, tool TEXT, response TEXT, created_at TEXT, PRIMARY KEY (key, account_id, tool));
```

Balance = sum of `ledger.delta` for the account minus open reservations. The ledger
is append-only: refunds and corrections are new rows, never updates.

## ACP checkout tools

Implement the five tools from the MCP binding with `packages/acp` schemas:

- `create_checkout_session`: line items must reference active products. One
  fulfilment option, type `digital`, cost 0, title "Credits added to your
  account". `payment_handlers` advertises Stripe (`psp: "stripe"`, card, SPT).
  Totals computed server-side; tax through Stripe Tax (decision D5). Session bound
  to the authenticated account.
- `update_checkout_session`: quantity and item changes only.
- `complete_checkout_session`: takes the SPT, creates and confirms a Stripe
  PaymentIntent with it, handles 3DS outcomes per the spec's authentication
  examples, then creates the order and grants credits **in one D1 batch**. Returns
  `CheckoutSessionWithOrder`.
- `cancel_checkout_session` and `get_checkout_session` per spec.
- `meta.idempotency_key` honoured on create and complete (stored response replayed
  for the same key; a different body with the same key → `request_not_idempotent`).
- A session can only be read or changed by the account that created it
  (`forbidden` otherwise).

## Stripe

- Stripe secret key and webhook secret as Worker secrets. Test mode until D5 is
  settled; live keys only through a separate production environment (spec 06).
- `POST /webhooks/stripe`: verifies the signature, handles
  `payment_intent.succeeded` (idempotent grant if `complete` didn't finish),
  `charge.refunded` and `charge.dispute.created` (negative ledger rows; a dispute
  also sets the account to `frozen` pending review, because chargebacks after
  heavy use are a known extraction pattern).
- The card fingerprint from the PaymentMethod is stored (hashed) on the order and
  passed to spec 05 for linking accounts that share an instrument.

## Fallback purchase

`get_purchase_link({ product_id, quantity })` creates a Stripe Checkout Session
tied to the account and returns its URL. The webhook grants credits. Same products,
same ledger.

## Ledger implementation

Implements the `Ledger` interface from the README. `reserve` is atomic (a D1 batch
with a balance check in the same statement, or serialised through the account's
`AccountGuard` DO; pick one and document it). Reservations expire after 10 minutes
and a cron trigger sweeps them.

## Acceptance

- The upstream ACP examples run end to end against `wrangler dev` with Stripe test
  mode: create → update → complete with a test SPT → balance increases.
- Concurrency test: 20 parallel `reserve` calls against a balance of 10 never
  overdraw.
- Replaying `complete` with the same idempotency key doesn't charge or grant twice.
- Webhook signature failure → 400, nothing written.

## Out of scope

Subscriptions, invoices for organisations (later), payouts.
