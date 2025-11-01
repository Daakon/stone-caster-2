# 🔧 Fix mystika Mapping (Version 2) - Handles Duplicate UUID

## The Problem
The UUID `65103459-9ef0-49bd-a19c-29e73e890ecf` already exists in `world_id_mapping`, but it's mapped to a **different `text_id`** (not 'mystika').

## Step 1: Diagnose First (Optional but Recommended)

Run this to see what's actually in your database:

**File:** `supabase/migrations/20250201_diagnose_mystika_issue.sql`

This will show:
- What UUID mystika should have
- What's currently in world_id_mapping
- What text_id the UUID is currently mapped to
- Whether mystika exists with a different UUID

## Step 2: Run the Fix

**File:** `supabase/migrations/20250201_fix_mystika_mapping_v2.sql`

This migration will:
1. ✅ Check if mystika already exists with the correct UUID → done!
2. ✅ If the UUID exists with a different text_id → **update that row** to have `text_id = 'mystika'`
3. ✅ If mystika exists with wrong UUID → update mystika's UUID
4. ✅ If mystika doesn't exist → create it (handling conflicts)

**This version handles all edge cases!**

## How to Run

1. **Open Supabase Studio** → SQL Editor
2. **Copy/paste** the contents of `20250201_fix_mystika_mapping_v2.sql`
3. **Run it**
4. **Look for:** `SUCCESS: mystika -> UUID: 65103459-9ef0-49bd-a19c-29e73e890ecf`

## What the Fix Does

The smart logic will:
- **If UUID `65103459-...` exists mapped to some other world** (e.g., `'test-world'`):
  - It will **UPDATE that row** to have `text_id = 'mystika'`
  - This is safe because we know this UUID should be for mystika
  
- **If mystika exists but with wrong UUID**:
  - Update mystika to have the correct UUID

- **If mystika doesn't exist**:
  - Insert it, using `ON CONFLICT` to handle the UUID if it already exists

## After Running

1. **Verify** with this query:
   ```sql
   SELECT text_id, uuid_id, name 
   FROM public.world_id_mapping 
   WHERE text_id = 'mystika';
   ```
   
   Should show:
   ```
   text_id | uuid_id                              | name
   -------|--------------------------------------|----------
   mystika | 65103459-9ef0-49bd-a19c-29e73e890ecf | Mystika
   ```

2. **Try creating a character** - should work now! ✅

---

**This version handles the duplicate UUID issue!** 🎉

