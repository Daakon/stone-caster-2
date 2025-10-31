# Simplified World References - TEXT Only

## Summary
We've eliminated the UUID complexity and now use **TEXT slugs consistently** for all world references. No more `world_id_mapping` table needed!

## The Simple Design

All tables use TEXT slugs for world references:

```
worlds.id               = TEXT ("mystika", "aethermoor")
characters.world_slug   = TEXT ("mystika")
premade_characters.world_slug = TEXT ("mystika")
entry_points.world_id   = TEXT ("mystika")  // Yes, it's called world_id but stores TEXT
```

## What Was Removed

1. ❌ `characters.world_id` (UUID column) - Dropped
2. ❌ `premade_characters.world_id` (UUID column) - Dropped  
3. ❌ `world_id_mapping` table lookups - No longer needed
4. ❌ UUID resolution logic in backend - Removed
5. ❌ Complex fallback validation - Simplified

## Code Changes

### Types
- **`Character`**: Only has `worldSlug` (TEXT)
- **`ResolvedAdventureIdentity`**: Only has `worldSlug` (TEXT)

### Backend Services
- **`CharactersService`**: Removed `resolveWorldIdFromSlug()` helper
- **`GamesService`**: Simplified validation to single TEXT comparison: `character.worldSlug === adventure.worldSlug`
- **`adventure-identity`**: No more UUID mapping lookup

## Migration Steps

Run this in Supabase SQL Editor:

```sql
-- Drop the UUID columns we don't need
ALTER TABLE public.characters DROP COLUMN IF EXISTS world_id;
ALTER TABLE public.premade_characters DROP COLUMN IF EXISTS world_id;

-- Ensure TEXT slugs are indexed
CREATE INDEX IF NOT EXISTS idx_characters_world_slug 
ON public.characters(world_slug);

CREATE INDEX IF NOT EXISTS idx_premade_characters_world_slug
ON public.premade_characters(world_slug);
```

## How Validation Works Now

Simple TEXT comparison:

```typescript
if (character.worldSlug !== adventure.worldSlug) {
  return error('Character and adventure must be from the same world');
}
```

**No UUIDs. No mapping table. No complexity.**

## Your Current Issue - The Fix

Your entry point has `world_id = "e271c88b-6fa4-4761-bc8a-169e13b2db84"` (a UUID that was mistakenly stored).  
It should be `world_id = "mystika"` (the TEXT slug).

**Fix it manually in Supabase:**

```sql
UPDATE public.entry_points
SET world_id = 'mystika'
WHERE id = 'test-entry-point-1'
AND world_id = 'e271c88b-6fa4-4761-bc8a-169e13b2db84';
```

Then restart your backend and it will work!

## Why This Is Better

1. **Simpler**: One data type (TEXT) instead of two (TEXT + UUID)
2. **Fewer queries**: No joins to mapping tables
3. **More readable**: Can see "mystika" in the database instead of UUIDs
4. **Less error-prone**: No sync issues between TEXT and UUID
5. **Easier debugging**: Logs show "mystika" vs "aethermoor" instead of UUIDs

The only reason to use UUIDs for worlds would be if:
- World slugs change frequently (they don't)
- You need URLs to hide world names (you use entry point slugs for that)
- You have millions of worlds (you don't)

**TEXT slugs are the right choice here.**

