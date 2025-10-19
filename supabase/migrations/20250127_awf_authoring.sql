-- Phase 20: Authoring IDE & WorldBuilder API
-- Database schema for authoring drafts, publish history, and workspaces

-- Author drafts table
CREATE TABLE IF NOT EXISTS author_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type TEXT NOT NULL CHECK (doc_type IN (
    'core', 'world', 'adventure', 'start', 'quest_graph', 
    'items', 'recipes', 'loot', 'vendors', 'npc_personality', 
    'localization', 'sim_config', 'party_config', 'weather_zone',
    'region', 'event', 'npc_schedule'
  )),
  doc_ref TEXT NOT NULL,
  payload JSONB NOT NULL,
  format TEXT NOT NULL DEFAULT 'json' CHECK (format IN ('json', 'yaml')),
  updated_by UUID NOT NULL REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(doc_type, doc_ref)
);

-- Publish history table
CREATE TABLE IF NOT EXISTS publish_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type TEXT NOT NULL,
  doc_ref TEXT NOT NULL,
  from_draft_id UUID REFERENCES author_drafts(id),
  to_version TEXT NOT NULL,
  hash TEXT NOT NULL,
  changelog_path TEXT,
  playtest_report_path TEXT,
  published_by UUID NOT NULL REFERENCES auth.users(id),
  published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Author workspaces table (optional)
CREATE TABLE IF NOT EXISTS author_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  members UUID[] NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Author workspace members junction table
CREATE TABLE IF NOT EXISTS author_workspace_members (
  workspace_id UUID NOT NULL REFERENCES author_workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'editor', 'admin')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_author_drafts_doc_type_ref ON author_drafts(doc_type, doc_ref);
CREATE INDEX IF NOT EXISTS idx_author_drafts_updated_by ON author_drafts(updated_by);
CREATE INDEX IF NOT EXISTS idx_author_drafts_updated_at ON author_drafts(updated_at);
CREATE INDEX IF NOT EXISTS idx_publish_history_doc_type_ref ON publish_history(doc_type, doc_ref);
CREATE INDEX IF NOT EXISTS idx_publish_history_published_by ON publish_history(published_by);
CREATE INDEX IF NOT EXISTS idx_publish_history_published_at ON publish_history(published_at);
CREATE INDEX IF NOT EXISTS idx_author_workspaces_created_by ON author_workspaces(created_by);
CREATE INDEX IF NOT EXISTS idx_author_workspace_members_workspace_id ON author_workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_author_workspace_members_user_id ON author_workspace_members(user_id);

-- Add RLS policies for author drafts
ALTER TABLE author_drafts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own drafts
CREATE POLICY "Users can read own drafts" ON author_drafts
  FOR SELECT USING (updated_by = auth.uid());

-- Policy: Users can create their own drafts
CREATE POLICY "Users can create own drafts" ON author_drafts
  FOR INSERT WITH CHECK (updated_by = auth.uid());

-- Policy: Users can update their own drafts
CREATE POLICY "Users can update own drafts" ON author_drafts
  FOR UPDATE USING (updated_by = auth.uid());

-- Policy: Users can delete their own drafts
CREATE POLICY "Users can delete own drafts" ON author_drafts
  FOR DELETE USING (updated_by = auth.uid());

-- Policy: Admin users can manage all drafts
CREATE POLICY "Admin users can manage all drafts" ON author_drafts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Add RLS policies for publish history
ALTER TABLE publish_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read publish history
CREATE POLICY "Users can read publish history" ON publish_history
  FOR SELECT USING (true);

-- Policy: Admin users can manage publish history
CREATE POLICY "Admin users can manage publish history" ON publish_history
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Add RLS policies for author workspaces
ALTER TABLE author_workspaces ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read workspaces they're members of
CREATE POLICY "Users can read member workspaces" ON author_workspaces
  FOR SELECT USING (
    auth.uid() = ANY(members) OR 
    EXISTS (
      SELECT 1 FROM author_workspace_members 
      WHERE author_workspace_members.workspace_id = author_workspaces.id 
      AND author_workspace_members.user_id = auth.uid()
    )
  );

-- Policy: Users can create workspaces
CREATE POLICY "Users can create workspaces" ON author_workspaces
  FOR INSERT WITH CHECK (created_by = auth.uid());

