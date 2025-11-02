-- Fix worlds_admin view to use LEFT JOIN so all worlds appear
-- Also backfill missing mappings for existing worlds

BEGIN;

-- First, backfill any missing world_id_mapping entries
INSERT INTO public.world_id_mapping (text_id, uuid_id)
SELECT 
  w.id as text_id,
  -- If the world id looks like a UUID, use it; otherwise generate one
  CASE 
    WHEN w.id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN w.id::uuid
    ELSE gen_random_uuid()
  END as uuid_id
FROM public.worlds w
WHERE NOT EXISTS (
  SELECT 1 FROM public.world_id_mapping wm WHERE wm.text_id = w.id
)
ON CONFLICT (text_id) DO NOTHING;

-- Now recreate the view with LEFT JOIN so all worlds appear
DROP VIEW IF EXISTS public.worlds_admin;

CREATE VIEW public.worlds_admin AS
SELECT 
  COALESCE(wm.uuid_id, 
    CASE 
      WHEN w.id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
      THEN w.id::uuid
      ELSE gen_random_uuid() -- Fallback for non-UUID IDs (shouldn't happen but safe)
    END
  ) as id,
  COALESCE(wm.name, w.name) as name,
  w.id as text_id,
  w.slug,
  w.status,
  w.description,
  w.version,
  w.doc,
  w.created_at,
  w.updated_at
FROM public.worlds w
LEFT JOIN public.world_id_mapping wm ON w.id = wm.text_id
WHERE w.version = (
  SELECT MAX(version) 
  FROM public.worlds w2 
  WHERE w2.id = w.id
);

COMMENT ON VIEW public.worlds_admin IS 'Admin view of worlds with UUID identity from world_id_mapping (or fallback), including status and description. Uses LEFT JOIN so all worlds appear even without mappings.';

COMMIT;

