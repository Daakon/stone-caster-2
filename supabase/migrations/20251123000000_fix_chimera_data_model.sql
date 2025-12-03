-- Fix Chimera Data Model: Separate Draft Projects from Compiled Games
-- This migration:
-- 1. Adds `configuration` JSONB to chimera_stories (stores Casting Circle state)
-- 2. Updates compiled_stories to reference source_story_id and store compiled artifacts
-- 3. Removes dependency on chimera_world_ruleset_link for stories

BEGIN;

-- ============================================================================
-- UPDATE CHIMERA_STORIES: Add configuration JSONB field
-- ============================================================================
-- Add configuration column to store Casting Circle state
-- Format: { "worldId": "...", "rulesetIds": ["..."], "entityIds": ["..."] }
ALTER TABLE chimera_stories
ADD COLUMN IF NOT EXISTS configuration JSONB DEFAULT '{}'::jsonb;

-- Create index on configuration for efficient queries
CREATE INDEX IF NOT EXISTS idx_chimera_stories_configuration 
  ON chimera_stories USING gin (configuration);

COMMENT ON COLUMN chimera_stories.configuration IS 
  'JSONB field storing the Casting Circle state: { "worldId": "...", "rulesetIds": ["..."], "entityIds": ["..."] }';

-- ============================================================================
-- UPDATE COMPILED_STORIES: Add source_story_id and compiled artifacts
-- ============================================================================
-- Add source_story_id to reference the draft story
-- Note: chimera_stories.id is UUID, so source_story_id must be UUID
ALTER TABLE compiled_stories
ADD COLUMN IF NOT EXISTS source_story_id UUID REFERENCES chimera_stories(id) ON DELETE CASCADE;

-- Rename 'compiled' to 'compiled_schema' for clarity
-- Note: We'll keep 'compiled' for backward compatibility, but add 'compiled_schema' as alias
ALTER TABLE compiled_stories
ADD COLUMN IF NOT EXISTS compiled_schema JSONB;

-- Add initial_state for game engine
ALTER TABLE compiled_stories
ADD COLUMN IF NOT EXISTS initial_state JSONB DEFAULT '{}'::jsonb;

-- Create index on source_story_id
CREATE INDEX IF NOT EXISTS idx_compiled_stories_source_story_id 
  ON compiled_stories(source_story_id);

COMMENT ON COLUMN compiled_stories.source_story_id IS 
  'Foreign key to chimera_stories.id. References the draft story that was compiled.';
COMMENT ON COLUMN compiled_stories.compiled_schema IS 
  'The compiled schema/definition (alias for compiled field).';
COMMENT ON COLUMN compiled_stories.initial_state IS 
  'The initial game state when starting a new game from this compiled story.';

-- ============================================================================
-- MIGRATION: Backfill configuration from existing junction tables
-- ============================================================================
-- For existing stories, populate configuration from junction tables
-- This is a one-time migration for existing data
DO $$
DECLARE
  story_record RECORD;
  world_id_val TEXT;
  ruleset_ids TEXT[];
  entity_ids TEXT[];
BEGIN
  FOR story_record IN 
    SELECT id, world_id FROM chimera_stories WHERE configuration = '{}'::jsonb OR configuration IS NULL
  LOOP
    -- Get world_id
    world_id_val := story_record.world_id;
    
    -- Get ruleset IDs from chimera_story_links
    -- Use array() constructor to ensure TEXT[] type
    SELECT CASE 
      WHEN COUNT(*) = 0 THEN ARRAY[]::TEXT[]
      ELSE array_agg(ruleset_template_id::TEXT)
    END
    INTO ruleset_ids
    FROM chimera_story_links
    WHERE story_id = story_record.id;
    
    -- Get entity IDs from chimera_story_entity_links
    -- Use array() constructor to ensure TEXT[] type
    SELECT CASE 
      WHEN COUNT(*) = 0 THEN ARRAY[]::TEXT[]
      ELSE array_agg(entity_template_id::TEXT)
    END
    INTO entity_ids
    FROM chimera_story_entity_links
    WHERE story_id = story_record.id;
    
    -- Update configuration
    UPDATE chimera_stories
    SET configuration = jsonb_build_object(
      'worldId', COALESCE(world_id_val, ''),
      'rulesetIds', COALESCE(ruleset_ids, ARRAY[]::TEXT[]),
      'entityIds', COALESCE(entity_ids, ARRAY[]::TEXT[])
    )
    WHERE id = story_record.id;
  END LOOP;
END $$;

-- ============================================================================
-- MIGRATION: Backfill compiled_schema from compiled field
-- ============================================================================
-- Copy existing 'compiled' data to 'compiled_schema' for backward compatibility
UPDATE compiled_stories
SET compiled_schema = compiled
WHERE compiled_schema IS NULL AND compiled IS NOT NULL;

COMMIT;

