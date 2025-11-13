-- Admin Media Phase 2e: Publish Preflight Support
-- Adds RPC function for atomic reorder and ensures content_type column exists

BEGIN;

-- Ensure content_type column exists (idempotent)
ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS content_type text NULL;

-- Create RPC function for atomic reorder of media_links
-- Phase 2e refinement: Enforces ownership/admin checks and publish lock
CREATE OR REPLACE FUNCTION public.reorder_media_links(
  p_link_orders jsonb,
  p_target_kind text,
  p_target_id text,
  p_user_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  link_order jsonb;
  link_record record;
  entity_record record;
  is_user_admin boolean;
  target_column text;
  link_world_id text;
  link_story_id text;
  link_npc_id uuid;
BEGIN
  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_user_id AND role = 'admin'
    UNION
    SELECT 1 FROM public.app_roles WHERE user_id = p_user_id AND role = 'admin'
  ) INTO is_user_admin;

  -- Determine target column based on kind
  target_column := CASE p_target_kind
    WHEN 'world' THEN 'world_id'
    WHEN 'story' THEN 'story_id'
    WHEN 'npc' THEN 'npc_id'
    ELSE NULL
  END;

  IF target_column IS NULL THEN
    RAISE EXCEPTION 'Invalid target kind: %', p_target_kind;
  END IF;

  -- Load entity to check ownership and publish status
  IF p_target_kind = 'world' THEN
    SELECT owner_user_id, publish_status INTO entity_record
    FROM public.worlds WHERE id = p_target_id;
  ELSIF p_target_kind = 'story' THEN
    SELECT owner_user_id, publish_status INTO entity_record
    FROM public.entry_points WHERE id = p_target_id;
  ELSIF p_target_kind = 'npc' THEN
    SELECT owner_user_id, publish_status INTO entity_record
    FROM public.npcs WHERE id = p_target_id::uuid;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target entity not found';
  END IF;

  -- Check publish lock: if published and not admin, deny
  IF entity_record.publish_status = 'published' AND NOT is_user_admin THEN
    RAISE EXCEPTION 'Cannot modify published entity';
  END IF;

  -- Check ownership: if not owner and not admin, deny
  IF entity_record.owner_user_id != p_user_id AND NOT is_user_admin THEN
    RAISE EXCEPTION 'You do not own this entity';
  END IF;

  -- Verify all links belong to the target and update in transaction
  FOR link_order IN SELECT * FROM jsonb_array_elements(p_link_orders)
  LOOP
    -- Load link and verify it belongs to target
    SELECT world_id, story_id, npc_id INTO link_world_id, link_story_id, link_npc_id
    FROM public.media_links
    WHERE id = (link_order->>'linkId')::uuid;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Link not found: %', link_order->>'linkId';
    END IF;

    -- Verify link belongs to target based on kind
    IF p_target_kind = 'world' THEN
      IF link_world_id IS DISTINCT FROM p_target_id THEN
        RAISE EXCEPTION 'Link does not belong to target entity';
      END IF;
    ELSIF p_target_kind = 'story' THEN
      IF link_story_id IS DISTINCT FROM p_target_id THEN
        RAISE EXCEPTION 'Link does not belong to target entity';
      END IF;
    ELSIF p_target_kind = 'npc' THEN
      IF link_npc_id IS DISTINCT FROM p_target_id::uuid THEN
        RAISE EXCEPTION 'Link does not belong to target entity';
      END IF;
    END IF;

    -- Update sort_order
    UPDATE public.media_links
    SET sort_order = (link_order->>'sortOrder')::int
    WHERE id = (link_order->>'linkId')::uuid;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.reorder_media_links IS 'Atomically reorder media links by updating sort_order for multiple links in a single transaction';

COMMIT;

