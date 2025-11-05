-- Phase A4: NPC updated_at Support
-- Adds updated_at column if missing and creates trigger to auto-update it

BEGIN;

-- Add updated_at column if it doesn't exist
ALTER TABLE public.npcs
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Create trigger function (idempotent)
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'npcs_touch_updated_at'
  ) THEN
    CREATE TRIGGER npcs_touch_updated_at
    BEFORE UPDATE ON public.npcs
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_touch_updated_at();
  END IF;
END $$;

-- Index for updated_at queries (used in cache versioning)
CREATE INDEX IF NOT EXISTS npcs_updated_idx ON public.npcs (updated_at);

COMMIT;


