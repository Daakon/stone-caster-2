-- World-First Publishing: Phase 4 - Dependency Monitor Infrastructure
-- Additive-only migration: creates job_locks table and helpful indexes
-- This migration is idempotent and safe to run multiple times

BEGIN;

-- ============================================================================
-- JOB LOCKS TABLE (for single-leader cron safety)
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_locks (
  key text PRIMARY KEY,
  holder text NOT NULL,
  expires_at timestamptz NOT NULL
);

-- Index for cleanup queries (expired locks)
CREATE INDEX IF NOT EXISTS idx_job_locks_expires_at 
  ON job_locks(expires_at);

-- Comments
COMMENT ON TABLE job_locks IS 'Distributed lock table for background jobs (prevents concurrent execution)';
COMMENT ON COLUMN job_locks.key IS 'Unique job identifier (e.g., dependency_monitor)';
COMMENT ON COLUMN job_locks.holder IS 'Identifier of the process/instance holding the lock';
COMMENT ON COLUMN job_locks.expires_at IS 'Lock expiration timestamp (auto-releases after this time)';

-- ============================================================================
-- HELPFUL INDEXES FOR DEPENDENCY MONITORING
-- ============================================================================

-- Index for entry_points (stories) by world_id (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'entry_points' 
    AND indexname = 'idx_entry_points_world_id'
  ) THEN
    CREATE INDEX idx_entry_points_world_id ON public.entry_points(world_id);
  END IF;
END $$;

-- Index for npcs by world_id (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'npcs' 
    AND indexname = 'idx_npcs_world_id'
  ) THEN
    CREATE INDEX idx_npcs_world_id ON public.npcs(world_id);
  END IF;
END $$;

COMMIT;

