/* The tables behind wallet-backed Cozmlings, for a private preview database.

   runtime.mjs applies this once per function start, in one transaction under an advisory lock, so
   two cold starts can't race. Every statement is idempotent, so applying it again changes nothing.
   To read or apply it by hand:
     node -e "import('./netlify/cozmling/schema.mjs').then(m => console.log(m.SCHEMA))"            */

/** Wallet sign-in: one-use challenges, server sessions, and the preview's own session key. */
export const WALLET_SCHEMA = `
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

-- Used only when COZMC_ACCOUNT_SESSION_SECRET is not set: the key that signs sign-in challenges
-- is then made once, here, and never leaves the database.
CREATE TABLE IF NOT EXISTS cozmc_wallet_secret (
  singleton boolean PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  secret bytea NOT NULL CHECK (octet_length(secret) = 32)
);
`

/** Companions owned by a verified wallet, their private saves, and the Community Hatch. */
export const COMPANION_SCHEMA = `
CREATE TABLE IF NOT EXISTS cozmling_preview_scope (
  singleton boolean PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  origin text NOT NULL
);

CREATE TABLE IF NOT EXISTS cozmling_hatch_events (
  event_id text PRIMARY KEY,
  fingerprint text NOT NULL
);

CREATE TABLE IF NOT EXISTS cozmling_hatch_contributions (
  event_id text NOT NULL REFERENCES cozmling_hatch_events (event_id),
  wallet_address text NOT NULL CHECK (wallet_address ~ '^[A-Z2-7]{58}$'),
  contribution_day date NOT NULL,
  PRIMARY KEY (event_id, wallet_address, contribution_day)
);

CREATE TABLE IF NOT EXISTS cozmling_hatch_claims (
  event_id text NOT NULL REFERENCES cozmling_hatch_events (event_id),
  wallet_address text NOT NULL CHECK (wallet_address ~ '^[A-Z2-7]{58}$'),
  companion_id text NOT NULL UNIQUE,
  look_id text NOT NULL CHECK (look_id IN ('grove-green', 'grove-violet', 'grove-cyan')),
  PRIMARY KEY (event_id, wallet_address),
  UNIQUE (event_id, wallet_address, companion_id)
);

CREATE TABLE IF NOT EXISTS cozmling_account_companions (
  wallet_address text NOT NULL CHECK (wallet_address ~ '^[A-Z2-7]{58}$'),
  companion_id text NOT NULL,
  source text NOT NULL CHECK (source IN ('ordinary', 'event')),
  event_id text,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (wallet_address, companion_id),
  FOREIGN KEY (event_id, wallet_address, companion_id)
    REFERENCES cozmling_hatch_claims (event_id, wallet_address, companion_id),
  CHECK ((source = 'ordinary' AND event_id IS NULL AND companion_id NOT LIKE 'hatch-%') OR
         (source = 'event' AND event_id IS NOT NULL AND companion_id LIKE 'hatch-%'))
);

CREATE UNIQUE INDEX IF NOT EXISTS cozmling_globally_unique_companion_id
  ON cozmling_account_companions (companion_id);

-- (how many ordinary Starprints a wallet may adopt is now a setting, checked under a per-wallet lock in
-- account.mjs: COZMC_STARPRINTS_PER_WALLET, 10 by default; the old one-per-wallet index goes)
DROP INDEX IF EXISTS cozmling_one_ordinary_companion;

CREATE UNIQUE INDEX IF NOT EXISTS cozmling_one_companion_per_event
  ON cozmling_account_companions (wallet_address, event_id) WHERE source = 'event';

CREATE TABLE IF NOT EXISTS cozmling_account_save_operations (
  wallet_address text NOT NULL,
  companion_id text NOT NULL,
  op_id uuid NOT NULL,
  payload_hash text NOT NULL,
  PRIMARY KEY (wallet_address, companion_id, op_id),
  FOREIGN KEY (wallet_address, companion_id)
    REFERENCES cozmling_account_companions (wallet_address, companion_id) ON DELETE CASCADE
);
`

