# Post-Migration Validation SQL

Run these queries in the Supabase SQL editor after applying the Phase 1b migration to verify the schema changes.

## 1. Count Constraints and Indexes

```sql
-- Count constraints on media_assets
SELECT 
  conname AS constraint_name,
  contype AS constraint_type
FROM pg_constraint
WHERE conrelid = 'public.media_assets'::regclass
ORDER BY conname;

-- Expected: media_assets_provider_key_unique (UNIQUE)

-- Count indexes on media_assets
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'media_assets'
  AND schemaname = 'public'
ORDER BY indexname;

-- Expected indexes:
-- - media_assets_pkey (PRIMARY KEY)
-- - idx_media_assets_created_at
-- - idx_media_assets_visibility
-- - idx_media_assets_status
-- - idx_media_assets_owner

-- Count constraints on media_links
SELECT 
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.media_links'::regclass
ORDER BY conname;

-- Expected:
-- - media_links_pkey (PRIMARY KEY)
-- - media_links_one_target (CHECK)
-- Note: media_links_entity_media_unique is a unique index, not a constraint

-- Count indexes on media_links
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'media_links'
  AND schemaname = 'public'
ORDER BY indexname;

-- Expected indexes:
-- - media_links_pkey (PRIMARY KEY)
-- - media_links_entity_media_unique (UNIQUE index on COALESCE)
-- - idx_media_links_world (partial, WHERE world_id IS NOT NULL)
-- - idx_media_links_story (partial, WHERE story_id IS NOT NULL)
-- - idx_media_links_npc (partial, WHERE npc_id IS NOT NULL)
```

## 2. Sample Select to Prove One-of-Three Constraint

```sql
-- Verify CHECK constraint works: exactly one of world_id, story_id, npc_id is non-null
SELECT 
  id,
  world_id IS NOT NULL AS has_world,
  story_id IS NOT NULL AS has_story,
  npc_id IS NOT NULL AS has_npc,
  (world_id IS NOT NULL)::int + 
  (story_id IS NOT NULL)::int + 
  (npc_id IS NOT NULL)::int AS count_non_null
FROM public.media_links
LIMIT 10;

-- Expected: count_non_null should always be 1 for all rows

-- Try to insert invalid row (should fail)
INSERT INTO public.media_links (world_id, story_id, npc_id, media_id)
VALUES (NULL, NULL, NULL, gen_random_uuid());
-- Expected: ERROR: new row for relation "media_links" violates check constraint "media_links_one_target"

-- Try to insert row with multiple non-null (should fail)
INSERT INTO public.media_links (world_id, story_id, npc_id, media_id)
VALUES ('test-world', 'test-story', NULL, gen_random_uuid());
-- Expected: ERROR: new row for relation "media_links" violates check constraint "media_links_one_target"
```

## 3. Sample Policy EXPLAIN Showing Predicate Uses Right Join

```sql
-- Explain RLS policy for owner manage (worlds)
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM public.media_links
WHERE world_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.worlds w
    WHERE w.id = media_links.world_id
      AND w.owner_user_id = auth.uid()
      AND w.publish_status = 'draft'
  );

-- Expected: Should use index on worlds.id and efficient join
-- Look for: Index Scan or Index Only Scan on worlds

-- Explain RLS policy for owner manage (entry_points/stories)
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM public.media_links
WHERE story_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.entry_points ep
    WHERE ep.id = media_links.story_id
      AND ep.owner_user_id = auth.uid()
      AND ep.publish_status = 'draft'
  );

-- Expected: Should use index on entry_points.id and efficient join

-- Explain RLS policy for owner manage (npcs)
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM public.media_links
WHERE npc_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.npcs n
    WHERE n.id = media_links.npc_id
      AND n.owner_user_id = auth.uid()
      AND n.publish_status = 'draft'
  );

-- Expected: Should use index on npcs.id and efficient join
```

## 4. Verify Unique Constraint on (provider, provider_key)

```sql
-- Verify unique constraint exists on media_assets
SELECT 
  conname,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.media_assets'::regclass
  AND conname = 'media_assets_provider_key_unique';

-- Expected: UNIQUE (provider, provider_key)

-- Verify unique index exists on media_links
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'media_links'
  AND schemaname = 'public'
  AND indexname = 'media_links_entity_media_unique';

-- Expected: UNIQUE index on COALESCE(world_id::text, story_id::text, npc_id::text), media_id

-- Try to insert duplicate (should fail)
INSERT INTO public.media_assets (owner_user_id, kind, provider, provider_key)
VALUES 
  (auth.uid(), 'world', 'cloudflare_images', 'test-key-123'),
  (auth.uid(), 'world', 'cloudflare_images', 'test-key-123');
-- Expected: ERROR: duplicate key value violates unique constraint "media_assets_provider_key_unique"
```

## 5. Verify entity_id Removed from media_assets

```sql
-- Verify entity_id column does not exist
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'media_assets'
  AND column_name = 'entity_id';

-- Expected: 0 rows (column should not exist)

-- Verify old entity index does not exist
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'media_assets'
  AND indexname = 'idx_media_assets_entity';

-- Expected: 0 rows (index should not exist)
```

## 6. Verify RLS Policies

```sql
-- List all RLS policies on media_links
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'media_links'
ORDER BY policyname;

-- Expected policies:
-- - media_links_owner_manage (FOR ALL)
-- - media_links_admin_full (FOR ALL)

-- Verify RLS is enabled
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'media_links';

-- Expected: rowsecurity = true
```

## 7. Verify Data Migration (if old table existed)

```sql
-- Check if old table exists (should be renamed to media_links_old)
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = 'media_links_old'
) AS old_table_exists;

-- If old table exists, compare row counts
SELECT 
  'old' AS source,
  COUNT(*) AS row_count
FROM public.media_links_old
UNION ALL
SELECT 
  'new' AS source,
  COUNT(*) AS row_count
FROM public.media_links;

-- Expected: row counts should match (or new >= old if new rows were added)
```

