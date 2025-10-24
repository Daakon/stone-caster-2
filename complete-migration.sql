-- ============================================================================
-- COMPLETE ADMIN MIGRATION (ALL 9 MIGRATIONS COMBINED)
-- ============================================================================

BEGIN;

-- Safe Worlds Table UUID Migration (Final Fixed Version)
-- Alternative approach: Create admin-specific tables that work with existing schema
-- This avoids breaking existing foreign key constraints

-- Instead of converting the existing worlds table, we'll create a mapping table
-- and update the admin migrations to work with the existing TEXT-based schema

-- Create a mapping table to convert between TEXT and UUID for admin purposes
CREATE TABLE IF NOT EXISTS public.world_id_mapping (
  text_id text NOT NULL,
  uuid_id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (text_id)
);

-- Populate the mapping table with existing worlds
INSERT INTO public.world_id_mapping (text_id, uuid_id)
SELECT id, gen_random_uuid() 
FROM public.worlds 
WHERE id NOT IN (SELECT text_id FROM public.world_id_mapping);

-- Add status column to existing worlds table (this is safe)
ALTER TABLE public.worlds 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived'));

-- Update existing records to have status
UPDATE public.worlds SET status = 'active' WHERE status IS NULL;

-- Make status NOT NULL
ALTER TABLE public.worlds ALTER COLUMN status SET NOT NULL;

-- Add name and description columns to existing worlds table
ALTER TABLE public.worlds 
ADD COLUMN IF NOT EXISTS name text,
ADD COLUMN IF NOT EXISTS description text;

-- Update existing records to have names (use id as fallback)
UPDATE public.worlds SET name = id WHERE name IS NULL;

-- Make name required
ALTER TABLE public.worlds ALTER COLUMN name SET NOT NULL;

-- Create a view that provides UUID-based access for admin
-- Handle the composite primary key by getting the latest version
-- Only reference columns that actually exist in the worlds table
CREATE OR REPLACE VIEW public.worlds_admin AS
SELECT 
  wm.uuid_id as id,
  w.name,
  w.status,
  w.description,
  w.version,
  w.doc,
  w.created_at,
  w.updated_at
FROM public.worlds w
JOIN public.world_id_mapping wm ON w.id = wm.text_id
WHERE w.version = (
  SELECT MAX(version) 
  FROM public.worlds w2 
  WHERE w2.id = w.id
);

-- Enable RLS on the mapping table
ALTER TABLE public.world_id_mapping ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for the mapping table
-- Use simplified policies that don't depend on user_profiles table structure
CREATE POLICY "World mapping: Anyone can view" ON public.world_id_mapping
  FOR SELECT USING (true);

-- For now, allow all authenticated users to manage mappings
-- This can be refined later once we know the actual user table structure
CREATE POLICY "World mapping: Authenticated users can manage" ON public.world_id_mapping
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Create Rulesets Table Migration (Fixed v2)
-- Creates the rulesets table that the admin associations migration expects

-- Create rulesets table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.rulesets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL, -- Make it a regular column, not generated
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  description text,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS rulesets_slug_uq ON public.rulesets(slug);
CREATE INDEX IF NOT EXISTS rulesets_status_idx ON public.rulesets(status);

-- Enable RLS
ALTER TABLE public.rulesets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Rulesets: Anyone can view active rulesets" ON public.rulesets
  FOR SELECT USING (status = 'active');

-- Simplified admin policy that doesn't depend on user_profiles table
-- For now, allow all authenticated users to manage rulesets
-- This can be refined later once we know the actual user table structure
CREATE POLICY "Rulesets: Authenticated users can manage" ON public.rulesets
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Insert some default rulesets with explicit slugs
INSERT INTO public.rulesets (id, name, slug, description, status) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'D&D 5e', 'd-d-5e', 'Dungeons & Dragons 5th Edition rules', 'active'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Pathfinder', 'pathfinder', 'Pathfinder RPG rules', 'active'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Custom Rules', 'custom-rules', 'Custom game rules', 'draft')
ON CONFLICT (id) DO NOTHING;

-- Admin Associations Phase B Migration (Safe Version - Fixed v7)
-- Works with existing TEXT-based worlds table and existing rulesets table
-- Uses existing entry_points table instead of creating new entries table

