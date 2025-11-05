# NPCs Table - Visibility and Access Control

## Visibility Contract

The `public.npcs` table uses a dual-filter visibility model:

### Public Access (Anonymous + Authenticated Users)

Users can read NPCs that meet **both** conditions:
- `status = 'active'`
- `doc->>'visibility' = 'public'`

This is enforced by the `npcs_public_read_visible` RLS policy.

### Admin Access

Users with `role = 'admin'` in the `public.profiles` table can read **all NPCs** regardless of status or visibility.

This is enforced by the `npcs_admin_read_all` RLS policy, which uses the `public.is_admin()` helper function.

## Implementation Details

### Search Vector

The table includes a generated `search_vector` column that combines:
- `name` field
- `doc->>'short_desc'` field

This enables full-text search using GIN indexes for fast queries.

### Indexes

Five indexes optimize common query patterns:

1. **`npcs_status_idx`** - On `status` column (for filtering active NPCs)
2. **`npcs_world_idx`** - On `world_id` column (for filtering by world)
3. **`npcs_visibility_idx`** - On `doc->>'visibility'` expression (for filtering public NPCs)
4. **`npcs_created_idx`** - On `created_at` column (for sorting by creation date)
5. **`npcs_search_idx`** - GIN index on `search_vector` (for full-text search)

### RLS Policies

Row Level Security (RLS) is enabled on the `npcs` table. Two SELECT policies are defined:

- **`npcs_public_read_visible`**: Allows anonymous and authenticated users to read NPCs where `status = 'active'` AND `doc->>'visibility' = 'public'`
- **`npcs_admin_read_all`**: Allows users with admin role to read all NPCs

No INSERT/UPDATE/DELETE policies are defined in Phase A1 (read-only access).

## Usage Examples

### Querying Public NPCs (Frontend)

```sql
SELECT id, name, doc
FROM public.npcs
WHERE status = 'active'
  AND (doc->>'visibility') = 'public'
ORDER BY created_at DESC
LIMIT 24;
```

### Full-Text Search

```sql
SELECT id, name, doc
FROM public.npcs
WHERE status = 'active'
  AND (doc->>'visibility') = 'public'
  AND search_vector @@ to_tsquery('simple', 'ranger:*')
ORDER BY created_at DESC
LIMIT 24;
```

### Admin Query (All NPCs)

```sql
-- Admin users can query all NPCs
SELECT id, name, status, doc
FROM public.npcs
ORDER BY created_at DESC;
```

## Verification

To verify the setup:

1. **Check indexes exist**:
   ```sql
   SELECT indexname FROM pg_indexes WHERE tablename = 'npcs';
   ```

2. **Check RLS is enabled**:
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'npcs';
   ```

3. **Check policies exist**:
   ```sql
   SELECT policyname FROM pg_policies WHERE tablename = 'npcs';
   ```

4. **Verify is_admin() function**:
   ```sql
   SELECT public.is_admin();
   ```

5. **Test query plan (should use indexes)**:
   ```sql
   EXPLAIN ANALYZE
   SELECT id FROM public.npcs
   WHERE status = 'active'
     AND (doc->>'visibility') = 'public'
     AND world_id = (SELECT id FROM public.worlds LIMIT 1)
   ORDER BY created_at DESC
   LIMIT 24;
   ```


