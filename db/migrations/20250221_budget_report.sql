-- Budget Report Migration
-- Add budget_report column to prompt_snapshots table

-- Ensure prompt_snapshots table exists (created in 20250213_prompt_snapshots.sql)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prompt_snapshots') THEN
    RAISE EXCEPTION 'prompt_snapshots table does not exist. Please run 20250213_prompt_snapshots.sql first.';
  END IF;
END $$;

ALTER TABLE prompt_snapshots
ADD COLUMN IF NOT EXISTS budget_report JSONB NULL;

COMMENT ON COLUMN prompt_snapshots.budget_report IS 'Token budget report: { before, after, trims[], warnings[] }';

