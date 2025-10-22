-- Create Rulesets Table Migration
-- Creates the rulesets table that the admin associations migration expects

BEGIN;

-- Create rulesets table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.rulesets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text GENERATED ALWAYS AS (regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')) STORED,
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

CREATE POLICY "Rulesets: Admin can do everything" ON public.rulesets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role IN ('admin', 'moderator')
    )
  );

-- Insert some default rulesets
INSERT INTO public.rulesets (id, name, description, status) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'D&D 5e', 'Dungeons & Dragons 5th Edition rules', 'active'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Pathfinder', 'Pathfinder RPG rules', 'active'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Custom Rules', 'Custom game rules', 'draft')
ON CONFLICT (id) DO NOTHING;

COMMIT;
