-- ============================================================================
-- Stone Caster - Chimera V3 Schema Verification Script
-- Purpose: Verify database migration health and Hybrid Schema compliance
-- Date: 2025-12-03
-- 
-- INSTRUCTIONS: Copy and paste this entire script into Supabase Dashboard SQL Editor
-- Expected Result: All checks should return "PASS"
-- ============================================================================

-- ============================================================================
-- Verification Report (Single Result Set)
-- ============================================================================

SELECT * FROM (
SELECT 
    'Vector Extension' AS check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_extension WHERE extname = 'vector'
        ) THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_extension WHERE extname = 'vector'
        ) THEN 'pgvector extension is installed'
        ELSE 'pgvector extension is NOT installed - run: CREATE EXTENSION IF NOT EXISTS vector;'
    END AS details
UNION ALL

SELECT 
    'chimera_worlds Table Exists' AS check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'chimera_worlds'
        ) THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'chimera_worlds'
        ) THEN 'chimera_worlds table exists'
        ELSE 'chimera_worlds table is MISSING'
    END AS details
UNION ALL

SELECT 
    'chimera_ruleset_templates Table Exists' AS check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'chimera_ruleset_templates'
        ) THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'chimera_ruleset_templates'
        ) THEN 'chimera_ruleset_templates table exists'
        ELSE 'chimera_ruleset_templates table is MISSING'
    END AS details
UNION ALL

SELECT 
    'chimera_entities Table Exists' AS check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'chimera_entities'
        ) THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'chimera_entities'
        ) THEN 'chimera_entities table exists'
        ELSE 'chimera_entities table is MISSING'
    END AS details
UNION ALL

SELECT 
    'chimera_lore Table Exists' AS check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'chimera_lore'
        ) THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'chimera_lore'
        ) THEN 'chimera_lore table exists'
        ELSE 'chimera_lore table is MISSING'
    END AS details
UNION ALL

SELECT 
    'compiled_stories Table Exists' AS check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'compiled_stories'
        ) THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'compiled_stories'
        ) THEN 'compiled_stories table exists'
        ELSE 'compiled_stories table is MISSING'
    END AS details
UNION ALL

SELECT 
    'chimera_game_states Table Exists' AS check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'chimera_game_states'
        ) THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'chimera_game_states'
        ) THEN 'chimera_game_states table exists'
        ELSE 'chimera_game_states table is MISSING'
    END AS details
UNION ALL

SELECT 
    'chimera_worlds.definition Column Type' AS check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'chimera_worlds' 
            AND column_name = 'definition' 
            AND udt_name = 'jsonb'
        ) THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'chimera_worlds' 
            AND column_name = 'definition' 
            AND udt_name = 'jsonb'
        ) THEN 'chimera_worlds.definition is JSONB (correct)'
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'chimera_worlds' 
            AND column_name = 'definition'
        ) THEN 'chimera_worlds.definition exists but is NOT JSONB (type: ' || (
            SELECT udt_name FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'chimera_worlds' 
            AND column_name = 'definition'
        ) || ')'
        ELSE 'chimera_worlds.definition column is MISSING'
    END AS details
UNION ALL

SELECT 
    'chimera_ruleset_templates.definition Column Type' AS check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'chimera_ruleset_templates' 
            AND column_name = 'definition' 
            AND udt_name = 'jsonb'
        ) THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'chimera_ruleset_templates' 
            AND column_name = 'definition' 
            AND udt_name = 'jsonb'
        ) THEN 'chimera_ruleset_templates.definition is JSONB (correct)'
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'chimera_ruleset_templates' 
            AND column_name = 'definition'
        ) THEN 'chimera_ruleset_templates.definition exists but is NOT JSONB'
        ELSE 'chimera_ruleset_templates.definition column is MISSING'
    END AS details
UNION ALL

SELECT 
    'chimera_entities.raw_data Column Type' AS check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'chimera_entities' 
            AND column_name = 'raw_data' 
            AND udt_name = 'jsonb'
        ) THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'chimera_entities' 
            AND column_name = 'raw_data' 
            AND udt_name = 'jsonb'
        ) THEN 'chimera_entities.raw_data is JSONB (correct)'
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'chimera_entities' 
            AND column_name = 'raw_data'
        ) THEN 'chimera_entities.raw_data exists but is NOT JSONB'
        ELSE 'chimera_entities.raw_data column is MISSING'
    END AS details
UNION ALL

SELECT 
    'chimera_lore.fragment Column Type' AS check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'chimera_lore' 
            AND column_name = 'fragment' 
            AND udt_name = 'jsonb'
        ) THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'chimera_lore' 
            AND column_name = 'fragment' 
            AND udt_name = 'jsonb'
        ) THEN 'chimera_lore.fragment is JSONB (correct)'
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'chimera_lore' 
            AND column_name = 'fragment'
        ) THEN 'chimera_lore.fragment exists but is NOT JSONB'
        ELSE 'chimera_lore.fragment column is MISSING'
    END AS details
UNION ALL

SELECT 
    'chimera_lore.embedding Column Type' AS check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'chimera_lore' 
            AND column_name = 'embedding' 
            AND udt_name = 'vector'
        ) THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'chimera_lore' 
            AND column_name = 'embedding' 
            AND udt_name = 'vector'
        ) THEN 'chimera_lore.embedding is vector(1536) (correct)'
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'chimera_lore' 
            AND column_name = 'embedding'
        ) THEN 'chimera_lore.embedding exists but is NOT vector type (type: ' || (
            SELECT udt_name FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'chimera_lore' 
            AND column_name = 'embedding'
        ) || ')'
        ELSE 'chimera_lore.embedding column is MISSING'
    END AS details
