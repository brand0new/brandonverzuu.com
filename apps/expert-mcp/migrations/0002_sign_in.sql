-- Short-lived sign-in state for the magic link and the device flow (spec 02).
-- Rows expire within minutes; expired rows are ignored and deleted on use.
-- Kept in D1 rather than KV because they hold email addresses (decision D11).

CREATE TABLE magic_links (
  token_hash TEXT PRIMARY KEY,       -- SHA-256 of the emailed token
  email_hash TEXT NOT NULL,
  email TEXT NOT NULL,
  browser_hash TEXT NOT NULL,        -- SHA-256 of a cookie set in the browser that asked: the link works only there
  continue_path TEXT NOT NULL,       -- same-origin path to return to after sign-in
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX magic_links_email ON magic_links (email_hash, created_at);

CREATE TABLE signin_sessions (
  id_hash TEXT PRIMARY KEY,          -- SHA-256 of the session cookie value
  email_hash TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- RFC 8628 device authorization grant, for the CLI.
CREATE TABLE device_authorizations (
  device_code_hash TEXT PRIMARY KEY, -- SHA-256 of the device_code
  user_code TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | denied
  account_id TEXT,
  auth_code TEXT,                    -- one-time code minted on approval, exchanged on the next poll
  code_verifier TEXT NOT NULL,       -- PKCE verifier for that exchange; never leaves the server
  redirect_uri TEXT NOT NULL,
  last_polled_at TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
