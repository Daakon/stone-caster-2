-- Admin Media Phase 1: Schema & RLS Foundation
-- Creates media_assets and media_links tables with RLS policies
-- Adds cover_media_id references to worlds, entry_points (stories), and npcs
-- Adds publish_status fields if not present
-- Idempotent: safe to run on fresh or existing DBs

BEGIN;

-- ============================================================================
-- MEDIA ASSETS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('npc', 'world', 'story', 'site')),
  entity_id text NULL, -- points to npcs (uuid), worlds (text), entry_points/stories (text)
  provider text NOT NULL DEFAULT 'cloudflare_images',
  provider_key text NOT NULL, -- Cloudflare Images ID
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'unlisted', 'public')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed')),
  image_review_status text NOT NULL DEFAULT 'approved' CHECK (image_review_status IN ('pending', 'approved', 'rejected')),
  width int NULL,
  height int NULL,
  sha256 text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  ready_at timestamptz NULL
);

-- Indexes for media_assets
CREATE INDEX IF NOT EXISTS idx_media_assets_entity ON public.media_assets(kind, entity_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_visibility ON public.media_assets(visibility);
CREATE INDEX IF NOT EXISTS idx_media_assets_status ON public.media_assets(status);
CREATE INDEX IF NOT EXISTS idx_media_assets_owner ON public.media_assets(owner_user_id);

-- ============================================================================
-- MEDIA LINKS TABLE (Gallery links)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.media_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('npc', 'world', 'story')),
  entity_id text NOT NULL, -- npcs (uuid as text), worlds (text), entry_points/stories (text)
  media_id uuid NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'gallery',
  sort_order int NOT NULL DEFAULT 0,
  UNIQUE (entity_type, entity_id, media_id)
);

-- Indexes for media_links
CREATE INDEX IF NOT EXISTS idx_media_links_entity ON public.media_links(entity_type, entity_id, sort_order);

-- ============================================================================
-- COVER MEDIA REFERENCES
-- ============================================================================

-- Add cover_media_id to worlds (idempotent)
ALTER TABLE public.worlds
  ADD COLUMN IF NOT EXISTS cover_media_id uuid NULL REFERENCES public.media_assets(id) ON DELETE SET NULL;

-- Add cover_media_id to entry_points (stories) (idempotent)
ALTER TABLE public.entry_points
  ADD COLUMN IF NOT EXISTS cover_media_id uuid NULL REFERENCES public.media_assets(id) ON DELETE SET NULL;

-- Add cover_media_id to npcs (idempotent)
ALTER TABLE public.npcs
  ADD COLUMN IF NOT EXISTS cover_media_id uuid NULL REFERENCES public.media_assets(id) ON DELETE SET NULL;

-- ============================================================================
-- PUBLISH STATUS FIELDS (idempotent)
-- ============================================================================

-- Add publish_status, published_at, published_by to worlds if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'worlds' AND column_name = 'publish_status'
  ) THEN
    ALTER TABLE public.worlds
      ADD COLUMN publish_status text NOT NULL DEFAULT 'draft' CHECK (publish_status IN ('draft', 'in_review', 'published', 'rejected'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'worlds' AND column_name = 'published_at'
  ) THEN
    ALTER TABLE public.worlds
      ADD COLUMN published_at timestamptz NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'worlds' AND column_name = 'published_by'
  ) THEN
    ALTER TABLE public.worlds
      ADD COLUMN published_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add publish_status, published_at, published_by to entry_points if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'entry_points' AND column_name = 'publish_status'
  ) THEN
    ALTER TABLE public.entry_points
      ADD COLUMN publish_status text NOT NULL DEFAULT 'draft' CHECK (publish_status IN ('draft', 'in_review', 'published', 'rejected'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'entry_points' AND column_name = 'published_at'
  ) THEN
    ALTER TABLE public.entry_points
      ADD COLUMN published_at timestamptz NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'entry_points' AND column_name = 'published_by'
  ) THEN
    ALTER TABLE public.entry_points
      ADD COLUMN published_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add publish_status, published_at, published_by to npcs if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'npcs' AND column_name = 'publish_status'
  ) THEN
    ALTER TABLE public.npcs
      ADD COLUMN publish_status text NOT NULL DEFAULT 'draft' CHECK (publish_status IN ('draft', 'in_review', 'published', 'rejected'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'npcs' AND column_name = 'published_at'
  ) THEN
    ALTER TABLE public.npcs
      ADD COLUMN published_at timestamptz NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'npcs' AND column_name = 'published_by'
  ) THEN
    ALTER TABLE public.npcs
      ADD COLUMN published_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- ENABLE RLS
