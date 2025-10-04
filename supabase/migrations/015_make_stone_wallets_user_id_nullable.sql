-- Migration to make user_id nullable in stone_wallets table
-- This enables guest users to have wallets

-- Make user_id nullable in stone_wallets table
ALTER TABLE stone_wallets ALTER COLUMN user_id DROP NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN stone_wallets.user_id IS 'User ID for authenticated users, NULL for guest users';
