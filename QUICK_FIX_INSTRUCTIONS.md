# Quick Fix for world_id_mapping Missing 'mystika'

## The Problem
The `world_id_mapping` table is missing the `'mystika'` entry, so character creation fails.

## The Solution

Run this migration in Supabase Studio SQL Editor:

**File:** `supabase/migrations/20250201_fix_mystika_mapping.sql`

This will:
1. Check if `mystika` exists
2. Insert it with UUID `65103459-9ef0-49bd-a19c-29e73e890ecf` (the one we know)
3. Verify it worked

## Steps

1. Open Supabase Studio
2. Go to SQL Editor
3. Copy/paste the contents of `20250201_fix_mystika_mapping.sql`
4. Run it
5. You should see: `SUCCESS: mystika -> UUID: 65103459-9ef0-49bd-a19c-29e73e890ecf`

## After Running

Try creating a character again. It should work!

The logs should show:
```
[PLAYERV3_CREATE] Resolving world_id for worldSlug: mystika
[PLAYERV3_CREATE] Resolved world_id: 65103459-9ef0-49bd-a19c-29e73e890ecf
[PLAYERV3_CREATE_DATA] Character data being inserted: { world_id: '65103459-...' }
```

## Why This Happened

The `complete_world_uuid_setup.sql` migration should have populated `world_id_mapping` from the `worlds` table, but either:
- The migration didn't run
- The `worlds` table doesn't have an entry with `id = 'mystika'`
- There was a conflict during the migration

This manual fix ensures `mystika` exists regardless.

