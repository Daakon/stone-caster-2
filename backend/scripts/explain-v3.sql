-- EXPLAIN ANALYZE queries for v3 hot paths
-- Run with: psql $DATABASE_URL -f backend/scripts/explain-v3.sql

-- Query 1: World status lookup
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT id, code, status
FROM worlds
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Query 2: Default ruleset resolution (via entry_point_rulesets)
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT r.slug, r.is_default
FROM entry_point_rulesets epr
JOIN rulesets r ON r.slug = epr.ruleset_slug
WHERE epr.entry_point_id = '00000000-0000-0000-0000-000000000002'
ORDER BY epr.sort_order
LIMIT 1;

-- Query 3: NPC listing (ordered by sort_order)
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT p.id, p.metadata->>'slug' as slug, p.sort_order
FROM prompting.prompts p
WHERE p.layer = 'npc'
  AND p.world_slug = 'mystika'
  AND p.active = true
  AND p.locked = false
ORDER BY p.sort_order
LIMIT 50;

