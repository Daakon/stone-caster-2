-- Corrected Admin Tables Migration
-- Matches existing schema (worlds.id is text, not uuid)

BEGIN;

-- ============================================================================
-- CREATE ENTRIES TABLE (if it doesn't exist)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  world_id text NOT NULL REFERENCES public.worlds(id) ON DELETE CASCADE, -- Changed to text
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  description text,
  prompt jsonb DEFAULT '{}',
  tags text[] DEFAULT '{}',
  difficulty text DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  visibility text DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted', 'private')),
  entry_point_id text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create indexes for entries
CREATE INDEX IF NOT EXISTS entries_slug_idx ON public.entries(slug);
CREATE INDEX IF NOT EXISTS entries_world_id_idx ON public.entries(world_id);
CREATE INDEX IF NOT EXISTS entries_status_idx ON public.entries(status);
CREATE INDEX IF NOT EXISTS entries_difficulty_idx ON public.entries(difficulty);
CREATE INDEX IF NOT EXISTS entries_visibility_idx ON public.entries(visibility);
CREATE INDEX IF NOT EXISTS entries_entry_point_idx ON public.entries(entry_point_id);
CREATE INDEX IF NOT EXISTS entries_tags_gin_idx ON public.entries USING gin (tags);
CREATE INDEX IF NOT EXISTS entries_prompt_gin_idx ON public.entries USING gin (prompt);

-- ============================================================================
-- UPDATE EXISTING TABLES WITH MISSING COLUMNS
-- ============================================================================

-- Add missing columns to existing entry_points table
ALTER TABLE public.entry_points ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.entry_points ADD COLUMN IF NOT EXISTS prompt jsonb DEFAULT '{}';
ALTER TABLE public.entry_points ADD COLUMN IF NOT EXISTS entry_id uuid REFERENCES public.entries(id) ON DELETE CASCADE;

-- Create indexes for entry_points new columns
CREATE UNIQUE INDEX IF NOT EXISTS entry_points_slug_uq ON public.entry_points(slug);
CREATE INDEX IF NOT EXISTS entry_points_entry_id_idx ON public.entry_points(entry_id);
CREATE INDEX IF NOT EXISTS entry_points_prompt_gin_idx ON public.entry_points USING gin (prompt);

-- Add missing columns to existing rulesets table
ALTER TABLE public.rulesets ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.rulesets ADD COLUMN IF NOT EXISTS prompt jsonb DEFAULT '{}';

-- Create indexes for rulesets new columns
CREATE UNIQUE INDEX IF NOT EXISTS rulesets_slug_uq ON public.rulesets(slug);
CREATE INDEX IF NOT EXISTS rulesets_prompt_gin_idx ON public.rulesets USING gin (prompt);

-- Add missing columns to existing npcs table
ALTER TABLE public.npcs ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.npcs ADD COLUMN IF NOT EXISTS prompt jsonb DEFAULT '{}';

-- Create indexes for npcs new columns
CREATE UNIQUE INDEX IF NOT EXISTS npcs_slug_uq ON public.npcs(slug);
CREATE INDEX IF NOT EXISTS npcs_prompt_gin_idx ON public.npcs USING gin (prompt);

-- Add missing columns to existing npc_packs table
ALTER TABLE public.npc_packs ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.npc_packs ADD COLUMN IF NOT EXISTS prompt jsonb DEFAULT '{}';

-- Create indexes for npc_packs new columns
CREATE UNIQUE INDEX IF NOT EXISTS npc_packs_slug_uq ON public.npc_packs(slug);
CREATE INDEX IF NOT EXISTS npc_packs_prompt_gin_idx ON public.npc_packs USING gin (prompt);

-- ============================================================================
-- CREATE RLS POLICIES (if they don't exist)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rulesets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.npcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.npc_packs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'entries' 
    AND policyname = 'Entries: Anyone can view active public entries'
  ) THEN
    CREATE POLICY "Entries: Anyone can view active public entries" ON public.entries
      FOR SELECT USING (status = 'active' AND visibility = 'public');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'entries' 
    AND policyname = 'Entries: Authenticated users can manage'
  ) THEN
    CREATE POLICY "Entries: Authenticated users can manage" ON public.entries
      FOR ALL USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Create RLS policies for entry_points
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'entry_points' 
    AND policyname = 'Entry Points: Anyone can view active public entry points'
  ) THEN
    CREATE POLICY "Entry Points: Anyone can view active public entry points" ON public.entry_points
      FOR SELECT USING (lifecycle = 'active' AND visibility = 'public');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'entry_points' 
    AND policyname = 'Entry Points: Authenticated users can manage'
  ) THEN
    CREATE POLICY "Entry Points: Authenticated users can manage" ON public.entry_points
      FOR ALL USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Create RLS policies for rulesets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'rulesets' 
    AND policyname = 'Rulesets: Anyone can view active rulesets'
  ) THEN
    CREATE POLICY "Rulesets: Anyone can view active rulesets" ON public.rulesets
      FOR SELECT USING (status = 'active');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'rulesets' 
    AND policyname = 'Rulesets: Authenticated users can manage'
  ) THEN
    CREATE POLICY "Rulesets: Authenticated users can manage" ON public.rulesets
      FOR ALL USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Create RLS policies for npcs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'npcs' 
    AND policyname = 'NPCs: Anyone can view active NPCs'
  ) THEN
    CREATE POLICY "NPCs: Anyone can view active NPCs" ON public.npcs
      FOR SELECT USING (status = 'active');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'npcs' 
    AND policyname = 'NPCs: Authenticated users can manage'
  ) THEN
    CREATE POLICY "NPCs: Authenticated users can manage" ON public.npcs
      FOR ALL USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Create RLS policies for npc_packs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'npc_packs' 
    AND policyname = 'NPC Packs: Anyone can view active NPC packs'
  ) THEN
    CREATE POLICY "NPC Packs: Anyone can view active NPC packs" ON public.npc_packs
      FOR SELECT USING (status = 'active');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'npc_packs' 
    AND policyname = 'NPC Packs: Authenticated users can manage'
  ) THEN
    CREATE POLICY "NPC Packs: Authenticated users can manage" ON public.npc_packs
      FOR ALL USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- VERIFY THE CHANGES
-- ============================================================================

SELECT 
  'Migration completed successfully!' as status,
  'All admin tables and columns are now available' as message;

-- Show the new entries table schema
SELECT 
  'entries' as table_name,
  column_name, 
  data_type, 
  is_nullable, 
  column_default 
FROM information_schema.columns 
WHERE table_name = 'entries' 
  AND table_schema = 'public'
ORDER BY ordinal_position;







