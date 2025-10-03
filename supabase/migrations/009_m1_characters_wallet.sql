-- Layer M1 - Characters & Wallet Foundations Migration
-- Adds world validation, guest support, and wallet access controls

-- Add world_slug column to characters table
ALTER TABLE characters ADD COLUMN IF NOT EXISTS world_slug VARCHAR(100);

-- Add cookie_id column to characters table for guest support
ALTER TABLE characters ADD COLUMN IF NOT EXISTS cookie_id UUID;

-- Add constraint to ensure either user_id or cookie_id is present (but not both)
ALTER TABLE characters ADD CONSTRAINT characters_owner_check 
  CHECK (
    (user_id IS NOT NULL AND cookie_id IS NULL) OR 
    (user_id IS NULL AND cookie_id IS NOT NULL)
  );

-- Create index for world_slug lookups
CREATE INDEX IF NOT EXISTS idx_characters_world_slug ON characters(world_slug);

-- Create index for cookie_id lookups
CREATE INDEX IF NOT EXISTS idx_characters_cookie_id ON characters(cookie_id);

-- Update RLS policies to support both authenticated users and guests
DROP POLICY IF EXISTS "Users can view their own characters" ON characters;
DROP POLICY IF EXISTS "Users can insert their own characters" ON characters;
DROP POLICY IF EXISTS "Users can update their own characters" ON characters;
DROP POLICY IF EXISTS "Users can delete their own characters" ON characters;

-- New RLS policies that support both authenticated users and guests
CREATE POLICY "Users can view their own characters"
  ON characters FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND cookie_id IS NOT NULL)
  );

CREATE POLICY "Users can insert their own characters"
  ON characters FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND cookie_id IS NOT NULL)
  );

CREATE POLICY "Users can update their own characters"
  ON characters FOR UPDATE
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND cookie_id IS NOT NULL)
  );

CREATE POLICY "Users can delete their own characters"
  ON characters FOR DELETE
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND cookie_id IS NOT NULL)
  );

-- Add service role policies for server-side operations
CREATE POLICY "Service role can manage all characters"
  ON characters FOR ALL
  TO service_role
  USING (TRUE);

-- Update stone_wallets table to support guest users
-- Add cookie_group_id column for guest wallets
ALTER TABLE stone_wallets ADD COLUMN IF NOT EXISTS cookie_group_id UUID REFERENCES cookie_groups(id) ON DELETE CASCADE;

-- Update constraint to ensure either user_id or cookie_group_id is present (but not both)
ALTER TABLE stone_wallets DROP CONSTRAINT IF EXISTS stone_wallets_user_id_key;
ALTER TABLE stone_wallets ADD CONSTRAINT stone_wallets_owner_check 
  CHECK (
    (user_id IS NOT NULL AND cookie_group_id IS NULL) OR 
    (user_id IS NULL AND cookie_group_id IS NOT NULL)
  );

-- Create index for cookie_group_id lookups
CREATE INDEX IF NOT EXISTS idx_stone_wallets_cookie_group_id ON stone_wallets(cookie_group_id);

-- Update RLS policies for stone_wallets to support guests
DROP POLICY IF EXISTS "Users can view their own wallet" ON stone_wallets;
DROP POLICY IF EXISTS "Users can update their own wallet" ON stone_wallets;
DROP POLICY IF EXISTS "System can insert wallets for users" ON stone_wallets;

-- New RLS policies that support both authenticated users and guests
CREATE POLICY "Users can view their own wallet"
  ON stone_wallets FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND cookie_group_id IS NOT NULL)
  );

CREATE POLICY "Users can update their own wallet"
  ON stone_wallets FOR UPDATE
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND cookie_group_id IS NOT NULL)
  );

CREATE POLICY "System can insert wallets for users and guests"
  ON stone_wallets FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND cookie_group_id IS NOT NULL)
  );

-- Add service role policies for server-side operations
CREATE POLICY "Service role can manage all wallets"
  ON stone_wallets FOR ALL
  TO service_role
  USING (TRUE);

