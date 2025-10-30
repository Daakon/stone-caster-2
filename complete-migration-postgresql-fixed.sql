-- ============================================================================
-- POSTGRESQL-COMPATIBLE MIGRATION - FIXED ORDER
-- ============================================================================
-- PostgreSQL does NOT support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- We must use DO blocks with proper error handling and correct order

BEGIN;

-- ============================================================================
-- STEP 1: ADD STATUS COLUMN TO WORLDS TABLE
-- ============================================================================

DO $$
BEGIN
  -- Check if status column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'worlds' 
    AND table_schema = 'public' 
    AND column_name = 'status'
  ) THEN
    -- Add the status column
    ALTER TABLE public.worlds 
    ADD COLUMN status text DEFAULT 'active';
    
    -- Add the check constraint
    ALTER TABLE public.worlds 
    ADD CONSTRAINT worlds_status_check 
    CHECK (status IN ('draft', 'active', 'archived'));
    
    -- Update existing records
    UPDATE public.worlds SET status = 'active' WHERE status IS NULL;
    
    -- Make it NOT NULL
    ALTER TABLE public.worlds ALTER COLUMN status SET NOT NULL;
    
    RAISE NOTICE 'Added status column to worlds table';
  ELSE
    RAISE NOTICE 'Status column already exists in worlds table';
  END IF;
EXCEPTION
  WHEN duplicate_column THEN
    RAISE NOTICE 'Status column already exists (caught exception)';
END $$;

-- ============================================================================
-- STEP 2: ADD NAME COLUMN TO WORLDS TABLE
-- ============================================================================

DO $$
BEGIN
  -- Check if name column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'worlds' 
    AND table_schema = 'public' 
    AND column_name = 'name'
  ) THEN
    -- Add the name column
    ALTER TABLE public.worlds 
    ADD COLUMN name text;
    
    -- Update existing records to use id as name
    UPDATE public.worlds SET name = id WHERE name IS NULL;
    
    -- Make it NOT NULL
    ALTER TABLE public.worlds ALTER COLUMN name SET NOT NULL;
    
    RAISE NOTICE 'Added name column to worlds table';
  ELSE
    RAISE NOTICE 'Name column already exists in worlds table';
  END IF;
EXCEPTION
  WHEN duplicate_column THEN
    RAISE NOTICE 'Name column already exists (caught exception)';
END $$;

-- ============================================================================
-- STEP 3: ADD DESCRIPTION COLUMN TO WORLDS TABLE
-- ============================================================================

DO $$
BEGIN
  -- Check if description column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'worlds' 
    AND table_schema = 'public' 
    AND column_name = 'description'
  ) THEN
    -- Add the description column
    ALTER TABLE public.worlds 
    ADD COLUMN description text;
    
    RAISE NOTICE 'Added description column to worlds table';
  ELSE
    RAISE NOTICE 'Description column already exists in worlds table';
  END IF;
EXCEPTION
  WHEN duplicate_column THEN
    RAISE NOTICE 'Description column already exists (caught exception)';
END $$;

-- ============================================================================
-- STEP 4: ADD PROMPT COLUMN TO WORLDS TABLE
-- ============================================================================

DO $$
BEGIN
  -- Check if prompt column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'worlds' 
    AND table_schema = 'public' 
    AND column_name = 'prompt'
  ) THEN
    -- Add the prompt column
    ALTER TABLE public.worlds 
    ADD COLUMN prompt text;
    
    RAISE NOTICE 'Added prompt column to worlds table';
  ELSE
    RAISE NOTICE 'Prompt column already exists in worlds table';
  END IF;
EXCEPTION
  WHEN duplicate_column THEN
    RAISE NOTICE 'Prompt column already exists (caught exception)';
END $$;

-- ============================================================================
-- STEP 5: CREATE WORLD ID MAPPING TABLE
-- ============================================================================

-- Create a mapping table to convert between TEXT and UUID for admin purposes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'world_id_mapping' 
    AND table_schema = 'public'
  ) THEN
    CREATE TABLE public.world_id_mapping (
      text_id text NOT NULL,
      uuid_id uuid NOT NULL DEFAULT gen_random_uuid(),
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (text_id)
    );
  END IF;
END $$;

-- Populate the mapping table with existing worlds
INSERT INTO public.world_id_mapping (text_id, uuid_id)
SELECT id, gen_random_uuid() 
FROM public.worlds 
WHERE id NOT IN (SELECT text_id FROM public.world_id_mapping);

-- Enable RLS on the mapping table
ALTER TABLE public.world_id_mapping ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for the mapping table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'world_id_mapping' 
    AND policyname = 'World mapping: Anyone can view'
  ) THEN
    CREATE POLICY "World mapping: Anyone can view" ON public.world_id_mapping
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'world_id_mapping' 
    AND policyname = 'World mapping: Authenticated users can manage'
  ) THEN
    CREATE POLICY "World mapping: Authenticated users can manage" ON public.world_id_mapping
      FOR ALL USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- ============================================================================
-- STEP 6: CREATE WORLDS ADMIN VIEW (ONLY AFTER ALL COLUMNS EXIST)
-- ============================================================================

-- Now create the view that references all the columns we just added
DO $$
BEGIN
  -- Only create the view if all required columns exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'worlds' 
    AND table_schema = 'public' 
    AND column_name = 'status'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'worlds' 
    AND table_schema = 'public' 
    AND column_name = 'name'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'worlds' 
    AND table_schema = 'public' 
    AND column_name = 'description'
  ) THEN
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
    
    RAISE NOTICE 'Created worlds_admin view';
  ELSE
    RAISE NOTICE 'Required columns not found, skipping view creation';
  END IF;
