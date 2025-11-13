-- Admin Media Phase 1b: Typed Links, Asset-Centric Schema, RLS Refinements
-- Removes entity_id from media_assets (asset-centric)
-- Replaces polymorphic media_links with typed columns (world_id, story_id, npc_id)
-- Adds unique constraint on (provider, provider_key)
-- Adds created_at index for approval queues
-- Migrates existing data if old media_links exists
-- Updates RLS policies to use typed columns

BEGIN;

-- ============================================================================
-- MEDIA_ASSETS: Remove entity_id, add unique constraint and index
-- ============================================================================

-- Drop entity_id column (asset-centric design)
ALTER TABLE public.media_assets
  DROP COLUMN IF EXISTS entity_id;

-- Drop the old entity index (no longer needed)
DROP INDEX IF EXISTS public.idx_media_assets_entity;

-- Add unique constraint on (provider, provider_key) to prevent duplicates
-- Use DO block to handle gracefully if constraint already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'media_assets_provider_key_unique'
      AND conrelid = 'public.media_assets'::regclass
  ) THEN
    ALTER TABLE public.media_assets
      ADD CONSTRAINT media_assets_provider_key_unique
      UNIQUE (provider, provider_key);
  END IF;
END $$;

-- Add index on created_at for approval queue queries
CREATE INDEX IF NOT EXISTS idx_media_assets_created_at
  ON public.media_assets(created_at);

-- Add index on image_review_status for approval queue queries
CREATE INDEX IF NOT EXISTS idx_media_assets_image_review_status
  ON public.media_assets(image_review_status);

-- Add composite index for pending queue queries (image_review_status, created_at DESC)
-- Phase 2e refinement: Index verified for keyset pagination
-- EXPLAIN ANALYZE on: SELECT * FROM media_assets WHERE image_review_status = 'pending' ORDER BY created_at DESC, id DESC LIMIT 25;
-- Expected: Uses idx_media_assets_review_status_created_at for WHERE + ORDER BY
CREATE INDEX IF NOT EXISTS idx_media_assets_review_status_created_at
  ON public.media_assets(image_review_status, created_at DESC)
  WHERE image_review_status = 'pending';

-- Add content_type column if not present (for downstream headers)
ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS content_type text NULL;

-- ============================================================================
-- MEDIA_LINKS: Migrate to typed columns if old table exists
-- ============================================================================

-- Check if media_links exists and migrate if needed
DO $$
DECLARE
  table_exists boolean;
  has_old_shape boolean;
  has_new_shape boolean;