-- Update stone_ledger table to support guest users
-- Add cookie_group_id column for guest ledger entries
ALTER TABLE stone_ledger ADD COLUMN IF NOT EXISTS cookie_group_id UUID REFERENCES cookie_groups(id) ON DELETE CASCADE;

-- Update constraint to ensure either user_id or cookie_group_id is present (but not both)
ALTER TABLE stone_ledger ADD CONSTRAINT stone_ledger_owner_check 
  CHECK (
    (user_id IS NOT NULL AND cookie_group_id IS NULL) OR 
    (user_id IS NULL AND cookie_group_id IS NOT NULL)
  );

-- Create index for cookie_group_id lookups
CREATE INDEX IF NOT EXISTS idx_stone_ledger_cookie_group_id ON stone_ledger(cookie_group_id);

-- Update RLS policies for stone_ledger to support guests
DROP POLICY IF EXISTS "Users can view their own ledger entries" ON stone_ledger;
DROP POLICY IF EXISTS "System can insert ledger entries" ON stone_ledger;

-- New RLS policies that support both authenticated users and guests
CREATE POLICY "Users can view their own ledger entries"
  ON stone_ledger FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND cookie_group_id IS NOT NULL)
  );

CREATE POLICY "System can insert ledger entries for users and guests"
  ON stone_ledger FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND cookie_group_id IS NOT NULL)
  );

-- Add service role policies for server-side operations
CREATE POLICY "Service role can manage all ledger entries"
  ON stone_ledger FOR ALL
  TO service_role
  USING (TRUE);

-- Create function to get or create guest wallet
CREATE OR REPLACE FUNCTION get_or_create_guest_wallet(p_cookie_group_id UUID)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  -- Try to get existing wallet
  SELECT id INTO v_wallet_id
  FROM stone_wallets
  WHERE cookie_group_id = p_cookie_group_id;
  
  -- Create new wallet if it doesn't exist
  IF v_wallet_id IS NULL THEN
    INSERT INTO stone_wallets (cookie_group_id, casting_stones, inventory_shard, inventory_crystal, inventory_relic, daily_regen, last_regen_at)
    VALUES (p_cookie_group_id, 0, 0, 0, 0, 0, NOW())
    RETURNING id INTO v_wallet_id;
  END IF;
  
  RETURN v_wallet_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to validate world slug
CREATE OR REPLACE FUNCTION validate_world_slug(p_world_slug TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if world slug is in the allowed list
  -- This matches the worlds from the static content
  RETURN p_world_slug IN (
    'mystika',
    'aetherium', 
    'voidreach',
    'whispercross',
    'paragon-city',
    'veloria',
    'noctis-veil'
  );
END;
$$ LANGUAGE plpgsql;

-- Add trigger to validate world_slug on character creation/update
CREATE OR REPLACE FUNCTION validate_character_world_slug()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate world_slug if provided
  IF NEW.world_slug IS NOT NULL AND NOT validate_world_slug(NEW.world_slug) THEN
    RAISE EXCEPTION 'Invalid world slug: %', NEW.world_slug;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for world_slug validation
DROP TRIGGER IF EXISTS trigger_validate_character_world_slug ON characters;
CREATE TRIGGER trigger_validate_character_world_slug
  BEFORE INSERT OR UPDATE ON characters
  FOR EACH ROW
  EXECUTE FUNCTION validate_character_world_slug();

-- Add comments for documentation
COMMENT ON COLUMN characters.world_slug IS 'World identifier from static content (e.g., mystika, aetherium)';
COMMENT ON COLUMN characters.cookie_id IS 'Guest cookie ID for guest users (mutually exclusive with user_id)';
COMMENT ON COLUMN stone_wallets.cookie_group_id IS 'Guest cookie group ID for guest wallets (mutually exclusive with user_id)';
COMMENT ON COLUMN stone_ledger.cookie_group_id IS 'Guest cookie group ID for guest ledger entries (mutually exclusive with user_id)';

-- Add function to migrate existing characters to have world_slug
-- This sets a default world_slug for existing characters
UPDATE characters 
SET world_slug = 'mystika' 
WHERE world_slug IS NULL;

-- Make world_slug NOT NULL after setting defaults
ALTER TABLE characters ALTER COLUMN world_slug SET NOT NULL;
