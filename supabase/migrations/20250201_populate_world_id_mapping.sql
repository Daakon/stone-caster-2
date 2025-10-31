-- Populate world_id_mapping table with UUID <-> text slug mappings
-- This ensures proper resolution between UUIDs and text slugs

BEGIN;

-- Insert mapping for mystika world (from your entry_points data)
-- This maps the UUID from entry_points.world_id to the text slug "mystika"
INSERT INTO public.world_id_mapping (uuid_id, text_id)
VALUES ('e271c88b-6fa4-4761-bc8a-169e13b2db84', 'mystika')
ON CONFLICT (uuid_id) DO NOTHING;

-- If you have other worlds, add them here following the same pattern:
-- INSERT INTO public.world_id_mapping (uuid_id, text_id)
-- VALUES ('other-world-uuid', 'other-world-slug')
-- ON CONFLICT (uuid_id) DO NOTHING;

COMMIT;

