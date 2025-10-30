-- Check the entry_points table constraints
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.entry_points'::regclass
  AND contype = 'c';








