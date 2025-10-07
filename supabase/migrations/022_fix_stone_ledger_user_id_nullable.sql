-- Fix stone_ledger user_id nullable constraint
-- This migration ensures user_id can be NULL for guest users

-- First, drop the existing foreign key constraint
ALTER TABLE stone_ledger DROP CONSTRAINT IF EXISTS stone_ledger_user_id_fkey;

-- Make user_id nullable
ALTER TABLE stone_ledger ALTER COLUMN user_id DROP NOT NULL;

-- Re-add the foreign key constraint but allow NULL values
ALTER TABLE stone_ledger ADD CONSTRAINT stone_ledger_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update the comment
COMMENT ON COLUMN stone_ledger.user_id IS 'User ID for authenticated users, NULL for guest users';

-- Update RLS policies to handle NULL user_id
DROP POLICY IF EXISTS "Users can view their own ledger entries" ON stone_ledger;
DROP POLICY IF EXISTS "System can insert ledger entries" ON stone_ledger;

-- Create new RLS policies that handle NULL user_id
CREATE POLICY "Users can view their own ledger entries" ON stone_ledger
  FOR SELECT USING (
    user_id IS NULL OR auth.uid() = user_id
  );

CREATE POLICY "System can insert ledger entries" ON stone_ledger
  FOR INSERT WITH CHECK (
    user_id IS NULL OR auth.uid() = user_id
  );

-- Add index for cookie_group_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_stone_ledger_cookie_group_id ON stone_ledger(cookie_group_id);
