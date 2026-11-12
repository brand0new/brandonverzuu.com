# 03: Payments: x402 and MPP

## Scope

Pay per check over two micropayment rails, x402 and Stripe's Machine Payments
Protocol (MPP), with no checkout, credit packs or balance (decision D13). Prices
come from D6. Includes binding payers to accounts, the payment records,
statements for accounting, and refunds.

**Verify first.** Both protocols are young, and secondary sources disagree on
details. Before writing code, read the current official specs and SDKs, and
note in the PR where they differ from this spec:

- x402: the spec, its MCP transport, the facilitator API and EIP-3009 for
  EURC/USDC.
- MPP: Stripe's docs, the HTTP authentication scheme, and whether capture can be
  deferred.

## Prices

Per check, in EUR, excluding VAT (D6):

| Check | Price |
| --- | --- |
| Skill design | EUR 5 |
| API governance | EUR 10 for up to 50 operations, +EUR 5 per further 50 |
| Process description review | EUR 15 |

Prices are configuration: a `prices` table seeded by a migration, amounts in minor
units. `quote(kind, artifact)` computes the price from the parsed artifact before
anything is charged, so the size surcharge is known up front.

**VAT.** The price shown is excluding VAT. The amount charged includes VAT where
it applies: EU business customers with a validated VAT id pay under reverse charge
(no VAT), and Dutch customers pay 21%. An account without a known VAT status is
charged as Dutch until it adds one. The terms say business customers only
(spec 07). The rules need Brandon's accountant to confirm them (D5).

## The payment flow

Every paid check, over MCP or REST, goes through `PaymentGate` inside the
spec 02 pipeline:

```
authenticate (OAuth) → validate + parse → quote → guard.admit
  → no payment attached?  respond 402 with both challenges (x402 + MPP), nothing runs
  → payment attached     → gate.verify (valid, right amount, payer bound to this account)
  → rules.run → guard.shape → gate.settle → respond → guard.record
                (check fails on our side → gate.void: nothing is collected)
```

The point of verify before settle: **a check that fails on our side is never
paid.** That's the refund-on-failure promise without refunds.

### x402

- On a missing payment, the 402 response carries x402 payment requirements:
  - scheme `exact`, network Base,
  - accepted assets EURC (preferred) and USDC, with the USDC amount converted
    from EUR at a quoted rate valid for 5 minutes,
  - `payTo` Brandon's receiving address, `maxAmountRequired`, and `resource` set
    to the check request.
- The client retries with a signed payment (EIP-3009 authorisation). The gateway
  verifies it through the facilitator (Coinbase CDP at first) without settling,
  runs the check, then calls settle. On failure it doesn't settle, and the
  authorisation lapses at its `validBefore`.
- Over MCP, follow x402's MCP transport: the tool result carries the payment
  requirements and the retry carries the payment in the request metadata. Check
  its current form before implementing.

### MPP

- The same 402 response also carries an MPP challenge (`WWW-Authenticate:
  Payment …`, per the RFC 9110 authentication framework), backed by Stripe.
- This rail is for buyers who pay in fiat without a crypto wallet. Use deferred
  capture if MPP supports it, so a failed check is voided like x402. If it
  doesn't, charge and refund automatically on failure, and record the refund.

### Idempotency

- `Idempotency-Key` is required on every paid request. The same key with the same
  body replays the stored response and charges nothing. A different body returns
  a conflict.
- A payment authorisation is single-use: its nonce or payment id is stored, and
  reuse is rejected.

## Binding payers to accounts

Anti-extraction (spec 05) needs an identity per payer. A wallet costs nothing to
create, so payments alone aren't one. Every payer is therefore bound to an OAuth
account:

- **x402:** the paying address (`from` in the authorisation) must be bound to the
  account. An account binds a wallet by signing a challenge message (EIP-191)
  from it, through `POST /v1/wallets`. A payment from an unbound address returns
  `payer_not_bound`, and nothing runs. Each account can bind a small number of
  wallets (a `GUARD_CONFIG` setting).
