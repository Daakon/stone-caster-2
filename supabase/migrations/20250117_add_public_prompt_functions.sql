-- Expose prompt management helper functions in the public schema so they can be
-- invoked through PostgREST without schema-qualified RPC calls.

CREATE OR REPLACE FUNCTION public.get_prompt_stats()
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
    SELECT *
    FROM prompting.get_prompt_stats();
$$;

GRANT EXECUTE ON FUNCTION public.get_prompt_stats() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.validate_prompt_dependencies()
RETURNS TABLE (
    prompt_id UUID,
    missing_dependencies TEXT[]
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT *
    FROM prompting.validate_prompt_dependencies();
$$;

GRANT EXECUTE ON FUNCTION public.validate_prompt_dependencies() TO authenticated, service_role;
