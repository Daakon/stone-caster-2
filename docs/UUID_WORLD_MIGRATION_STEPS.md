# UUID World Migration - Manual Steps Required

## Summary
The system has been updated to use UUID consistently for world references instead of text slugs. The backend code is ready, but two database migrations need to be run manually.

## Changes Made

### Code Changes (✅ Complete)
1. **Type Definitions**
   - Added `worldId: string` (UUID) to `CharacterSchema` in `shared/src/types/index.ts`
   - Added `worldId: string` (UUID) to `ResolvedAdventureIdentity` in `backend/src/utils/adventure-identity.ts`

2. **Backend Services**
   - Updated `CharactersService.mapCharacterFromDb()` to map `world_id` from database
   - Added `CharactersService.resolveWorldIdFromSlug()` helper method
   - Updated character creation to resolve and set `world_id` UUID when creating new characters
   - Updated `resolveAdventureByIdentifier()` to resolve world UUID to text slug for backward compatibility

3. **Validation Logic**
   - Updated `GamesService.spawnGameForAdventure()` to compare UUIDs first, then fall back to slugs
   - Validation now checks: `character.worldId === adventure.worldId` (preferred) or `character.worldSlug === adventure.worldSlug` (fallback)

### Database Migrations (❌ TODO - Manual)

You need to run these two SQL migration files in your Supabase SQL Editor:

1. **`supabase/migrations/20250201_add_world_id_to_characters.sql`**
   - Adds `world_id` UUID column to `characters` table
   - Populates it from `world_id_mapping` using existing `world_slug` values
   - Creates index for efficient lookups

2. **`supabase/migrations/20250201_add_world_id_to_premade_characters.sql`**
   - Adds `world_id` UUID column to `premade_characters` table  
   - Populates it from `world_id_mapping`
   - Updates unique constraints to use UUID instead of slug

## Steps to Complete

### 1. Run Migrations in Supabase

Go to your Supabase project → SQL Editor and run each migration file:

```sql
-- First migration
-- Copy and paste contents of: supabase/migrations/20250201_add_world_id_to_characters.sql

-- Second migration  
-- Copy and paste contents of: supabase/migrations/20250201_add_world_id_to_premade_characters.sql
```

### 2. Restart Backend Server

After migrations complete:
```bash
cd backend
npm run start:local
```

## How It Works Now

### Character Creation
When a character is created with a `worldSlug` (e.g., "mystika"):
1. Backend resolves it to UUID via `world_id_mapping` table
2. Stores both `world_slug` (text, deprecated) and `world_id` (UUID, preferred) in database
3. Returns both fields in Character object

### Adventure/Entry Point Resolution  
When an entry point is fetched:
1. Loads `world_id` (UUID) from `entry_points` table
2. Resolves to text slug via `world_id_mapping` for backward compatibility
3. Returns both `worldId` (UUID) and `worldSlug` (text) in `ResolvedAdventureIdentity`

### World Validation (Game Spawn)
When starting a game with a character and adventure:
1. First tries: `character.worldId === adventure.worldId` (UUID comparison - preferred)
2. Falls back to: `character.worldSlug === adventure.worldSlug` (text comparison - legacy)
3. Only fails if neither match

## Testing After Migration

1. Create a new character for a world
2. Try to start a game with that character
3. Verify no "Character and adventure must be from the same world" error

The error you were seeing happened because:
- Old characters only had `world_slug` (no `world_id`)
- Entry points have `world_id` (UUID)
- Validation was comparing UUID to null, which failed

After running the migrations:
- Existing characters will have their `world_id` populated from their `world_slug`
- New characters will have both fields set at creation
- Validation will succeed using UUID comparison

