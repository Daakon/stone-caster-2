-- Slots Flags Migration
-- Add must_keep and min_chars columns to slots table for budget engine

-- Ensure slots table exists (created in 20250214_slots_templates.sql)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'slots') THEN
    RAISE EXCEPTION 'slots table does not exist. Please run 20250214_slots_templates.sql first.';
  END IF;
END $$;

-- Add columns
ALTER TABLE slots
ADD COLUMN IF NOT EXISTS must_keep BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS min_chars INTEGER NULL;

-- Add comments
COMMENT ON COLUMN slots.must_keep IS 'If true, this slot should be protected from trimming (unless fallback required)';
COMMENT ON COLUMN slots.min_chars IS 'Minimum character count to preserve when trimming (NULL = no minimum)';

-- Create index for budget queries
CREATE INDEX IF NOT EXISTS idx_slots_must_keep ON slots(must_keep) WHERE must_keep = true;

-- One-time seeder: Set gentle defaults for critical slots (only if unset)
-- Note: This uses a DO block to conditionally update only if values are not already set

DO $$
BEGIN
  -- ruleset.principles: must_keep=true, min_chars=160
  UPDATE slots
  SET must_keep = true, min_chars = 160
  WHERE type = 'ruleset' AND name = 'principles'
    AND (must_keep = false OR min_chars IS NULL);

  -- ruleset.choice_style: must_keep=true, min_chars=80
  UPDATE slots
  SET must_keep = true, min_chars = 80
  WHERE type = 'ruleset' AND name = 'choice_style'
    AND (must_keep = false OR min_chars IS NULL);

  -- module.actions: must_keep=true, min_chars=60
  UPDATE slots
  SET must_keep = true, min_chars = 60
  WHERE type = 'module' AND name = 'actions'
    AND (must_keep = false OR min_chars IS NULL);

  -- world.tone: min_chars=180
  UPDATE slots
  SET min_chars = 180
  WHERE type = 'world' AND name = 'tone'
    AND min_chars IS NULL;

  -- npc.persona: min_chars=140
  UPDATE slots
  SET min_chars = 140
  WHERE type = 'npc' AND name = 'persona'
    AND min_chars IS NULL;
END $$;

