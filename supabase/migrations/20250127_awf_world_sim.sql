-- Phase 19: World Simulation
-- Database schema for world regions, events, and NPC schedules

-- World regions table
CREATE TABLE IF NOT EXISTS world_regions (
  id TEXT PRIMARY KEY,
  world_ref TEXT NOT NULL,
  doc JSONB NOT NULL,
  hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(id, hash)
);

-- World events table
CREATE TABLE IF NOT EXISTS world_events (
  id TEXT PRIMARY KEY,
  world_ref TEXT NOT NULL,
  doc JSONB NOT NULL,
  hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(id, hash)
);

-- NPC schedules table
CREATE TABLE IF NOT EXISTS npc_schedules (
  npc_id TEXT NOT NULL,
  world_ref TEXT NOT NULL,
  doc JSONB NOT NULL,
  hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (npc_id, world_ref),
  UNIQUE(npc_id, world_ref, hash)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_world_regions_world_ref ON world_regions(world_ref);
CREATE INDEX IF NOT EXISTS idx_world_regions_hash ON world_regions(hash);
CREATE INDEX IF NOT EXISTS idx_world_events_world_ref ON world_events(world_ref);
CREATE INDEX IF NOT EXISTS idx_world_events_hash ON world_events(hash);
CREATE INDEX IF NOT EXISTS idx_npc_schedules_world_ref ON npc_schedules(world_ref);
CREATE INDEX IF NOT EXISTS idx_npc_schedules_npc_id ON npc_schedules(npc_id);

-- Extend game_states table with simulation state
ALTER TABLE game_states 
ADD COLUMN IF NOT EXISTS sim JSONB DEFAULT '{
  "clock": { "day_index": 0, "band": "Dawn" },
  "weather": { "region": "region.forest_glade", "state": "clear", "front": "none" },
  "regions": {},
  "npcs": {}
}'::jsonb;

-- Add index for simulation queries
CREATE INDEX IF NOT EXISTS idx_game_states_sim ON game_states USING GIN (sim);

-- Add RLS policies for world regions
ALTER TABLE world_regions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read world regions
CREATE POLICY "Users can read world regions" ON world_regions
  FOR SELECT USING (true);

-- Policy: Admin users can manage world regions
CREATE POLICY "Admin users can manage world regions" ON world_regions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.auth_user_id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Add RLS policies for world events
ALTER TABLE world_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read world events
CREATE POLICY "Users can read world events" ON world_events
  FOR SELECT USING (true);

-- Policy: Admin users can manage world events
CREATE POLICY "Admin users can manage world events" ON world_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.auth_user_id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Add RLS policies for NPC schedules
ALTER TABLE npc_schedules ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read NPC schedules
CREATE POLICY "Users can read NPC schedules" ON npc_schedules
  FOR SELECT USING (true);

-- Policy: Admin users can manage NPC schedules
CREATE POLICY "Admin users can manage NPC schedules" ON npc_schedules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.auth_user_id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Add RLS policies for game_states simulation data
-- Policy: Users can read their own simulation state
CREATE POLICY "Users can read own simulation state" ON game_states
  FOR SELECT USING (session_id = auth.uid());

-- Policy: Users can update their own simulation state
CREATE POLICY "Users can update own simulation state" ON game_states
  FOR UPDATE USING (session_id = auth.uid());

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_world_regions_updated_at 
  BEFORE UPDATE ON world_regions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_world_events_updated_at 
  BEFORE UPDATE ON world_events 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_npc_schedules_updated_at 
  BEFORE UPDATE ON npc_schedules 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add sample world region data
INSERT INTO world_regions (id, world_ref, doc, hash) VALUES
(
  'region.forest_glade',
  'world.forest_glade',
  '{
    "id": "region.forest_glade",
    "name": "Forest Glade",
    "coords": [45.2, 12.8],
    "tags": ["forest", "safe", "herbal"],
    "base_prosperity": 60,
    "base_threat": 20,
    "base_travel_risk": 10,
    "drift_rules": {
      "prosperity": { "min": 40, "max": 80, "step": 2 },
      "threat": { "min": 10, "max": 40, "step": 1 },
      "travel_risk": { "min": 5, "max": 25, "step": 1 }
    },
    "weather_zone": "temperate",
    "nearby_regions": ["region.mountain_pass", "region.river_crossing"]
  }',
  'hash_forest_glade_v1'
),
(
  'region.mountain_pass',
  'world.forest_glade',
  '{
    "id": "region.mountain_pass",
    "name": "Mountain Pass",
    "coords": [47.1, 15.3],
    "tags": ["mountain", "dangerous", "trade_route"],
    "base_prosperity": 40,
    "base_threat": 60,
    "base_travel_risk": 30,
    "drift_rules": {
      "prosperity": { "min": 20, "max": 60, "step": 3 },
      "threat": { "min": 40, "max": 80, "step": 2 },
      "travel_risk": { "min": 20, "max": 50, "step": 2 }
    },
    "weather_zone": "alpine",
    "nearby_regions": ["region.forest_glade", "region.river_crossing"]
  }',
  'hash_mountain_pass_v1'
);

