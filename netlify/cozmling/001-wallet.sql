CREATE TABLE IF NOT EXISTS cozmc_wallet_challenge_use (
  origin_scope text NOT NULL CHECK (origin_scope ~ '^[a-f0-9]{64}$'),
  nonce text NOT NULL CHECK (nonce ~ '^[a-f0-9]{32}$'),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (origin_scope, nonce)
);

CREATE TABLE IF NOT EXISTS cozmc_wallet_session (
  origin_scope text NOT NULL CHECK (origin_scope ~ '^[a-f0-9]{64}$'),
  token_digest text NOT NULL CHECK (token_digest ~ '^[a-f0-9]{64}$'),
  wallet_address text NOT NULL CHECK (wallet_address ~ '^[A-Z2-7]{58}$'),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (origin_scope, token_digest)
);

CREATE INDEX IF NOT EXISTS cozmc_wallet_challenge_expires_idx ON cozmc_wallet_challenge_use (expires_at);
CREATE INDEX IF NOT EXISTS cozmc_wallet_session_expires_idx ON cozmc_wallet_session (expires_at);
