-- Light the Grove: when each lantern was lit, so the first wallets to light one can be named.
-- Additive: the previous code keeps working on this table.
ALTER TABLE cozmling_hatch_contributions ADD COLUMN IF NOT EXISTS lit_at timestamptz NOT NULL DEFAULT now();

INSERT INTO cozmc_schema_version (singleton, version) VALUES (TRUE, 7)
  ON CONFLICT (singleton) DO UPDATE SET version = GREATEST(cozmc_schema_version.version, EXCLUDED.version), applied_at = now();
