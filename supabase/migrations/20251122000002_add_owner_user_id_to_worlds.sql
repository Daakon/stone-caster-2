-- Add owner_user_id column to chimera_worlds for API compatibility
-- The V3 schema uses owner_id, but the API code expects owner_user_id

BEGIN;

-- Add owner_user_id column (alias for owner_id for API compatibility)
ALTER TABLE chimera_worlds
  ADD COLUMN IF NOT EXISTS owner_user_id UUID;

-- Copy data from owner_id to owner_user_id if owner_user_id is null
UPDATE chimera_worlds
SET owner_user_id = owner_id
WHERE owner_user_id IS NULL AND owner_id IS NOT NULL;

-- Make owner_user_id NOT NULL if we have data, otherwise keep it nullable
-- (We'll keep it nullable to match the V3 schema's owner_id which is nullable)

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_chimera_worlds_owner_user_id 
  ON chimera_worlds(owner_user_id) 
  WHERE owner_user_id IS NOT NULL;

-- Create trigger to keep owner_id and owner_user_id in sync
CREATE OR REPLACE FUNCTION sync_chimera_worlds_owner_ids()
RETURNS TRIGGER AS $$
BEGIN
  -- If owner_user_id is set, sync to owner_id
  IF NEW.owner_user_id IS NOT NULL AND (OLD.owner_user_id IS DISTINCT FROM NEW.owner_user_id) THEN
    NEW.owner_id = NEW.owner_user_id;
  END IF;
  -- If owner_id is set, sync to owner_user_id
  IF NEW.owner_id IS NOT NULL AND (OLD.owner_id IS DISTINCT FROM NEW.owner_id) THEN
    NEW.owner_user_id = NEW.owner_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_chimera_worlds_owner_ids_trigger ON chimera_worlds;
CREATE TRIGGER sync_chimera_worlds_owner_ids_trigger
  BEFORE INSERT OR UPDATE ON chimera_worlds
  FOR EACH ROW
  EXECUTE FUNCTION sync_chimera_worlds_owner_ids();

COMMENT ON COLUMN chimera_worlds.owner_user_id IS 
  'Owner user ID (synced with owner_id for API compatibility)';

COMMIT;

