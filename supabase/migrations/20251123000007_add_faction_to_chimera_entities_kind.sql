-- Add 'faction' as a valid kind for chimera_entities
-- This migration updates the CHECK constraint to include 'faction' alongside 'npc', 'item', and 'location'

BEGIN;

-- Drop the existing CHECK constraint
ALTER TABLE chimera_entities
  DROP CONSTRAINT IF EXISTS chimera_entities_kind_check;

-- Add the updated CHECK constraint with 'faction' included
ALTER TABLE chimera_entities
  ADD CONSTRAINT chimera_entities_kind_check 
  CHECK (kind IN ('npc', 'item', 'location', 'faction'));

COMMENT ON COLUMN chimera_entities.kind IS 
  'Kind of entity: npc, item, location, or faction';

COMMIT;

