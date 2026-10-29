-- Payments per check over x402 and MPP (spec 03, decision D13).
-- The database is created with --jurisdiction eu (decision D11).

-- Prices per check in EUR minor units, excluding VAT (decision D6).
CREATE TABLE prices (
  kind TEXT PRIMARY KEY,
  base_amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  step_ops INTEGER,                  -- API governance: operations included, and per step
  step_amount INTEGER,
  active INTEGER NOT NULL DEFAULT 1
);

INSERT INTO prices (kind, base_amount, currency, step_ops, step_amount, active) VALUES
  ('skill-design', 500, 'EUR', NULL, NULL, 1),
  ('api-governance', 1000, 'EUR', 50, 500, 1),
  ('process-review', 1500, 'EUR', NULL, NULL, 1);

-- A payer bound to one account: a wallet (x402) or a card (MPP).
CREATE TABLE payers (
  id TEXT PRIMARY KEY,               -- payer_<ulid>
  account_id TEXT NOT NULL,
  rail TEXT NOT NULL,                -- x402 | mpp
  ref_hash TEXT NOT NULL UNIQUE,     -- SHA-256 of "wallet:<lowercase address>" or "card:<Stripe fingerprint>"
  ref TEXT NOT NULL,                 -- wallet address (statements need it) or Stripe customer id; never card data
  bound_at TEXT NOT NULL,
  removed_at TEXT                    -- unbound by the account; the payer stays tied to it
);

CREATE INDEX payers_account ON payers (account_id);

-- A payer already bound to one account that showed up on another. Spec 05's
-- guard treats linked accounts as one identity (shared budget).
CREATE TABLE payer_links (
  payer_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  linked_at TEXT NOT NULL,
  PRIMARY KEY (payer_id, account_id)
);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,               -- pay_<ulid>
  account_id TEXT NOT NULL,
  payer_id TEXT NOT NULL,            -- 'pending' until the MPP card is known
  rail TEXT NOT NULL,                -- x402 | mpp
  kind TEXT NOT NULL,                -- check kind
  check_ref TEXT NOT NULL,           -- request id
  amount INTEGER NOT NULL,           -- EUR minor units, excluding VAT
  vat_amount INTEGER NOT NULL,
  vat_treatment TEXT NOT NULL,       -- reverse_charge | nl_standard
  currency TEXT NOT NULL,            -- EUR
  asset TEXT,                        -- x402: token contract; MPP: null
  asset_amount TEXT,                 -- x402: atomic token units actually authorised
  network TEXT,                      -- x402: CAIP-2 network; MPP: null
  proof_ref TEXT NOT NULL UNIQUE,    -- single use: x402 authorisation nonce, MPP challenge id
  external_ref TEXT UNIQUE,          -- tx hash / Stripe PaymentIntent id
  status TEXT NOT NULL,              -- pending | verified | settled | voided | refunded | disputed | failed
  created_at TEXT NOT NULL,
  settled_at TEXT
);

CREATE INDEX payments_account_settled ON payments (account_id, settled_at);
CREATE INDEX payments_status ON payments (status, created_at);

-- Stored responses for Idempotency-Key replays. Rows are deleted after a day.
CREATE TABLE idempotency (
  key TEXT NOT NULL,
  account_id TEXT NOT NULL,
  route TEXT NOT NULL,
  body_hash TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (key, account_id, route)
);

-- Monthly statements: settled payments per account and calendar month (UTC).
CREATE TABLE statements (
  id TEXT PRIMARY KEY,               -- stmt_<period>_<account id>
  account_id TEXT NOT NULL,
  period TEXT NOT NULL,              -- YYYY-MM
  total INTEGER NOT NULL,            -- EUR minor units, including VAT
  vat_total INTEGER NOT NULL,
  currency TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  UNIQUE (account_id, period)
);

-- VAT status (spec 03 "VAT") and the account's Stripe customer (MPP).
ALTER TABLE accounts ADD COLUMN vat_id TEXT;
ALTER TABLE accounts ADD COLUMN vat_country TEXT;
ALTER TABLE accounts ADD COLUMN vat_status TEXT NOT NULL DEFAULT 'none'; -- none | pending | valid | invalid
ALTER TABLE accounts ADD COLUMN vat_checked_at TEXT;
ALTER TABLE accounts ADD COLUMN stripe_customer_id TEXT;
