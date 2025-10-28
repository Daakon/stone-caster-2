-- Create rulesets table if it doesn't exist
-- This creates a simple rulesets table that matches the expected schema

BEGIN;

-- Create rulesets table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.rulesets (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  description text,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS rulesets_slug_uq ON public.rulesets(slug);
CREATE INDEX IF NOT EXISTS rulesets_status_idx ON public.rulesets(status);

-- Enable RLS
ALTER TABLE public.rulesets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (only if they don't exist)
DO $$
BEGIN
  -- Create policy for viewing active rulesets
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'rulesets' 
    AND policyname = 'Rulesets: Anyone can view active rulesets'
  ) THEN
    CREATE POLICY "Rulesets: Anyone can view active rulesets" ON public.rulesets
      FOR SELECT USING (status = 'active');
  END IF;

  -- Create policy for authenticated users to manage rulesets
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'rulesets' 
    AND policyname = 'Rulesets: Authenticated users can manage'
  ) THEN
    CREATE POLICY "Rulesets: Authenticated users can manage" ON public.rulesets
      FOR ALL USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Insert some default rulesets
INSERT INTO public.rulesets (id, name, slug, description, status) VALUES
  ('d-d-5e', 'D&D 5e', 'd-d-5e', 'Dungeons & Dragons 5th Edition rules', 'active'),
  ('pathfinder', 'Pathfinder', 'pathfinder', 'Pathfinder RPG rules', 'active'),
  ('custom-rules', 'Custom Rules', 'custom-rules', 'Custom game rules', 'draft')
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Verify the table was created
SELECT 
  'Rulesets table created successfully!' as status,
  COUNT(*) as default_rulesets_count
FROM public.rulesets;