-- Add sample world event data
INSERT INTO world_events (id, world_ref, doc, hash) VALUES
(
  'event.festival_herbal',
  'world.forest_glade',
  '{
    "id": "event.festival_herbal",
    "name": "Herbal Festival",
    "type": "festival",
    "guards": {
      "region_prosperity_min": 50,
      "band": ["Dawn", "Morning"],
      "rarity": 0.1
    },
    "trigger_window": {
      "start_day": 0,
      "end_day": 365,
      "frequency": "weekly"
    },
    "effects": [
      { "type": "REGION_DELTA", "regionId": "region.forest_glade", "prosperityDelta": 10 },
      { "type": "WORLD_FLAG_SET", "key": "festival_active", "val": true }
    ],
    "duration": 2,
    "rarity_weight": 10
  }',
  'hash_festival_herbal_v1'
),
(
  'event.beast_activity',
  'world.forest_glade',
  '{
    "id": "event.beast_activity",
    "name": "Beast Activity",
    "type": "threat",
    "guards": {
      "region_threat_min": 30,
      "band": ["Evening", "Night"],
      "rarity": 0.05
    },
    "trigger_window": {
      "start_day": 0,
      "end_day": 365,
      "frequency": "daily"
    },
    "effects": [
      { "type": "REGION_DELTA", "regionId": "region.forest_glade", "threatDelta": 5 },
      { "type": "WORLD_FLAG_SET", "key": "beast_activity", "val": true }
    ],
    "duration": 1,
    "rarity_weight": 5
  }',
  'hash_beast_activity_v1'
);

-- Add sample NPC schedule data
INSERT INTO npc_schedules (npc_id, world_ref, doc, hash) VALUES
(
  'npc.kiera',
  'world.forest_glade',
  '{
    "npc_id": "npc.kiera",
    "world_ref": "world.forest_glade",
    "entries": [
      {
        "band": "Dawn",
        "location": "location.herbal_garden",
        "intent": "gather_herbs",
        "except": {
          "weather": "storm",
          "events": ["event.festival_herbal"]
        }
      },
      {
        "band": "Morning",
        "location": "location.herbal_garden",
        "intent": "tend_garden",
        "except": {
          "weather": "storm"
        }
      },
      {
        "band": "Afternoon",
        "location": "location.herbal_shop",
        "intent": "sell_herbs",
        "except": {
          "weather": "storm"
        }
      },
      {
        "band": "Evening",
        "location": "location.herbal_garden",
        "intent": "rest",
        "except": {}
      },
      {
        "band": "Night",
        "location": "location.herbal_cottage",
        "intent": "sleep",
        "except": {}
      }
    ],
    "behavior_variance": {
      "curiosity": 0.1,
      "caution": 0.05,
      "social": 0.15
    }
  }',
  'hash_kiera_schedule_v1'
),
(
  'npc.talan',
  'world.forest_glade',
  '{
    "npc_id": "npc.talan",
    "world_ref": "world.forest_glade",
    "entries": [
      {
        "band": "Dawn",
        "location": "location.forest_edge",
        "intent": "scout",
        "except": {
          "weather": "storm"
        }
      },
      {
        "band": "Morning",
        "location": "location.forest_path",
        "intent": "patrol",
        "except": {
          "weather": "storm"
        }
      },
      {
        "band": "Afternoon",
        "location": "location.forest_deep",
        "intent": "hunt",
        "except": {
          "weather": "storm"
        }
      },
      {
        "band": "Evening",
        "location": "location.forest_edge",
        "intent": "guard",
        "except": {}
      },
      {
        "band": "Night",
        "location": "location.forest_camp",
        "intent": "sleep",
        "except": {}
      }
    ],
    "behavior_variance": {
      "curiosity": 0.2,
      "caution": 0.1,
      "social": 0.05
    }
  }',
  'hash_talan_schedule_v1'
);

-- Add configuration table for world simulation
CREATE TABLE IF NOT EXISTS world_sim_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  module_mode TEXT DEFAULT 'full' CHECK (module_mode IN ('off', 'readonly', 'full')),
  max_sim_tokens INTEGER DEFAULT 260,
  max_nearby_npcs INTEGER DEFAULT 4,
  max_nearby_regions INTEGER DEFAULT 3,
  event_rate TEXT DEFAULT 'normal' CHECK (event_rate IN ('low', 'normal', 'high')),
  weather_transition TEXT DEFAULT 'clear:0.7,overcast:0.2,rain:0.1',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO world_sim_config (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

-- Add RLS policy for world sim config
ALTER TABLE world_sim_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read world sim config" ON world_sim_config
  FOR SELECT USING (true);

CREATE POLICY "Admin users can manage world sim config" ON world_sim_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Add trigger for world sim config updated_at
CREATE TRIGGER update_world_sim_config_updated_at 
  BEFORE UPDATE ON world_sim_config 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add down migration
CREATE OR REPLACE FUNCTION down_migration_phase19()
RETURNS void AS $$
BEGIN
  -- Remove simulation state from game_states
  ALTER TABLE game_states DROP COLUMN IF EXISTS sim;
  
  -- Drop world simulation tables
  DROP TABLE IF EXISTS world_regions CASCADE;
  DROP TABLE IF EXISTS world_events CASCADE;
  DROP TABLE IF EXISTS npc_schedules CASCADE;
  DROP TABLE IF EXISTS world_sim_config CASCADE;
  
  -- Drop indexes
  DROP INDEX IF EXISTS idx_world_regions_world_ref;
  DROP INDEX IF EXISTS idx_world_regions_hash;
  DROP INDEX IF EXISTS idx_world_events_world_ref;
  DROP INDEX IF EXISTS idx_world_events_hash;
  DROP INDEX IF EXISTS idx_npc_schedules_world_ref;
  DROP INDEX IF EXISTS idx_npc_schedules_npc_id;
  DROP INDEX IF EXISTS idx_game_states_sim;
END;
$$ LANGUAGE plpgsql;
