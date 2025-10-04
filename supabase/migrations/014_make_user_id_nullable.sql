-- Migration to make user_id nullable in characters table
-- This fixes the constraint issue where user_id was NOT NULL but constraints allow it to be NULL

-- Make user_id nullable in characters table
ALTER TABLE characters ALTER COLUMN user_id DROP NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN characters.user_id IS 'User ID for authenticated users, NULL for guest users';
