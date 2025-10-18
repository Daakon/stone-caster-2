-- Assign prompt_admin role to user daakon13@gmail.com
-- User ID: b5c9906f-63ed-4234-afd8-7a8e5cf12085

-- Step 1: Add the role
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "prompt_admin"}'::jsonb
WHERE id = 'b5c9906f-63ed-4234-afd8-7a8e5cf12085';

-- Step 2: Verify the role was added
SELECT id, email, raw_user_meta_data 
FROM auth.users 
WHERE id = 'b5c9906f-63ed-4234-afd8-7a8e5cf12085';







