-- Add prompt fields to worlds and rulesets
-- This migration adds prompt content fields to worlds and rulesets tables

-- ============================================================================
-- ADD PROMPT FIELDS TO WORLDS
-- ============================================================================

ALTER TABLE public.worlds
  ADD COLUMN IF NOT EXISTS prompt text;

-- Add comment for documentation
COMMENT ON COLUMN public.worlds.prompt IS 'The world''s prompt content for AI generation';

-- ============================================================================
-- ADD PROMPT FIELDS TO RULESETS  
-- ============================================================================

ALTER TABLE public.rulesets
  ADD COLUMN IF NOT EXISTS prompt text;

-- Add comment for documentation
COMMENT ON COLUMN public.rulesets.prompt IS 'The ruleset''s prompt content for AI generation';

-- ============================================================================
-- UPDATE SEED DATA WITH SAMPLE PROMPTS
-- ============================================================================

-- Update existing worlds with sample prompts
UPDATE public.worlds 
SET prompt = 'You are in a magical fantasy realm filled with dragons, wizards, and enchanted forests. The world is governed by ancient magic and mystical creatures roam the lands.'
WHERE name = 'Fantasy Realm';

UPDATE public.worlds 
SET prompt = 'You are in a futuristic sci-fi universe with advanced technology, space travel, and alien civilizations. The world is governed by scientific principles and technological advancement.'
WHERE name = 'Sci-Fi Universe';

-- Update existing rulesets with sample prompts
UPDATE public.rulesets 
SET prompt = 'Follow D&D 5th Edition rules. Use standard ability scores, hit points, and spellcasting mechanics. Maintain the traditional fantasy RPG experience.'
WHERE name = 'D&D 5e Core';

UPDATE public.rulesets 
SET prompt = 'Follow Pathfinder rules. Use the d20 system with expanded character options, feats, and tactical combat mechanics.'
WHERE name = 'Pathfinder Core';
