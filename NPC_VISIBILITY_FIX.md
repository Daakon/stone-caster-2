# NPC Visibility Column Fix

## Problem
The NPC admin API is failing with the error:
```
{
    "code": "42703",
    "details": null,
    "hint": null,
    "message": "column npcs.visibility does not exist"
}
```

## Root Cause
The `npcs` table is missing the `visibility` column that was supposed to be added by the migration `20250205_npc_visibility_and_authors_fixed.sql`. The migration script couldn't be applied automatically because the Supabase instance doesn't have the `exec_sql` RPC function.

## Solution

### Step 1: Apply the Migration Manually

1. **Go to your Supabase Dashboard**
   - Navigate to https://supabase.com/dashboard
   - Select your project

2. **Open the SQL Editor**
   - Click on "SQL Editor" in the left sidebar

3. **Run the Migration SQL**
   - Copy the contents of `scripts/npc-visibility-migration-sql.sql`
   - Paste it into the SQL Editor
   - Click "Run" to execute the migration

### Step 2: Verify the Fix

Run the test script to verify the migration was successful:

```bash
node scripts/test-npc-visibility.cjs
```

You should see:
```
✅ Visibility column exists!
✅ NPC Admin API working!
```

### Step 3: Test the Admin API

The NPC admin API endpoints should now work without the visibility error:

- `GET /api/admin/awf/npcs` - List NPCs
- `POST /api/admin/awf/npcs` - Create NPC
- `DELETE /api/admin/awf/npcs/:id/:version` - Delete NPC

## What the Migration Does

The migration adds the following to the `npcs` table:

1. **New Columns:**
   - `visibility` (text, default: 'private') - Whether NPC is private or public
   - `author_name` (text) - Display name of the NPC author
   - `author_type` (text, default: 'user') - Type of author (user/system/original)

2. **Indexes:**
   - `idx_npcs_visibility` - For filtering by visibility
   - `idx_npcs_author_type` - For filtering by author type

3. **RLS Policies:**
   - Users can view public NPCs and their own private NPCs
   - Users can create, update, and delete their own NPCs
   - Admins can do everything with all NPCs

4. **Sample Data:**
   - Adds some sample public NPCs (Gandalf, Captain Kirk, System Assistant)

## Files Created

- `scripts/npc-visibility-migration-sql.sql` - SQL migration to run manually
- `scripts/test-npc-visibility.cjs` - Test script to verify the fix
- `NPC_VISIBILITY_FIX.md` - This documentation

## Next Steps

After applying the migration:

1. Test your NPC admin API endpoints
2. Verify the visibility column is working in your frontend
3. Check that RLS policies are properly applied
4. Consider adding the `exec_sql` RPC function to your Supabase instance for future automated migrations

## Troubleshooting

If you still get the visibility error after applying the migration:

1. Check that the migration ran successfully in the SQL Editor
2. Verify the `npcs` table has the `visibility` column
3. Check that your API is connecting to the correct Supabase instance
4. Ensure your environment variables are set correctly

## Related Files

- `supabase/migrations/20250205_npc_visibility_and_authors_fixed.sql` - Original migration file
- `backend/src/routes/admin.ts` - NPC admin API endpoints
- `frontend/src/services/admin.npcs.ts` - Frontend NPC service
