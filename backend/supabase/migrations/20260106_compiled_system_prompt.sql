-- Phase 7: The Compiled Rules Engine
-- Add compiled_system_prompt to chimera_game_states to store the "frozen" ruleset instructions from Genesis.

ALTER TABLE chimera_game_states
ADD COLUMN compiled_system_prompt TEXT;

-- Descriptive comment
COMMENT ON COLUMN chimera_game_states.compiled_system_prompt IS 'The immutable system prompt compiled at game creation, containing Rulesets, Tone, and JSON Schema.';