- **MPP:** the Stripe customer and the payment method's card fingerprint (hashed)
  are bound to the account on the first payment, as card fingerprints are in
  spec 05.
- A wallet or card already bound to another account links the two accounts in
  the guard (shared budget), and isn't silently re-bound.

## Data

```sql
CREATE TABLE prices (kind TEXT PRIMARY KEY, base_amount INTEGER, currency TEXT, step_ops INTEGER, step_amount INTEGER, active INTEGER);
CREATE TABLE payers (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, rail TEXT NOT NULL, ref_hash TEXT NOT NULL UNIQUE, bound_at TEXT NOT NULL); -- wallet address or Stripe customer, hashed for lookups
CREATE TABLE payments (
  id TEXT PRIMARY KEY, account_id TEXT NOT NULL, payer_id TEXT NOT NULL, rail TEXT NOT NULL,   -- x402 | mpp
  check_ref TEXT NOT NULL, amount INTEGER NOT NULL, vat_amount INTEGER NOT NULL, currency TEXT NOT NULL,
  asset TEXT, network TEXT, external_ref TEXT UNIQUE,  -- tx hash / payment id
  status TEXT NOT NULL,                                -- verified | settled | voided | refunded | failed
  created_at TEXT NOT NULL, settled_at TEXT
);
CREATE TABLE idempotency (key TEXT, account_id TEXT, route TEXT, body_hash TEXT, response TEXT, created_at TEXT, PRIMARY KEY (key, account_id, route));
CREATE TABLE statements (id TEXT PRIMARY KEY, account_id TEXT, period TEXT, total INTEGER, vat_total INTEGER, currency TEXT, issued_at TEXT);
```

Stored in the EU D1 database (D11). The wallet address itself is stored, because
statements need it, but lookups use the hash. **A blockchain is public:** payments
on Base are visible to anyone, together with the receiving address. The privacy
statement says so (spec 07).

## Statements and accounting

- A monthly statement per account lists every settled payment with VAT. It's
  available at `GET /v1/statements` and emailed. It works as the invoice for
  reverse-charge purposes. Brandon's accountant confirms the format (D5).
- Settled x402 funds arrive in EURC/USDC at the receiving address. Converting to
  EUR and booking it is Brandon's process, outside the gateway. The gateway
  exports payments as CSV for it.

## Account surface (replaces balance and purchase links)

- REST: `GET /v1/account` (payers, month-to-date spend, spending ceiling),
  `POST /v1/wallets` (bind), `DELETE /v1/wallets/{id}`, `GET /v1/statements`,
  `GET /v1/prices`.
- MCP free tools: `get_account`, `get_prices`, `quote_check` (price for a given
  artifact, nothing charged), `bind_wallet` (returns the message to sign), and
  `get_terms`.

## Stripe (MPP) operations

- Stripe secret key and webhook secret are Worker secrets. Test mode until D5 is
  settled.
- `POST /webhooks/stripe` verifies the signature and handles payment success,
  refunds and disputes. A dispute freezes the account pending review, as before:
  chargebacks after heavy use are an extraction pattern.

## Acceptance

- x402 end to end on Base Sepolia (testnet), with a test wallet:
  - 402 with requirements,
  - paid retry,
  - check result,
  - settlement visible on the testnet.
- MPP end to end in Stripe test mode.
- A check that fails on our side leaves the x402 authorisation unsettled and the
  MPP payment voided or refunded. A test asserts nothing is collected.
- A payment from an unbound wallet, a reused authorisation and a wrong amount are
  each rejected before any rules run.
- Replaying a request with the same `Idempotency-Key` charges once.
- The VAT cases (reverse charge, Dutch, unknown) produce the right amounts.
- The monthly statement matches the settled payments.

## Out of scope

Subscriptions, prepaid balances and invoicing by bank transfer (D13 excludes them).
Selling the data set (a later direction in D6).
