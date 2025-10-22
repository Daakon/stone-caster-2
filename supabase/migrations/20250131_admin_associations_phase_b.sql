-- Admin Associations Phase B Migration
-- Updates schema to support per-entry associations with proper naming and relationships

-- ============================================================================
-- UPDATE WORLDS TABLE
-- ============================================================================

-- Add name and slug columns if they don't exist
ALTER TABLE public.worlds
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS description text;

-- Update existing records to have names (use id as fallback)
UPDATE public.worlds SET name = id WHERE name IS NULL;

-- Make name required
ALTER TABLE public.worlds ALTER COLUMN name SET NOT NULL;

-- Create generated slug column
ALTER TABLE public.worlds 
  ADD COLUMN IF NOT EXISTS slug_generated text GENERATED ALWAYS AS (
    regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')
  ) STORED;

-- Update slug to use generated value
UPDATE public.worlds SET slug = slug_generated WHERE slug IS NULL;

-- Make slug unique and required
ALTER TABLE public.worlds ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS worlds_slug_uq ON public.worlds(slug);

-- Add status index
CREATE INDEX IF NOT EXISTS worlds_status_idx ON public.worlds(status);

-- ============================================================================
-- UPDATE RULESETS TABLE
-- ============================================================================

-- Add name and slug columns if they don't exist
ALTER TABLE public.rulesets
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS version int DEFAULT 1;

-- Update existing records to have names (use id as fallback)
UPDATE public.rulesets SET name = id WHERE name IS NULL;

-- Make name required
ALTER TABLE public.rulesets ALTER COLUMN name SET NOT NULL;

-- Create generated slug column
ALTER TABLE public.rulesets 
  ADD COLUMN IF NOT EXISTS slug_generated text GENERATED ALWAYS AS (
    regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')
  ) STORED;

-- Update slug to use generated value
UPDATE public.rulesets SET slug = slug_generated WHERE slug IS NULL;

-- Make slug unique and required
ALTER TABLE public.rulesets ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS rulesets_slug_uq ON public.rulesets(slug);

-- Add status index
CREATE INDEX IF NOT EXISTS rulesets_status_idx ON public.rulesets(status);

-- ============================================================================
-- CREATE ENTRIES TABLE (replaces entry_points with better naming)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text GENERATED ALWAYS AS (regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')) STORED,
  world_id uuid REFERENCES public.worlds(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS entries_slug_uq ON public.entries(slug);
CREATE INDEX IF NOT EXISTS entries_world_idx ON public.entries(world_id);

-- ============================================================================
-- CREATE ENTRY_RULESETS TABLE (ordered join)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.entry_rulesets (
  entry_id uuid NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  ruleset_id uuid NOT NULL REFERENCES public.rulesets(id) ON DELETE RESTRICT,
  sort_order int NOT NULL DEFAULT 0,
  PRIMARY KEY (entry_id, ruleset_id)
);

CREATE INDEX IF NOT EXISTS entry_rulesets_order_idx ON public.entry_rulesets(entry_id, sort_order);

-- ============================================================================
-- CREATE NPCS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.npcs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text GENERATED ALWAYS AS (regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')) STORED,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS npcs_slug_uq ON public.npcs(slug);

-- ============================================================================
-- CREATE NPC_PACKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.npc_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text GENERATED ALWAYS AS (regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')) STORED,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS npc_packs_slug_uq ON public.npc_packs(slug);

-- ============================================================================
-- CREATE NPC_PACK_MEMBERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.npc_pack_members (
  pack_id uuid NOT NULL REFERENCES public.npc_packs(id) ON DELETE CASCADE,
  npc_id uuid NOT NULL REFERENCES public.npcs(id) ON DELETE RESTRICT,
  PRIMARY KEY (pack_id, npc_id)
);

-- ============================================================================
-- CREATE ENTRY_NPCS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.entry_npcs (
  entry_id uuid NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  npc_id uuid NOT NULL REFERENCES public.npcs(id) ON DELETE RESTRICT,
  PRIMARY KEY (entry_id, npc_id)
);

-- ============================================================================
-- CREATE ENTRY_NPC_PACKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.entry_npc_packs (
  entry_id uuid NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  pack_id uuid NOT NULL REFERENCES public.npc_packs(id) ON DELETE RESTRICT,
  PRIMARY KEY (entry_id, pack_id)
);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.worlds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rulesets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_rulesets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.npcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.npc_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.npc_pack_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_npcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_npc_packs ENABLE ROW LEVEL SECURITY;

-- Worlds policies
CREATE POLICY "Worlds: Admin can do everything" ON public.worlds
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role IN ('admin', 'moderator', 'creator')
    )
  );

-- Rulesets policies
CREATE POLICY "Rulesets: Admin can do everything" ON public.rulesets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role IN ('admin', 'moderator', 'creator')
    )
  );

