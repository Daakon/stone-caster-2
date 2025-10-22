-- Verification script for segments scope cleanup
-- Asserts that the migration was applied correctly

-- 1) Assert constraint exists and blocks deprecated values
DO $$
BEGIN
    -- Test that constraint exists by trying to insert a deprecated scope
    BEGIN
        INSERT INTO public.prompt_segments (scope, content, active) 
        VALUES ('game_state', 'test', true);
        RAISE EXCEPTION 'Constraint failed: deprecated scope was allowed';
    EXCEPTION
        WHEN check_violation THEN
            -- Expected: constraint should block this
            NULL;
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Unexpected error: %', SQLERRM;
    END;
    
    -- Test that allowed scopes work
    BEGIN
        INSERT INTO public.prompt_segments (scope, content, active) 
        VALUES ('core', 'test', true);
        -- Clean up test data
        DELETE FROM public.prompt_segments WHERE scope = 'core' AND content = 'test';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Allowed scope was blocked: %', SQLERRM;
    END;
    
    RAISE NOTICE 'Constraint verification passed';
END $$;

-- 2) Assert any rows with deprecated scopes are inactive
DO $$
DECLARE
    deprecated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO deprecated_count
    FROM public.prompt_segments
    WHERE scope IN ('game_state','player','rng','input') 
    AND active = true;
    
    IF deprecated_count > 0 THEN
        RAISE EXCEPTION 'Found % active segments with deprecated scopes', deprecated_count;
    END IF;
    
    RAISE NOTICE 'Deprecated scope cleanup verification passed';
END $$;

-- 3) Assert metadata was added to deprecated segments
DO $$
DECLARE
    missing_metadata_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO missing_metadata_count
    FROM public.prompt_segments
    WHERE scope IN ('game_state','player','rng','input') 
    AND active = false
    AND (metadata IS NULL OR NOT metadata ? 'deprecated_scope');
    
    IF missing_metadata_count > 0 THEN
        RAISE EXCEPTION 'Found % deprecated segments without proper metadata', missing_metadata_count;
    END IF;
    
    RAISE NOTICE 'Deprecated segment metadata verification passed';
END $$;

-- 4) Show summary of affected segments
SELECT 
    scope,
    COUNT(*) as total_segments,
    COUNT(*) FILTER (WHERE active = true) as active_segments,
    COUNT(*) FILTER (WHERE active = false) as inactive_segments
FROM public.prompt_segments
GROUP BY scope
ORDER BY scope;

RAISE NOTICE 'Segments scope cleanup verification completed successfully';
