-- Find Segment Duplicates Function
-- Creates a function to find duplicate prompt segments based on content hash

-- Drop the existing function first
DROP FUNCTION IF EXISTS find_segment_duplicates(text, text, text, text);

CREATE OR REPLACE FUNCTION find_segment_duplicates(
    p_scope text,
    p_content text,
    p_ref_id text DEFAULT NULL,
    p_exclude_id text DEFAULT NULL
)
RETURNS TABLE (
    id bigint,
    scope text,
    ref_id text,
    content text,
    similarity_score numeric
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ps.id,
        ps.scope,
        ps.ref_id,
        ps.content,
        -- Simple similarity based on content match
        CASE 
            WHEN ps.content = p_content THEN 1.0
            ELSE 0.0
        END as similarity_score
    FROM prompt_segments ps
    WHERE ps.scope = p_scope
    AND ps.content = p_content
    AND (p_ref_id IS NULL OR ps.ref_id = p_ref_id)
    AND (p_exclude_id IS NULL OR ps.id::text != p_exclude_id)
    AND ps.active = true
    ORDER BY similarity_score DESC, ps.created_at DESC;
END;
$$;

-- Add comment
COMMENT ON FUNCTION find_segment_duplicates(text, text, text, text) IS 'Find duplicate prompt segments based on content hash and scope';
