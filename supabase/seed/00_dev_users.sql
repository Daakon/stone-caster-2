-- Deterministic LOCAL-ONLY dev users. Never applied to hosted. All share the password: stonecaster-dev
--   admin@stonecaster.local   (admin, approved)      00000000-0000-4000-8000-00000000a001
--   player@stonecaster.local  (early_access, approved)   00000000-0000-4000-8000-00000000b001
--   pending@stonecaster.local (pending access)       00000000-0000-4000-8000-00000000c001
-- 00_ runs first so that base content (10_base_*) can be owned by the local admin.
set search_path to public, extensions;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, confirmation_token, recovery_token,
  email_change_token_new, email_change, email_change_token_current, reauthentication_token, phone_change, phone_change_token,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       extensions.crypt('stonecaster-dev', extensions.gen_salt('bf')), now(), '', '', '', '', '', '', '', '',
       '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('display_name', u.name),
       '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', false, false
from (values
  ('00000000-0000-4000-8000-00000000a001'::uuid, 'admin@stonecaster.local',   'Local Admin'),
  ('00000000-0000-4000-8000-00000000b001'::uuid, 'player@stonecaster.local',  'Local Player'),
  ('00000000-0000-4000-8000-00000000c001'::uuid, 'pending@stonecaster.local', 'Pending User')
) as u(id, email, name)
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
       now(), now(), now()
from auth.users u where u.email like '%@stonecaster.local'
on conflict (provider_id, provider) do nothing;

-- user_profiles rows are created by trigger_create_user_profile; polish display names.
update public.user_profiles set display_name = 'Local Admin'  where auth_user_id = '00000000-0000-4000-8000-00000000a001';
update public.user_profiles set display_name = 'Local Player' where auth_user_id = '00000000-0000-4000-8000-00000000b001';
update public.user_profiles set display_name = 'Pending User' where auth_user_id = '00000000-0000-4000-8000-00000000c001';

insert into public.profiles (id, role, approval_note) values
  ('00000000-0000-4000-8000-00000000a001', 'admin',   'local dev fixture'),
  ('00000000-0000-4000-8000-00000000b001', 'early_access', 'local dev fixture'),
  ('00000000-0000-4000-8000-00000000c001', 'pending', 'local dev fixture')
on conflict (id) do nothing;

insert into public.app_roles (user_id, role) values
  ('00000000-0000-4000-8000-00000000a001', 'admin'),
  ('00000000-0000-4000-8000-00000000a001', 'moderator')
on conflict do nothing;

insert into public.access_requests (email, user_id, status, approved_by, approved_at, note) values
  ('admin@stonecaster.local',   '00000000-0000-4000-8000-00000000a001', 'approved', '00000000-0000-4000-8000-00000000a001', now(), 'local dev fixture'),
  ('player@stonecaster.local',  '00000000-0000-4000-8000-00000000b001', 'approved', '00000000-0000-4000-8000-00000000a001', now(), 'local dev fixture'),
  ('pending@stonecaster.local', '00000000-0000-4000-8000-00000000c001', 'pending',  null, null, 'local dev fixture');
