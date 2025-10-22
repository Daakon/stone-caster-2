-- Segments Scope Cleanup Migration
-- Restricts prompt_segments.scope to allowed values and deprecates old scopes

BEGIN;

-- 1) Add a check constraint that whitelists allowed scopes.
--    If an existing constraint exists, drop it first.
ALTER TABLE public.prompt_segments
  DROP CONSTRAINT IF EXISTS chk_prompt_segments_scope;

ALTER TABLE public.prompt_segments
  ADD CONSTRAINT chk_prompt_segments_scope
  CHECK (scope IN ('core', 'ruleset', 'world', 'entry', 'entry_start', 'npc'));

-- 2) Soft-migrate existing rows with deprecated scopes (game_state, player, rng, input)
--    Strategy: mark them inactive and tag in metadata so authors can copy text if needed.
UPDATE public.prompt_segments
SET active = false,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'deprecated_scope', scope, 
      'deprecated_at', now(),
      'migration_note', 'This segment was automatically deactivated due to scope deprecation. Content can be copied to allowed scopes if needed.'
    )
WHERE scope IN ('game_state','player','rng','input') AND active = true;

-- 3) Add comment for documentation
COMMENT ON CONSTRAINT chk_prompt_segments_scope ON public.prompt_segments 
IS 'Restricts scope to allowed values: core, ruleset, world, entry, entry_start, npc';

-- 4) Create index for performance on scope filtering
CREATE INDEX IF NOT EXISTS prompt_segments_scope_active_idx 
ON public.prompt_segments(scope, active) 
WHERE active = true;

COMMIT;
