-- Update prompt assembly ordering to align with the new core -> world -> adventure -> adventure_start taxonomy
-- and support category/subcategory metadata for finer-grained sequencing.

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
            -- Core/system prompts (no world slug)
            p.world_slug IS NULL
            OR
            -- World prompts
            (p.world_slug = p_world_slug AND p.adventure_slug IS NULL)
            OR
            -- Adventure prompts
            (p.world_slug = p_world_slug AND p.adventure_slug = p_adventure_slug)
            OR
            -- Scene prompts
            (p.world_slug = p_world_slug AND p.adventure_slug = p_adventure_slug AND p.scene_id = p_scene_id)
        )
        AND (
            -- Include "start" turn-stage prompts when requested
            (p_include_start = true OR p.turn_stage != 'start')
        )
        AND (
            -- Keep backwards compatibility with the enhancement toggle
            p_include_enhancements = true
            OR p.layer NOT IN ('enhancement')
        )
    ORDER BY
        CASE p.layer
            WHEN 'core' THEN 1
            WHEN 'world' THEN 2
            WHEN 'adventure' THEN 3
            WHEN 'adventure_start' THEN 4
            ELSE 5
        END,
        NULLIF(TRIM(COALESCE(p.metadata->>'category', '')), '') IS NULL,
        LOWER(COALESCE(p.metadata->>'category', '')),
        LOWER(COALESCE(p.metadata->>'subcategory', '')),
        p.sort_order,
        p.id;
END;
$$;

COMMENT ON FUNCTION prompting.prompt_segments_for_context IS
'Returns ordered prompt segments prioritised by layer (core -> world -> adventure -> adventure_start) with optional category/subcategory metadata for secondary ordering.';

GRANT EXECUTE ON FUNCTION prompting.prompt_segments_for_context TO authenticated, service_role;

CREATE OR REPLACE FUNCTION prompting.get_prompt_stats()
RETURNS TABLE (
    total_prompts BIGINT,
    active_prompts BIGINT,
    locked_prompts BIGINT,
    layers_count JSONB,
    worlds_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH base AS (
    SELECT layer, world_slug, active, locked
    FROM prompting.prompts
),
layer_counts AS (
    SELECT layer, COUNT(*) AS layer_count
    FROM base
    GROUP BY layer
),
totals AS (
    SELECT
        COUNT(*) AS total_prompts,
        COUNT(*) FILTER (WHERE active) AS active_prompts,
        COUNT(*) FILTER (WHERE locked) AS locked_prompts,
        COUNT(DISTINCT world_slug) FILTER (WHERE world_slug IS NOT NULL) AS worlds_count
    FROM base
)
SELECT
    totals.total_prompts,
    totals.active_prompts,
    totals.locked_prompts,
    COALESCE(
        (
            SELECT jsonb_object_agg(layer, layer_count)
            FROM (
                SELECT layer, layer_count
                FROM layer_counts
                ORDER BY layer
            ) ordered_layer_counts
        ),
        '{}'::jsonb
    ) AS layers_count,
    totals.worlds_count
FROM totals;
$$;

COMMENT ON FUNCTION prompting.get_prompt_stats IS
'Returns aggregate counts of prompts grouped by layer, status, and world scope.';

GRANT EXECUTE ON FUNCTION prompting.get_prompt_stats TO authenticated, service_role;
