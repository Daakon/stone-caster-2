-- World-First Publishing: Phase 2 - Audit Table
-- Additive-only migration: creates publishing_audit table for traceability
-- This migration is idempotent and safe to run multiple times

BEGIN;

-- ============================================================================
-- PUBLISHING_AUDIT TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS publishing_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('world', 'story', 'npc')),
  entity_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('request', 'approve', 'reject', 'auto-reject', 'auto-clear')),
  requested_by uuid NULL,
  reviewed_by uuid NULL,
  reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient entity lookups
CREATE INDEX IF NOT EXISTS idx_publishing_audit_entity 
  ON publishing_audit(entity_type, entity_id, created_at DESC);

-- Index for user-based queries (requested_by)
CREATE INDEX IF NOT EXISTS idx_publishing_audit_requested_by 
  ON publishing_audit(requested_by, created_at DESC) 
  WHERE requested_by IS NOT NULL;

-- Index for reviewer queries (reviewed_by)
CREATE INDEX IF NOT EXISTS idx_publishing_audit_reviewed_by 
  ON publishing_audit(reviewed_by, created_at DESC) 
  WHERE reviewed_by IS NOT NULL;

-- Comments
COMMENT ON TABLE publishing_audit IS 'Audit trail for publishing actions (request, approve, reject, etc.)';
COMMENT ON COLUMN publishing_audit.entity_type IS 'Type of entity: world, story, or npc';
COMMENT ON COLUMN publishing_audit.entity_id IS 'UUID of the entity (matches worlds.id, entry_points.id, or npcs.id)';
COMMENT ON COLUMN publishing_audit.action IS 'Action taken: request, approve, reject, auto-reject, auto-clear';
COMMENT ON COLUMN publishing_audit.requested_by IS 'User who requested publication (for action=request)';
COMMENT ON COLUMN publishing_audit.reviewed_by IS 'Admin/moderator who reviewed (for action=approve/reject)';
COMMENT ON COLUMN publishing_audit.reason IS 'Optional reason for rejection or other actions';

COMMIT;