-- ============================================================================
-- ENHANCE EXISTING ENTRY_POINTS TABLE
-- ============================================================================

-- Add missing columns to existing entry_points table if they don't exist
-- Use more robust column addition
DO $$
-- Add status column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'entry_points' 
    AND table_schema = 'public' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.entry_points 
    ADD COLUMN status text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived'));
  END IF;

  -- Add description column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'entry_points' 
    AND table_schema = 'public' 
    AND column_name = 'description'
  ) THEN
    ALTER TABLE public.entry_points 
    ADD COLUMN description text;
  END IF;

  -- Add updated_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'entry_points' 
    AND table_schema = 'public' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.entry_points 
    ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Update existing records to have status
UPDATE public.entry_points SET status = 'active' WHERE status IS NULL;

-- Make status NOT NULL (only if the column exists)
DO $$
IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'entry_points' 
    AND table_schema = 'public' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.entry_points ALTER COLUMN status SET NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- CREATE ENTRY_RULESETS TABLE (ordered join)
-- ============================================================================

-- Check if rulesets table exists and what type its id column is
-- If it's text, we need to use text for the foreign key
CREATE TABLE IF NOT EXISTS public.entry_rulesets (
  entry_id text NOT NULL REFERENCES public.entry_points(id) ON DELETE CASCADE, -- Use text to match existing entry_points.id
  ruleset_id text NOT NULL, -- Use text to match existing rulesets table
  sort_order int NOT NULL DEFAULT 0,
  PRIMARY KEY (entry_id, ruleset_id)
);

-- Add foreign key constraint only if rulesets table exists with text id
DO $$
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rulesets' AND table_schema = 'public') THEN
    -- Check if rulesets.id is text type
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'rulesets' 
      AND table_schema = 'public' 
      AND column_name = 'id' 
      AND data_type = 'text'
    ) THEN
      -- Add foreign key constraint to existing text-based rulesets table
      ALTER TABLE public.entry_rulesets 
      ADD CONSTRAINT entry_rulesets_ruleset_id_fkey 
      FOREIGN KEY (ruleset_id) REFERENCES public.rulesets(id) ON DELETE RESTRICT;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS entry_rulesets_order_idx ON public.entry_rulesets(entry_id, sort_order);

-- ============================================================================
-- CREATE NPCS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.npcs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS npcs_status_idx ON public.npcs(status);

-- ============================================================================
-- CREATE NPC_PACKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.npc_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS npc_packs_status_idx ON public.npc_packs(status);

-- ============================================================================
-- CREATE NPC_PACK_MEMBERS TABLE (join table)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.npc_pack_members (
  pack_id uuid NOT NULL REFERENCES public.npc_packs(id) ON DELETE CASCADE,
  npc_id uuid NOT NULL REFERENCES public.npcs(id) ON DELETE CASCADE,
  PRIMARY KEY (pack_id, npc_id)
);

-- ============================================================================
-- CREATE ENTRY_NPCS TABLE (join table) - using entry_points
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.entry_npcs (
  entry_id text NOT NULL REFERENCES public.entry_points(id) ON DELETE CASCADE, -- Use text to match existing entry_points.id
  npc_id uuid NOT NULL REFERENCES public.npcs(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, npc_id)
);

-- ============================================================================
-- CREATE ENTRY_NPC_PACKS TABLE (join table) - using entry_points
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.entry_npc_packs (
  entry_id text NOT NULL REFERENCES public.entry_points(id) ON DELETE CASCADE, -- Use text to match existing entry_points.id
  pack_id uuid NOT NULL REFERENCES public.npc_packs(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, pack_id)
);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.entry_rulesets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.npcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.npc_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.npc_pack_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_npcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_npc_packs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREATE RLS POLICIES
-- ============================================================================

-- Entry rulesets policies
CREATE POLICY "Entry rulesets: Authenticated users can manage" ON public.entry_rulesets
  FOR ALL USING (auth.uid() IS NOT NULL);

-- NPCs policies
CREATE POLICY "NPCs: Anyone can view active NPCs" ON public.npcs
  FOR SELECT USING (status = 'active');

CREATE POLICY "NPCs: Authenticated users can manage" ON public.npcs
  FOR ALL USING (auth.uid() IS NOT NULL);

