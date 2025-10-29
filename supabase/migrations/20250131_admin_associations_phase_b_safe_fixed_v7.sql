-- Admin Associations Phase B Migration (Safe Version - Fixed v7)
-- Works with existing TEXT-based worlds table and existing rulesets table
-- Uses existing entry_points table instead of creating new entries table

BEGIN;

-- ============================================================================
-- ENHANCE EXISTING ENTRY_POINTS TABLE
-- ============================================================================

-- Add missing columns to existing entry_points table if they don't exist
-- Use more robust column addition
DO $$
BEGIN
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
BEGIN
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
BEGIN
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

COMMIT;

