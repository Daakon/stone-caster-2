-- Fixed version for PostgreSQL compatibility

-- First ensure npcs table has proper structure
DO $$
BEGIN
  -- Check if npcs table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'npcs' 
    AND table_schema = 'public'
  ) THEN
    -- Check if id column exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'npcs' 
      AND table_schema = 'public' 
      AND column_name = 'id'
    ) THEN
      -- Add id column if missing
      ALTER TABLE public.npcs ADD COLUMN id uuid DEFAULT gen_random_uuid();
    END IF;
    
    -- Check if primary key exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'npcs' 
      AND tc.table_schema = 'public'
      AND tc.constraint_type = 'PRIMARY KEY'
      AND ccu.column_name = 'id'
    ) THEN
      -- Add primary key constraint
      ALTER TABLE public.npcs ADD CONSTRAINT npcs_pkey PRIMARY KEY (id);
    END IF;
  ELSE
    -- Create npcs table with proper structure
    CREATE TABLE public.npcs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text,
      status text DEFAULT 'draft',
      description text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    -- Constraint already exists, do nothing
    NULL;
END $$;

-- Create npc_pack_members table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'npc_pack_members' 
    AND table_schema = 'public'
  ) THEN
    CREATE TABLE public.npc_pack_members (
      pack_id uuid NOT NULL REFERENCES public.npc_packs(id) ON DELETE CASCADE,
      npc_id uuid NOT NULL REFERENCES public.npcs(id) ON DELETE CASCADE,
      PRIMARY KEY (pack_id, npc_id)
    );
  END IF;
END $$;
