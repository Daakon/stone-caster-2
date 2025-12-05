-- Database Table Audit SQL
-- Run this against your Supabase database to get row counts and identify deletable tables
-- Usage: psql $DATABASE_URL -f backend/scripts/audit-tables.sql
-- Or: supabase db execute --file backend/scripts/audit-tables.sql

-- ============================================================================
-- PART 1: Get all tables with row counts
-- ============================================================================

SELECT 
  schemaname,
  relname as table_name,
  n_live_tup as row_count,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) as table_size
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY 
  CASE 
    WHEN relname LIKE 'chimera_%' THEN 1
    WHEN relname IN ('profiles', 'compiled_stories', 'access_requests', 'media_assets', 'media_links') THEN 2
    WHEN relname IN ('entry_points', 'entry_point_rulesets', 'worlds', 'npcs', 'rulesets', 'scenarios') THEN 3
    ELSE 4
  END,
  relname;

-- ============================================================================
-- PART 2: Summary by category
-- ============================================================================

-- Chimera V3 Core Tables (KEEP)
SELECT 
  'Chimera V3 Core' as category,
  COUNT(*) as table_count,
  SUM(n_live_tup) as total_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND relname LIKE 'chimera_%';

-- System Tables (KEEP)
SELECT 
  'System Tables' as category,
  COUNT(*) as table_count,
  SUM(n_live_tup) as total_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND relname IN ('profiles', 'compiled_stories', 'access_requests', 'media_assets', 'media_links');

-- Legacy Tables (REVIEW)
SELECT 
  'Legacy Tables' as category,
  COUNT(*) as table_count,
  SUM(n_live_tup) as total_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND relname IN ('entry_points', 'entry_point_rulesets', 'worlds', 'npcs', 'rulesets', 'scenarios', 'templates', 'prompt_snapshots');

-- Other Tables (UNKNOWN - need investigation)
SELECT 
  'Other Tables' as category,
  COUNT(*) as table_count,
  SUM(n_live_tup) as total_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND relname NOT LIKE 'chimera_%'
  AND relname NOT IN ('profiles', 'compiled_stories', 'access_requests', 'media_assets', 'media_links')
  AND relname NOT IN ('entry_points', 'entry_point_rulesets', 'worlds', 'npcs', 'rulesets', 'scenarios', 'templates', 'prompt_snapshots')
  AND relname NOT LIKE 'pg_%'
  AND relname NOT LIKE 'sql_%';

-- ============================================================================
-- PART 3: Empty tables (DELETE CANDIDATES)
-- ============================================================================

SELECT 
  'Empty Tables (Delete Candidates)' as category,
  relname as table_name,
  n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND n_live_tup = 0
  AND relname NOT LIKE 'chimera_%'
  AND relname NOT IN ('profiles', 'compiled_stories', 'access_requests', 'media_assets', 'media_links')
  AND relname NOT LIKE 'pg_%'
  AND relname NOT LIKE 'sql_%'
ORDER BY relname;

-- ============================================================================
-- PART 4: Tables with data but not in known active list (REVIEW NEEDED)
-- ============================================================================

SELECT 
  'Tables with Data (Review Needed)' as category,
  relname as table_name,
  n_live_tup as row_count,
  pg_size_pretty(pg_total_relation_size('public'||'.'||relname)) as table_size
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND n_live_tup > 0
  AND relname NOT LIKE 'chimera_%'
  AND relname NOT IN ('profiles', 'compiled_stories', 'access_requests', 'media_assets', 'media_links')
  AND relname NOT IN ('entry_points', 'entry_point_rulesets', 'worlds', 'npcs', 'rulesets', 'scenarios', 'templates', 'prompt_snapshots')
  AND relname NOT LIKE 'pg_%'
  AND relname NOT LIKE 'sql_%'
ORDER BY n_live_tup DESC;

-- ============================================================================
-- PART 5: Generate DROP TABLE statements for empty tables (REVIEW BEFORE RUNNING!)
-- ============================================================================

SELECT 
  '-- DROP TABLE IF EXISTS ' || relname || ' CASCADE;' as drop_statement
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND n_live_tup = 0
  AND relname NOT LIKE 'chimera_%'
  AND relname NOT IN ('profiles', 'compiled_stories', 'access_requests', 'media_assets', 'media_links')
  AND relname NOT LIKE 'pg_%'
  AND relname NOT LIKE 'sql_%'
ORDER BY relname;
