-- Add missing tables for Chimera V3: stories and world-ruleset links
-- These tables are needed for the admin API routes

BEGIN;

-- ============================================================================
-- CHIMERA_STORIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS chimera_stories (
  id TEXT PRIMARY KEY,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'pending_approval', 'public')),
  display_name TEXT NOT NULL,
  description_short TEXT,
  world_id TEXT REFERENCES chimera_worlds(key) ON DELETE SET NULL, -- References chimera_worlds.key
  story_definition JSONB DEFAULT '{}',
  is_system_asset BOOLEAN NOT NULL DEFAULT false,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_chimera_stories_owner_user_id_display_name UNIQUE (owner_user_id, display_name)
);

CREATE INDEX idx_chimera_stories_owner_user_id ON chimera_stories(owner_user_id);
CREATE INDEX idx_chimera_stories_visibility ON chimera_stories(visibility);
CREATE INDEX idx_chimera_stories_world_id ON chimera_stories(world_id) WHERE world_id IS NOT NULL;

-- ============================================================================
-- CHIMERA_WORLD_RULESET_LINK
-- ============================================================================
-- Foreign keys reference key columns (which are UNIQUE) for PostgREST relationship syntax
CREATE TABLE IF NOT EXISTS chimera_world_ruleset_link (
  world_id TEXT NOT NULL REFERENCES chimera_worlds(key) ON DELETE CASCADE,
  ruleset_template_id TEXT NOT NULL REFERENCES chimera_ruleset_templates(key) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (world_id, ruleset_template_id)
);

CREATE INDEX idx_chimera_world_ruleset_link_world_id ON chimera_world_ruleset_link(world_id);
CREATE INDEX idx_chimera_world_ruleset_link_ruleset_template_id ON chimera_world_ruleset_link(ruleset_template_id);

-- ============================================================================
-- CHIMERA_STORY_LINKS
-- ============================================================================
CREATE TABLE IF NOT EXISTS chimera_story_links (
  story_id TEXT NOT NULL REFERENCES chimera_stories(id) ON DELETE CASCADE,
  ruleset_template_id TEXT NOT NULL REFERENCES chimera_ruleset_templates(key) ON DELETE CASCADE,
  PRIMARY KEY (story_id, ruleset_template_id)
);

CREATE INDEX idx_chimera_story_links_story_id ON chimera_story_links(story_id);
CREATE INDEX idx_chimera_story_links_ruleset_template_id ON chimera_story_links(ruleset_template_id);

-- ============================================================================
-- CHIMERA_STORY_ENTITY_LINKS
-- ============================================================================
CREATE TABLE IF NOT EXISTS chimera_story_entity_links (
  story_id TEXT NOT NULL REFERENCES chimera_stories(id) ON DELETE CASCADE,
  entity_template_id TEXT NOT NULL REFERENCES chimera_entities(key) ON DELETE CASCADE,
  PRIMARY KEY (story_id, entity_template_id)
);

CREATE INDEX idx_chimera_story_entity_links_story_id ON chimera_story_entity_links(story_id);
CREATE INDEX idx_chimera_story_entity_links_entity_template_id ON chimera_story_entity_links(entity_template_id);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE chimera_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE chimera_world_ruleset_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE chimera_story_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE chimera_story_entity_links ENABLE ROW LEVEL SECURITY;

-- Stories: owners can do everything, public can read public stories
CREATE POLICY chimera_stories_owner_full_access
ON chimera_stories
FOR ALL
TO authenticated
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY chimera_stories_public_read
ON chimera_stories
FOR SELECT
TO anon, authenticated
USING (visibility = 'public');

-- Links: same access as parent tables
CREATE POLICY chimera_world_ruleset_link_public_access
ON chimera_world_ruleset_link
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY chimera_story_links_owner_access
ON chimera_story_links
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM chimera_stories
    WHERE chimera_stories.id = chimera_story_links.story_id
    AND chimera_stories.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM chimera_stories
    WHERE chimera_stories.id = chimera_story_links.story_id
    AND chimera_stories.owner_user_id = auth.uid()
  )
);

CREATE POLICY chimera_story_entity_links_owner_access
ON chimera_story_entity_links
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM chimera_stories
    WHERE chimera_stories.id = chimera_story_entity_links.story_id
    AND chimera_stories.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM chimera_stories
    WHERE chimera_stories.id = chimera_story_entity_links.story_id
    AND chimera_stories.owner_user_id = auth.uid()
  )
);

COMMIT;

