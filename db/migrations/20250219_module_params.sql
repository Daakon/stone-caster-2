-- Module Parameters and Loadouts Migration
-- Add params to story_modules and create loadouts table

-- Add params column to story_modules
ALTER TABLE story_modules
ADD COLUMN IF NOT EXISTS params jsonb NULL,
ADD COLUMN IF NOT EXISTS params_meta jsonb NULL;

-- Add index for params queries
CREATE INDEX IF NOT EXISTS idx_story_modules_params ON story_modules USING gin (params);

-- Loadouts table
CREATE TABLE IF NOT EXISTS loadouts (
  id text PRIMARY KEY,
  base_id text NOT NULL,
  version int NOT NULL,
  title text NOT NULL,
  description text,
  ruleset_id text NOT NULL,
  modules jsonb NOT NULL,              -- Array of module IDs
  overrides jsonb NULL,                -- { "<moduleId>": { "params": { ... } } }
  created_at timestamptz DEFAULT now(),
  UNIQUE(base_id, version)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_loadouts_base_id ON loadouts(base_id);
CREATE INDEX IF NOT EXISTS idx_loadouts_ruleset_id ON loadouts(ruleset_id);

-- Comments
COMMENT ON COLUMN story_modules.params IS 'Per-story module parameters (overrides manifest defaults)';
COMMENT ON COLUMN story_modules.params_meta IS 'Metadata about params (e.g., preset_id used)';
COMMENT ON TABLE loadouts IS 'Preset loadouts: ruleset + modules + optional param overrides';

