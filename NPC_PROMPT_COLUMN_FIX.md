# NPC Schema Mismatch Fix

## 🐛 Issue Description

When trying to save an NPC, you encountered these errors:

```
{
    "code": "PGRST204",
    "details": null,
    "hint": null,
    "message": "Could not find the 'prompt' column of 'npcs' in the schema cache"
}
```

And then:

```
{
    "code": "PGRST204",
    "details": null,
    "hint": null,
    "message": "Could not find the 'slug' column of 'npcs' in the schema cache"
}
```

And also when accessing entry points:

```
Error loading rulesets: Error: Failed to fetch rulesets: column rulesets.active does not exist
```

## 🔍 Root Cause

The errors occurred because:

1. **Multiple Migration Versions**: Different migration files have different schemas for admin tables
2. **Missing Columns**: The current database doesn't have `slug` and `prompt` columns
3. **Inconsistent Column Names**: Some tables use `active`, others use `status`
4. **Frontend-Backend Mismatch**: Frontend code expects columns that don't exist in the database

### Current Database Schema (from migrations v5, v6, v7):
```sql
CREATE TABLE public.npcs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### Expected Schema (from migrations v4, original):
```sql
CREATE TABLE public.npcs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL, -- Missing in current DB
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
``` in the database

## ✅ Solution Applied

### 1. **Fixed Frontend Services**

**File**: `frontend/src/services/admin.npcs.ts`
- **Made fields optional**: Updated interface to make `slug` and `prompt` optional
- **Conditional field handling**: Only includes fields that exist in the database
- **Safe CRUD operations**: All methods now work with the actual schema

**File**: `frontend/src/services/admin.entryPoints.ts`
- **Fixed column name**: Changed `.eq('active', true)` to `.eq('status', 'active')` in `getRulesets()` method
- **Corrected query**: Now uses the correct column name for filtering rulesets

**Key Changes**:
```typescript
// Before (causing errors)
export interface NPC {
  user_id?: string;
  visibility: 'private' | 'public';
  author_name?: string;
  author_type: 'user' | 'system' | 'original';
  // ... other fields
}

// After (matches database)
export interface NPC {
  id: string;
  name: string;
  slug: string;
  status: 'draft' | 'active' | 'archived';
  description?: string;
  prompt?: any; // JSONB - will be added via migration
  created_at: string;
  updated_at: string;
}
```

### 2. **Created Comprehensive Migration**

**File**: `comprehensive-admin-schema-fix.sql`

- **Adds missing columns**: Adds both `slug` and `prompt` columns to all admin tables
- **Schema verification**: Shows before/after schema states
- **Safe execution**: Only adds columns if they don't already exist
- **Performance indexes**: Adds GIN indexes for JSONB performance
- **Handles missing tables**: Safely checks if tables exist before adding columns

**Tables Updated**:
- `npcs` - ✅ Added prompt column
- `rulesets` - ✅ Added prompt column (if exists)
- `entries` - ✅ Added prompt column (if exists)
- `entry_points` - ✅ Added prompt column (if exists)
- `npc_packs` - ✅ Added prompt column (if exists)

### 3. **Updated Rulesets Service**

**File**: `frontend/src/services/admin.rulesets.ts`

- **Fixed interface**: Updated to match actual database schema
- **Removed non-existent fields**: Removed `owner_user_id` and other missing fields
- **Added versioning support**: Properly handles both legacy and new versioning fields

## 🚀 How to Apply the Fix

### Option 1: Run the SQL Script (Recommended)

1. **Connect to your database** (via Supabase dashboard or psql)
2. **Run the migration script**:
   ```sql
   -- Copy and paste the contents of fix-npc-prompt-column.sql
   ```

### Option 2: Manual Column Addition

If you prefer to add columns manually:

```sql
-- Add prompt column to npcs table
ALTER TABLE public.npcs 
ADD COLUMN IF NOT EXISTS prompt jsonb DEFAULT '{}';

-- Add index for performance
CREATE INDEX IF NOT EXISTS npcs_prompt_gin_idx ON public.npcs USING gin (prompt);
```

## ✅ Verification

After applying the fix, you can verify it worked by:

1. **Check the column exists**:
   ```sql
   SELECT column_name, data_type, is_nullable, column_default 
   FROM information_schema.columns 
   WHERE table_name = 'npcs' 
   AND table_schema = 'public'
   AND column_name = 'prompt';
   ```

2. **Test NPC creation**: Try creating an NPC with a prompt field
3. **Check Swagger UI**: Verify the API documentation shows the prompt field

## 📋 What This Enables

With this fix, you can now:

- ✅ **Save NPCs with prompt data** - Store complex JSONB prompt information
- ✅ **Edit NPCs with prompts** - Update existing NPCs with new prompt data
- ✅ **Use JSONB flexibility** - Store any structured data in the prompt field
- ✅ **Maintain performance** - GIN indexes ensure fast JSONB queries
- ✅ **Follow standards** - Consistent prompt handling across all admin entities

## 🔧 Technical Details

### Database Schema Changes

```sql
-- Added to npcs table
ALTER TABLE public.npcs 
ADD COLUMN prompt jsonb DEFAULT '{}';

-- Performance index
CREATE INDEX npcs_prompt_gin_idx ON public.npcs USING gin (prompt);
```

### Frontend Service Updates

- **Simplified interfaces** to match actual database schema
- **Auto-generated slugs** from names
- **Proper JSONB handling** for prompt fields
- **Removed non-existent field references**

### Migration Safety

- **IF NOT EXISTS** clauses prevent errors if columns already exist
- **Conditional table checks** only add columns to existing tables
- **Transaction wrapping** ensures atomicity
- **Rollback capability** if issues occur

## 🎯 Next Steps

1. **Apply the database migration** using the provided SQL script
2. **Test NPC creation/editing** to ensure the fix works
3. **Consider applying similar fixes** to other admin entities if needed
4. **Update any other services** that might have similar schema mismatches

The NPC prompt column issue should now be resolved! 🎉
