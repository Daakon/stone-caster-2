-- Fix worlds_admin view to include status and description fields
-- This view is used by the admin API to list worlds

DROP VIEW IF EXISTS public.worlds_admin;

CREATE VIEW public.worlds_admin AS
SELECT 
  wm.uuid_id as id,
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
JOIN public.world_id_mapping wm ON w.id = wm.text_id
WHERE w.version = (
  SELECT MAX(version) 
  FROM public.worlds w2 
  WHERE w2.id = w.id
);

COMMENT ON VIEW public.worlds_admin IS 'Admin view of worlds with UUID identity from world_id_mapping, including status and description';

