-- Check current npcs table schema
-- Run this to see what columns actually exist in your npcs table

SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default,
  ordinal_position
FROM information_schema.columns 
WHERE table_name = 'npcs' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
