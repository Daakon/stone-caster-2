-- ============================================================================
-- Stone Caster - Chimera V3 Game Instances
-- Purpose: Schema for live game instances (Phase 13.1)
-- Date: 2025-12-22
-- ============================================================================

-- Create the instances table
CREATE TABLE IF NOT EXISTS chimera_instances_v3 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Aligning with Compiler Service which writes to 'chimera_compiled_stories'
    compiled_story_id UUID NOT NULL REFERENCES chimera_compiled_stories(id),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
    current_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    event_log JSONB NOT NULL DEFAULT '[]'::jsonb,
    turn_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chimera_instances_v3_user_id ON chimera_instances_v3(user_id);
CREATE INDEX IF NOT EXISTS idx_chimera_instances_v3_compiled_story_id ON chimera_instances_v3(compiled_story_id);
CREATE INDEX IF NOT EXISTS idx_chimera_instances_v3_status ON chimera_instances_v3(status);
CREATE INDEX IF NOT EXISTS idx_chimera_instances_v3_current_state ON chimera_instances_v3 USING GIN(current_state);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_chimera_instances_v3_modtime()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_chimera_instances_v3_modtime ON chimera_instances_v3;
CREATE TRIGGER trigger_chimera_instances_v3_modtime
    BEFORE UPDATE ON chimera_instances_v3
    FOR EACH ROW
    EXECUTE FUNCTION update_chimera_instances_v3_modtime();

-- RLS Policies
ALTER TABLE chimera_instances_v3 ENABLE ROW LEVEL SECURITY;

-- Allow users to see their own games
CREATE POLICY "Users can view own instances"
    ON chimera_instances_v3
    FOR SELECT
    USING (auth.uid() = user_id);

-- Allow users to insert their own games
CREATE POLICY "Users can insert own instances"
    ON chimera_instances_v3
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own games
CREATE POLICY "Users can update own instances"
    ON chimera_instances_v3
    FOR UPDATE
    USING (auth.uid() = user_id);
