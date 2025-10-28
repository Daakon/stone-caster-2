-- Check if rulesets table exists and what its schema is
-- Run this to see what's actually in your database

-- Check if rulesets table exists
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rulesets' AND table_schema = 'public') 
    THEN 'EXISTS' 
    ELSE 'DOES NOT EXIST' 
  END as table_status;

-- If it exists, show the schema
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default,
  ordinal_position
FROM information_schema.columns 
WHERE table_name = 'rulesets' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'rulesets';
