-- Add visibility column to worlds_admin view
-- This ensures the visibility field is available when loading worlds for editing

BEGIN;

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
  w.visibility,
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

COMMENT ON VIEW public.worlds_admin IS 'Admin view of worlds with UUID identity from world_id_mapping (or fallback), including status, visibility, and description. Uses LEFT JOIN so all worlds appear even without mappings.';

COMMIT;

