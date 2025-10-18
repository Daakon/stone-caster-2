-- Phase 18: Companions & Party System
-- Database schema for companions registry and party state

-- Companions registry table
CREATE TABLE IF NOT EXISTS companions_registry (
  id TEXT PRIMARY KEY,
  doc JSONB NOT NULL,
  hash TEXT NOT NULL,
  world_ref TEXT,
  adventure_ref TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(id, hash)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_companions_registry_world_ref ON companions_registry(world_ref);
CREATE INDEX IF NOT EXISTS idx_companions_registry_adventure_ref ON companions_registry(adventure_ref);
CREATE INDEX IF NOT EXISTS idx_companions_registry_hash ON companions_registry(hash);

-- Extend game_states table with party state
ALTER TABLE game_states 
ADD COLUMN IF NOT EXISTS party JSONB DEFAULT '{
  "leader": "player",
  "companions": [],
  "reserve": [],
  "marching_order": ["player"],
  "intents": {}
}'::jsonb;

-- Add index for party queries
CREATE INDEX IF NOT EXISTS idx_game_states_party ON game_states USING GIN (party);

-- Extend npc_personalities table with party rules
ALTER TABLE npc_personalities 
ADD COLUMN IF NOT EXISTS party_rules JSONB DEFAULT '{}'::jsonb;

-- Add index for party rules queries
CREATE INDEX IF NOT EXISTS idx_npc_personalities_party_rules ON npc_personalities USING GIN (party_rules);

-- Add RLS policies for companions registry
ALTER TABLE companions_registry ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read companions registry
CREATE POLICY "Users can read companions registry" ON companions_registry
  FOR SELECT USING (true);

-- Policy: Admin users can manage companions registry
CREATE POLICY "Admin users can manage companions registry" ON companions_registry
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.auth_user_id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Add RLS policies for game_states party data
-- Policy: Users can read their own game states
CREATE POLICY "Users can read own game states" ON game_states
  FOR SELECT USING (session_id = auth.uid());

-- Policy: Users can update their own game states
CREATE POLICY "Users can update own game states" ON game_states
  FOR UPDATE USING (session_id = auth.uid());

-- Add RLS policies for npc_personalities party rules
-- Policy: Users can read npc personalities
CREATE POLICY "Users can read npc personalities" ON npc_personalities
  FOR SELECT USING (true);

-- Policy: Admin users can manage npc personalities
CREATE POLICY "Admin users can manage npc personalities" ON npc_personalities
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.auth_user_id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_companions_registry_updated_at 
  BEFORE UPDATE ON companions_registry 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add sample companion data
INSERT INTO companions_registry (id, doc, hash, world_ref, adventure_ref) VALUES
(
  'npc.kiera',
  '{
    "id": "npc.kiera",
    "name": "Kiera",
    "role": "herbalist",
    "traits": ["healing", "nature", "wise"],
    "recruitment_conditions": {
      "trust_min": 30,
      "quests_completed": ["quest.herbal_garden"],
      "world_events": []
    },
    "join_banter": "banter.kiera.join",
    "leave_banter": "banter.kiera.leave",
    "party_rules": {
      "refuses_hard_difficulty": true,
      "trust_threshold": 50,
      "preferred_intent": "support"
    },
    "equipment_slots": {
      "main_hand": null,
      "off_hand": null,
      "armor": null,
      "accessory": null
    },
    "skill_baselines": {
      "healing": 60,
      "nature": 70,
      "survival": 45
    }
  }',
  'hash_kiera_v1',
  'world.forest_glade',
  'adv.herbal_journey'
),
(
  'npc.talan',
  '{
    "id": "npc.talan",
    "name": "Talan",
    "role": "scout",
    "traits": ["stealth", "agile", "observant"],
    "recruitment_conditions": {
      "trust_min": 20,
      "quests_completed": [],
      "world_events": ["event.forest_clearing"]
    },
    "join_banter": "banter.talan.join",
    "leave_banter": "banter.talan.leave",
    "party_rules": {
      "refuses_hard_difficulty": false,
      "trust_threshold": 30,
      "preferred_intent": "scout"
    },
    "equipment_slots": {
      "main_hand": null,
      "off_hand": null,
      "armor": null,
      "accessory": null
    },
    "skill_baselines": {
      "stealth": 65,
      "perception": 70,
      "agility": 55
    }
  }',
  'hash_talan_v1',
  'world.forest_glade',
  'adv.herbal_journey'
);

-- Update npc_personalities with party rules
UPDATE npc_personalities 
SET party_rules = '{
  "refuses_hard_difficulty": true,
  "trust_threshold": 50,
  "preferred_intent": "support"
}'::jsonb
WHERE npc_id = 'npc.kiera';

UPDATE npc_personalities 
SET party_rules = '{
  "refuses_hard_difficulty": false,
  "trust_threshold": 30,
  "preferred_intent": "scout"
}'::jsonb
WHERE npc_id = 'npc.talan';

-- Add configuration table for party settings
CREATE TABLE IF NOT EXISTS party_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  max_active INTEGER DEFAULT 4,
  max_reserve INTEGER DEFAULT 6,
  max_acts_per_turn INTEGER DEFAULT 3,
  default_intent TEXT DEFAULT 'support',
  module_mode TEXT DEFAULT 'full' CHECK (module_mode IN ('off', 'readonly', 'full')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO party_config (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

-- Add RLS policy for party config
ALTER TABLE party_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read party config" ON party_config
  FOR SELECT USING (true);

CREATE POLICY "Admin users can manage party config" ON party_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Add trigger for party config updated_at
CREATE TRIGGER update_party_config_updated_at 
  BEFORE UPDATE ON party_config 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add down migration
CREATE OR REPLACE FUNCTION down_migration_phase18()
RETURNS void AS $$
BEGIN
  -- Remove party state from game_states
  ALTER TABLE game_states DROP COLUMN IF EXISTS party;
  
  -- Remove party rules from npc_personalities
  ALTER TABLE npc_personalities DROP COLUMN IF EXISTS party_rules;
  
  -- Drop companions registry
  DROP TABLE IF EXISTS companions_registry CASCADE;
  
  -- Drop party config
  DROP TABLE IF EXISTS party_config CASCADE;
  
  -- Drop indexes
  DROP INDEX IF EXISTS idx_companions_registry_world_ref;
  DROP INDEX IF EXISTS idx_companions_registry_adventure_ref;
  DROP INDEX IF EXISTS idx_companions_registry_hash;
  DROP INDEX IF EXISTS idx_game_states_party;
  DROP INDEX IF EXISTS idx_npc_personalities_party_rules;
END;
$$ LANGUAGE plpgsql;
