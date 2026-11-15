BEGIN;

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

CREATE UNIQUE INDEX IF NOT EXISTS cozmling_one_ordinary_companion
  ON cozmling_account_companions (wallet_address) WHERE source = 'ordinary';

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

COMMIT;
