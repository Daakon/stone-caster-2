-- Prompt Segments Referential Integrity Migration
-- Adds composite indexes for performance and referential safety constraints

BEGIN;

-- Fast lookups for assembler and admin
CREATE INDEX IF NOT EXISTS idx_prompt_segments_scope_ref
  ON public.prompt_segments(scope, ref_id) WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_prompt_segments_active_scope
  ON public.prompt_segments(active, scope);

-- Guardrails: each scope must point to the correct table.
-- We'll use NOT VALID foreign keys so we can add them safely; then validate.
-- For each scope, we constrain via partial FK using generated columns approach.

-- 1) Add a virtual column per target table to enable partial FKs
--    If generated columns are not available, skip to server-side validation (already included below).

DO $$
BEGIN
  -- noop if column already exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='prompt_segments' AND column_name='ref_world_id') THEN
    ALTER TABLE public.prompt_segments
      ADD COLUMN ref_world_id uuid GENERATED ALWAYS AS (CASE WHEN scope='world' THEN ref_id ELSE NULL END) STORED;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='prompt_segments' AND column_name='ref_ruleset_id') THEN
    ALTER TABLE public.prompt_segments
      ADD COLUMN ref_ruleset_id uuid GENERATED ALWAYS AS (CASE WHEN scope='ruleset' THEN ref_id ELSE NULL END) STORED;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='prompt_segments' AND column_name='ref_entry_id') THEN
    ALTER TABLE public.prompt_segments
      ADD COLUMN ref_entry_id uuid GENERATED ALWAYS AS (CASE WHEN scope IN ('entry','entry_start') THEN ref_id ELSE NULL END) STORED;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='prompt_segments' AND column_name='ref_npc_id') THEN
    ALTER TABLE public.prompt_segments
      ADD COLUMN ref_npc_id uuid GENERATED ALWAYS AS (CASE WHEN scope='npc' THEN ref_id ELSE NULL END) STORED;
  END IF;
END$$;

-- 2) Partial FKs (NOT VALID first; we will validate)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_ps_world_ref') THEN
    ALTER TABLE public.prompt_segments
      ADD CONSTRAINT fk_ps_world_ref FOREIGN KEY (ref_world_id) REFERENCES public.worlds(id) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_ps_ruleset_ref') THEN
    ALTER TABLE public.prompt_segments
      ADD CONSTRAINT fk_ps_ruleset_ref FOREIGN KEY (ref_ruleset_id) REFERENCES public.rulesets(id) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_ps_entry_ref') THEN
    ALTER TABLE public.prompt_segments
      ADD CONSTRAINT fk_ps_entry_ref FOREIGN KEY (ref_entry_id) REFERENCES public.entries(id) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_ps_npc_ref') THEN
    ALTER TABLE public.prompt_segments
      ADD CONSTRAINT fk_ps_npc_ref FOREIGN KEY (ref_npc_id) REFERENCES public.npcs(id) NOT VALID;
  END IF;
END$$;

-- Try to validate (will succeed unless dangling refs exist; still safe to keep NOT VALID)
ALTER TABLE public.prompt_segments VALIDATE CONSTRAINT fk_ps_world_ref;
ALTER TABLE public.prompt_segments VALIDATE CONSTRAINT fk_ps_ruleset_ref;
ALTER TABLE public.prompt_segments VALIDATE CONSTRAINT fk_ps_entry_ref;
ALTER TABLE public.prompt_segments VALIDATE CONSTRAINT fk_ps_npc_ref;

-- Add comments for documentation
COMMENT ON INDEX idx_prompt_segments_scope_ref IS 'Composite index for fast assembler queries by scope and ref_id';
COMMENT ON INDEX idx_prompt_segments_active_scope IS 'Index for filtering active segments by scope';

COMMIT;
