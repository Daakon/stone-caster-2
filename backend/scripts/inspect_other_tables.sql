/*
  List table names that are NOT 'chimera_%', NOT 'awf_%', NOT 'stone_%', NOT 'mod_%'.
  Exclude standard Supabase schemas (auth, storage, realtime, graphql, vault).
  
  Purpose: Identify remaining tables that may be legacy candidates for deletion.
  Date: 2025-12-04
*/

SELECT 
  schemaname, 
  relname as table_name,
  n_live_tup as row_count,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) as table_size
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
  AND relname NOT LIKE 'chimera_%'
  AND relname NOT LIKE 'awf_%'
  AND relname NOT LIKE 'stone_%'
  AND relname NOT LIKE 'mod_%'
  -- Exclude common system tables if they appear in public (pg_*)
  AND relname NOT LIKE 'pg_%'
  AND relname NOT LIKE 'sql_%'
ORDER BY relname;

-- Summary count
SELECT 
  COUNT(*) as total_other_tables
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
  AND relname NOT LIKE 'chimera_%'
  AND relname NOT LIKE 'awf_%'
  AND relname NOT LIKE 'stone_%'
  AND relname NOT LIKE 'mod_%'
  AND relname NOT LIKE 'pg_%'
  AND relname NOT LIKE 'sql_%';

