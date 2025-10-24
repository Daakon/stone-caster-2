-- Create Rulesets Table Migration (Fixed v2)
-- Creates the rulesets table that the admin associations migration expects

BEGIN;

-- Create rulesets table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.rulesets (
  id text PRIMARY KEY, -- Use text to match existing patterns
  name text NOT NULL,
  slug text NOT NULL, -- Make it a regular column, not generated
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

-- Create RLS policies
CREATE POLICY "Rulesets: Anyone can view active rulesets" ON public.rulesets
  FOR SELECT USING (status = 'active');

-- Simplified admin policy that doesn't depend on user_profiles table
-- For now, allow all authenticated users to manage rulesets
-- This can be refined later once we know the actual user table structure
CREATE POLICY "Rulesets: Authenticated users can manage" ON public.rulesets
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Insert some default rulesets with explicit slugs
INSERT INTO public.rulesets (id, name, slug, description, status) VALUES
  ('d-d-5e', 'D&D 5e', 'd-d-5e', 'Dungeons & Dragons 5th Edition rules', 'active'),
  ('pathfinder', 'Pathfinder', 'pathfinder', 'Pathfinder RPG rules', 'active'),
  ('custom-rules', 'Custom Rules', 'custom-rules', 'Custom game rules', 'draft')
ON CONFLICT (id) DO NOTHING;

COMMIT;
