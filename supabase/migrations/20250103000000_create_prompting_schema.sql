-- Create prompting schema and tables for AI prompt pipeline migration
-- This migration replaces filesystem-based prompt loading with database-backed storage

-- Create prompting schema
CREATE SCHEMA IF NOT EXISTS prompting;

-- Create prompts table
CREATE TABLE prompting.prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layer VARCHAR(50) NOT NULL, -- e.g., 'foundation', 'core', 'engine', 'ai_behavior', 'data_management', 'performance', 'content', 'enhancement'
    world_slug VARCHAR(100), -- NULL for core/system prompts, specific world for world-specific
    adventure_slug VARCHAR(100), -- NULL for non-adventure prompts
    scene_id VARCHAR(100), -- NULL for non-scene prompts
    turn_stage VARCHAR(50) DEFAULT 'any', -- 'start', 'ongoing', 'end', 'any'
    sort_order INTEGER NOT NULL DEFAULT 0, -- Load order within layer
    version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    hash VARCHAR(64) NOT NULL, -- SHA256 hash of content for change detection
    content TEXT NOT NULL, -- The actual prompt content
    metadata JSONB DEFAULT '{}', -- Additional metadata (variables, dependencies, etc.)
    active BOOLEAN NOT NULL DEFAULT true, -- Whether this prompt is active
    locked BOOLEAN NOT NULL DEFAULT false, -- Whether this prompt is locked from modification
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Create indexes for efficient querying
CREATE INDEX idx_prompts_world_adventure ON prompting.prompts(world_slug, adventure_slug) WHERE active = true;
CREATE INDEX idx_prompts_layer_sort ON prompting.prompts(layer, sort_order) WHERE active = true;
CREATE INDEX idx_prompts_scene ON prompting.prompts(scene_id) WHERE active = true AND scene_id IS NOT NULL;
CREATE INDEX idx_prompts_turn_stage ON prompting.prompts(turn_stage) WHERE active = true;
CREATE INDEX idx_prompts_hash ON prompting.prompts(hash);
CREATE INDEX idx_prompts_active_locked ON prompting.prompts(active, locked);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION prompting.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_prompts_updated_at 
    BEFORE UPDATE ON prompting.prompts 
    FOR EACH ROW EXECUTE FUNCTION prompting.update_updated_at_column();

-- Create RLS policies
ALTER TABLE prompting.prompts ENABLE ROW LEVEL SECURITY;

-- Policy: Service role and prompt_admin can do everything
CREATE POLICY "Service role and prompt_admin full access" ON prompting.prompts
    FOR ALL USING (
        auth.role() = 'service_role' OR 
        EXISTS (
            SELECT 1 FROM auth.users u 
            WHERE u.id = auth.uid() 
            AND u.raw_user_meta_data->>'role' = 'prompt_admin'
        )
    );

-- Policy: Authenticated users can read active, unlocked prompts
CREATE POLICY "Authenticated users read active prompts" ON prompting.prompts
    FOR SELECT USING (
        auth.role() = 'authenticated' AND 
        active = true AND 
        locked = false
    );

-- Create RPC function for prompt segments
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

-- Create a function to get prompt statistics
CREATE OR REPLACE FUNCTION prompting.get_prompt_stats()
RETURNS TABLE (
    total_prompts BIGINT,
    active_prompts BIGINT,
    locked_prompts BIGINT,
    layers_count JSONB,
    worlds_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_prompts,
        COUNT(*) FILTER (WHERE active = true) as active_prompts,
        COUNT(*) FILTER (WHERE locked = true) as locked_prompts,
        jsonb_object_agg(layer, layer_count) as layers_count,
        COUNT(DISTINCT world_slug) FILTER (WHERE world_slug IS NOT NULL) as worlds_count
    FROM (
        SELECT 
            layer,
            COUNT(*) as layer_count
        FROM prompting.prompts
        GROUP BY layer
    ) layer_stats
    CROSS JOIN (
        SELECT COUNT(*) FROM prompting.prompts
    ) total_stats;
END;
$$;

GRANT EXECUTE ON FUNCTION prompting.get_prompt_stats TO authenticated, service_role;

-- Create a function to validate prompt dependencies
CREATE OR REPLACE FUNCTION prompting.validate_prompt_dependencies()
RETURNS TABLE (
    prompt_id UUID,
    missing_dependencies TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as prompt_id,
        ARRAY_AGG(dep.dependency) as missing_dependencies
    FROM prompting.prompts p
    CROSS JOIN LATERAL (
        SELECT jsonb_array_elements_text(p.metadata->'dependencies') as dependency
    ) dep
    WHERE 
        p.active = true
        AND NOT EXISTS (
            SELECT 1 FROM prompting.prompts p2 
            WHERE p2.id = dep.dependency::uuid 
            AND p2.active = true
        )
    GROUP BY p.id;
END;
$$;

GRANT EXECUTE ON FUNCTION prompting.validate_prompt_dependencies TO authenticated, service_role;
