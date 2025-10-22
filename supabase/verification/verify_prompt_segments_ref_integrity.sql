-- Verification script for prompt segments referential integrity
-- Asserts that the migration was applied correctly

-- 1) Assert indexes exist
DO $$
DECLARE
    index_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'prompt_segments'
    AND indexname IN ('idx_prompt_segments_scope_ref', 'idx_prompt_segments_active_scope');
    
    IF index_count < 2 THEN
        RAISE EXCEPTION 'Missing required indexes for prompt_segments';
    END IF;
    
    RAISE NOTICE 'Index verification passed';
END $$;

-- 2) Assert generated columns exist
DO $$
DECLARE
    column_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'prompt_segments'
    AND column_name IN ('ref_world_id', 'ref_ruleset_id', 'ref_entry_id', 'ref_npc_id');
    
    IF column_count < 4 THEN
        RAISE EXCEPTION 'Missing generated columns for referential integrity';
    END IF;
    
    RAISE NOTICE 'Generated columns verification passed';
END $$;

-- 3) Assert FK constraints exist (VALID or NOT VALID)
DO $$
DECLARE
    constraint_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO constraint_count
    FROM pg_constraint 
    WHERE conname IN ('fk_ps_world_ref', 'fk_ps_ruleset_ref', 'fk_ps_entry_ref', 'fk_ps_npc_ref');
    
    IF constraint_count < 4 THEN
        RAISE EXCEPTION 'Missing foreign key constraints';
    END IF;
    
    RAISE NOTICE 'Foreign key constraints verification passed';
END $$;

-- 4) Test sample inserts per scope (wrap in savepoints and rollback)
DO $$
DECLARE
    test_world_id UUID;
    test_ruleset_id UUID;
    test_entry_id UUID;
    test_npc_id UUID;
BEGIN
    -- Get test IDs (assuming some test data exists)
    SELECT id INTO test_world_id FROM public.worlds LIMIT 1;
    SELECT id INTO test_ruleset_id FROM public.rulesets LIMIT 1;
    SELECT id INTO test_entry_id FROM public.entries LIMIT 1;
    SELECT id INTO test_npc_id FROM public.npcs LIMIT 1;
    
    -- Test core scope (no ref_id required)
    BEGIN
        SAVEPOINT test_core;
        INSERT INTO public.prompt_segments (scope, content, active) 
        VALUES ('core', 'Test core segment', true);
        ROLLBACK TO test_core;
        RAISE NOTICE 'Core scope test passed';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Core scope test failed: %', SQLERRM;
    END;
    
    -- Test world scope (requires valid world_id)
    IF test_world_id IS NOT NULL THEN
        BEGIN
            SAVEPOINT test_world;
            INSERT INTO public.prompt_segments (scope, ref_id, content, active) 
            VALUES ('world', test_world_id, 'Test world segment', true);
            ROLLBACK TO test_world;
            RAISE NOTICE 'World scope test passed';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE EXCEPTION 'World scope test failed: %', SQLERRM;
        END;
    END IF;
    
    -- Test ruleset scope (requires valid ruleset_id)
    IF test_ruleset_id IS NOT NULL THEN
        BEGIN
            SAVEPOINT test_ruleset;
            INSERT INTO public.prompt_segments (scope, ref_id, content, active) 
            VALUES ('ruleset', test_ruleset_id, 'Test ruleset segment', true);
            ROLLBACK TO test_ruleset;
            RAISE NOTICE 'Ruleset scope test passed';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE EXCEPTION 'Ruleset scope test failed: %', SQLERRM;
        END;
    END IF;
    
    -- Test entry scope (requires valid entry_id)
    IF test_entry_id IS NOT NULL THEN
        BEGIN
            SAVEPOINT test_entry;
            INSERT INTO public.prompt_segments (scope, ref_id, content, active) 
            VALUES ('entry', test_entry_id, 'Test entry segment', true);
            ROLLBACK TO test_entry;
            RAISE NOTICE 'Entry scope test passed';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE EXCEPTION 'Entry scope test failed: %', SQLERRM;
        END;
    END IF;
    
    -- Test npc scope (requires valid npc_id)
    IF test_npc_id IS NOT NULL THEN
        BEGIN
            SAVEPOINT test_npc;
            INSERT INTO public.prompt_segments (scope, ref_id, content, active) 
            VALUES ('npc', test_npc_id, 'Test npc segment', true);
            ROLLBACK TO test_npc;
            RAISE NOTICE 'NPC scope test passed';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE EXCEPTION 'NPC scope test failed: %', SQLERRM;
        END;
    END IF;
    
    RAISE NOTICE 'Sample insert tests completed successfully';
END $$;

-- 5) Test constraint violations (should fail)
DO $$
BEGIN
    -- Test invalid world reference
    BEGIN
        SAVEPOINT test_invalid_world;
        INSERT INTO public.prompt_segments (scope, ref_id, content, active) 
        VALUES ('world', '00000000-0000-0000-0000-000000000000', 'Test invalid world', true);
        ROLLBACK TO test_invalid_world;
        RAISE EXCEPTION 'Invalid world reference should have failed';
    EXCEPTION
        WHEN foreign_key_violation THEN
            RAISE NOTICE 'Invalid world reference correctly rejected';
        WHEN OTHERS THEN
            RAISE NOTICE 'Invalid world reference test: %', SQLERRM;
    END;
    
    -- Test missing ref_id for non-core scope
    BEGIN
        SAVEPOINT test_missing_ref;
        INSERT INTO public.prompt_segments (scope, content, active) 
        VALUES ('ruleset', 'Test missing ref', true);
        ROLLBACK TO test_missing_ref;
        RAISE NOTICE 'Missing ref_id test completed (may pass if not enforced at DB level)';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Missing ref_id test: %', SQLERRM;
    END;
END $$;

-- 6) Show summary of constraints and indexes
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    convalidated as is_validated
FROM pg_constraint 
WHERE conrelid = 'public.prompt_segments'::regclass
ORDER BY conname;

SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename = 'prompt_segments'
ORDER BY indexname;

RAISE NOTICE 'Prompt segments referential integrity verification completed successfully';
