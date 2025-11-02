# 🔧 Fix Missing 'mystika' in world_id_mapping

## The Problem
```
[PLAYERV3_CREATE] World mapping not found: {
  worldSlug: 'mystika',
  error: { code: 'PGRST116', ... }
}
```

The `world_id_mapping` table is missing the `'mystika'` entry.

## ✅ The Fix (Run This Now!)

### Option 1: Supabase Studio (Recommended)

1. **Open Supabase Studio** → Go to your project
2. **Click "SQL Editor"** (left sidebar)
3. **Click "New Query"**
4. **Copy and paste** the entire contents of:
   ```
   supabase/migrations/20250201_fix_mystika_mapping.sql
   ```
5. **Click "Run"** (or press Ctrl+Enter)
6. **Look for this success message:**
   ```
   SUCCESS: mystika -> UUID: 65103459-9ef0-49bd-a19c-29e73e890ecf
   ```

### Option 2: Supabase CLI

```bash
# If you have Supabase CLI configured
cd "C:\Dev\Stone Caster\stone-caster-2"
supabase db reset
# Or apply just this migration:
psql $DATABASE_URL -f supabase/migrations/20250201_fix_mystika_mapping.sql
```

## 🧪 Verify It Worked

After running the fix, run this query to verify:

```sql
SELECT text_id, uuid_id, name 
FROM public.world_id_mapping 
WHERE text_id = 'mystika';
```

**Expected result:**
```
text_id | uuid_id                              | name
--------|--------------------------------------|----------
mystika | 65103459-9ef0-49bd-a19c-29e73e890ecf | Mystika
```

## ✅ Test Character Creation

After the fix:
1. **Restart your backend** (to clear any cached errors)
2. **Try creating a character again** from a premade
3. **You should see:**
   ```
   [PLAYERV3_CREATE] Resolving world_id for worldSlug: mystika
   [PLAYERV3_CREATE] Resolved world_id: 65103459-9ef0-49bd-a19c-29e73e890ecf ✅
   [PLAYERV3_CREATE_DATA] Character data being inserted: { world_id: '65103459-...' }
   ```

## Why This Happened

The `complete_world_uuid_setup.sql` migration should have populated `world_id_mapping` from the `worlds` table, but:
- The migration may not have run completely
- Or the `worlds` table structure was different than expected
- Or there was a conflict during population

This manual fix ensures `mystika` exists with the correct UUID regardless.

---

**After running the fix, character creation should work!** 🎉

