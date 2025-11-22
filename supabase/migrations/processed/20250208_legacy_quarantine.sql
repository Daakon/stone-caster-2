-- Legacy Prompting Quarantine Migration
-- Moves legacy prompting schema to prompting_legacy and creates stubs
-- Legacy quarantined; do not use. Removal date: 2025-03-08 (T+30 days)
--
-- SECURITY: Revokes all access from authenticated, anon, service_role
-- Only database owner can access prompting_legacy
--
-- This migration is Phase 1 of a controlled decommission:
-- Phase 1 (now): Quarantine + stubs
-- Phase 2 (T+14 days): Drop code references in tests/fixtures
-- Phase 3 (T+30 days): Hard-drop prompting_legacy after full backup

BEGIN;

-- 1. Rename existing prompting schema to prompting_legacy
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'prompting') THEN
        -- Check if prompting_legacy already exists (avoid conflict)
        IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'prompting_legacy') THEN
            RAISE NOTICE 'prompting_legacy already exists, skipping rename';
        ELSE
            ALTER SCHEMA prompting RENAME TO prompting_legacy;
            RAISE NOTICE 'Renamed schema prompting to prompting_legacy';
        END IF;
    ELSE
        RAISE NOTICE 'Schema prompting does not exist, skipping rename';
    END IF;
END $$;

-- 2. Create fresh prompting schema (empty for future use)
CREATE SCHEMA IF NOT EXISTS prompting;

-- 3. Revoke all access from prompting_legacy (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'prompting_legacy') THEN
        -- Revoke from authenticated role
        EXECUTE 'REVOKE ALL ON SCHEMA prompting_legacy FROM authenticated';
        EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA prompting_legacy FROM authenticated';
        EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA prompting_legacy FROM authenticated';
        
        -- Revoke from anon role
        EXECUTE 'REVOKE ALL ON SCHEMA prompting_legacy FROM anon';
        EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA prompting_legacy FROM anon';
        EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA prompting_legacy FROM anon';
        
        -- Revoke from service_role
        EXECUTE 'REVOKE ALL ON SCHEMA prompting_legacy FROM service_role';
        EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA prompting_legacy FROM service_role';
        EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA prompting_legacy FROM service_role';
        
        RAISE NOTICE 'Revoked all access from prompting_legacy';
    END IF;
END $$;

-- 4. Create stub function that errors if called
CREATE OR REPLACE FUNCTION prompting.prompt_segments_for_context(
    p_world_id TEXT,
    p_entry_start_slug TEXT,
    p_include_scenarios BOOLEAN DEFAULT TRUE,
    p_ruleset_slug TEXT DEFAULT NULL,
    p_include_npcs BOOLEAN DEFAULT TRUE
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'LEGACY_PROMPTS_DISABLED: prompting.prompt_segments_for_context is deprecated. Use entry-point assembler v3 instead.'
        USING HINT = 'This function has been quarantined. See docs/deprecations/prompting-legacy-decomm.md';
    RETURN;
END;
$$;

-- 5. Create stub for prompt_segments table access (if needed)
CREATE OR REPLACE FUNCTION prompting.prompt_segments()
RETURNS SETOF jsonb
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'LEGACY_PROMPTS_DISABLED: prompting.prompt_segments table is deprecated.'
        USING HINT = 'This table has been quarantined. Use entry-point assembler v3 instead.';
    RETURN;
END;
$$;

-- 6. Grant usage on new prompting schema to service_role (for future use)
GRANT USAGE ON SCHEMA prompting TO service_role;

-- 7. Create empty view for legacy usage monitoring (placeholder)
CREATE OR REPLACE VIEW prompting.legacy_usage_log AS
SELECT 
    NULL::text as event_type,
    NULL::text as object_name,
    NULL::timestamptz as accessed_at
WHERE false; -- Empty view by design

COMMENT ON SCHEMA prompting_legacy IS 'LEGACY: Quarantined on 2025-02-08. Do not use. Removal planned for 2025-03-08.';
COMMENT ON SCHEMA prompting IS 'Active prompting schema. Use entry-point assembler v3.';
COMMENT ON VIEW prompting.legacy_usage_log IS 'Placeholder view for future legacy usage monitoring (event triggers can populate this)';

COMMIT;