BEGIN
  -- Check if media_links table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'media_links'
  ) INTO table_exists;

  -- If table doesn't exist, create it with new shape directly
  IF NOT table_exists THEN
    -- Create media_links with typed columns (fresh DB)
    CREATE TABLE public.media_links (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      world_id text NULL, -- matches public.worlds.id (TEXT)
      story_id text NULL, -- matches public.entry_points.id (TEXT)
      npc_id uuid NULL, -- matches public.npcs.id (UUID)
      media_id uuid NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
      role text NOT NULL DEFAULT 'gallery',
      sort_order int NOT NULL DEFAULT 0,
      -- Ensure exactly one of the three typed columns is non-null
      CONSTRAINT media_links_one_target CHECK (
        (world_id IS NOT NULL)::int +
        (story_id IS NOT NULL)::int +
        (npc_id IS NOT NULL)::int = 1
      )
    );

    -- Unique index: one media asset per entity
    CREATE UNIQUE INDEX media_links_entity_media_unique
      ON public.media_links (
        COALESCE(world_id::text, story_id::text, npc_id::text),
        media_id
      );

    -- Indexes for fast lookups by entity type
    CREATE INDEX idx_media_links_world
      ON public.media_links(world_id, sort_order)
      WHERE world_id IS NOT NULL;

    CREATE INDEX idx_media_links_story
      ON public.media_links(story_id, sort_order)
      WHERE story_id IS NOT NULL;

    CREATE INDEX idx_media_links_npc
      ON public.media_links(npc_id, sort_order)
      WHERE npc_id IS NOT NULL;

    -- Enable RLS
    ALTER TABLE public.media_links ENABLE ROW LEVEL SECURITY;
  ELSE
    -- Table exists, check shape
    -- Check for old shape: entity_type and entity_id columns
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'media_links'
        AND column_name = 'entity_type'
    ) INTO has_old_shape;

    -- Check for new shape: world_id, story_id, or npc_id columns
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'media_links'
        AND column_name IN ('world_id', 'story_id', 'npc_id')
    ) INTO has_new_shape;

    -- If old shape exists and new shape doesn't, migrate
    IF has_old_shape AND NOT has_new_shape THEN
    -- Create media_links_v2 with typed columns
    -- worlds.id and entry_points.id are TEXT, npcs.id is UUID
    CREATE TABLE IF NOT EXISTS public.media_links_v2 (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      world_id text NULL, -- matches public.worlds.id (TEXT)
      story_id text NULL, -- matches public.entry_points.id (TEXT)
      npc_id uuid NULL, -- matches public.npcs.id (UUID)
      media_id uuid NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
      role text NOT NULL DEFAULT 'gallery',
      sort_order int NOT NULL DEFAULT 0,
      -- Ensure exactly one of the three typed columns is non-null
      CONSTRAINT media_links_one_target CHECK (
        (world_id IS NOT NULL)::int +
        (story_id IS NOT NULL)::int +
        (npc_id IS NOT NULL)::int = 1
      )
    );

    -- Unique index: one media asset per entity (using coalesce to handle different types)
    -- Note: Using unique index instead of constraint because COALESCE is not supported in UNIQUE constraints
    CREATE UNIQUE INDEX IF NOT EXISTS media_links_entity_media_unique
      ON public.media_links_v2 (
        COALESCE(world_id::text, story_id::text, npc_id::text),
        media_id
      );

    -- Indexes for fast lookups by entity type
    CREATE INDEX IF NOT EXISTS idx_media_links_world
      ON public.media_links_v2(world_id, sort_order)
      WHERE world_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_media_links_story
      ON public.media_links_v2(story_id, sort_order)
      WHERE story_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_media_links_npc
      ON public.media_links_v2(npc_id, sort_order)
      WHERE npc_id IS NOT NULL;

    -- Migrate data from old table to new table
    INSERT INTO public.media_links_v2 (
      id,
      world_id,
      story_id,
      npc_id,
      media_id,
      role,
      sort_order
    )
    SELECT
      id,
      CASE WHEN entity_type = 'world' THEN entity_id ELSE NULL END,
      CASE WHEN entity_type = 'story' THEN entity_id ELSE NULL END,
      CASE WHEN entity_type = 'npc' THEN entity_id::uuid ELSE NULL END,
      media_id,
      role,
      sort_order
    FROM public.media_links
    ON CONFLICT DO NOTHING; -- Skip duplicates if any

    -- Drop RLS policies on old table
    DROP POLICY IF EXISTS "media_links_owner_manage" ON public.media_links;
    DROP POLICY IF EXISTS "media_links_admin_full" ON public.media_links;

      -- Rename old table to backup
      ALTER TABLE public.media_links RENAME TO media_links_old;

      -- Rename v2 to canonical
      ALTER TABLE public.media_links_v2 RENAME TO media_links;

      -- Enable RLS on new table
      ALTER TABLE public.media_links ENABLE ROW LEVEL SECURITY;
    END IF;
    -- If new shape already exists, do nothing (idempotent)
  END IF;
END $$;

-- ============================================================================
-- RLS POLICIES FOR MEDIA_LINKS (idempotent re-create)
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "media_links_owner_manage" ON public.media_links;
DROP POLICY IF EXISTS "media_links_admin_full" ON public.media_links;

-- Owner manage: owners can manage links only for entities they own
-- and only when publish_status = 'draft'
-- Uses typed columns for efficient joins
CREATE POLICY "media_links_owner_manage"
ON public.media_links
FOR ALL
TO authenticated
USING (
  -- For worlds (world_id is text, matches worlds.id)
  (world_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.worlds w
    WHERE w.id = media_links.world_id
      AND w.owner_user_id = auth.uid()
      AND w.publish_status = 'draft'
  ))
  OR
  -- For entry_points/stories (story_id is text, matches entry_points.id)
  (story_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.entry_points ep
    WHERE ep.id = media_links.story_id
      AND ep.owner_user_id = auth.uid()
      AND ep.publish_status = 'draft'
  ))
  OR
  -- For npcs (npc_id is uuid, matches npcs.id)
  (npc_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.npcs n
    WHERE n.id = media_links.npc_id
      AND n.owner_user_id = auth.uid()
      AND n.publish_status = 'draft'
  ))
)
WITH CHECK (
  -- For worlds
  (world_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.worlds w
    WHERE w.id = media_links.world_id
      AND w.owner_user_id = auth.uid()
      AND w.publish_status = 'draft'
  ))
  OR
  -- For entry_points/stories
  (story_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.entry_points ep
    WHERE ep.id = media_links.story_id
      AND ep.owner_user_id = auth.uid()
      AND ep.publish_status = 'draft'
  ))
  OR
  -- For npcs
  (npc_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.npcs n
    WHERE n.id = media_links.npc_id
      AND n.owner_user_id = auth.uid()
      AND n.publish_status = 'draft'
  ))
);

-- Admin full: is_admin() bypass for all operations
CREATE POLICY "media_links_admin_full"
ON public.media_links
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

COMMIT;

