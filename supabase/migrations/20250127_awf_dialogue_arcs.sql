-- Phase 21: Dynamic Dialogue System with Story Arcs
-- Database schema for dialogue graphs and story arcs

-- Dialogue graphs table
CREATE TABLE IF NOT EXISTS dialogue_graphs (
  id TEXT PRIMARY KEY,
  world_ref TEXT NOT NULL,
  adventure_ref TEXT,
  doc JSONB NOT NULL,
  hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(id, hash)
);

-- Story arcs table
CREATE TABLE IF NOT EXISTS story_arcs (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('npc', 'relationship')),
  world_ref TEXT NOT NULL,
  adventure_ref TEXT,
  doc JSONB NOT NULL,
  hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(id, hash)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_dialogue_graphs_world_ref ON dialogue_graphs(world_ref);
CREATE INDEX IF NOT EXISTS idx_dialogue_graphs_adventure_ref ON dialogue_graphs(adventure_ref);
CREATE INDEX IF NOT EXISTS idx_dialogue_graphs_hash ON dialogue_graphs(hash);
CREATE INDEX IF NOT EXISTS idx_story_arcs_world_ref ON story_arcs(world_ref);
CREATE INDEX IF NOT EXISTS idx_story_arcs_adventure_ref ON story_arcs(adventure_ref);
CREATE INDEX IF NOT EXISTS idx_story_arcs_scope ON story_arcs(scope);
CREATE INDEX IF NOT EXISTS idx_story_arcs_hash ON story_arcs(hash);

-- Extend game_states table with dialogue state
ALTER TABLE game_states 
ADD COLUMN IF NOT EXISTS dialogue JSONB DEFAULT '{
  "active_conv": null,
  "speaker_queue": [],
  "cooldowns": {},
  "emotions": {},
  "last_lines": []
}'::jsonb;

-- Extend game_states table with relationships state
ALTER TABLE game_states 
ADD COLUMN IF NOT EXISTS relationships JSONB DEFAULT '{
  "consent_map": {},
  "boundaries": {},
  "trust_levels": {},
  "romance_flags": {}
}'::jsonb;

-- Add index for dialogue queries
CREATE INDEX IF NOT EXISTS idx_game_states_dialogue ON game_states USING GIN (dialogue);
CREATE INDEX IF NOT EXISTS idx_game_states_relationships ON game_states USING GIN (relationships);

-- Add RLS policies for dialogue graphs
ALTER TABLE dialogue_graphs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read dialogue graphs
CREATE POLICY "Users can read dialogue graphs" ON dialogue_graphs
  FOR SELECT USING (true);

-- Policy: Admin users can manage dialogue graphs
CREATE POLICY "Admin users can manage dialogue graphs" ON dialogue_graphs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.auth_user_id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Add RLS policies for story arcs
ALTER TABLE story_arcs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read story arcs
CREATE POLICY "Users can read story arcs" ON story_arcs
  FOR SELECT USING (true);

-- Policy: Admin users can manage story arcs
CREATE POLICY "Admin users can manage story arcs" ON story_arcs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.auth_user_id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Add RLS policies for game_states dialogue data
-- Policy: Users can read their own dialogue state
CREATE POLICY "Users can read own dialogue state" ON game_states
  FOR SELECT USING (session_id = auth.uid());

-- Policy: Users can update their own dialogue state
CREATE POLICY "Users can update own dialogue state" ON game_states
  FOR UPDATE USING (session_id = auth.uid());

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_dialogue_graphs_updated_at 
  BEFORE UPDATE ON dialogue_graphs 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_story_arcs_updated_at 
  BEFORE UPDATE ON story_arcs 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add sample dialogue graph data