-- NPC Packs policies
CREATE POLICY "NPC Packs: Anyone can view active packs" ON public.npc_packs
  FOR SELECT USING (status = 'active');

CREATE POLICY "NPC Packs: Authenticated users can manage" ON public.npc_packs
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Join table policies
CREATE POLICY "NPC Pack Members: Authenticated users can manage" ON public.npc_pack_members
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Entry NPCs: Authenticated users can manage" ON public.entry_npcs
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Entry NPC Packs: Authenticated users can manage" ON public.entry_npc_packs
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- INSERT SAMPLE DATA
-- ============================================================================

-- Insert sample NPCs
INSERT INTO public.npcs (id, name, description, status) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Gandalf the Grey', 'A wise wizard mentor', 'active'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Captain Kirk', 'Bold starship captain', 'active'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Sherlock Holmes', 'Master detective', 'active')
ON CONFLICT (id) DO NOTHING;

-- Insert sample NPC Packs
INSERT INTO public.npc_packs (id, name, description, status) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Fantasy Companions', 'Classic fantasy party members', 'active'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Sci-Fi Crew', 'Space adventure crew members', 'active'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Mystery Investigators', 'Detective and investigator NPCs', 'draft')
ON CONFLICT (id) DO NOTHING;

-- Admin Publishing Phase C Migration
-- Adds versioning, history, and import/export capabilities

-- ============================================================================
-- RULESET VERSIONING
-- ============================================================================

-- Add versioning columns to rulesets
ALTER TABLE public.rulesets
  ADD COLUMN IF NOT EXISTS version_major int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS version_minor int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS version_patch int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_mutable boolean GENERATED ALWAYS AS (status = 'draft') STORED;

-- Create computed version_semver column
ALTER TABLE public.rulesets
  ADD COLUMN IF NOT EXISTS version_semver text GENERATED ALWAYS AS (
    version_major::text || '.' || version_minor::text || '.' || version_patch::text
  ) STORED;

-- Add unique constraint on slug + version
ALTER TABLE public.rulesets
  ADD CONSTRAINT IF NOT EXISTS rulesets_slug_version_unique 
  UNIQUE (slug, version_major, version_minor, version_patch);

-- ============================================================================
-- RULESET REVISIONS HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ruleset_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ruleset_id uuid NOT NULL REFERENCES public.rulesets(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  actor uuid NULL -- admin user id if available
);

CREATE INDEX IF NOT EXISTS ruleset_revisions_ruleset_idx ON public.ruleset_revisions(ruleset_id);
CREATE INDEX IF NOT EXISTS ruleset_revisions_created_idx ON public.ruleset_revisions(created_at);

-- ============================================================================
-- CONTENT IMPORT JOBS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.content_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('world', 'ruleset', 'npc', 'npc_pack', 'entry', 'bundle')),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'validated', 'applied', 'failed')),
  report jsonb,
  created_at timestamptz DEFAULT now(),
  created_by uuid NULL
);

CREATE INDEX IF NOT EXISTS content_import_jobs_kind_idx ON public.content_import_jobs(kind);
CREATE INDEX IF NOT EXISTS content_import_jobs_status_idx ON public.content_import_jobs(status);

-- ============================================================================
-- ENHANCED CONSTRAINTS
-- ============================================================================

-- Ensure non-empty names for all entities
ALTER TABLE public.worlds
  ADD CONSTRAINT IF NOT EXISTS worlds_name_not_empty CHECK (length(trim(name)) > 0);

ALTER TABLE public.rulesets
  ADD CONSTRAINT IF NOT EXISTS rulesets_name_not_empty CHECK (length(trim(name)) > 0);

ALTER TABLE public.entries
  ADD CONSTRAINT IF NOT EXISTS entries_name_not_empty CHECK (length(trim(name)) > 0);

ALTER TABLE public.npcs
  ADD CONSTRAINT IF NOT EXISTS npcs_name_not_empty CHECK (length(trim(name)) > 0);

ALTER TABLE public.npc_packs
  ADD CONSTRAINT IF NOT EXISTS npc_packs_name_not_empty CHECK (length(trim(name)) > 0);

