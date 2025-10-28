-- Add missing columns to existing rulesets table
-- This script assumes the rulesets table already exists

BEGIN;

-- Add slug column to rulesets table (if it doesn't exist)
ALTER TABLE public.rulesets ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS rulesets_slug_uq ON public.rulesets(slug);

-- Add prompt column to rulesets table (handle existing text columns)
DO $$
BEGIN
  -- Check if prompt column already exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rulesets' 
    AND table_schema = 'public' 
    AND column_name = 'prompt'
  ) THEN
    -- Column exists, check if it's jsonb type
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'rulesets' 
      AND table_schema = 'public' 
      AND column_name = 'prompt'
      AND data_type = 'jsonb'
    ) THEN
      -- It's already jsonb, just create the index
      CREATE INDEX IF NOT EXISTS rulesets_prompt_gin_idx ON public.rulesets USING gin (prompt);
    ELSE
      -- It's text type, convert to jsonb safely
      BEGIN
        ALTER TABLE public.rulesets ALTER COLUMN prompt TYPE jsonb USING prompt::jsonb;
        CREATE INDEX IF NOT EXISTS rulesets_prompt_gin_idx ON public.rulesets USING gin (prompt);
      EXCEPTION WHEN OTHERS THEN
        -- If conversion fails, drop the column and recreate as jsonb
        ALTER TABLE public.rulesets DROP COLUMN IF EXISTS prompt;
        ALTER TABLE public.rulesets ADD COLUMN prompt jsonb DEFAULT '{}';
        CREATE INDEX IF NOT EXISTS rulesets_prompt_gin_idx ON public.rulesets USING gin (prompt);
      END;
    END IF;
  ELSE
    -- Column doesn't exist, create as jsonb
    ALTER TABLE public.rulesets ADD COLUMN prompt jsonb DEFAULT '{}';
    CREATE INDEX IF NOT EXISTS rulesets_prompt_gin_idx ON public.rulesets USING gin (prompt);
  END IF;
END $$;

-- Add comments to document the new columns
COMMENT ON COLUMN public.rulesets.slug IS 'URL-friendly identifier for rulesets';
COMMENT ON COLUMN public.rulesets.prompt IS 'JSONB field for storing ruleset prompt data and AI instructions';

COMMIT;

-- Verify the columns were added
SELECT 
  'Rulesets table updated successfully!' as status,
  column_name, 
  data_type, 
  is_nullable, 
  column_default 
FROM information_schema.columns 
WHERE table_name = 'rulesets' 
  AND table_schema = 'public'
  AND column_name IN ('slug', 'prompt')
ORDER BY column_name;
