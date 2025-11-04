# Supabase Seed Data & Admin Setup

This directory contains seed data and instructions for setting up the database.

## Admin User Setup

To create an admin user during initial setup:

1. **Create a user account** via Supabase Auth (or your auth provider)

2. **Get the user's UUID** from `auth.users` table:
   ```sql
   SELECT id, email FROM auth.users WHERE email = 'your-admin@example.com';
   ```

3. **Update the profiles table** to set admin role:
   ```sql
   UPDATE public.profiles
   SET role = 'admin',
       approved_by = (SELECT id FROM auth.users WHERE email = 'your-admin@example.com'),
       approval_note = 'Initial admin setup'
   WHERE id = '<user-uuid-from-step-2>';
   ```

   Or if the profile doesn't exist yet:
   ```sql
   INSERT INTO public.profiles (id, role, approved_by, approval_note)
   VALUES (
     '<user-uuid-from-step-2>',
     'admin',
     '<user-uuid-from-step-2>', -- self-approved
     'Initial admin setup'
   );
   ```

4. **Verify admin access**:
   ```sql
   SELECT id, role, joined_at FROM public.profiles WHERE role = 'admin';
   ```

5. **Test admin endpoint**:
   ```bash
   curl -H "Authorization: Bearer <admin-jwt-token>" \
        https://your-api.com/api/internal/flags
   ```

## Early Access Role Management

### Roles

- `pending`: Default role for new users (no access)
- `early_access`: Early access users (can access gameplay)
- `member`: Full members (can access all features)
- `admin`: Administrators (full access + admin endpoints)

### Promoting Users

To promote a user to early access:

```sql
UPDATE public.profiles
SET role = 'early_access',
    approved_by = '<admin-user-id>',
    approval_note = 'Promoted to early access'
WHERE id = '<user-uuid>';
```

### Bulk Promotion

To promote multiple users:

```sql
UPDATE public.profiles
SET role = 'early_access',
    approved_by = '<admin-user-id>',
    approval_note = 'Bulk promotion to early access'
WHERE id IN (
  SELECT id FROM auth.users 
  WHERE email IN ('user1@example.com', 'user2@example.com')
);
```

## Environment Variables

Set the `EARLY_ACCESS_MODE` environment variable:

- **Backend (Fly.io)**: Set `EARLY_ACCESS_MODE=on` or `EARLY_ACCESS_MODE=off`
- **Frontend Worker (Cloudflare)**: Set `EARLY_ACCESS_MODE=on` or `EARLY_ACCESS_MODE=off` in Wrangler secrets

Default is `'on'` if not set (with warning).

## Verification

After setup, verify:

1. **Profiles table exists**:
   ```sql
   SELECT COUNT(*) FROM public.profiles;
   ```

2. **RLS policies are active**:
   ```sql
   SELECT tablename, policyname FROM pg_policies WHERE tablename = 'profiles';
   ```

3. **is_admin() function works**:
   ```sql
   -- As admin user
   SELECT public.is_admin(); -- Should return true
   
   -- As non-admin user
   SELECT public.is_admin(); -- Should return false
   ```

4. **Admin endpoint works**:
   ```bash
   curl -H "Authorization: Bearer <admin-token>" \
        https://your-api.com/api/internal/flags
   ```

