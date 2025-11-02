-- Phase 3.1: Transaction support and idempotency for game creation
-- This migration adds:
-- 1. Stored procedure for atomic game+turn insert
-- 2. Extends idempotency_keys table to support game-scope (key-only) idempotency

BEGIN;

-- ============================================================================
-- STEP 1: Create/Extend idempotency_keys table if needed
-- ============================================================================

-- Check if idempotency_keys table exists, create if not
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  owner_id text,
  game_id uuid, -- Nullable for game-scope idempotency (before game exists)
  operation text NOT NULL DEFAULT 'turn',
  request_hash text NOT NULL,
  response_data jsonb NOT NULL,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Add unique constraint on (key, operation) for game-scope idempotency
-- When game_id is NULL, this allows key+operation uniqueness for game creation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'idempotency_keys_key_operation_unique'
  ) THEN
    -- For game creation, we want unique (key, operation) when game_id is NULL
    -- For turn operations, we want unique (key, owner_id, game_id, operation)
    -- We'll handle this with a partial unique index
    CREATE UNIQUE INDEX idempotency_keys_key_operation_unique
      ON public.idempotency_keys (key, operation)
      WHERE game_id IS NULL;
    
    RAISE NOTICE 'Added unique index for game-scope idempotency (key, operation)';
  ELSE
    RAISE NOTICE 'Unique index on (key, operation) already exists';
  END IF;
END $$;

-- Add index for owner+game scoped lookups
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_owner_game
  ON public.idempotency_keys (owner_id, game_id, operation)
  WHERE owner_id IS NOT NULL AND game_id IS NOT NULL;

-- Add index on key for fast lookups
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_key
  ON public.idempotency_keys (key);

-- ============================================================================
-- STEP 2: Stored Procedure for Atomic Game+Turn Insert
-- ============================================================================

CREATE OR REPLACE FUNCTION public.spawn_game_v3_atomic(
  -- Game parameters
  p_entry_point_id text,
  p_entry_point_type text,
  p_world_id uuid,
  p_ruleset_id text,
  p_character_id uuid,
  p_world_slug text,
  p_state_snapshot jsonb,
  p_user_id uuid,
  p_cookie_group_id uuid,
  -- Turn parameters
  p_turn_role text DEFAULT 'narrator',
  p_turn_content text,
  p_turn_meta jsonb,
  -- Return values
  OUT game_id uuid,
  OUT turn_id bigint,
  OUT turn_number integer,
  OUT error_code text,
  OUT error_message text
)
RETURNS RECORD
LANGUAGE plpgsql
SECURITY DEFINER -- Run with function creator's privileges (service role)
AS $$
DECLARE
  v_game_id uuid;
  v_turn_id bigint;
  v_turn_number integer;
BEGIN
  -- Phase 5: Function safety - set timeouts and search path at the top
  SET LOCAL statement_timeout = '10s';
  SET LOCAL idle_in_transaction_session_timeout = '10s';
  SET LOCAL search_path TO public;

  -- Initialize return values
  game_id := NULL;
  turn_id := NULL;
  turn_number := NULL;
  error_code := NULL;
  error_message := NULL;

  -- Insert game
  INSERT INTO public.games (
    entry_point_id,
    entry_point_type,
    world_id,
    ruleset_id,
    character_id,
    world_slug,
    state_snapshot,
    turn_count,
    status,
    user_id,
    cookie_group_id,
    created_at,
    updated_at,
    last_played_at
  ) VALUES (
    p_entry_point_id,
    p_entry_point_type,
    p_world_id,
    p_ruleset_id,
    p_character_id,
    p_world_slug,
    p_state_snapshot,
    0, -- turn_count starts at 0, first turn will be 1
    'active',
    p_user_id,
    p_cookie_group_id,
    now(),
    now(),
    now()
  )
  RETURNING id INTO v_game_id;

  IF v_game_id IS NULL THEN
    error_code := 'GAME_CREATE_ERROR';
    error_message := 'Failed to create game';
    RETURN;
  END IF;

  -- Insert first turn (trigger will assign turn_number=1)
  INSERT INTO public.turns (
    game_id,
    role,
    content,
    meta,
    created_at
  ) VALUES (
    v_game_id,
    p_turn_role,
    p_turn_content,
    p_turn_meta,
    now()
  )
  RETURNING id, turn_number INTO v_turn_id, v_turn_number;

  IF v_turn_id IS NULL THEN
    -- Rollback game insert
    DELETE FROM public.games WHERE id = v_game_id;
    error_code := 'TURN_CREATE_ERROR';
    error_message := 'Failed to create first turn';
    RETURN;
  END IF;

  -- Success: return values
  game_id := v_game_id;
  turn_id := v_turn_id;
  turn_number := v_turn_number;

EXCEPTION
  WHEN unique_violation THEN
    -- Unique constraint violation (game_id, turn_number or idempotency key)
    IF v_game_id IS NOT NULL THEN
      DELETE FROM public.games WHERE id = v_game_id;
    END IF;
    error_code := 'DB_CONFLICT';
    error_message := 'Unique constraint violation: ' || SQLERRM;
  WHEN foreign_key_violation THEN
    IF v_game_id IS NOT NULL THEN
      DELETE FROM public.games WHERE id = v_game_id;
    END IF;
    error_code := 'FK_VIOLATION';
    error_message := 'Foreign key violation: ' || SQLERRM;
  WHEN OTHERS THEN
    IF v_game_id IS NOT NULL THEN
      DELETE FROM public.games WHERE id = v_game_id;
    END IF;
    error_code := 'INTERNAL_ERROR';
    error_message := 'Unexpected error: ' || SQLERRM;
END;
$$;

-- Grant execute permission to service role (already has it via SECURITY DEFINER, but be explicit)
GRANT EXECUTE ON FUNCTION public.spawn_game_v3_atomic TO service_role;

-- Add comment
COMMENT ON FUNCTION public.spawn_game_v3_atomic IS
  'Atomically creates a game and its first turn. Returns game_id, turn_id, turn_number on success, or error_code and error_message on failure. Handles rollback internally.';

-- ============================================================================
-- STEP 3: Verify FK constraint on turns.game_id (should already exist)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname LIKE '%turns_game_id%'
    AND contype = 'f'
  ) THEN
    -- Add FK if missing
    ALTER TABLE public.turns
      ADD CONSTRAINT fk_turns_game_id
      FOREIGN KEY (game_id) REFERENCES public.games(id)
      ON DELETE CASCADE;
    RAISE NOTICE 'Added FK constraint on turns.game_id';
  ELSE
    RAISE NOTICE 'FK constraint on turns.game_id already exists';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK NOTES
-- ============================================================================
/*
To rollback this migration:

1. Drop function:
   DROP FUNCTION IF EXISTS public.spawn_game_v3_atomic;

2. Drop unique index:
   DROP INDEX IF EXISTS idempotency_keys_key_operation_unique;

3. Drop additional indexes:
   DROP INDEX IF EXISTS idx_idempotency_keys_owner_game;
   DROP INDEX IF EXISTS idx_idempotency_keys_key;

4. Note: idempotency_keys table may be used elsewhere, so don't drop it unless
   you're sure it's safe. The table structure changes are additive only.
*/

