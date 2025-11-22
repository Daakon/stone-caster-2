-- Add sort_order column to entry_point_npcs for deterministic NPC ordering
-- This migration supports v3 assembler which requires ordered NPC segments

BEGIN;

-- Add sort_order column if it doesn't exist
ALTER TABLE entry_point_npcs
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Create index for ordered queries
CREATE INDEX IF NOT EXISTS idx_ep_npcs_sort 
  ON entry_point_npcs(entry_point_id, sort_order);

-- Update existing rows to use weight as sort_order (if weight exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'entry_point_npcs' 
    AND column_name = 'weight'
  ) THEN
    UPDATE entry_point_npcs
    SET sort_order = COALESCE(weight, 0)
    WHERE sort_order = 0;
  END IF;
END $$;

COMMENT ON COLUMN entry_point_npcs.sort_order IS 'Ordering for NPC segments in v3 assembler (lower = earlier)';

COMMIT;