END $$;

-- ============================================================================
-- STEP 7: CREATE RULESETS TABLE
-- ============================================================================

-- Create rulesets table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'rulesets' 
    AND table_schema = 'public'
  ) THEN
    CREATE TABLE public.rulesets (
      id text PRIMARY KEY,
      name text NOT NULL,
      slug text NOT NULL,
      status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
      description text,
      version int NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;

-- Create indexes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'rulesets_slug_uq'
  ) THEN
    CREATE UNIQUE INDEX rulesets_slug_uq ON public.rulesets(slug);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'rulesets_status_idx'
  ) THEN
    CREATE INDEX rulesets_status_idx ON public.rulesets(status);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.rulesets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'rulesets' 
    AND policyname = 'Rulesets: Anyone can view active rulesets'
  ) THEN
    CREATE POLICY "Rulesets: Anyone can view active rulesets" ON public.rulesets
      FOR SELECT USING (status = 'active');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'rulesets' 
    AND policyname = 'Rulesets: Authenticated users can manage'
  ) THEN
    CREATE POLICY "Rulesets: Authenticated users can manage" ON public.rulesets
      FOR ALL USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Insert some default rulesets
DO $$
BEGIN
  -- Insert D&D 5e ruleset if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM public.rulesets WHERE slug = 'd-d-5e') THEN
    INSERT INTO public.rulesets (id, name, slug, description, status) VALUES
      ('d-d-5e', 'D&D 5e', 'd-d-5e', 'Dungeons & Dragons 5th Edition rules', 'active');
  END IF;

  -- Insert Pathfinder ruleset if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM public.rulesets WHERE slug = 'pathfinder') THEN
    INSERT INTO public.rulesets (id, name, slug, description, status) VALUES
      ('pathfinder', 'Pathfinder', 'pathfinder', 'Pathfinder RPG rules', 'active');
  END IF;

  -- Insert Custom Rules ruleset if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM public.rulesets WHERE slug = 'custom-rules') THEN
    INSERT INTO public.rulesets (id, name, slug, description, status) VALUES
      ('custom-rules', 'Custom Rules', 'custom-rules', 'Custom game rules', 'draft');
  END IF;
END $$;

-- ============================================================================
-- STEP 8: CREATE NPCS TABLE
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'npcs' 
    AND table_schema = 'public'
  ) THEN
    CREATE TABLE public.npcs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
      description text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;

-- Create index AFTER the table is created and has the status column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'npcs_status_idx'
  ) THEN
    CREATE INDEX npcs_status_idx ON public.npcs(status);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.npcs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'npcs' 
    AND policyname = 'NPCs: Anyone can view active NPCs'
  ) THEN
    CREATE POLICY "NPCs: Anyone can view active NPCs" ON public.npcs
      FOR SELECT USING (status = 'active');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'npcs' 
    AND policyname = 'NPCs: Authenticated users can manage'
  ) THEN
    CREATE POLICY "NPCs: Authenticated users can manage" ON public.npcs
      FOR ALL USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Insert sample NPCs
INSERT INTO public.npcs (id, name, description, status) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Gandalf the Grey', 'A wise wizard mentor', 'active'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Captain Kirk', 'Bold starship captain', 'active'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Sherlock Holmes', 'Master detective', 'active')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 9: ADD PROMPT COLUMN TO RULESETS
-- ============================================================================

DO $$
BEGIN
  -- Check if prompt column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rulesets' 
    AND table_schema = 'public' 
    AND column_name = 'prompt'
  ) THEN
    -- Add the prompt column
    ALTER TABLE public.rulesets 
    ADD COLUMN prompt text;
    
    RAISE NOTICE 'Added prompt column to rulesets table';
  ELSE
    RAISE NOTICE 'Prompt column already exists in rulesets table';
  END IF;
EXCEPTION
  WHEN duplicate_column THEN
    RAISE NOTICE 'Prompt column already exists (caught exception)';
END $$;

-- ============================================================================
-- STEP 10: ADD PROMPT COLUMN TO NPCS
-- ============================================================================

DO $$
BEGIN
  -- Check if prompt column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'npcs' 
    AND table_schema = 'public' 
    AND column_name = 'prompt'
  ) THEN
    -- Add the prompt column
    ALTER TABLE public.npcs 
    ADD COLUMN prompt text;
    
    RAISE NOTICE 'Added prompt column to npcs table';
  ELSE
    RAISE NOTICE 'Prompt column already exists in npcs table';
  END IF;
EXCEPTION
  WHEN duplicate_column THEN
    RAISE NOTICE 'Prompt column already exists (caught exception)';
END $$;

-- ============================================================================
-- VERIFICATION STEP
-- ============================================================================

-- Let's verify what columns now exist in the worlds table
DO $$
DECLARE
  col_record RECORD;
BEGIN
  RAISE NOTICE 'Current columns in worlds table:';
  FOR col_record IN 
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'worlds' 
    AND table_schema = 'public'
    ORDER BY ordinal_position
  LOOP
    RAISE NOTICE '  %: % (nullable: %)', col_record.column_name, col_record.data_type, col_record.is_nullable;
  END LOOP;
END $$;

COMMIT;