-- ============================================================================
-- RLS POLICIES FOR NEW TABLES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE public.ruleset_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_import_jobs ENABLE ROW LEVEL SECURITY;

-- Ruleset revisions policies
CREATE POLICY "Ruleset revisions: Admin can read all" ON public.ruleset_revisions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "Ruleset revisions: Admin can insert" ON public.ruleset_revisions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role IN ('admin', 'moderator')
    )
  );

-- Content import jobs policies
CREATE POLICY "Import jobs: Admin can do everything" ON public.content_import_jobs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role IN ('admin', 'moderator')
    )
  );

-- ============================================================================
-- RPC FUNCTIONS FOR PUBLISHING
-- ============================================================================

-- Function to publish a ruleset
CREATE OR REPLACE FUNCTION public.publish_ruleset(ruleset_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ruleset_record public.rulesets%ROWTYPE;
  revision_id uuid;
  result jsonb;
-- Get the ruleset
  SELECT * INTO ruleset_record FROM public.rulesets WHERE id = ruleset_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ruleset not found');
  END IF;
  
  -- Check if already active
  IF ruleset_record.status = 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ruleset is already active');
  END IF;
  
  -- Create revision snapshot
  INSERT INTO public.ruleset_revisions (ruleset_id, snapshot, actor)
  VALUES (ruleset_id, to_jsonb(ruleset_record), auth.uid())
  RETURNING id INTO revision_id;
  
  -- Update ruleset to active
  UPDATE public.rulesets 
  SET 
    status = 'active',
    published_at = now()
  WHERE id = ruleset_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'ruleset_id', ruleset_id,
    'revision_id', revision_id,
    'version', ruleset_record.version_semver
  );
END;
$$;

-- Function to clone a ruleset with version bump
CREATE OR REPLACE FUNCTION public.clone_ruleset(
  ruleset_id uuid,
  bump_type text DEFAULT 'minor'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ruleset_record public.rulesets%ROWTYPE;
  new_version_major int;
  new_version_minor int;
  new_version_patch int;
  new_slug text;
  new_id uuid;
  result jsonb;
-- Get the ruleset
  SELECT * INTO ruleset_record FROM public.rulesets WHERE id = ruleset_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ruleset not found');
  END IF;
  
  -- Calculate new version
  new_version_major := ruleset_record.version_major;
  new_version_minor := ruleset_record.version_minor;
  new_version_patch := ruleset_record.version_patch;
  
  CASE bump_type
    WHEN 'major' THEN
      new_version_major := new_version_major + 1;
      new_version_minor := 0;
      new_version_patch := 0;
    WHEN 'minor' THEN
      new_version_minor := new_version_minor + 1;
      new_version_patch := 0;
    WHEN 'patch' THEN
      new_version_patch := new_version_patch + 1;
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Invalid bump type');
  END CASE;
  
  -- Generate new slug
  new_slug := ruleset_record.slug || '-v' || new_version_major || '-' || new_version_minor || '-' || new_version_patch;
  
  -- Create new ruleset
  INSERT INTO public.rulesets (
    name, slug, description, status, version_major, version_minor, version_patch
  ) VALUES (
    ruleset_record.name || ' (v' || new_version_major || '.' || new_version_minor || '.' || new_version_patch || ')',
    new_slug,
    ruleset_record.description,
    'draft',
    new_version_major,
    new_version_minor,
    new_version_patch
  ) RETURNING id INTO new_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'original_id', ruleset_id,
    'new_id', new_id,
    'new_version', new_version_major || '.' || new_version_minor || '.' || new_version_patch
  );
END;
$$;

-- ============================================================================
-- SEED DATA FOR TESTING
-- ============================================================================

-- Insert some sample rulesets with versioning
INSERT INTO public.rulesets (name, description, status, version_major, version_minor, version_patch) VALUES
  ('D&D 5e Core', 'Core D&D 5th Edition rules', 'active', 1, 0, 0),
  ('Pathfinder Core', 'Core Pathfinder rules', 'draft', 2, 1, 0),
  ('Custom Fantasy', 'Custom fantasy ruleset', 'active', 1, 2, 3)