INSERT INTO dialogue_graphs (id, world_ref, adventure_ref, doc, hash) VALUES
(
  'conv.kiera.intro',
  'world.forest_glade',
  'adv.herbal_journey',
  '{
    "id": "conv.kiera.intro",
    "world_ref": "world.forest_glade",
    "adventure_ref": "adv.herbal_journey",
    "nodes": [
      {
        "id": "line.kiera.greeting",
        "type": "line",
        "speaker": "npc.kiera",
        "syn": "Warm greeting by the glade.",
        "emotion": ["warm", "curious"],
        "cooldown": 3
      },
      {
        "id": "branch.kiera.trust",
        "type": "branch",
        "guard": [{"rel": "kiera", "gte": 60}]
      },
      {
        "id": "line.kiera.tease",
        "type": "banter",
        "speaker": "npc.kiera",
        "syn": "Playful tease about your gear.",
        "emotion": ["playful"]
      },
      {
        "id": "line.kiera.trust",
        "type": "line",
        "speaker": "npc.kiera",
        "syn": "Shares a personal story about the forest.",
        "emotion": ["trusting", "vulnerable"]
      },
      {
        "id": "line.kiera.distant",
        "type": "line",
        "speaker": "npc.kiera",
        "syn": "Keeps conversation brief and professional.",
        "emotion": ["distant", "cautious"]
      }
    ],
    "edges": [
      {"from": "line.kiera.greeting", "to": "branch.kiera.trust"},
      {"from": "branch.kiera.trust", "to": "line.kiera.trust", "condition": "trust_high"},
      {"from": "branch.kiera.trust", "to": "line.kiera.distant", "condition": "trust_low"},
      {"from": "line.kiera.trust", "to": "line.kiera.tease"},
      {"from": "line.kiera.distant", "to": "line.kiera.tease"}
    ]
  }',
  'hash_kiera_intro_v1'
),
(
  'conv.talan.scout',
  'world.forest_glade',
  'adv.herbal_journey',
  '{
    "id": "conv.talan.scout",
    "world_ref": "world.forest_glade",
    "adventure_ref": "adv.herbal_journey",
    "nodes": [
      {
        "id": "line.talan.alert",
        "type": "line",
        "speaker": "npc.talan",
        "syn": "Reports movement in the forest.",
        "emotion": ["alert", "focused"]
      },
      {
        "id": "line.talan.all_clear",
        "type": "line",
        "speaker": "npc.talan",
        "syn": "All clear, no threats detected.",
        "emotion": ["relieved", "confident"]
      }
    ],
    "edges": []
  }',
  'hash_talan_scout_v1'
);

-- Add sample story arc data
INSERT INTO story_arcs (id, scope, world_ref, adventure_ref, doc, hash) VALUES
(
  'arc.kiera.trust',
  'npc',
  'world.forest_glade',
  'adv.herbal_journey',
  '{
    "id": "arc.kiera.trust",
    "scope": "npc",
    "world_ref": "world.forest_glade",
    "adventure_ref": "adv.herbal_journey",
    "npc_id": "npc.kiera",
    "phases": [
      {
        "id": "locked",
        "name": "Locked",
        "description": "Arc not yet available"
      },
      {
        "id": "available",
        "name": "Available",
        "description": "Arc can be started"
      },
      {
        "id": "active",
        "name": "Active",
        "description": "Arc in progress"
      },
      {
        "id": "completed",
        "name": "Completed",
        "description": "Arc finished"
      },
      {
        "id": "epilogue",
        "name": "Epilogue",
        "description": "Arc aftermath"
      }
    ],
    "steps": [
      {
        "id": "earn_trust",
        "name": "Earn Trust",
        "description": "Build trust with Kiera",
        "guards": [
          {"type": "relationship", "npc": "kiera", "min_trust": 40}
        ],
        "rewards": [
          {"type": "RELATIONSHIP_DELTA", "npc": "kiera", "trust_delta": 10}
        ]
      },
      {
        "id": "deepen_bond",
        "name": "Deepen Bond",
        "description": "Strengthen the relationship",
        "guards": [
          {"type": "relationship", "npc": "kiera", "min_trust": 70}
        ],
        "rewards": [
          {"type": "RELATIONSHIP_DELTA", "npc": "kiera", "trust_delta": 15}
        ]
      }
    ],
    "romance_flags": {
      "eligible": true,
      "min_trust": 65,
      "consent_required": true,
      "cooldown_turns": 3
    },
    "cooldowns": {
      "step_progression": 2,
      "romance_scenes": 5
    }
  }',
  'hash_kiera_trust_v1'
),
(
  'arc.kiera.talan.friendship',
  'relationship',
  'world.forest_glade',
  'adv.herbal_journey',
  '{
    "id": "arc.kiera.talan.friendship",
    "scope": "relationship",
    "world_ref": "world.forest_glade",
    "adventure_ref": "adv.herbal_journey",
    "participants": ["npc.kiera", "npc.talan"],
    "phases": [
      {
        "id": "locked",
        "name": "Locked",
        "description": "Relationship arc not available"
      },
      {
        "id": "available",
        "name": "Available",
        "description": "Can observe their interactions"
      },
      {
        "id": "active",
        "name": "Active",
        "description": "Watching their friendship develop"
      },
      {
        "id": "completed",
        "name": "Completed",
        "description": "Friendship established"
      }
    ],
    "steps": [
      {
        "id": "observe_interaction",
        "name": "Observe Interaction",
        "description": "Watch Kiera and Talan interact",
        "guards": [
          {"type": "presence", "npcs": ["kiera", "talan"]}
        ]
      },
      {
        "id": "facilitate_bond",
        "name": "Facilitate Bond",
        "description": "Help them connect",
        "guards": [
          {"type": "relationship", "npc": "kiera", "min_trust": 50},
          {"type": "relationship", "npc": "talan", "min_trust": 50}
        ]
      }
    ],
    "romance_flags": {
      "eligible": false
    }
  }',
  'hash_kiera_talan_friendship_v1'
);

