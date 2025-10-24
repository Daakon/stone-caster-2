# NPC Admin API Fix

## Problem Summary

The NPC admin API was failing with multiple errors:

1. **`"column npcs.visibility does not exist"`** - Fixed by previous migration
2. **`"column npcs.user_id does not exist"`** - Current issue
3. **API schema mismatch** - API was written for AWF schema but table uses admin associations schema

## Root Cause Analysis

### Schema Mismatch
The API code was written for the **AWF NPC schema**:
```sql
CREATE TABLE npcs (
  id TEXT NOT NULL,
  version TEXT NOT NULL,
  doc JSONB NOT NULL,
  -- ...
);
```

But the actual table uses the **admin associations schema**:
```sql
CREATE TABLE npcs (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  status text NOT NULL,
  description text,
  -- ...
);
```

### Missing Columns
- `user_id` column was missing (causing RLS policy errors)
- `version` and `doc` columns don't exist (causing API errors)

## Solution

### 1. Database Migration
Apply the comprehensive migration: `scripts/comprehensive-npc-fix.sql`

This adds:
- `user_id` column with proper foreign key
- Updated RLS policies for user ownership
- Proper indexes

### 2. API Code Fixes
Updated `backend/src/routes/admin.ts`:

**GET /api/admin/awf/npcs**
- Removed `version` ordering (doesn't exist)
- Removed `doc->npc->tags` filtering (doesn't exist)
- Uses `created_at` for ordering instead

**POST /api/admin/awf/npcs**
- Changed from AWF schema (`id, version, doc`) to admin schema (`id, name, description, status, visibility, author_name, author_type, user_id`)
- Removed document validation (not applicable)
- Uses proper upsert with `id` conflict resolution

**DELETE /api/admin/awf/npcs/:id**
- Removed `version` parameter (doesn't exist)
- Simplified to delete by `id` only

### 3. Design Decision: user_id vs author_name/author_type

You were right to question this design. Here's the analysis:

**Current Schema:**
- `user_id` (uuid) - Direct foreign key to auth.users
- `author_name` (text) - Display name for UI
- `author_type` (text) - 'user', 'system', 'original'

**Recommendation:**
- Keep `user_id` for RLS policies and ownership
- Keep `author_name` for display purposes (can be different from user's actual name)
- Keep `author_type` for categorizing NPCs (user-created vs system vs original characters)

This provides flexibility for:
- System NPCs (user_id = NULL, author_type = 'system')
- Original characters (user_id = NULL, author_type = 'original')
- User-created NPCs (user_id = actual user, author_type = 'user')

## Files Modified

1. **`scripts/comprehensive-npc-fix.sql`** - Database migration
2. **`backend/src/routes/admin.ts`** - API endpoint fixes
3. **`scripts/test-comprehensive-npc-fix.cjs`** - Test script

## Testing

Run the test script to verify the fix:
```bash
node scripts/test-comprehensive-npc-fix.cjs
```

Expected output:
```
✅ user_id column exists!
✅ NPC Admin API working!
✅ NPC Creation working!
```

## API Endpoints

### GET /api/admin/awf/npcs
- **Query params:** `id` (optional), `tag` (ignored for now)
- **Response:** Array of NPCs with current schema fields

### POST /api/admin/awf/npcs
- **Body:** `{ id, name, description?, status?, visibility?, author_name?, author_type?, user_id? }`
- **Response:** Created/updated NPC

### DELETE /api/admin/awf/npcs/:id
- **Params:** `id` (NPC ID)
- **Response:** Success message

## RLS Policies

The migration creates comprehensive RLS policies:

1. **Users can view:** Their own NPCs + public NPCs + admin can see all
2. **Users can create:** Their own NPCs + admin can create for anyone
3. **Users can update:** Their own NPCs + admin can update any
4. **Users can delete:** Their own NPCs + admin can delete any

## Next Steps

1. Apply the migration in Supabase SQL Editor
2. Test the API endpoints
3. Update frontend code if needed to match new API schema
4. Consider adding tag filtering if needed (would require schema changes)

## Related Issues

- The AWF NPC schema vs admin associations schema mismatch suggests the migrations were applied out of order or to different environments
- Consider consolidating the NPC schemas or clearly documenting which one to use
- The versioned document approach (AWF) vs simple record approach (admin) serve different purposes
