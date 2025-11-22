-- v3 Assembler Integrity Migration
-- Adds constraints, indexes, and data integrity guards for entry-point assembler v3

BEGIN;

-- ============================================================================
-- 1) ENTRY_POINTS: Constraints and Indexes
-- ============================================================================

-- Ensure unique (world_id, slug) per world
CREATE UNIQUE INDEX IF NOT EXISTS idx_entry_points_world_slug 
  ON entry_points(world_id, slug)
  WHERE status = 'active';

-- Status check constraint (if not already enforced by CHECK)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'entry_points_status_check'
    AND table_name = 'entry_points'
  ) THEN
    ALTER TABLE entry_points 
    ADD CONSTRAINT entry_points_status_check 
    CHECK (status IN ('draft', 'active', 'archived'));
  END IF;
END $$;

-- Index for active entry points lookup
CREATE INDEX IF NOT EXISTS idx_entry_points_active 
  ON entry_points(world_id, status)
  WHERE status = 'active';

-- ============================================================================
-- 2) ENTRY_POINT_RULESETS: PK, FK, Default Ruleset Enforcement
-- ============================================================================

-- Add is_default column if missing
ALTER TABLE entry_point_rulesets
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

-- Ensure PK is composite (entry_point_id, ruleset_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'entry_point_rulesets_pkey'
    AND table_name = 'entry_point_rulesets'
  ) THEN
    ALTER TABLE entry_point_rulesets
    ADD PRIMARY KEY (entry_point_id, ruleset_id);
  END IF;
END $$;

-- FK cascade delete
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'entry_point_rulesets_entry_point_id_fkey'
    AND table_name = 'entry_point_rulesets'
  ) THEN
    ALTER TABLE entry_point_rulesets
    ADD CONSTRAINT entry_point_rulesets_entry_point_id_fkey
    FOREIGN KEY (entry_point_id) REFERENCES entry_points(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Partial index for fast default lookup
CREATE INDEX IF NOT EXISTS idx_entry_point_rulesets_default 
  ON entry_point_rulesets(entry_point_id, is_default)
  WHERE is_default = true;

-- Function to enforce max one default per entry point
CREATE OR REPLACE FUNCTION enforce_single_default_ruleset()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    -- Unset other defaults for this entry point
    UPDATE entry_point_rulesets
    SET is_default = false
    WHERE entry_point_id = NEW.entry_point_id
      AND ruleset_id != NEW.ruleset_id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce single default
DROP TRIGGER IF EXISTS trigger_enforce_single_default_ruleset ON entry_point_rulesets;
CREATE TRIGGER trigger_enforce_single_default_ruleset
  BEFORE INSERT OR UPDATE OF is_default ON entry_point_rulesets
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION enforce_single_default_ruleset();

-- ============================================================================
-- 3) ENTRY_POINT_NPCS: PK, FK, sort_order Backfill, Indexes
-- ============================================================================

-- Add sort_order if missing (from previous migration)
ALTER TABLE entry_point_npcs
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 1000;

-- Backfill null sort_order using window function (by insertion order)
DO $$
BEGIN
  UPDATE entry_point_npcs epn
  SET sort_order = subq.rn * 10
  FROM (
    SELECT 
      entry_point_id,
      npc_id,
      ROW_NUMBER() OVER (PARTITION BY entry_point_id ORDER BY created_at, id) AS rn
    FROM entry_point_npcs
    WHERE sort_order = 1000 OR sort_order IS NULL
  ) subq
  WHERE epn.entry_point_id = subq.entry_point_id
    AND epn.npc_id = subq.npc_id;
END $$;

-- Ensure NOT NULL after backfill
ALTER TABLE entry_point_npcs
  ALTER COLUMN sort_order SET NOT NULL;

-- Composite index for deterministic ordering
CREATE INDEX IF NOT EXISTS idx_entry_point_npcs_ordering 
  ON entry_point_npcs(entry_point_id, sort_order, npc_id);

-- FK cascade delete
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'entry_point_npcs_entry_point_id_fkey'
    AND table_name = 'entry_point_npcs'
  ) THEN
    ALTER TABLE entry_point_npcs
    ADD CONSTRAINT entry_point_npcs_entry_point_id_fkey
    FOREIGN KEY (entry_point_id) REFERENCES entry_points(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 4) WORLDS: Active Status Check Function
-- ============================================================================

-- Function to check if world is active
CREATE OR REPLACE FUNCTION is_world_active(p_world_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM worlds
    WHERE id = p_world_id
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 5) RULESETS: Active Status Check Function
-- ============================================================================

-- Function to check if ruleset is active and allowed for entry point
CREATE OR REPLACE FUNCTION is_ruleset_allowed_for_entry(
  p_entry_point_id TEXT,
  p_ruleset_id TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM entry_point_rulesets epr
    JOIN rulesets r ON r.id = epr.ruleset_id
    WHERE epr.entry_point_id = p_entry_point_id
      AND epr.ruleset_id = p_ruleset_id
      AND r.status = 'active'
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON INDEX idx_entry_points_world_slug IS 'Ensures unique slug per world for active entry points';
COMMENT ON INDEX idx_entry_point_rulesets_default IS 'Fast lookup of default ruleset per entry point';
COMMENT ON INDEX idx_entry_point_npcs_ordering IS 'Deterministic NPC ordering: entry_point_id -> sort_order -> npc_id';
COMMENT ON FUNCTION enforce_single_default_ruleset() IS 'Ensures max one default ruleset per entry point';
COMMENT ON FUNCTION is_world_active(TEXT) IS 'Check if world exists and is active';
COMMENT ON FUNCTION is_ruleset_allowed_for_entry(TEXT, TEXT) IS 'Check if ruleset is mapped to entry point and active';

COMMIT;