-- Add configuration table for dialogue system
CREATE TABLE IF NOT EXISTS dialogue_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  module_mode TEXT DEFAULT 'full' CHECK (module_mode IN ('off', 'readonly', 'full')),
  max_tokens INTEGER DEFAULT 220,
  max_candidates INTEGER DEFAULT 3,
  romance_enabled BOOLEAN DEFAULT true,
  romance_min_trust INTEGER DEFAULT 65,
  romance_cooldown_turns INTEGER DEFAULT 3,
  safety_explicit_block BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO dialogue_config (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

-- Add RLS policy for dialogue config
ALTER TABLE dialogue_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read dialogue config" ON dialogue_config
  FOR SELECT USING (true);

CREATE POLICY "Admin users can manage dialogue config" ON dialogue_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.auth_user_id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Add trigger for dialogue config updated_at
CREATE TRIGGER update_dialogue_config_updated_at 
  BEFORE UPDATE ON dialogue_config 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add down migration
CREATE OR REPLACE FUNCTION down_migration_phase21()
RETURNS void AS $$
BEGIN
  -- Remove dialogue and relationships state from game_states
  ALTER TABLE game_states DROP COLUMN IF EXISTS dialogue;
  ALTER TABLE game_states DROP COLUMN IF EXISTS relationships;
  
  -- Drop dialogue system tables
  DROP TABLE IF EXISTS dialogue_graphs CASCADE;
  DROP TABLE IF EXISTS story_arcs CASCADE;
  DROP TABLE IF EXISTS dialogue_config CASCADE;
  
  -- Drop indexes
  DROP INDEX IF EXISTS idx_dialogue_graphs_world_ref;
  DROP INDEX IF EXISTS idx_dialogue_graphs_adventure_ref;
  DROP INDEX IF EXISTS idx_dialogue_graphs_hash;
  DROP INDEX IF EXISTS idx_story_arcs_world_ref;
  DROP INDEX IF EXISTS idx_story_arcs_adventure_ref;
  DROP INDEX IF EXISTS idx_story_arcs_scope;
  DROP INDEX IF EXISTS idx_story_arcs_hash;
  DROP INDEX IF EXISTS idx_game_states_dialogue;
  DROP INDEX IF EXISTS idx_game_states_relationships;
END;
$$ LANGUAGE plpgsql;
