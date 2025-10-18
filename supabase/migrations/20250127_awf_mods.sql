-- Phase 22: Mod System & Procedural Hooks
-- Database schema for namespaced mod packs and procedural hooks

-- Mod packs table
CREATE TABLE IF NOT EXISTS mod_packs (
  namespace TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'installed' CHECK (status IN ('installed', 'enabled', 'disabled', 'quarantined')),
  manifest JSONB NOT NULL,
  hash TEXT NOT NULL,
  certified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(namespace, version)
);

-- Mod hooks table
CREATE TABLE IF NOT EXISTS mod_hooks (
  namespace TEXT NOT NULL REFERENCES mod_packs(namespace) ON DELETE CASCADE,
  hook_id TEXT NOT NULL,
  hook_type TEXT NOT NULL,
  doc JSONB NOT NULL,
  hash TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (namespace, hook_id)
);

-- Mod quarantine table
CREATE TABLE IF NOT EXISTS mod_quarantine (
  namespace TEXT NOT NULL REFERENCES mod_packs(namespace) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (namespace)
);

-- Mod metrics table
CREATE TABLE IF NOT EXISTS mod_metrics (
  namespace TEXT NOT NULL REFERENCES mod_packs(namespace) ON DELETE CASCADE,
  hook_id TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  value NUMERIC NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (namespace, hook_id, metric_type, timestamp)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_mod_packs_status ON mod_packs(status);
CREATE INDEX IF NOT EXISTS idx_mod_packs_certified ON mod_packs(certified);
CREATE INDEX IF NOT EXISTS idx_mod_packs_hash ON mod_packs(hash);
CREATE INDEX IF NOT EXISTS idx_mod_hooks_type ON mod_hooks(hook_type);
CREATE INDEX IF NOT EXISTS idx_mod_hooks_priority ON mod_hooks(priority);
CREATE INDEX IF NOT EXISTS idx_mod_hooks_hash ON mod_hooks(hash);
CREATE INDEX IF NOT EXISTS idx_mod_quarantine_created ON mod_quarantine(created_at);
CREATE INDEX IF NOT EXISTS idx_mod_metrics_namespace ON mod_metrics(namespace);
CREATE INDEX IF NOT EXISTS idx_mod_metrics_timestamp ON mod_metrics(timestamp);

-- Add RLS policies for mod packs
ALTER TABLE mod_packs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read enabled/certified mod packs
CREATE POLICY "Users can read enabled mod packs" ON mod_packs
  FOR SELECT USING (status = 'enabled' AND certified = true);

-- Policy: Admin users can manage mod packs
CREATE POLICY "Admin users can manage mod packs" ON mod_packs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.auth_user_id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Add RLS policies for mod hooks
ALTER TABLE mod_hooks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read hooks from enabled mod packs
CREATE POLICY "Users can read enabled mod hooks" ON mod_hooks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM mod_packs 
      WHERE mod_packs.namespace = mod_hooks.namespace 
      AND mod_packs.status = 'enabled' 
      AND mod_packs.certified = true
    )
  );

-- Policy: Admin users can manage mod hooks
CREATE POLICY "Admin users can manage mod hooks" ON mod_hooks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.auth_user_id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Add RLS policies for mod quarantine
ALTER TABLE mod_quarantine ENABLE ROW LEVEL SECURITY;

-- Policy: Admin users can manage mod quarantine
CREATE POLICY "Admin users can manage mod quarantine" ON mod_quarantine
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.auth_user_id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Add RLS policies for mod metrics
ALTER TABLE mod_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read mod metrics
CREATE POLICY "Users can read mod metrics" ON mod_metrics
  FOR SELECT USING (true);

-- Policy: System can write mod metrics
CREATE POLICY "System can write mod metrics" ON mod_metrics
  FOR INSERT WITH CHECK (true);

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_mods_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_mod_packs_updated_at 
  BEFORE UPDATE ON mod_packs 
  FOR EACH ROW EXECUTE FUNCTION update_mods_updated_at();

CREATE TRIGGER update_mod_hooks_updated_at 
  BEFORE UPDATE ON mod_hooks 
  FOR EACH ROW EXECUTE FUNCTION update_mods_updated_at();

