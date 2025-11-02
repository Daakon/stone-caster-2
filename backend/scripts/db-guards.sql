-- Database Guards
-- Smoke tests to verify legacy quarantine and schema integrity
-- Run with: psql "$DATABASE_URL" -f backend/scripts/db-guards.sql

\echo '🔍 Checking database guards...'

-- 1. Assert prompting_legacy exists
\echo 'Checking prompting_legacy schema exists...'
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'prompting_legacy')
        THEN '✅ prompting_legacy schema exists'
        ELSE '❌ ERROR: prompting_legacy schema does not exist'
    END as check_legacy_schema;

-- 2. Assert new prompting schema exists and is empty (no real tables)
\echo 'Checking prompting schema exists and is empty...'
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'prompting')
        THEN '✅ prompting schema exists'
        ELSE '❌ ERROR: prompting schema does not exist'
    END as check_prompting_schema;

SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ prompting schema has no real tables (as expected)'
        ELSE '⚠️  WARNING: prompting schema has ' || COUNT(*) || ' tables'
    END as check_prompting_empty
FROM information_schema.tables
WHERE table_schema = 'prompting'
  AND table_type = 'BASE TABLE';

-- 3. Assert prompting.prompt_segments_for_context contains LEGACY_PROMPTS_DISABLED
\echo 'Checking stub function contains guard...'
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'prompting'
              AND p.proname = 'prompt_segments_for_context'
              AND pg_get_functiondef(p.oid) LIKE '%LEGACY_PROMPTS_DISABLED%'
        )
        THEN '✅ stub function contains LEGACY_PROMPTS_DISABLED guard'
        ELSE '❌ ERROR: stub function missing guard or does not exist'
    END as check_stub_guard;

-- 4. Assert prompting_legacy access is revoked from service_role
\echo 'Checking prompting_legacy access revocation...'
SELECT 
    CASE 
        WHEN NOT EXISTS (
            SELECT 1 
            FROM information_schema.role_usage_grants
            WHERE object_schema = 'prompting_legacy'
              AND grantee IN ('service_role', 'authenticated', 'anon')
        )
        THEN '✅ prompting_legacy access revoked from service_role/authenticated/anon'
        ELSE '⚠️  WARNING: Some access grants may still exist'
    END as check_access_revoked;

-- Summary
\echo ''
\echo '✅ Database guards check complete'

