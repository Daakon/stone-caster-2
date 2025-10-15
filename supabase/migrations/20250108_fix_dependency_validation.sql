-- Fix validate_prompt_dependencies to handle non-UUID dependency identifiers
-- This migration updates the function to skip validation for non-UUID dependencies
-- while still validating true UUID references

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
        AND dep.dependency IS NOT NULL
        AND dep.dependency != ''
        -- Only validate dependencies that look like UUIDs
        AND dep.dependency ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND NOT EXISTS (
            SELECT 1 FROM prompting.prompts p2 
            WHERE p2.id = dep.dependency::uuid 
            AND p2.active = true
        )
    GROUP BY p.id;
END;
$$;

-- Grant permissions (maintain existing grants)
GRANT EXECUTE ON FUNCTION prompting.validate_prompt_dependencies TO authenticated, service_role;
