-- Migration 003: email column on users, verification_tokens for magic-link, accounts for Google SSO

ALTER TABLE users ADD COLUMN email TEXT UNIQUE;

CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL,
  token      TEXT NOT NULL,
  expires    TEXT NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- OAuth account links (Google SSO)
CREATE TABLE IF NOT EXISTS accounts (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                TEXT    NOT NULL,
  provider            TEXT    NOT NULL,
  provider_account_id TEXT    NOT NULL,
  refresh_token       TEXT,
  access_token        TEXT,
  expires_at          INTEGER,
  token_type          TEXT,
  scope               TEXT,
  id_token            TEXT,
  session_state       TEXT,
  UNIQUE(provider, provider_account_id)
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