ON CONFLICT (slug, version_major, version_minor, version_patch) DO NOTHING;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.ruleset_revisions IS 'Append-only history of ruleset changes';
COMMENT ON TABLE public.content_import_jobs IS 'Tracks import/export operations';
COMMENT ON FUNCTION public.publish_ruleset IS 'Publishes a draft ruleset to active status';
COMMENT ON FUNCTION public.clone_ruleset IS 'Clones a ruleset with version bump';

-- Add prompt fields to worlds and rulesets
-- This migration adds prompt content fields to worlds and rulesets tables

-- ============================================================================
-- ADD PROMPT FIELDS TO WORLDS
-- ============================================================================

ALTER TABLE public.worlds
  ADD COLUMN IF NOT EXISTS prompt text;

-- Add comment for documentation
COMMENT ON COLUMN public.worlds.prompt IS 'The world''s prompt content for AI generation';

-- ============================================================================
-- ADD PROMPT FIELDS TO RULESETS  
-- ============================================================================

ALTER TABLE public.rulesets
  ADD COLUMN IF NOT EXISTS prompt text;

-- Add comment for documentation
COMMENT ON COLUMN public.rulesets.prompt IS 'The ruleset''s prompt content for AI generation';

-- ============================================================================
-- UPDATE SEED DATA WITH SAMPLE PROMPTS
-- ============================================================================

-- Update existing worlds with sample prompts
UPDATE public.worlds 
SET prompt = 'You are in a magical fantasy realm filled with dragons, wizards, and enchanted forests. The world is governed by ancient magic and mystical creatures roam the lands.'
WHERE name = 'Fantasy Realm';

UPDATE public.worlds 
SET prompt = 'You are in a futuristic sci-fi universe with advanced technology, space travel, and alien civilizations. The world is governed by scientific principles and technological advancement.'
WHERE name = 'Sci-Fi Universe';

-- Update existing rulesets with sample prompts
UPDATE public.rulesets 
SET prompt = 'Follow D&D 5th Edition rules. Use standard ability scores, hit points, and spellcasting mechanics. Maintain the traditional fantasy RPG experience.'
WHERE name = 'D&D 5e Core';

UPDATE public.rulesets 
SET prompt = 'Follow Pathfinder rules. Use the d20 system with expanded character options, feats, and tactical combat mechanics.'
WHERE name = 'Pathfinder Core';

-- Segments Scope Cleanup Migration
-- Restricts prompt_segments.scope to allowed values and deprecates old scopes

-- 1) Add a check constraint that whitelists allowed scopes.
--    If an existing constraint exists, drop it first.
ALTER TABLE public.prompt_segments
  DROP CONSTRAINT IF EXISTS chk_prompt_segments_scope;

ALTER TABLE public.prompt_segments
  ADD CONSTRAINT chk_prompt_segments_scope
  CHECK (scope IN ('core', 'ruleset', 'world', 'entry', 'entry_start', 'npc'));

-- 2) Soft-migrate existing rows with deprecated scopes (game_state, player, rng, input)
--    Strategy: mark them inactive and tag in metadata so authors can copy text if needed.
UPDATE public.prompt_segments
SET active = false,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'deprecated_scope', scope, 
      'deprecated_at', now(),
      'migration_note', 'This segment was automatically deactivated due to scope deprecation. Content can be copied to allowed scopes if needed.'
    )
WHERE scope IN ('game_state','player','rng','input') AND active = true;

-- 3) Add comment for documentation
COMMENT ON CONSTRAINT chk_prompt_segments_scope ON public.prompt_segments 
IS 'Restricts scope to allowed values: core, ruleset, world, entry, entry_start, npc';

-- 4) Create index for performance on scope filtering
CREATE INDEX IF NOT EXISTS prompt_segments_scope_active_idx 
ON public.prompt_segments(scope, active) 
WHERE active = true;

-- Prompt Segments Referential Integrity Migration
-- Adds composite indexes for performance and referential safety constraints

-- Fast lookups for assembler and admin
CREATE INDEX IF NOT EXISTS idx_prompt_segments_scope_ref
  ON public.prompt_segments(scope, ref_id) WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_prompt_segments_active_scope
  ON public.prompt_segments(active, scope);

-- Guardrails: each scope must point to the correct table.
-- We'll use NOT VALID foreign keys so we can add them safely; then validate.
-- For each scope, we constrain via partial FK using generated columns approach.