-- ============================================================================

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_links ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES FOR MEDIA_ASSETS
-- ============================================================================

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "media_assets_owner_read" ON public.media_assets;
DROP POLICY IF EXISTS "media_assets_public_read" ON public.media_assets;
DROP POLICY IF EXISTS "media_assets_owner_insert" ON public.media_assets;
DROP POLICY IF EXISTS "media_assets_owner_update" ON public.media_assets;
DROP POLICY IF EXISTS "media_assets_admin_full" ON public.media_assets;

-- Owner read: owners can select rows where owner_user_id = auth.uid()
CREATE POLICY "media_assets_owner_read"
ON public.media_assets
FOR SELECT
TO authenticated
USING (owner_user_id = auth.uid());

-- Public read: anyone can select rows where visibility = 'public'
CREATE POLICY "media_assets_public_read"
ON public.media_assets
FOR SELECT
TO anon, authenticated
USING (visibility = 'public');

-- Owner insert: owners can insert with owner_user_id = auth.uid()
CREATE POLICY "media_assets_owner_insert"
ON public.media_assets
FOR INSERT
TO authenticated
WITH CHECK (owner_user_id = auth.uid());

-- Owner update: owners can update only their rows
CREATE POLICY "media_assets_owner_update"
ON public.media_assets
FOR UPDATE
TO authenticated
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());

-- Admin full: if is_admin() = true, allow select/insert/update/delete unconditionally
CREATE POLICY "media_assets_admin_full"
ON public.media_assets
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ============================================================================
-- RLS POLICIES FOR MEDIA_LINKS
-- ============================================================================

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "media_links_owner_manage" ON public.media_links;
DROP POLICY IF EXISTS "media_links_admin_full" ON public.media_links;

-- Owner manage: owners can select/insert/update/delete links only for entities they own
-- and only when the linked entity publish_status = 'draft'
-- Note: This requires checking ownership via the entity tables (worlds/entry_points/npcs)
-- Note: entity_id is stored as text to handle both TEXT (worlds/entry_points) and UUID (npcs) IDs
CREATE POLICY "media_links_owner_manage"
ON public.media_links
FOR ALL
TO authenticated
USING (
  -- For worlds (id is text)
  (entity_type = 'world' AND EXISTS (
    SELECT 1 FROM public.worlds w
    WHERE w.id = media_links.entity_id
      AND w.owner_user_id = auth.uid()
      AND w.publish_status = 'draft'
  ))
  OR
  -- For entry_points/stories (id is text)
  (entity_type = 'story' AND EXISTS (
    SELECT 1 FROM public.entry_points ep
    WHERE ep.id = media_links.entity_id
      AND ep.owner_user_id = auth.uid()
      AND ep.publish_status = 'draft'
  ))
  OR
  -- For npcs (id is uuid, stored as text)
  (entity_type = 'npc' AND EXISTS (
    SELECT 1 FROM public.npcs n
    WHERE n.id::text = media_links.entity_id
      AND n.owner_user_id = auth.uid()
      AND n.publish_status = 'draft'
  ))
)
WITH CHECK (
  -- For worlds (id is text)
  (entity_type = 'world' AND EXISTS (
    SELECT 1 FROM public.worlds w
    WHERE w.id = media_links.entity_id
      AND w.owner_user_id = auth.uid()
      AND w.publish_status = 'draft'
  ))
  OR
  -- For entry_points/stories (id is text)
  (entity_type = 'story' AND EXISTS (
    SELECT 1 FROM public.entry_points ep
    WHERE ep.id = media_links.entity_id
      AND ep.owner_user_id = auth.uid()
      AND ep.publish_status = 'draft'
  ))
  OR
  -- For npcs (id is uuid, stored as text)
  (entity_type = 'npc' AND EXISTS (
    SELECT 1 FROM public.npcs n
    WHERE n.id::text = media_links.entity_id
      AND n.owner_user_id = auth.uid()
      AND n.publish_status = 'draft'
  ))
);

-- Admin full: is_admin() = 'true' bypass for all operations
CREATE POLICY "media_links_admin_full"
ON public.media_links
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

COMMIT;

