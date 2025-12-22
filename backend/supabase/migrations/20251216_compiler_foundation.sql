-- 20251216_compiler_foundation.sql
-- Description: Foundation tables for the Story Compiler (Phase 1)
-- Philosophy: "Clean Slate" - strictly typed, versioned compiled stories.

-- 1. Create the Compiled Stories table
CREATE TABLE IF NOT EXISTS chimera_compiled_stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES chimera_stories(id) ON DELETE CASCADE,
    version INTEGER DEFAULT 1,
    
    -- Computable Logic
    config_engine JSONB DEFAULT '{}'::jsonb,
    
    -- AI Persona Prompts
    prompt_interpreter_logic TEXT,
    prompt_narrator_style TEXT,
    
    -- Frozen State Snapshots (Deep Clones)
    snapshot_world JSONB DEFAULT '{}'::jsonb,
    snapshot_entities JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Update the parent Story table to link to the "Live" compiled version
ALTER TABLE chimera_stories
ADD COLUMN IF NOT EXISTS current_compiled_id UUID REFERENCES chimera_compiled_stories(id),
ADD COLUMN IF NOT EXISTS compile_status TEXT DEFAULT 'draft';
