-- Fixed version for PostgreSQL compatibility

-- Completely recreate npcs table to ensure it has proper primary key
DO $$
BEGIN
  -- Drop npcs table if it exists (this will also drop any dependent objects)
  DROP TABLE IF EXISTS public.npcs CASCADE;
  
  -- Create npcs table with proper structure
  CREATE TABLE public.npcs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text,
    status text DEFAULT 'draft',
    description text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
  
  RAISE NOTICE 'Created npcs table with primary key';
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
