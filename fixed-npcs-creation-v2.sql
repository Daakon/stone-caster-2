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

-- Ensure status column exists (add if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'npcs' 
    AND table_schema = 'public' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.npcs 
    ADD COLUMN status text DEFAULT 'draft';
    
    -- Add the check constraint
    ALTER TABLE public.npcs 
    ADD CONSTRAINT npcs_status_check 
    CHECK (status IN ('draft', 'active', 'archived'));
    
    -- Update existing records
    UPDATE public.npcs SET status = 'draft' WHERE status IS NULL;
    
    -- Make it NOT NULL
    ALTER TABLE public.npcs ALTER COLUMN status SET NOT NULL;
  END IF;
EXCEPTION
  WHEN duplicate_column THEN
    -- Column already exists, do nothing
    NULL;
END $$;

-- Create index only after ensuring status column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'npcs_status_idx'
  ) THEN
    CREATE INDEX npcs_status_idx ON public.npcs(status);
  END IF;
END $$;