-- Add configuration table for mod system
CREATE TABLE IF NOT EXISTS mod_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  mods_enabled BOOLEAN DEFAULT true,
  max_hooks_per_turn INTEGER DEFAULT 12,
  max_acts_per_turn INTEGER DEFAULT 6,
  max_namespace_tokens INTEGER DEFAULT 80,
  max_global_tokens INTEGER DEFAULT 200,
  max_eval_ms INTEGER DEFAULT 15,
  quarantine_threshold INTEGER DEFAULT 5,
  cert_required BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO mod_config (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

-- Add RLS policy for mod config
ALTER TABLE mod_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read mod config" ON mod_config
  FOR SELECT USING (true);

CREATE POLICY "Admin users can manage mod config" ON mod_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.auth_user_id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Add trigger for mod config updated_at
CREATE TRIGGER update_mod_config_updated_at 
  BEFORE UPDATE ON mod_config 
  FOR EACH ROW EXECUTE FUNCTION update_mods_updated_at();

-- Add sample mod pack data
INSERT INTO mod_packs (namespace, version, status, manifest, hash, certified) VALUES
(
  'author.mystika_additions',
  '1.0.0',
  'enabled',
  '{
    "namespace": "author.mystika_additions",
    "version": "1.0.0",
    "awf_core": ">=1.12.0",
    "declares": {
      "hooks": ["onTurnStart", "onNodeEnter", "onLootRoll"],
      "slices": ["sim.weather", "hot.objectives", "warm.relationships"]
    },
    "permissions": {
      "acts": ["OBJECTIVE_UPDATE", "RESOURCE_DELTA", "ITEM_ADD", "APPLY_STATUS"],
      "perTurnActsMax": 3,
      "requiresCertification": true
    }
  }',
  'hash_mystika_additions_v1',
  true
),
(
  'author.weather_effects',
  '1.2.0',
  'enabled',
  '{
    "namespace": "author.weather_effects",
    "version": "1.2.0",
    "awf_core": ">=1.10.0",
    "declares": {
      "hooks": ["onWeatherChange", "onTurnStart"],
      "slices": ["sim.weather", "sim.regions"]
    },
    "permissions": {
      "acts": ["RESOURCE_DELTA", "APPLY_STATUS"],
      "perTurnActsMax": 2,
      "requiresCertification": false
    }
  }',
  'hash_weather_effects_v1_2',
  true
);

-- Add sample mod hook data
INSERT INTO mod_hooks (namespace, hook_id, hook_type, doc, hash, priority) VALUES
(
  'author.mystika_additions',
  'weather_bonus_foragers',
  'onTurnStart',
  '{
    "hook_id": "weather_bonus_foragers",
    "type": "onTurnStart",
    "guards": [
      {"path": "sim.weather.state", "op": "eq", "val": "rain"},
      {"path": "party.members.*.tags", "op": "has", "val": "forager"}
    ],
    "prob": "seeded(0.35)",
    "effects": [
      {"act": "RESOURCE_DELTA", "key": "energy", "delta": -1, "clamp": "soft"},
      {"act": "ITEM_ADD", "target": "player", "id": "itm.healing_leaf", "qty": 1}
    ]
  }',
  'hash_weather_bonus_foragers_v1',
  10
),
(
  'author.mystika_additions',
  'forest_encounter_bonus',
  'onNodeEnter',
  '{
    "hook_id": "forest_encounter_bonus",
    "type": "onNodeEnter",
    "guards": [
      {"path": "graph.current_node", "op": "eq", "val": "node.forest_clearing"},
      {"path": "party.members.*.skills", "op": "has", "val": "nature"}
    ],
    "prob": "seeded(0.25)",
    "effects": [
      {"act": "OBJECTIVE_UPDATE", "objective": "explore_forest", "progress": 1}
    ]
  }',
  'hash_forest_encounter_bonus_v1',
  5
),
(
  'author.weather_effects',
  'storm_penalty',
  'onWeatherChange',
  '{
    "hook_id": "storm_penalty",
    "type": "onWeatherChange",
    "guards": [
      {"path": "sim.weather.state", "op": "eq", "val": "storm"},
      {"path": "sim.weather.duration", "op": "gte", "val": 2}
    ],
    "prob": "seeded(0.8)",
    "effects": [
      {"act": "RESOURCE_DELTA", "key": "morale", "delta": -2, "clamp": "hard"},
      {"act": "APPLY_STATUS", "target": "party", "status": "exhausted", "duration": 1}
    ]
  }',
  'hash_storm_penalty_v1',
  15
);

-- Add comments
COMMENT ON TABLE mod_packs IS 'Registry for mod packs with namespace isolation and certification';
COMMENT ON TABLE mod_hooks IS 'Individual hooks within mod packs with deterministic execution';
COMMENT ON TABLE mod_quarantine IS 'Quarantined mod packs with violation details';
COMMENT ON TABLE mod_metrics IS 'Performance and usage metrics for mod hooks';
COMMENT ON TABLE mod_config IS 'Configuration for mod system quotas and limits';

-- Add down migration
CREATE OR REPLACE FUNCTION down_migration_phase22()
RETURNS void AS $$
BEGIN
  -- Drop mod system tables
  DROP TABLE IF EXISTS mod_metrics CASCADE;
  DROP TABLE IF EXISTS mod_quarantine CASCADE;
  DROP TABLE IF EXISTS mod_hooks CASCADE;
  DROP TABLE IF EXISTS mod_packs CASCADE;
  DROP TABLE IF EXISTS mod_config CASCADE;
  
  -- Drop indexes
  DROP INDEX IF EXISTS idx_mod_packs_status;
  DROP INDEX IF EXISTS idx_mod_packs_certified;
  DROP INDEX IF EXISTS idx_mod_packs_hash;
  DROP INDEX IF EXISTS idx_mod_hooks_type;
  DROP INDEX IF EXISTS idx_mod_hooks_priority;
  DROP INDEX IF EXISTS idx_mod_hooks_hash;
  DROP INDEX IF EXISTS idx_mod_quarantine_created;
  DROP INDEX IF EXISTS idx_mod_metrics_namespace;
  DROP INDEX IF EXISTS idx_mod_metrics_timestamp;
END;
$$ LANGUAGE plpgsql;
