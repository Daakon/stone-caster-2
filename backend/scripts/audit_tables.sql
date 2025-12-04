-- Audit Script: List all tables and row counts in public schema
-- Used to verify legacy purge and identify remaining tables
-- Date: 2025-12-04

SELECT 
  schemaname, 
  relname as table_name, 
  n_live_tup as row_count,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) as table_size
FROM pg_stat_user_tables 
WHERE schemaname = 'public' 
ORDER BY relname;

-- Summary: Count tables by prefix pattern
SELECT 
  CASE 
    WHEN relname LIKE 'awf_%' THEN 'awf_* (legacy)'
    WHEN relname LIKE 'stone_%' THEN 'stone_* (legacy)'
    WHEN relname LIKE 'mod_%' THEN 'mod_* (legacy)'
    WHEN relname LIKE 'chimera_%' THEN 'chimera_* (active)'
    WHEN relname IN ('entry_points', 'worlds', 'world_templates', 'adventures', 'games', 'sessions', 'turns', 'content_reviews', 'content_reports', 'review_actions') THEN 'legacy_runtime (legacy)'
    ELSE 'other'
  END as table_category,
  COUNT(*) as table_count,
  SUM(n_live_tup) as total_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
GROUP BY 
  CASE 
    WHEN relname LIKE 'awf_%' THEN 'awf_* (legacy)'
    WHEN relname LIKE 'stone_%' THEN 'stone_* (legacy)'
    WHEN relname LIKE 'mod_%' THEN 'mod_* (legacy)'
    WHEN relname LIKE 'chimera_%' THEN 'chimera_* (active)'
    WHEN relname IN ('entry_points', 'worlds', 'world_templates', 'adventures', 'games', 'sessions', 'turns', 'content_reviews', 'content_reports', 'review_actions') THEN 'legacy_runtime (legacy)'
    ELSE 'other'
  END
ORDER BY table_category;