-- 1) Add a virtual column per target table to enable partial FKs
--    If generated columns are not available, skip to server-side validation (already included below).

DO $$
-- noop if column already exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='prompt_segments' AND column_name='ref_world_id') THEN
    ALTER TABLE public.prompt_segments
      ADD COLUMN ref_world_id uuid GENERATED ALWAYS AS (CASE WHEN scope='world' THEN ref_id ELSE NULL END) STORED;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='prompt_segments' AND column_name='ref_ruleset_id') THEN
    ALTER TABLE public.prompt_segments
      ADD COLUMN ref_ruleset_id uuid GENERATED ALWAYS AS (CASE WHEN scope='ruleset' THEN ref_id ELSE NULL END) STORED;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='prompt_segments' AND column_name='ref_entry_id') THEN
    ALTER TABLE public.prompt_segments
      ADD COLUMN ref_entry_id uuid GENERATED ALWAYS AS (CASE WHEN scope IN ('entry','entry_start') THEN ref_id ELSE NULL END) STORED;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='prompt_segments' AND column_name='ref_npc_id') THEN
    ALTER TABLE public.prompt_segments
      ADD COLUMN ref_npc_id uuid GENERATED ALWAYS AS (CASE WHEN scope='npc' THEN ref_id ELSE NULL END) STORED;
  END IF;
END$$;

-- 2) Partial FKs (NOT VALID first; we will validate)
DO $$
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_ps_world_ref') THEN
    ALTER TABLE public.prompt_segments
      ADD CONSTRAINT fk_ps_world_ref FOREIGN KEY (ref_world_id) REFERENCES public.worlds(id) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_ps_ruleset_ref') THEN
    ALTER TABLE public.prompt_segments
      ADD CONSTRAINT fk_ps_ruleset_ref FOREIGN KEY (ref_ruleset_id) REFERENCES public.rulesets(id) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_ps_entry_ref') THEN
    ALTER TABLE public.prompt_segments
      ADD CONSTRAINT fk_ps_entry_ref FOREIGN KEY (ref_entry_id) REFERENCES public.entries(id) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_ps_npc_ref') THEN
    ALTER TABLE public.prompt_segments
      ADD CONSTRAINT fk_ps_npc_ref FOREIGN KEY (ref_npc_id) REFERENCES public.npcs(id) NOT VALID;
  END IF;
END$$;

-- Try to validate (will succeed unless dangling refs exist; still safe to keep NOT VALID)
ALTER TABLE public.prompt_segments VALIDATE CONSTRAINT fk_ps_world_ref;
ALTER TABLE public.prompt_segments VALIDATE CONSTRAINT fk_ps_ruleset_ref;
ALTER TABLE public.prompt_segments VALIDATE CONSTRAINT fk_ps_entry_ref;
ALTER TABLE public.prompt_segments VALIDATE CONSTRAINT fk_ps_npc_ref;

-- Add comments for documentation
COMMENT ON INDEX idx_prompt_segments_scope_ref IS 'Composite index for fast assembler queries by scope and ref_id';
COMMENT ON INDEX idx_prompt_segments_active_scope IS 'Index for filtering active segments by scope';

-- Add user ownership to NPCs table
-- NPCs should be private to the player who created them

-- Add user_id column to npcs table
ALTER TABLE public.npcs 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add index for efficient user-based queries
CREATE INDEX IF NOT EXISTS idx_npcs_user_id ON public.npcs(user_id);

-- Update RLS policies to enforce user ownership
DROP POLICY IF EXISTS "NPCs: Anyone can view active NPCs" ON public.npcs;
DROP POLICY IF EXISTS "NPCs: Admin can do everything" ON public.npcs;

-- New RLS policies for user ownership
CREATE POLICY "NPCs: Users can view their own NPCs" ON public.npcs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "NPCs: Users can create their own NPCs" ON public.npcs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "NPCs: Users can update their own NPCs" ON public.npcs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "NPCs: Users can delete their own NPCs" ON public.npcs
  FOR DELETE USING (auth.uid() = user_id);

-- Admin override policy (admins can see all NPCs)
CREATE POLICY "NPCs: Admin can do everything" ON public.npcs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role IN ('admin', 'moderator')
    )
  );

