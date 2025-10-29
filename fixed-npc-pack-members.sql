-- Fixed version for PostgreSQL compatibility

-- First ensure npcs table has proper primary key
DO $$
BEGIN
  -- Check if npcs table exists and has primary key
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'npcs' 
    AND table_schema = 'public'
  ) THEN
    -- Check if id column exists and is primary key
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'npcs' 
      AND tc.table_schema = 'public'
      AND tc.constraint_type = 'PRIMARY KEY'
      AND ccu.column_name = 'id'
    ) THEN
      -- Add primary key constraint if missing
      ALTER TABLE public.npcs ADD CONSTRAINT npcs_pkey PRIMARY KEY (id);
    END IF;
  END IF;
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

