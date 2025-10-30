-- Fixed version for PostgreSQL compatibility

-- First, let's see what's actually in the npcs table and fix it
DO $$
DECLARE
  has_primary_key boolean := false;
BEGIN
  -- Check if npcs table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'npcs' 
    AND table_schema = 'public'
  ) THEN
    -- Check if it has a primary key
    SELECT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      WHERE tc.table_name = 'npcs' 
      AND tc.table_schema = 'public'
      AND tc.constraint_type = 'PRIMARY KEY'
    ) INTO has_primary_key;
    
    IF NOT has_primary_key THEN
      -- Drop and recreate the table with proper structure
      DROP TABLE IF EXISTS public.npcs CASCADE;
      CREATE TABLE public.npcs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text,
        status text DEFAULT 'draft',
        description text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
      RAISE NOTICE 'Recreated npcs table with proper primary key';
    ELSE
      RAISE NOTICE 'npcs table already has primary key';
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
    RAISE NOTICE 'Created new npcs table with primary key';
  END IF;
END $$;

-- Now create npc_pack_members table
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
    RAISE NOTICE 'Created npc_pack_members table';
  ELSE
    RAISE NOTICE 'npc_pack_members table already exists';
  END IF;
END $$;







