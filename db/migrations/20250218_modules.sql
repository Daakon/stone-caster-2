-- Modules System Migration
-- Add modules, story_modules, and ruleset_module_compat tables

-- Modules table
CREATE TABLE IF NOT EXISTS modules (
  id text PRIMARY KEY,                    -- e.g., "module.relationships.v3"
  base_id text NOT NULL,                  -- e.g., "module.relationships"
  version int NOT NULL,
  title text NOT NULL,
  description text,
  state_slice text NOT NULL,               -- namespaced slice owner, e.g. "relationships"
  ai_hints jsonb NOT NULL DEFAULT '[]',
  exports jsonb NOT NULL,                  -- {"capabilities":[...], "actions":[...]}
  slots jsonb NOT NULL DEFAULT '["module.hints","module.actions"]',
  extras jsonb NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(base_id, version)
);

-- Story modules junction table
-- Note: stories are stored in entry_points table, so we reference entry_point_id
CREATE TABLE IF NOT EXISTS story_modules (
  story_id uuid NOT NULL,                 -- FK to entry_points.id
  module_id text NOT NULL,                 -- FK to modules.id
  PRIMARY KEY (story_id, module_id),
  FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
);

-- Ruleset module compatibility table
CREATE TABLE IF NOT EXISTS ruleset_module_compat (
  ruleset_id text NOT NULL,                -- FK to rulesets.id
  module_base_id text NOT NULL,                -- FK to modules.base_id (via lookup)
  status text NOT NULL CHECK (status IN ('allowed','forbidden','conditional')),
  PRIMARY KEY (ruleset_id, module_base_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_modules_base_id ON modules(base_id);
CREATE INDEX IF NOT EXISTS idx_modules_state_slice ON modules(state_slice);
CREATE INDEX IF NOT EXISTS idx_story_modules_story_id ON story_modules(story_id);
CREATE INDEX IF NOT EXISTS idx_story_modules_module_id ON story_modules(module_id);
CREATE INDEX IF NOT EXISTS idx_ruleset_module_compat_ruleset ON ruleset_module_compat(ruleset_id);
CREATE INDEX IF NOT EXISTS idx_ruleset_module_compat_module ON ruleset_module_compat(module_base_id);

-- Comments
COMMENT ON TABLE modules IS 'Versioned module manifests with action exports';
COMMENT ON TABLE story_modules IS 'Junction table linking stories (entry_points) to modules';
COMMENT ON TABLE ruleset_module_compat IS 'Ruleset compatibility matrix for modules';

