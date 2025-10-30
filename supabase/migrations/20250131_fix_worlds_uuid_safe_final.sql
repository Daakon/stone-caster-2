-- Safe Worlds Table UUID Migration (Final Fixed Version)
-- Alternative approach: Create admin-specific tables that work with existing schema
-- This avoids breaking existing foreign key constraints

BEGIN;

-- Instead of converting the existing worlds table, we'll create a mapping table
-- and update the admin migrations to work with the existing TEXT-based schema

-- Create a mapping table to convert between TEXT and UUID for admin purposes
CREATE TABLE IF NOT EXISTS public.world_id_mapping (
  text_id text NOT NULL,
  uuid_id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (text_id)
);

-- Populate the mapping table with existing worlds
INSERT INTO public.world_id_mapping (text_id, uuid_id)
SELECT id, gen_random_uuid() 
FROM public.worlds 
WHERE id NOT IN (SELECT text_id FROM public.world_id_mapping);

-- Add status column to existing worlds table (this is safe)
ALTER TABLE public.worlds 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived'));

-- Update existing records to have status
UPDATE public.worlds SET status = 'active' WHERE status IS NULL;

-- Make status NOT NULL
ALTER TABLE public.worlds ALTER COLUMN status SET NOT NULL;

-- Add name and description columns to existing worlds table
ALTER TABLE public.worlds 
ADD COLUMN IF NOT EXISTS name text,
ADD COLUMN IF NOT EXISTS description text;

-- Update existing records to have names (use id as fallback)
UPDATE public.worlds SET name = id WHERE name IS NULL;

-- Make name required
ALTER TABLE public.worlds ALTER COLUMN name SET NOT NULL;

-- Create a view that provides UUID-based access for admin
-- Handle the composite primary key by getting the latest version
-- Only reference columns that actually exist in the worlds table
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

-- Enable RLS on the mapping table
ALTER TABLE public.world_id_mapping ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for the mapping table
-- Use simplified policies that don't depend on user_profiles table structure
CREATE POLICY "World mapping: Anyone can view" ON public.world_id_mapping
  FOR SELECT USING (true);

-- For now, allow all authenticated users to manage mappings
-- This can be refined later once we know the actual user table structure
CREATE POLICY "World mapping: Authenticated users can manage" ON public.world_id_mapping
  FOR ALL USING (auth.uid() IS NOT NULL);

COMMIT;