-- Add comment for documentation
COMMENT ON COLUMN public.npcs.user_id IS 'User who owns this NPC - NPCs are private to their creator';

-- NPC Visibility and Authors Migration (Fixed)
-- Adds support for private/public NPCs with proper authorship tracking
-- This version handles the case where user_id column might not exist yet

-- Add visibility and author fields to npcs table
ALTER TABLE public.npcs 
ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
ADD COLUMN IF NOT EXISTS author_name text,
ADD COLUMN IF NOT EXISTS author_type text DEFAULT 'user' CHECK (author_type IN ('user', 'system', 'original'));

-- Add index for visibility filtering
CREATE INDEX IF NOT EXISTS idx_npcs_visibility ON public.npcs(visibility);
CREATE INDEX IF NOT EXISTS idx_npcs_author_type ON public.npcs(author_type);

-- Update existing NPCs to have proper author information
-- Set all existing NPCs as original characters (since they were created before user ownership)
UPDATE public.npcs 
SET 
  author_name = 'Original Character',
  author_type = 'original'
WHERE author_name IS NULL;

-- Update RLS policies to support both private and public NPCs
-- First, drop existing policies if they exist
DROP POLICY IF EXISTS "NPCs: Users can view their own NPCs" ON public.npcs;
DROP POLICY IF EXISTS "NPCs: Users can create their own NPCs" ON public.npcs;
DROP POLICY IF EXISTS "NPCs: Users can update their own NPCs" ON public.npcs;
DROP POLICY IF EXISTS "NPCs: Users can delete their own NPCs" ON public.npcs;
DROP POLICY IF EXISTS "NPCs: Admin can do everything" ON public.npcs;
DROP POLICY IF EXISTS "NPCs: Anyone can view active NPCs" ON public.npcs;

-- New RLS policies for dual visibility model
-- Note: These policies assume user_id column exists (from previous migration)
CREATE POLICY "NPCs: Users can view public NPCs and their own private NPCs" ON public.npcs
  FOR SELECT USING (
    visibility = 'public' OR 
    (visibility = 'private' AND auth.uid() = user_id)
  );

CREATE POLICY "NPCs: Users can create NPCs" ON public.npcs
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND 
    visibility IN ('private', 'public')
  );

CREATE POLICY "NPCs: Users can update their own NPCs" ON public.npcs
  FOR UPDATE USING (
    auth.uid() = user_id
  );

CREATE POLICY "NPCs: Users can delete their own NPCs" ON public.npcs
  FOR DELETE USING (
    auth.uid() = user_id
  );

-- Admin override policy (admins can see and manage all NPCs)
CREATE POLICY "NPCs: Admin can do everything" ON public.npcs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role IN ('admin', 'moderator')
    )
  );

-- Add comments for documentation
COMMENT ON COLUMN public.npcs.visibility IS 'Whether the NPC is private (user-only) or public (shared)';
COMMENT ON COLUMN public.npcs.author_name IS 'Display name of the NPC author';
COMMENT ON COLUMN public.npcs.author_type IS 'Type of author: user, system, or original character';

-- Insert some sample public NPCs with different author types
INSERT INTO public.npcs (id, name, description, status, visibility, author_name, author_type, prompt) VALUES
  ('550e8400-e29b-41d4-a716-446655440004', 'Gandalf the Grey', 'A wise wizard mentor from Middle-earth', 'active', 'public', 'J.R.R. Tolkien', 'original', 'You are Gandalf the Grey, a wise and powerful wizard. You speak in riddles and provide guidance to adventurers.'),
  ('550e8400-e29b-41d4-a716-446655440005', 'Captain Kirk', 'Bold starship captain from Star Trek', 'active', 'public', 'Gene Roddenberry', 'original', 'You are Captain James T. Kirk, commanding officer of the USS Enterprise. You are bold, decisive, and always ready for adventure.'),
  ('550e8400-e29b-41d4-a716-446655440006', 'System Assistant', 'Helpful AI assistant for game mechanics', 'active', 'public', 'Stone Caster', 'system', 'You are a helpful assistant that provides guidance on game rules and mechanics.')
ON CONFLICT (id) DO NOTHING;



-- ============================================================================
-- END OF ALL MIGRATIONS
-- ============================================================================

COMMIT;