# Complete Migration Order for Budget Engine

Run these migrations **in this exact order**:

## Step 1: Prerequisites (if not already run)

### Core Schema (if needed)
```bash
psql $DATABASE_URL -f db/migrations/20250130000000_core_schema.sql
# OR if you're using the recreated version:
# psql $DATABASE_URL -f db/migrations/20250130000002_recreate_core_schema.sql
```

### Prompt Snapshots (REQUIRED)
```bash
psql $DATABASE_URL -f db/migrations/20250213_prompt_snapshots.sql
```

### Slots and Templates (REQUIRED)
```bash
psql $DATABASE_URL -f db/migrations/20250214_slots_templates.sql
```

## Step 2: Fix Migration (if you got foreign key errors)

**Only if you already ran `20250213_prompt_snapshots.sql` and got a foreign key error:**
```bash
psql $DATABASE_URL -f db/migrations/20250222_fix_prompt_snapshots_turn_id.sql
```

## Step 3: New Budget Engine Migrations

```bash
psql $DATABASE_URL -f db/migrations/20250220_slots_flags.sql
psql $DATABASE_URL -f db/migrations/20250221_budget_report.sql
psql $DATABASE_URL -f db/migrations/20250222_turn_metrics.sql
```

## Quick All-in-One Script

```bash
# Prerequisites
psql $DATABASE_URL -f db/migrations/20250213_prompt_snapshots.sql
psql $DATABASE_URL -f db/migrations/20250214_slots_templates.sql

# Fix (only if needed)
# psql $DATABASE_URL -f db/migrations/20250222_fix_prompt_snapshots_turn_id.sql

# New migrations
psql $DATABASE_URL -f db/migrations/20250220_slots_flags.sql
psql $DATABASE_URL -f db/migrations/20250221_budget_report.sql
psql $DATABASE_URL -f db/migrations/20250222_turn_metrics.sql
```

## Verify Everything Worked

```sql
-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('slots', 'prompt_snapshots', 'turn_metrics')
ORDER BY table_name;

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
```



