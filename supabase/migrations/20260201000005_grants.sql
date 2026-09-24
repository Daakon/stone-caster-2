-- StoneCaster canonical local baseline (6/6): least-privilege grants.
-- RLS (000004) is the row gate; these grants are the table/column gate. Hosted granted ALL (incl. TRUNCATE) on every table to anon.
set search_path to public, extensions;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;

revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

-- Views that expose auth.users columns are service-only (hosted views run as owner and ignore RLS).
revoke all on public.profiles_view, public.v_days_90 from anon, authenticated;

-- Column-level write gates: users must not be able to rewrite their own privilege columns.
revoke update on public.profiles from authenticated;
grant update (role, approved_by, approval_note, role_version, is_verified_creator) on public.profiles to authenticated; -- admin policy only
revoke update on public.user_profiles from authenticated;
grant update (display_name, avatar_url, preferences, last_seen_at, cookie_group_id, public_bio, profile_image_url, website_url,
              pending_avatar_image_url, creator_slug) on public.user_profiles to authenticated;

revoke update on public.ai_audit_logs from authenticated;
grant update (turn_id) on public.ai_audit_logs to authenticated; -- audit rows are otherwise immutable to clients

-- Privileged SECURITY DEFINER helpers were callable by anon through PostgREST on hosted (self-promote to admin).
revoke execute on function public.assign_admin_role(uuid), public.assign_moderator_role(uuid), public.remove_user_roles(uuid),
  public.user_has_role(uuid, text), public.update_user_role(uuid, text), public.cleanup_old_telemetry_events(integer)
  from public, anon, authenticated;
grant execute on function public.assign_admin_role(uuid), public.assign_moderator_role(uuid), public.remove_user_roles(uuid),
  public.user_has_role(uuid, text), public.update_user_role(uuid, text), public.cleanup_old_telemetry_events(integer) to service_role;
-- Policies call these as the invoking role.
grant execute on function public.is_admin(), public.is_moderator_or_admin() to anon, authenticated, service_role;
