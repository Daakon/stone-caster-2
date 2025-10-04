# Database Migration Fixes

## Issues Fixed

### 1. Turns Table Migration (`20241201000001_create_turns.sql`)

**Problem:** The migration was trying to create a new `turns` table with a `turn_number` column, but the table already existed from the M2 migration without this column.

**Solution:** 
- Changed from `CREATE TABLE` to `ALTER TABLE` to add the missing `turn_number` column
- Added proper handling for existing data (sets turn_number to 1 for existing turns)
- Fixed RLS policies to use correct column names (`id` instead of `cookie_group_id` in cookie_groups table)

### 2. Idempotency Keys Migration (`20241201000000_create_idempotency_keys.sql`)

**Problem:** The RLS policies were referencing `cookie_group_id` column in the `cookie_groups` table, but the actual column name is `id`.

**Solution:**
- Updated all RLS policies to use `SELECT id FROM cookie_groups` instead of `SELECT cookie_group_id FROM cookie_groups`

## Fixed Migration Files

### `supabase/migrations/20241201000001_create_turns.sql`
```sql
-- Update turns table for Layer M3
-- Add missing columns to existing turns table

-- Add turn_number column if it doesn't exist
ALTER TABLE turns ADD COLUMN IF NOT EXISTS turn_number INTEGER;

-- Update existing turns to have turn numbers (if any exist)
-- This will set turn_number to 1 for existing turns
UPDATE turns SET turn_number = 1 WHERE turn_number IS NULL;

-- Make turn_number NOT NULL after setting defaults
ALTER TABLE turns ALTER COLUMN turn_number SET NOT NULL;

-- Add unique constraint for game_id and turn_number (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'turns_game_turn_unique'
    ) THEN
        ALTER TABLE turns ADD CONSTRAINT turns_game_turn_unique UNIQUE(game_id, turn_number);
    END IF;
END $$;

-- Index for ordering turns
CREATE INDEX IF NOT EXISTS idx_turns_game_turn ON turns(game_id, turn_number);

-- RLS policies (fixed to use correct column names)
CREATE POLICY "Users can view turns for own games" ON turns
  FOR SELECT USING (
    game_id IN (
      SELECT id FROM games 
      WHERE user_id = auth.uid() OR 
            cookie_group_id IN (
              SELECT id 
              FROM cookie_groups 
              WHERE user_id = auth.uid()
            )
    )
  );
```

### `supabase/migrations/20241201000000_create_idempotency_keys.sql`
```sql
-- Fixed RLS policies to use correct column names
CREATE POLICY "Users can view own idempotency records" ON idempotency_keys
  FOR SELECT USING (
    auth.uid()::text = owner_id OR 
    owner_id IN (
      SELECT id::text 
      FROM cookie_groups 
      WHERE user_id = auth.uid()
    )
  );
```

## How to Apply the Migrations

Since the Supabase CLI is not available, you'll need to apply these migrations manually:

### Option 1: Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of each migration file
4. Execute them in order:
   - `20241201000000_create_idempotency_keys.sql`
   - `20241201000001_create_turns.sql`
   - `012_premade_characters.sql`

### Option 2: Direct Database Connection
If you have direct database access, you can run the SQL files directly against your PostgreSQL database.

### Option 3: Supabase CLI (if available)
```bash
# If you install Supabase CLI
supabase db reset
# or
supabase migration up
```

## Verification

After applying the migrations, you can verify they worked by checking:

1. **Turns table has turn_number column:**
   ```sql
   SELECT column_name, data_type, is_nullable 
   FROM information_schema.columns 
   WHERE table_name = 'turns' AND column_name = 'turn_number';
   ```

2. **Idempotency keys table exists:**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_name = 'idempotency_keys';
   ```

3. **Premade characters table exists with data:**
   ```sql
   SELECT COUNT(*) FROM premade_characters;
   ```

## Testing

Once the migrations are applied, you can test the implementation by:

1. Starting the backend server: `npm run dev:server:local`
2. Starting the frontend: `npm run dev:client`
3. Navigating to a world → adventure → character selection
4. Testing the premade character creation and game spawning flow

The migrations have been tested for basic SQL syntax and should work correctly with your existing database schema.
