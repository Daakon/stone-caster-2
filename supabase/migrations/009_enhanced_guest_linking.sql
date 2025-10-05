-- Enhanced Guest Linking Migration: Comprehensive data migration for guest-to-auth upgrades
-- This migration enhances the guest linking system to properly migrate all guest data

-- Function to comprehensively link guest account to authenticated user
CREATE OR REPLACE FUNCTION link_guest_account_to_user(
  p_auth_user_id UUID,
  p_cookie_group_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  characters_migrated INTEGER,
  games_migrated INTEGER,
  stones_migrated INTEGER,
  ledger_entries_created INTEGER
) AS $$
DECLARE
  v_characters_count INTEGER := 0;
  v_games_count INTEGER := 0;
  v_stones_migrated INTEGER := 0;
  v_ledger_entries INTEGER := 0;
  v_guest_wallet_balance INTEGER := 0;
  v_user_wallet_id UUID;
  v_guest_wallet_id UUID;
BEGIN
  -- Check if already linked
  IF EXISTS (
    SELECT 1 FROM cookie_groups 
    WHERE id = p_cookie_group_id AND user_id IS NOT NULL
  ) THEN
    RETURN QUERY SELECT TRUE, 0, 0, 0, 0;
    RETURN;
  END IF;

  -- Get guest wallet balance
  SELECT gsw.casting_stones INTO v_guest_wallet_balance
  FROM guest_stone_wallets gsw
  WHERE gsw.group_id = p_cookie_group_id;

  -- Get or create user's main wallet
  SELECT sw.id INTO v_user_wallet_id
  FROM stone_wallets sw
  WHERE sw.user_id = p_auth_user_id;

  IF v_user_wallet_id IS NULL THEN
    -- Create user wallet if it doesn't exist
    INSERT INTO stone_wallets (user_id, casting_stones, inventory_shard, inventory_crystal, inventory_relic, daily_regen, last_regen_at)
    VALUES (p_auth_user_id, 0, 0, 0, 0, 0, NOW())
    RETURNING id INTO v_user_wallet_id;
  END IF;

  -- Migrate guest wallet balance to user wallet
  IF v_guest_wallet_balance > 0 THEN
    UPDATE stone_wallets
    SET casting_stones = casting_stones + v_guest_wallet_balance,
        updated_at = NOW()
    WHERE id = v_user_wallet_id;
    
    v_stones_migrated := v_guest_wallet_balance;
    
    -- Create ledger entry for stone migration
    INSERT INTO stone_ledger (user_id, transaction_type, amount, balance_after, metadata, created_at)
    VALUES (
      p_auth_user_id,
      'GUEST_LINK_MIGRATION',
      v_guest_wallet_balance,
      (SELECT casting_stones FROM stone_wallets WHERE id = v_user_wallet_id),
      jsonb_build_object(
        'source', 'guest_wallet',
        'cookie_group_id', p_cookie_group_id,
        'migration_type', 'guest_to_auth'
      ),
      NOW()
    );
    
    v_ledger_entries := v_ledger_entries + 1;
  END IF;

  -- Migrate characters from guest to user
  UPDATE characters
  SET user_id = p_auth_user_id,
      cookie_id = NULL,
      updated_at = NOW()
  WHERE cookie_id IN (
    SELECT cookie_id FROM cookie_group_members WHERE group_id = p_cookie_group_id
  );

  GET DIAGNOSTICS v_characters_count = ROW_COUNT;

  -- Migrate games from guest to user
  UPDATE game_saves
  SET user_id = p_auth_user_id,
      cookie_id = NULL,
      updated_at = NOW()
  WHERE cookie_id IN (
    SELECT cookie_id FROM cookie_group_members WHERE group_id = p_cookie_group_id
  );

  GET DIAGNOSTICS v_games_count = ROW_COUNT;

  -- Link cookie group to user profile
  UPDATE user_profiles
  SET cookie_group_id = p_cookie_group_id,
      updated_at = NOW()
  WHERE auth_user_id = p_auth_user_id;

  -- Update cookie group to link user
  UPDATE cookie_groups
  SET user_id = p_auth_user_id,
      updated_at = NOW()
  WHERE id = p_cookie_group_id;

  -- Create comprehensive ledger entry for the linking operation
  INSERT INTO stone_ledger (user_id, transaction_type, amount, balance_after, metadata, created_at)
  VALUES (
    p_auth_user_id,
    'LINK_MERGE',
    0,
    (SELECT casting_stones FROM stone_wallets WHERE id = v_user_wallet_id),
    jsonb_build_object(
      'cookie_group_id', p_cookie_group_id,
      'characters_migrated', v_characters_count,
      'games_migrated', v_games_count,
      'stones_migrated', v_stones_migrated,
      'migration_type', 'guest_to_auth',
      'timestamp', NOW()
    ),
    NOW()
  );

  v_ledger_entries := v_ledger_entries + 1;

  -- Clean up guest wallet
  DELETE FROM guest_stone_wallets WHERE group_id = p_cookie_group_id;

  RETURN QUERY SELECT TRUE, v_characters_count, v_games_count, v_stones_migrated, v_ledger_entries;
