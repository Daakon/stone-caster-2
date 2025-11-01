# Fixing the Character world_id Bug - Action Plan

## What Was Wrong

When creating a character from a premade, the code used **`players-v3.ts`** instead of `CharactersService`. This code path did NOT set `world_id`, only `world_slug`.

## What Was Fixed

✅ Updated `backend/src/routes/players-v3.ts` to:
- Look up `world_id` from `world_id_mapping` using `worldSlug`
- Set `world_id` in the character data
- Add detailed logging: `[PLAYERV3_CREATE]`, `[PLAYERV3_CREATE_DATA]`, `[PLAYERV3_CREATED_DB_ROW]`

✅ Backend rebuilt successfully

## Next Steps (In Order)

### 1. Kill Old Backend Process
```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
```

### 2. Verify Port 3000 is Free
```powershell
netstat -ano | findstr :3000
# Should show NOTHING
```

### 3. Clean Up Old Characters with NULL world_id
Run this migration to delete all characters created before the fix:
```powershell
# In Supabase Studio SQL Editor or via CLI
# Run: supabase/migrations/cleanup_old_characters.sql
```

Or in Supabase Studio:
1. Go to SQL Editor
2. Paste the contents of `cleanup_old_characters.sql`
3. Run it

### 4. Start Backend with New Build
```powershell
cd "C:\Dev\Stone Caster\stone-caster-2\backend"
npm run start:local
```

### 5. Create a BRAND NEW Character
In the frontend:
1. Go to Stories
2. Select a story
3. Click "Start Story"
4. Create a NEW character from a premade

### 6. Verify Logs Appear
You MUST see these logs in the backend console:
```
[PLAYERV3_CREATE] Resolving world_id for worldSlug: mystika
[PLAYERV3_CREATE] Resolved world_id: 65103459-9ef0-49bd-a19c-29e73e890ecf
[PLAYERV3_CREATE_DATA] Character data being inserted: { id: '...', world_id: '65103459-...' }
[PLAYERV3_CREATED_DB_ROW] Character created in DB: { id: '...', world_id: '65103459-...' }
```

### 7. Start the Game
Click "Begin Adventure" with the fresh character.

You should see:
```
[WORLD_VALIDATION] {
  character: { worldId: '65103459-9ef0-49bd-a19c-29e73e890ecf', ... },
  adventure: { worldId: '65103459-9ef0-49bd-a19c-29e73e890ecf', ... }
}
```

**Both worldIds should match and the game should start successfully!**

## If It Still Doesn't Work

Check:
1. Did you see the `[PLAYERV3_CREATE]` logs when creating the character?
2. Did the `[PLAYERV3_CREATED_DB_ROW]` log show a non-null `world_id`?
3. Did you delete the old characters with NULL world_id?
4. Are you using the FRESH character, not an old one?

