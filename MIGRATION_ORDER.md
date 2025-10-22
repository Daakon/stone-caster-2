# Database Migration Order Guide

## Problem
The admin migrations assume certain table structures that don't exist or have incompatible types:
- `worlds` table has `id TEXT` but admin expects `id UUID`
- `rulesets` table doesn't exist but admin migrations try to ALTER it
- Foreign key constraints fail due to type mismatches

## Solution: Run Migrations in This Order (SAFE APPROACH)

### 1. Create Safe Worlds Mapping
```bash
# Run this migration first to create a safe mapping approach
psql "your-db-url" -f supabase/migrations/20250131_fix_worlds_uuid_safe.sql
```

### 2. Create Missing Rulesets Table
```bash
# Run this migration to create the rulesets table
psql "your-db-url" -f supabase/migrations/20250131_create_rulesets_table.sql
```

### 3. Run Admin Phase B Migration (Safe Version)
```bash
# Now run the safe admin associations migration
psql "your-db-url" -f supabase/migrations/20250131_admin_associations_phase_b_safe.sql
```

### 4. Run Admin Phase C Migration
```bash
# Run the publishing workflow migration
psql "your-db-url" -f supabase/migrations/20250131_admin_publishing_phase_c.sql
```

### 5. Run Prompt Fields Migration
```bash
# Add prompt fields to worlds and rulesets
psql "your-db-url" -f supabase/migrations/20250131_add_prompt_fields.sql
```

### 6. Run Scope Cleanup Migration
```bash
# Clean up prompt segments scopes
psql "your-db-url" -f supabase/migrations/20250204_segments_scope_cleanup.sql
```

### 7. Run Referential Integrity Migration
```bash
# Add referential integrity constraints
psql "your-db-url" -f supabase/migrations/20250205_prompt_segments_ref_integrity.sql
```

## Alternative: Complete Database Reset

If you want to start fresh with all migrations:

```bash
# Reset the database completely
supabase db reset

# This will run all migrations in chronological order
# The new migrations will be applied in the correct sequence
```

## Verification

After running all migrations, verify the schema:

```sql
-- Check worlds table structure
\d public.worlds

-- Check rulesets table structure  
\d public.rulesets

-- Check entries table structure
\d public.entries

-- Verify foreign key constraints
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('entries', 'entry_rulesets', 'npcs', 'npc_packs');
```

## Expected Results

After running all migrations in order:

1. ✅ `worlds` table has `id UUID` primary key
2. ✅ `rulesets` table exists with `id UUID` primary key  
3. ✅ `entries` table exists with proper foreign keys
4. ✅ All foreign key constraints work correctly
5. ✅ Admin panel functionality works
6. ✅ No type mismatch errors

## Troubleshooting

If you still get errors:

1. **Check existing data**: Make sure there's no conflicting data in the tables
2. **Verify migration order**: Ensure migrations run in the exact order listed
3. **Check constraints**: Some constraints might need to be dropped before recreating
4. **Use transaction rollback**: Wrap problematic migrations in BEGIN/ROLLBACK to test

## Quick Fix Command

If you want to run all the new migrations at once:

```bash
# Create a combined migration file
cat supabase/migrations/20250131_fix_worlds_uuid.sql \
    supabase/migrations/20250131_create_rulesets_table.sql \
    supabase/migrations/20250131_admin_associations_phase_b.sql \
    supabase/migrations/20250131_admin_publishing_phase_c.sql \
    supabase/migrations/20250131_add_prompt_fields.sql \
    supabase/migrations/20250204_segments_scope_cleanup.sql \
    supabase/migrations/20250205_prompt_segments_ref_integrity.sql > combined_admin_migrations.sql

# Run the combined migration
psql "your-db-url" -f combined_admin_migrations.sql
```