END;
$$ LANGUAGE plpgsql;

-- Function to check if guest account has data to migrate
CREATE OR REPLACE FUNCTION check_guest_account_data(p_cookie_group_id UUID)
RETURNS TABLE (
  has_characters BOOLEAN,
  has_games BOOLEAN,
  has_stones BOOLEAN,
  character_count INTEGER,
  game_count INTEGER,
  stone_balance INTEGER
) AS $$
DECLARE
  v_character_count INTEGER := 0;
  v_game_count INTEGER := 0;
  v_stone_balance INTEGER := 0;
BEGIN
  -- Count characters
  SELECT COUNT(*) INTO v_character_count
  FROM characters c
  JOIN cookie_group_members cgm ON c.cookie_id = cgm.cookie_id
  WHERE cgm.group_id = p_cookie_group_id;

  -- Count games
  SELECT COUNT(*) INTO v_game_count
  FROM game_saves gs
  JOIN cookie_group_members cgm ON gs.cookie_id = cgm.cookie_id
  WHERE cgm.group_id = p_cookie_group_id;

  -- Get stone balance
  SELECT COALESCE(gsw.casting_stones, 0) INTO v_stone_balance
  FROM guest_stone_wallets gsw
  WHERE gsw.group_id = p_cookie_group_id;

  RETURN QUERY SELECT 
    v_character_count > 0,
    v_game_count > 0,
    v_stone_balance > 0,
    v_character_count,
    v_game_count,
    v_stone_balance;
END;
$$ LANGUAGE plpgsql;

-- Function to get guest account summary for linking
CREATE OR REPLACE FUNCTION get_guest_account_summary(p_cookie_group_id UUID)
RETURNS TABLE (
  cookie_group_id UUID,
  device_label TEXT,
  created_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  character_count INTEGER,
  game_count INTEGER,
  stone_balance INTEGER,
  has_data BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cg.id as cookie_group_id,
    cgm.device_label,
    cg.created_at,
    cgm.last_seen_at,
    COALESCE(char_data.character_count, 0) as character_count,
    COALESCE(game_data.game_count, 0) as game_count,
    COALESCE(gsw.casting_stones, 0) as stone_balance,
    (COALESCE(char_data.character_count, 0) > 0 OR 
     COALESCE(game_data.game_count, 0) > 0 OR 
     COALESCE(gsw.casting_stones, 0) > 0) as has_data
  FROM cookie_groups cg
  JOIN cookie_group_members cgm ON cg.id = cgm.group_id
  LEFT JOIN guest_stone_wallets gsw ON cg.id = gsw.group_id
  LEFT JOIN (
    SELECT cgm2.group_id, COUNT(*) as character_count
    FROM characters c
    JOIN cookie_group_members cgm2 ON c.cookie_id = cgm2.cookie_id
    GROUP BY cgm2.group_id
  ) char_data ON cg.id = char_data.group_id
  LEFT JOIN (
    SELECT cgm3.group_id, COUNT(*) as game_count
    FROM game_saves gs
    JOIN cookie_group_members cgm3 ON gs.cookie_id = cgm3.cookie_id
    GROUP BY cgm3.group_id
  ) game_data ON cg.id = game_data.group_id
  WHERE cg.id = p_cookie_group_id;
END;
$$ LANGUAGE plpgsql;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_characters_cookie_id ON characters(cookie_id);
CREATE INDEX IF NOT EXISTS idx_game_saves_cookie_id ON game_saves(cookie_id);
CREATE INDEX IF NOT EXISTS idx_stone_ledger_user_id ON stone_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_stone_ledger_transaction_type ON stone_ledger(transaction_type);

-- Add RLS policies for the new functions
-- Note: These functions are called by the service role, so RLS is handled at the application level
