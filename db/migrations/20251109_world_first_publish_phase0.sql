-- World-First Publishing: Phase 0/1 Bootstrap Migration
-- Additive-only migration: adds publishing-related columns to worlds, entry_points (stories), and npcs
-- This migration is idempotent and safe to run multiple times

BEGIN;

-- ============================================================================
-- WORLDS TABLE - Add publishing columns
-- ============================================================================

-- Add visibility column (doesn't exist on worlds)
ALTER TABLE public.worlds
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private' 
    CHECK (visibility IN ('private', 'public'));

-- Add review_state column
ALTER TABLE public.worlds
  ADD COLUMN IF NOT EXISTS review_state text NOT NULL DEFAULT 'draft'
    CHECK (review_state IN ('draft', 'pending_review', 'approved', 'rejected'));

-- Add owner_user_id column (only if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'worlds' 
    AND column_name = 'owner_user_id'
  ) THEN
    ALTER TABLE public.worlds ADD COLUMN owner_user_id uuid NOT NULL;
  END IF;
END $$;

-- Add version column (only if missing - note: worlds already has 'version' as text, we need integer)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'worlds' 
    AND column_name = 'version_int'
  ) THEN
    ALTER TABLE public.worlds ADD COLUMN version_int integer NOT NULL DEFAULT 1;
  END IF;
END $$;

-- Add parent_id column (for re-publishing)
ALTER TABLE public.worlds
  ADD COLUMN IF NOT EXISTS parent_id uuid NULL;

-- Add review metadata columns
ALTER TABLE public.worlds
  ADD COLUMN IF NOT EXISTS review_reason text NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz NULL;

-- Create indexes for worlds
CREATE INDEX IF NOT EXISTS idx_worlds_visibility ON public.worlds(visibility);
CREATE INDEX IF NOT EXISTS idx_worlds_review_state ON public.worlds(review_state);

-- ============================================================================
-- ENTRY_POINTS TABLE (Stories) - Add publishing columns
-- ============================================================================

-- Note: entry_points already has a 'visibility' column with values ('public', 'unlisted', 'private')
-- We'll add a new 'publish_visibility' column for our publishing system
-- Application logic will need to map between the two visibility systems

-- Add publish_visibility column (separate from existing visibility)
ALTER TABLE public.entry_points
  ADD COLUMN IF NOT EXISTS publish_visibility text NOT NULL DEFAULT 'private'
    CHECK (publish_visibility IN ('private', 'public'));

-- Add review_state column
ALTER TABLE public.entry_points
  ADD COLUMN IF NOT EXISTS review_state text NOT NULL DEFAULT 'draft'
    CHECK (review_state IN ('draft', 'pending_review', 'approved', 'rejected'));

-- Add owner_user_id column (only if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'entry_points' 
    AND column_name = 'owner_user_id'
  ) THEN
    ALTER TABLE public.entry_points ADD COLUMN owner_user_id uuid NOT NULL;
  END IF;
END $$;

-- Add version column (only if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'entry_points' 
    AND column_name = 'version'
  ) THEN
    ALTER TABLE public.entry_points ADD COLUMN version integer NOT NULL DEFAULT 1;
  END IF;
END $$;

-- Add parent_id column
ALTER TABLE public.entry_points
  ADD COLUMN IF NOT EXISTS parent_id uuid NULL;

-- Add review metadata columns
ALTER TABLE public.entry_points
  ADD COLUMN IF NOT EXISTS review_reason text NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz NULL;

-- Add dependency tracking columns (stories only)
ALTER TABLE public.entry_points
  ADD COLUMN IF NOT EXISTS dependency_invalid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_reason text NULL;

-- Create indexes for entry_points
CREATE INDEX IF NOT EXISTS idx_entry_points_publish_visibility ON public.entry_points(publish_visibility);
CREATE INDEX IF NOT EXISTS idx_entry_points_review_state ON public.entry_points(review_state);
CREATE INDEX IF NOT EXISTS idx_entry_points_dependency_invalid ON public.entry_points(dependency_invalid);

-- ============================================================================
-- NPCS TABLE - Add publishing columns
-- ============================================================================

-- Add visibility column
ALTER TABLE public.npcs
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'public'));

-- Add review_state column
ALTER TABLE public.npcs
  ADD COLUMN IF NOT EXISTS review_state text NOT NULL DEFAULT 'draft'
    CHECK (review_state IN ('draft', 'pending_review', 'approved', 'rejected'));

-- Add owner_user_id column (only if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'npcs' 
    AND column_name = 'owner_user_id'
  ) THEN
    ALTER TABLE public.npcs ADD COLUMN owner_user_id uuid NOT NULL;
  END IF;
END $$;

-- Add version column (only if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'npcs' 
    AND column_name = 'version'
  ) THEN
    ALTER TABLE public.npcs ADD COLUMN version integer NOT NULL DEFAULT 1;
  END IF;
END $$;

-- Add parent_id column
ALTER TABLE public.npcs
  ADD COLUMN IF NOT EXISTS parent_id uuid NULL;

-- Add review metadata columns
ALTER TABLE public.npcs
  ADD COLUMN IF NOT EXISTS review_reason text NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz NULL;

-- Add dependency tracking columns (npcs only)
ALTER TABLE public.npcs
  ADD COLUMN IF NOT EXISTS dependency_invalid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_reason text NULL;

-- Create indexes for npcs
CREATE INDEX IF NOT EXISTS idx_npcs_visibility ON public.npcs(visibility);
CREATE INDEX IF NOT EXISTS idx_npcs_review_state ON public.npcs(review_state);
CREATE INDEX IF NOT EXISTS idx_npcs_dependency_invalid ON public.npcs(dependency_invalid);

-- ============================================================================
-- BACKFILL: Set review_state = 'approved' for existing public content
-- ============================================================================

-- For worlds: if visibility = 'public' and review_state = 'draft', set to 'approved'
UPDATE public.worlds
SET review_state = 'approved'
WHERE visibility = 'public' AND review_state = 'draft';

-- For entry_points: if publish_visibility = 'public' and review_state = 'draft', set to 'approved'
UPDATE public.entry_points
SET review_state = 'approved'
WHERE publish_visibility = 'public' AND review_state = 'draft';

-- For npcs: if visibility = 'public' and review_state = 'draft', set to 'approved'
UPDATE public.npcs
SET review_state = 'approved'
WHERE visibility = 'public' AND review_state = 'draft';

COMMIT;

