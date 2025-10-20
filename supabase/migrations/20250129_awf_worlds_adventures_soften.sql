-- AWF Worlds & Adventures Soften Migration
-- Adds updated_at trigger helpers and ensures triggers exist

-- Add updated_at trigger helpers if you don't have them
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW(); 
  RETURN NEW;
END$$;

-- Ensure updated_at triggers exist for worlds
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='worlds')
  THEN
    -- Drop existing trigger if it exists
    DROP TRIGGER IF EXISTS worlds_touch_updated_at ON public.worlds;
    
    -- Create the trigger
    CREATE TRIGGER worlds_touch_updated_at
    BEFORE UPDATE ON public.worlds
    FOR EACH ROW EXECUTE PROCEDURE public.touch_updated_at();
  END IF;
END$$;

-- Ensure updated_at triggers exist for adventures
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='adventures')
  THEN
    -- Drop existing trigger if it exists
    DROP TRIGGER IF EXISTS adventures_touch_updated_at ON public.adventures;
    
    -- Create the trigger
    CREATE TRIGGER adventures_touch_updated_at
    BEFORE UPDATE ON public.adventures
    FOR EACH ROW EXECUTE PROCEDURE public.touch_updated_at();
  END IF;
END$$;

-- Add comments
COMMENT ON FUNCTION public.touch_updated_at() IS 'Generic trigger function to update updated_at timestamp';
