-- Migration to make user_id nullable in stone_ledger table
ALTER TABLE stone_ledger ALTER COLUMN user_id DROP NOT NULL;
COMMENT ON COLUMN stone_ledger.user_id IS 'User ID for authenticated users, NULL for guest users';