/** Starprint NFTs on TestNet: the issuer the database keeps, and one mint per Starprint (mint.mjs). */
export const MINT_SCHEMA = `
CREATE TABLE IF NOT EXISTS starprint_issuer (
  network text PRIMARY KEY CHECK (network = 'testnet'),
  secret bytea NOT NULL CHECK (octet_length(secret) = 64),
  manager_address text NOT NULL CHECK (manager_address ~ '^[A-Z2-7]{58}$')
);

CREATE TABLE IF NOT EXISTS starprint_mints (
  network text NOT NULL,
  companion_id text NOT NULL,
  wallet_address text NOT NULL CHECK (wallet_address ~ '^[A-Z2-7]{58}$'),
  serial bigserial UNIQUE,
  mint_ref text NOT NULL UNIQUE CHECK (mint_ref ~ '^[a-f0-9]{24}$'),
  status text NOT NULL CHECK (status IN ('awaiting_fee', 'queued', 'submitted', 'confirmed')),
  public_name text,
  traits jsonb NOT NULL,
  txid text,
  first_valid bigint,
  last_valid bigint,
  signed_txn bytea,
  asset_id bigint UNIQUE,
  confirmed_round bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (network, companion_id)
);

-- the player's mint fee (added after the first TestNet preview): one payment pays for one mint
ALTER TABLE starprint_mints ADD COLUMN IF NOT EXISTS fee_txid text UNIQUE;
ALTER TABLE starprint_mints DROP CONSTRAINT IF EXISTS starprint_mints_status_check;
ALTER TABLE starprint_mints ADD CONSTRAINT starprint_mints_status_check CHECK (status IN ('awaiting_fee', 'queued', 'submitted', 'confirmed'));
-- delivery to the player's wallet, and MainNet rows (the MainNet issuer key is never stored here)
ALTER TABLE starprint_mints ADD COLUMN IF NOT EXISTS delivery_status text CHECK (delivery_status IN ('sending', 'delivered'));
ALTER TABLE starprint_mints ADD COLUMN IF NOT EXISTS delivery_txid text;
ALTER TABLE starprint_mints ADD COLUMN IF NOT EXISTS delivery_last_valid bigint;
ALTER TABLE starprint_mints ADD COLUMN IF NOT EXISTS delivery_signed bytea;
ALTER TABLE starprint_mints DROP CONSTRAINT IF EXISTS starprint_mints_network_check;
ALTER TABLE starprint_mints ADD CONSTRAINT starprint_mints_network_check CHECK (network IN ('testnet', 'mainnet'));
`

/** Which tables the database has. Production stops with database_not_migrated until scripts/db-migrate.mjs has
    applied at least this version. Raise it whenever the SQL above changes, and keep changes additive, so the
    previous code still runs on the new tables (that is what makes a site rollback safe). */
export const SCHEMA_VERSION = 6
const VERSION_SCHEMA = `
-- hatching decided by the server: when each egg may hatch, and when it did (both by the server's clock, set once)
ALTER TABLE cozmling_account_companions ADD COLUMN IF NOT EXISTS hatch_eligible_at timestamptz;
ALTER TABLE cozmling_account_companions ADD COLUMN IF NOT EXISTS hatched_at timestamptz;

-- switches that take effect at once, without a redeploy (scripts/starprint-pause.mjs sets them)
CREATE TABLE IF NOT EXISTS cozmc_runtime_flags (
  name text PRIMARY KEY CHECK (name IN ('starprint_paused')),
  value boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cozmc_schema_version (
  singleton boolean PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  version integer NOT NULL CHECK (version > 0),
  applied_at timestamptz NOT NULL DEFAULT now()
);
`

export const SCHEMA = WALLET_SCHEMA + COMPANION_SCHEMA + MINT_SCHEMA + VERSION_SCHEMA