-- Policy: Workspace admins can update workspaces
CREATE POLICY "Workspace admins can update workspaces" ON author_workspaces
  FOR UPDATE USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM author_workspace_members 
      WHERE author_workspace_members.workspace_id = author_workspaces.id 
      AND author_workspace_members.user_id = auth.uid()
      AND author_workspace_members.role = 'admin'
    )
  );

-- Add RLS policies for workspace members
ALTER TABLE author_workspace_members ENABLE ROW LEVEL SECURITY;

-- Policy: Workspace admins can manage members
CREATE POLICY "Workspace admins can manage members" ON author_workspace_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM author_workspace_members awm
      WHERE awm.workspace_id = author_workspace_members.workspace_id 
      AND awm.user_id = auth.uid()
      AND awm.role = 'admin'
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

CREATE TRIGGER update_author_drafts_updated_at 
  BEFORE UPDATE ON author_drafts 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_author_workspaces_updated_at 
  BEFORE UPDATE ON author_workspaces 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add sample author draft data
INSERT INTO author_drafts (doc_type, doc_ref, payload, format, updated_by, notes) VALUES
(
  'world',
  'world.forest_glade',
  '{
    "id": "world.forest_glade",
    "name": "Forest Glade",
    "description": "A peaceful forest realm with ancient magic",
    "tags": ["forest", "magic", "peaceful"],
    "settings": {
      "climate": "temperate",
      "magic_level": "high",
      "technology_level": "medieval"
    }
  }',
  'json',
  (SELECT id FROM auth.users LIMIT 1),
  'Initial world draft'
),
(
  'adventure',
  'adv.herbal_journey',
  '{
    "id": "adv.herbal_journey",
    "name": "The Herbal Journey",
    "description": "A quest to gather rare herbs",
    "world_ref": "world.forest_glade",
    "difficulty": "easy",
    "estimated_duration": "2-3 hours"
  }',
  'json',
  (SELECT id FROM auth.users LIMIT 1),
  'Herbal adventure draft'
),
(
  'quest_graph',
  'graph.herbal_journey',
  '{
    "id": "graph.herbal_journey",
    "adventure_ref": "adv.herbal_journey",
    "nodes": [
      {
        "id": "start",
        "type": "start",
        "title": "Begin the Journey",
        "description": "You stand at the edge of the forest"
      }
    ],
    "edges": []
  }',
  'json',
  (SELECT id FROM auth.users LIMIT 1),
  'Quest graph draft'
);

-- Add sample author workspace
INSERT INTO author_workspaces (name, members, created_by) VALUES
(
  'Forest Glade Team',
  ARRAY[(SELECT id FROM auth.users LIMIT 1)],
  (SELECT id FROM auth.users LIMIT 1)
);

-- Add workspace member
INSERT INTO author_workspace_members (workspace_id, user_id, role) VALUES
(
  (SELECT id FROM author_workspaces LIMIT 1),
  (SELECT id FROM auth.users LIMIT 1),
  'admin'
);

-- Add down migration
CREATE OR REPLACE FUNCTION down_migration_phase20()
RETURNS void AS $$
BEGIN
  -- Drop tables in reverse dependency order
  DROP TABLE IF EXISTS author_workspace_members CASCADE;
  DROP TABLE IF EXISTS author_workspaces CASCADE;
  DROP TABLE IF EXISTS publish_history CASCADE;
  DROP TABLE IF EXISTS author_drafts CASCADE;
  
  -- Drop indexes
  DROP INDEX IF EXISTS idx_author_drafts_doc_type_ref;
  DROP INDEX IF EXISTS idx_author_drafts_updated_by;
  DROP INDEX IF EXISTS idx_author_drafts_updated_at;
  DROP INDEX IF EXISTS idx_publish_history_doc_type_ref;
  DROP INDEX IF EXISTS idx_publish_history_published_by;
  DROP INDEX IF EXISTS idx_publish_history_published_at;
  DROP INDEX IF EXISTS idx_author_workspaces_created_by;
  DROP INDEX IF EXISTS idx_author_workspace_members_workspace_id;
  DROP INDEX IF EXISTS idx_author_workspace_members_user_id;
END;
$$ LANGUAGE plpgsql;


