-- Fixed version for PostgreSQL compatibility

-- Create npcs table if it doesn't exist
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

-- Create index if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'npcs_status_idx'
  ) THEN
    CREATE INDEX npcs_status_idx ON public.npcs(status);
  END IF;
END $$;







