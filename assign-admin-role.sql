-- Assign prompt_admin role to the current user
-- Replace 'your-user-id-here' with your actual user ID from the console logs

UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "prompt_admin"}'::jsonb
WHERE id = 'your-user-id-here';

-- To find your user ID, you can run this query first:
-- SELECT id, email, raw_user_meta_data FROM auth.users WHERE email = 'your-email@example.com';


