-- Entry Points Multi-Ruleset Support Migration
-- Replaces single ruleset_id with many-to-many relationship

-- ============================================================================
-- 1) Remove old single-FK (no backward compatibility required)
-- ============================================================================

ALTER TABLE entry_points
  DROP COLUMN IF EXISTS ruleset_id;

-- ============================================================================
-- 2) New join table for entry-point to ruleset relationships
-- ============================================================================

CREATE TABLE IF NOT EXISTS entry_point_rulesets (
  entry_point_id text NOT NULL REFERENCES entry_points(id) ON DELETE CASCADE,
  ruleset_id     text NOT NULL REFERENCES rulesets(id) ON DELETE RESTRICT,
  sort_order     int  NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entry_point_id, ruleset_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_epr_entry ON entry_point_rulesets(entry_point_id);
CREATE INDEX IF NOT EXISTS idx_epr_ruleset ON entry_point_rulesets(ruleset_id);
CREATE INDEX IF NOT EXISTS idx_epr_sort ON entry_point_rulesets(entry_point_id, sort_order);

-- ============================================================================
-- 3) RLS Policies (mirror entry_points visibility/ownership)
-- ============================================================================

ALTER TABLE entry_point_rulesets ENABLE ROW LEVEL SECURITY;

-- Owner can manage their own entry rulesets
CREATE POLICY epr_owner_rw ON entry_point_rulesets
FOR ALL
USING ( EXISTS (
  SELECT 1 FROM entry_points ep
  WHERE ep.id = entry_point_rulesets.entry_point_id
    AND (ep.owner_user_id = auth.uid() OR auth.jwt() ->> 'role' IN ('moderator','admin'))
))
WITH CHECK ( EXISTS (
  SELECT 1 FROM entry_points ep
  WHERE ep.id = entry_point_rulesets.entry_point_id
    AND (ep.owner_user_id = auth.uid() OR auth.jwt() ->> 'role' IN ('moderator','admin'))
));

-- ============================================================================
-- 4) Constraints
-- ============================================================================

-- Sort order bounds
ALTER TABLE entry_point_rulesets
  ADD CONSTRAINT chk_epr_sort_order CHECK (sort_order BETWEEN 0 AND 999);

-- ============================================================================
-- 5) Comments
-- ============================================================================

COMMENT ON TABLE entry_point_rulesets IS 'Many-to-many relationship between entry points and rulesets with ordering';
COMMENT ON COLUMN entry_point_rulesets.entry_point_id IS 'Entry point identifier';
COMMENT ON COLUMN entry_point_rulesets.ruleset_id IS 'Ruleset identifier';
COMMENT ON COLUMN entry_point_rulesets.sort_order IS 'Order of ruleset application (0-999, lower numbers first)';
COMMENT ON COLUMN entry_point_rulesets.created_at IS 'When the relationship was created';