UNION ALL

SELECT 
    'compiled_stories.compiled Column Type' AS check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'compiled_stories' 
            AND column_name = 'compiled' 
            AND udt_name = 'jsonb'
        ) THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'compiled_stories' 
            AND column_name = 'compiled' 
            AND udt_name = 'jsonb'
        ) THEN 'compiled_stories.compiled is JSONB (correct)'
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'compiled_stories' 
            AND column_name = 'compiled'
        ) THEN 'compiled_stories.compiled exists but is NOT JSONB'
        ELSE 'compiled_stories.compiled column is MISSING'
    END AS details
UNION ALL

SELECT 
    'chimera_game_states.state Column Type' AS check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'chimera_game_states' 
            AND column_name = 'state' 
            AND udt_name = 'jsonb'
        ) THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'chimera_game_states' 
            AND column_name = 'state' 
            AND udt_name = 'jsonb'
        ) THEN 'chimera_game_states.state is JSONB (correct)'
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'chimera_game_states' 
            AND column_name = 'state'
        ) THEN 'chimera_game_states.state exists but is NOT JSONB'
        ELSE 'chimera_game_states.state column is MISSING'
    END AS details
UNION ALL

SELECT 
    'Legacy Tables Check (awf_%)' AS check_name,
    CASE 
        WHEN (
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE 'awf_%'
        ) = 0 THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    CASE 
        WHEN (
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE 'awf_%'
        ) = 0 THEN 'No awf_% tables found (correct)'
        ELSE 'Found ' || (
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE 'awf_%'
        ) || ' legacy awf_% table(s): ' || (
            SELECT string_agg(table_name, ', ' ORDER BY table_name)
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE 'awf_%'
        )
    END AS details
UNION ALL

SELECT 
    'Legacy Tables Check (stone_%)' AS check_name,
    CASE 
        WHEN (
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE 'stone_%'
        ) = 0 THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    CASE 
        WHEN (
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE 'stone_%'
        ) = 0 THEN 'No stone_% tables found (correct)'
        ELSE 'Found ' || (
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE 'stone_%'
        ) || ' legacy stone_% table(s): ' || (
            SELECT string_agg(table_name, ', ' ORDER BY table_name)
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE 'stone_%'
        )
    END AS details
UNION ALL

SELECT 
    'Legacy Tables Check (mod_%)' AS check_name,
    CASE 
        WHEN (
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE 'mod_%'
        ) = 0 THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    CASE 
        WHEN (
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE 'mod_%'
        ) = 0 THEN 'No mod_% tables found (correct)'
        ELSE 'Found ' || (
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE 'mod_%'
        ) || ' legacy mod_% table(s): ' || (
            SELECT string_agg(table_name, ', ' ORDER BY table_name)
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE 'mod_%'
        )
    END AS details
UNION ALL

SELECT 
    'Legacy Tables Check (world_templates, worlds, adventures, games, sessions, turns)' AS check_name,
    CASE 
        WHEN (
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('world_templates', 'worlds', 'adventures', 'games', 'sessions', 'turns')
        ) = 0 THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    CASE 
        WHEN (
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('world_templates', 'worlds', 'adventures', 'games', 'sessions', 'turns')
        ) = 0 THEN 'No legacy runtime tables found (correct)'
        ELSE 'Found ' || (
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('world_templates', 'worlds', 'adventures', 'games', 'sessions', 'turns')
        ) || ' legacy table(s): ' || (
            SELECT string_agg(table_name, ', ' ORDER BY table_name)
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('world_templates', 'worlds', 'adventures', 'games', 'sessions', 'turns')
        )
    END AS details
UNION ALL

SELECT 
    'chimera_worlds Hybrid Schema Indexes' AS check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND tablename = 'chimera_worlds' 
            AND indexname = 'idx_chimera_worlds_key'
        ) AND EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND tablename = 'chimera_worlds' 
            AND indexname = 'idx_chimera_worlds_definition'
        ) THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND tablename = 'chimera_worlds' 
            AND indexname = 'idx_chimera_worlds_key'
        ) AND EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND tablename = 'chimera_worlds' 
            AND indexname = 'idx_chimera_worlds_definition'
        ) THEN 'Key indexes exist (B-tree on key, GIN on definition)'
        ELSE 'Missing required indexes on chimera_worlds'
    END AS details
UNION ALL

SELECT 
    'chimera_lore Vector Index' AS check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND tablename = 'chimera_lore' 
            AND indexname = 'idx_chimera_lore_embedding'
        ) THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND tablename = 'chimera_lore' 
            AND indexname = 'idx_chimera_lore_embedding'
        ) THEN 'IVFFlat vector index exists on chimera_lore.embedding'
        ELSE 'Missing vector index on chimera_lore.embedding'
    END AS details
) AS verification_results

ORDER BY 
    CASE verification_results.status 
        WHEN 'FAIL' THEN 1 
        WHEN 'PASS' THEN 2 
    END,
    verification_results.check_name;

-- ============================================================================
-- Summary Query (Optional - shows pass/fail counts)
-- ============================================================================

-- Uncomment below to see a summary:
/*
SELECT 
    status,
    COUNT(*) AS count
FROM (
    -- Paste the entire UNION ALL query above here
) AS verification_results
GROUP BY status
ORDER BY status;
*/

