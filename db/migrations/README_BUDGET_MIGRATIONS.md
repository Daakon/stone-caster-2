# Budget Engine & Telemetry Migrations

## Migration Order

These migrations must be run in the following order:

### Prerequisites
1. **Core schema migrations** (if not already run):
   - `20250130000000_core_schema.sql` - Creates `turns` table (id: bigint)
   - Or `20250130000002_recreate_core_schema.sql`

2. **Slots and Templates** (if not already run):
   - `20250214_slots_templates.sql` - Creates `slots` table

3. **Prompt Snapshots** (if not already run):
   - `20250213_prompt_snapshots.sql` - Creates `prompt_snapshots` table

### New Migrations (Run in Order)

**IMPORTANT**: If you already ran `20250213_prompt_snapshots.sql` and got a foreign key error, run the fix migration first:

0. **`20250222_fix_prompt_snapshots_turn_id.sql`** (Only if needed)
   - Fixes `prompt_snapshots.turn_id` from UUID to bigint
   - Only needed if you got a foreign key constraint error
   - **Run this BEFORE the other migrations if you have the error**

1. **`20250220_slots_flags.sql`**
   - Adds `must_keep` and `min_chars` columns to `slots` table
   - Sets default values for critical slots
   - **Requires**: `slots` table (from `20250214_slots_templates.sql`)

2. **`20250221_budget_report.sql`**
   - Adds `budget_report` JSONB column to `prompt_snapshots` table
   - **Requires**: `prompt_snapshots` table (from `20250213_prompt_snapshots.sql`)

3. **`20250222_turn_metrics.sql`**
   - Creates `turn_metrics` table for telemetry
   - **Requires**: `turns` table (from core schema migrations)

## Quick Run Script

```bash
# From project root

# If you got a foreign key error on prompt_snapshots, run this first:
psql $DATABASE_URL -f db/migrations/20250222_fix_prompt_snapshots_turn_id.sql

# Then run the new migrations:
psql $DATABASE_URL -f db/migrations/20250220_slots_flags.sql
psql $DATABASE_URL -f db/migrations/20250221_budget_report.sql
psql $DATABASE_URL -f db/migrations/20250222_turn_metrics.sql
```

## Verification

After running, verify with:

```sql
-- Check slots has new columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'slots' 
AND column_name IN ('must_keep', 'min_chars');

-- Check prompt_snapshots has budget_report
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'prompt_snapshots' 
AND column_name = 'budget_report';

-- Check turn_metrics exists
SELECT * FROM information_schema.tables WHERE table_name = 'turn_metrics';
```

## Important Notes

- All migrations use `IF NOT EXISTS` / `IF EXISTS` clauses - safe to run multiple times
- The `turn_id` column in `turn_metrics` is `bigint` (not UUID) to match `turns.id`
- The `turn_id` column in `prompt_snapshots` was fixed to `bigint` (was incorrectly UUID)
- Migrations will raise helpful errors if prerequisite tables don't exist

