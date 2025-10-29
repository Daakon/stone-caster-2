-- Admin Associations Phase B Migration (Safe Version - Fixed v4)
-- Works with existing TEXT-based worlds table and existing rulesets table

BEGIN;

-- ============================================================================
-- CREATE ENTRIES TABLE (replaces entry_points with better naming)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL, -- Make it a regular column, not generated
  world_text_id text REFERENCES public.worlds(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS entries_slug_uq ON public.entries(slug);
CREATE INDEX IF NOT EXISTS entries_world_idx ON public.entries(world_text_id);

-- ============================================================================
-- CREATE ENTRY_RULESETS TABLE (ordered join)
-- ============================================================================

-- Check if rulesets table exists and what type its id column is
-- If it's text, we need to use text for the foreign key
CREATE TABLE IF NOT EXISTS public.entry_rulesets (
  entry_id uuid NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
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
  slug text NOT NULL, -- Make it a regular column, not generated
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS npcs_slug_uq ON public.npcs(slug);
CREATE INDEX IF NOT EXISTS npcs_status_idx ON public.npcs(status);

-- ============================================================================
-- CREATE NPC_PACKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.npc_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL, -- Make it a regular column, not generated
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS npc_packs_slug_uq ON public.npc_packs(slug);
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
-- CREATE ENTRY_NPCS TABLE (join table)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.entry_npcs (
  entry_id uuid NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  npc_id uuid NOT NULL REFERENCES public.npcs(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, npc_id)
);

-- ============================================================================
-- CREATE ENTRY_NPC_PACKS TABLE (join table)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.entry_npc_packs (
  entry_id uuid NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  pack_id uuid NOT NULL REFERENCES public.npc_packs(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, pack_id)
);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_rulesets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.npcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.npc_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.npc_pack_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_npcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_npc_packs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREATE RLS POLICIES
-- ============================================================================

-- Entries policies
CREATE POLICY "Entries: Anyone can view active entries" ON public.entries
  FOR SELECT USING (status = 'active');

CREATE POLICY "Entries: Authenticated users can manage" ON public.entries
  FOR ALL USING (auth.uid() IS NOT NULL);

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

-- Insert sample entries
INSERT INTO public.entries (id, name, slug, description, world_text_id, status) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'The Dragons Lair', 'the-dragons-lair', 'A classic dungeon adventure', 'world-fantasy', 'active'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Space Station Alpha', 'space-station-alpha', 'A sci-fi adventure in space', 'world-sci-fi', 'active'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Mystery Manor', 'mystery-manor', 'A horror investigation scenario', 'world-horror', 'draft')
ON CONFLICT (id) DO NOTHING;

-- Insert sample NPCs
INSERT INTO public.npcs (id, name, slug, description, status) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Gandalf the Grey', 'gandalf-the-grey', 'A wise wizard mentor', 'active'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Captain Kirk', 'captain-kirk', 'Bold starship captain', 'active'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Sherlock Holmes', 'sherlock-holmes', 'Master detective', 'active')
ON CONFLICT (id) DO NOTHING;

-- Insert sample NPC Packs
INSERT INTO public.npc_packs (id, name, slug, description, status) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Fantasy Companions', 'fantasy-companions', 'Classic fantasy party members', 'active'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Sci-Fi Crew', 'sci-fi-crew', 'Space adventure crew members', 'active'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Mystery Investigators', 'mystery-investigators', 'Detective and investigator NPCs', 'draft')
ON CONFLICT (id) DO NOTHING;

COMMIT;

