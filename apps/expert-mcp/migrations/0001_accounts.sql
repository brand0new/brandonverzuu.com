-- Accounts and API tokens (spec 02). Spec 03 adds the commerce tables.
-- The database is created with --jurisdiction eu (decision D11).

CREATE TABLE accounts (
  id TEXT PRIMARY KEY,               -- acct_<ulid>
  email_hash TEXT NOT NULL UNIQUE,   -- HMAC-SHA256(email, EMAIL_HMAC_KEY)
  email TEXT NOT NULL,               -- receipts only
  status TEXT NOT NULL DEFAULT 'active',
  terms_version TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE api_tokens (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,   -- SHA-256 of the token; the token itself is shown once
  label TEXT,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT
);

CREATE INDEX api_tokens_account ON api_tokens (account_id);
