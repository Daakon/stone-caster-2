-- Create prompting schema and function for prompt assembly
-- This migration sets up the database prompt system

-- Create prompting schema
CREATE SCHEMA IF NOT EXISTS prompting;

-- Create prompts table
CREATE TABLE IF NOT EXISTS prompting.prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layer VARCHAR(50) NOT NULL,
    world_slug VARCHAR(100),
    adventure_slug VARCHAR(100),
    scene_id VARCHAR(100),
    turn_stage VARCHAR(50) DEFAULT 'any',
    sort_order INTEGER NOT NULL DEFAULT 0,
    version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    hash VARCHAR(64) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    active BOOLEAN NOT NULL DEFAULT true,
    locked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_prompts_world_adventure ON prompting.prompts(world_slug, adventure_slug) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_prompts_layer_sort ON prompting.prompts(layer, sort_order) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_prompts_scene ON prompting.prompts(scene_id) WHERE active = true AND scene_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prompts_turn_stage ON prompting.prompts(turn_stage) WHERE active = true;

-- Create function to fetch prompt segments for a context
CREATE OR REPLACE FUNCTION prompting.prompt_segments_for_context(
    p_world_slug VARCHAR(100) DEFAULT NULL,
    p_adventure_slug VARCHAR(100) DEFAULT NULL,
    p_include_start BOOLEAN DEFAULT true,
    p_scene_id VARCHAR(100) DEFAULT NULL,
    p_include_enhancements BOOLEAN DEFAULT true
)
RETURNS TABLE (
    id UUID,
    layer VARCHAR(50),
    world_slug VARCHAR(100),
    adventure_slug VARCHAR(100),
    scene_id VARCHAR(100),
    turn_stage VARCHAR(50),
    sort_order INTEGER,
    version VARCHAR(20),
    content TEXT,
    metadata JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.layer,
        p.world_slug,
        p.adventure_slug,
        p.scene_id,
        p.turn_stage,
        p.sort_order,
        p.version,
        p.content,
        p.metadata
    FROM prompting.prompts p
    WHERE 
        p.active = true 
        AND p.locked = false
        AND (
            -- Core/system prompts (no world_slug)
            p.world_slug IS NULL
            OR 
            -- World-specific prompts
            (p.world_slug = p_world_slug AND p.adventure_slug IS NULL)
            OR
            -- Adventure-specific prompts
            (p.world_slug = p_world_slug AND p.adventure_slug = p_adventure_slug)
            OR
            -- Scene-specific prompts
            (p.world_slug = p_world_slug AND p.adventure_slug = p_adventure_slug AND p.scene_id = p_scene_id)
        )
        AND (
            -- Include start prompts if requested
            (p_include_start = true OR p.turn_stage != 'start')
        )
        AND (
            -- Include enhancements if requested
            (p_include_enhancements = true OR p.layer != 'enhancement')
        )
    ORDER BY 
        -- Order by layer priority, then sort_order within layer
        CASE p.layer
            WHEN 'foundation' THEN 1
            WHEN 'core' THEN 2
            WHEN 'engine' THEN 3
            WHEN 'ai_behavior' THEN 4
            WHEN 'data_management' THEN 5
            WHEN 'performance' THEN 6
            WHEN 'content' THEN 7
            WHEN 'enhancement' THEN 8
            ELSE 9
        END,
        p.sort_order;
END;
$$;

-- Grant permissions
GRANT USAGE ON SCHEMA prompting TO authenticated, service_role;
GRANT SELECT ON prompting.prompts TO authenticated;
GRANT ALL ON prompting.prompts TO service_role;
GRANT EXECUTE ON FUNCTION prompting.prompt_segments_for_context TO authenticated, service_role;