-- Entries policies
CREATE POLICY "Entries: Admin can do everything" ON public.entries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role IN ('admin', 'moderator', 'creator')
    )
  );

-- Entry rulesets policies
CREATE POLICY "Entry rulesets: Admin can do everything" ON public.entry_rulesets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role IN ('admin', 'moderator', 'creator')
    )
  );

-- NPCs policies
CREATE POLICY "NPCs: Admin can do everything" ON public.npcs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role IN ('admin', 'moderator', 'creator')
    )
  );

-- NPC packs policies
CREATE POLICY "NPC packs: Admin can do everything" ON public.npc_packs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role IN ('admin', 'moderator', 'creator')
    )
  );

-- NPC pack members policies
CREATE POLICY "NPC pack members: Admin can do everything" ON public.npc_pack_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role IN ('admin', 'moderator', 'creator')
    )
  );

-- Entry NPCs policies
CREATE POLICY "Entry NPCs: Admin can do everything" ON public.entry_npcs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role IN ('admin', 'moderator', 'creator')
    )
  );

-- Entry NPC packs policies
CREATE POLICY "Entry NPC packs: Admin can do everything" ON public.entry_npc_packs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role IN ('admin', 'moderator', 'creator')
    )
  );

-- ============================================================================
-- LEGACY COLUMN CLEANUP
-- ============================================================================

-- Rename legacy cross-type reference columns to avoid confusion
-- These will be dropped in a future migration once we confirm they're not used

-- Note: We'll identify and rename legacy columns in the next step
-- For now, we'll add comments to track what needs to be cleaned up

COMMENT ON TABLE public.entry_points IS 'LEGACY: This table will be replaced by entries table';
COMMENT ON TABLE public.games IS 'LEGACY: This table may need updates to reference new entries table';

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert some sample data for testing
INSERT INTO public.worlds (id, name, description, status) VALUES
  ('world-fantasy', 'Fantasy Realm', 'A magical fantasy world with dragons and wizards', 'active'),
  ('world-sci-fi', 'Sci-Fi Universe', 'A futuristic sci-fi setting with advanced technology', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.rulesets (id, name, description, status) VALUES
  ('ruleset-dnd', 'D&D 5e', 'Dungeons & Dragons 5th Edition rules', 'active'),
  ('ruleset-pathfinder', 'Pathfinder', 'Pathfinder RPG rules', 'active'),
  ('ruleset-custom', 'Custom Rules', 'Custom game rules', 'draft')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.npcs (name, description, status) VALUES
  ('Gandalf', 'A wise wizard and guide', 'active'),
  ('Aragorn', 'A ranger and future king', 'active'),
  ('Legolas', 'An elven archer', 'active')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.npc_packs (name, description, status) VALUES
  ('Fellowship of the Ring', 'The main characters from Lord of the Rings', 'active'),
  ('Villains', 'Antagonists and enemies', 'active')
ON CONFLICT (slug) DO NOTHING;
