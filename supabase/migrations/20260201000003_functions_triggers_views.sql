-- StoneCaster canonical local baseline (4/6): functions, triggers, views.
-- Bodies are copied from hosted. Deliberate differences (see docs/local-supabase/RLS_CHANGES.md):
--   * SECURITY DEFINER functions now pin search_path.
--   * Execute privileges on privileged role-management functions are revoked from anon/authenticated (000005).
--   * Legacy functions that reference tables which do not exist on hosted either (characters, game_saves,
--     stone_wallets, guest_stone_wallets, stone_ledger, turns, liveops_*, prompt_segments, ...) are omitted.
set search_path to public, extensions;

-- ---------- generic updated_at triggers ----------
create or replace function public.update_updated_at_column() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create or replace function public.tg_touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create or replace function public.update_mechanics_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create or replace function public.update_chimera_instances_v3_modtime() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create or replace function public.update_cookie_member_last_seen() returns trigger language plpgsql as $$
begin new.last_seen_at = now(); return new; end; $$;
create or replace function public.update_experiment_variations_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create or replace function public.update_experiments_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create or replace function public.update_injection_map_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create or replace function public.update_npc_personalities_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create or replace function public.update_quest_graphs_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ---------- prompt housekeeping ----------
create or replace function public.generate_content_hash(content text) returns text language plpgsql as $$
begin return encode(extensions.digest(content, 'sha256'), 'hex'); end; $$;
create or replace function public.auto_generate_prompt_hash() returns trigger language plpgsql as $$
begin new.hash = public.generate_content_hash(new.content); return new; end; $$;
create or replace function public.auto_increment_prompt_version() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    select coalesce(max(version), 0) + 1 into new.version from public.prompts where slug = new.slug and scope = new.scope;
  end if;
  return new;
end; $$;
create or replace function public.ensure_single_active_prompt() returns trigger language plpgsql as $$
begin
  if new.active = true then
    update public.prompts set active = false where slug = new.slug and scope = new.scope and id != new.id;
  end if;
  return new;
end; $$;

create or replace function public.sync_chimera_worlds_owner_ids() returns trigger language plpgsql as $$
begin
  if new.owner_user_id is not null and (old.owner_user_id is distinct from new.owner_user_id) then new.owner_id = new.owner_user_id; end if;
  if new.owner_id is not null and (old.owner_id is distinct from new.owner_id) then new.owner_user_id = new.owner_id; end if;
  return new;
end; $$;

-- ---------- role helpers ----------
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
create or replace function public.is_moderator_or_admin() returns boolean language plpgsql security definer set search_path = public as $$
begin
  return exists (select 1 from public.app_roles ar where ar.user_id = auth.uid() and ar.role in ('moderator', 'admin'));
end; $$;
create or replace function public.user_has_role(user_uuid uuid, role_name text) returns boolean language plpgsql security definer set search_path = public as $$
begin return exists (select 1 from public.app_roles where user_id = user_uuid and role = role_name); end; $$;
create or replace function public.assign_admin_role(user_uuid uuid) returns void language plpgsql security definer set search_path = public as $$
begin insert into public.app_roles (user_id, role) values (user_uuid, 'admin') on conflict (user_id, role) do nothing; end; $$;
create or replace function public.assign_moderator_role(user_uuid uuid) returns void language plpgsql security definer set search_path = public as $$
begin insert into public.app_roles (user_id, role) values (user_uuid, 'moderator') on conflict (user_id, role) do nothing; end; $$;
create or replace function public.remove_user_roles(user_uuid uuid) returns void language plpgsql security definer set search_path = public as $$
begin delete from public.app_roles where user_id = user_uuid; end; $$;
create or replace function public.get_user_role(p_auth_user_id uuid) returns text language plpgsql as $$
declare user_role text;
begin
  select role into user_role from public.user_profiles where auth_user_id = p_auth_user_id;
  return coalesce(user_role, 'user');
end; $$;
create or replace function public.update_user_role(p_auth_user_id uuid, p_role text) returns void language plpgsql as $$
begin update public.user_profiles set role = p_role, updated_at = now() where auth_user_id = p_auth_user_id; end; $$;

-- ---------- user profile / auth signup ----------
create or replace function public.create_user_profile_on_auth_signup() returns trigger language plpgsql security definer set search_path = public as $$
declare v_display_name varchar(100); v_email varchar(255);
begin
  v_display_name := coalesce(split_part(new.email, '@', 1), 'User_' || substr(new.id::text, 1, 8));
  v_email := new.email;
  insert into public.user_profiles (auth_user_id, display_name, email, created_at, updated_at)
  values (new.id, v_display_name, v_email, now(), now());
  return new;
exception when others then
  raise warning 'Failed to create user profile for auth user %: %', new.id, sqlerrm;
  return new;
end; $$;

create or replace function public.get_user_profile_by_auth_id(p_auth_user_id uuid)
returns table(id uuid, auth_user_id uuid, cookie_group_id uuid, display_name varchar, avatar_url text, email varchar, role text,
              preferences jsonb, last_seen_at timestamptz, created_at timestamptz, updated_at timestamptz)
language plpgsql as $$
begin
  return query select up.id, up.auth_user_id, up.cookie_group_id, up.display_name, up.avatar_url, up.email, up.role,
                      up.preferences, up.last_seen_at, up.created_at, up.updated_at
               from public.user_profiles up where up.auth_user_id = p_auth_user_id;
end; $$;
create or replace function public.update_user_last_seen(p_auth_user_id uuid) returns void language plpgsql as $$
begin update public.user_profiles set last_seen_at = now(), updated_at = now() where auth_user_id = p_auth_user_id; end; $$;
create or replace function public.update_user_profile(p_auth_user_id uuid, p_display_name varchar default null, p_avatar_url text default null, p_preferences jsonb default null)
returns void language plpgsql as $$
begin
  update public.user_profiles set
    display_name = coalesce(p_display_name, display_name), avatar_url = coalesce(p_avatar_url, avatar_url),
    preferences = coalesce(p_preferences, preferences), last_seen_at = now(), updated_at = now()
  where auth_user_id = p_auth_user_id;
end; $$;

-- ---------- guest cookie linking (only the functions whose tables exist) ----------
create or replace function public.create_cookie_group_with_member(p_cookie_id uuid, p_device_label text default null) returns uuid language plpgsql as $$
declare v_group_id uuid;
begin
  insert into public.cookie_groups (id) values (default) returning id into v_group_id;
  insert into public.cookie_group_members (cookie_id, group_id, device_label) values (p_cookie_id, v_group_id, p_device_label);
  return v_group_id;
end; $$;
create or replace function public.get_user_id_from_cookie(p_cookie_id uuid) returns uuid language plpgsql as $$
declare v_user_id uuid;
begin select user_id into v_user_id from public.cookie_user_links where cookie_id = p_cookie_id; return v_user_id; end; $$;
create or replace function public.link_cookie_to_user(p_cookie_id uuid, p_user_id uuid) returns boolean language plpgsql as $$
begin
  insert into public.cookie_user_links (cookie_id, user_id) values (p_cookie_id, p_user_id)
  on conflict (cookie_id) do update set user_id = excluded.user_id, updated_at = now();
  return true;
exception when others then return false;
end; $$;
create or replace function public.link_cookie_group_to_user(p_auth_user_id uuid, p_cookie_group_id uuid) returns void language plpgsql as $$
begin
  update public.user_profiles set cookie_group_id = p_cookie_group_id, updated_at = now() where auth_user_id = p_auth_user_id;
  update public.cookie_groups set user_id = p_auth_user_id, updated_at = now() where id = p_cookie_group_id;
end; $$;

-- ---------- NPC personality / media / telemetry helpers ----------
create or replace function public.get_npc_personality(p_npc_ref text, p_world_ref text, p_adventure_ref text default null)
returns table(traits jsonb, summary text, last_updated timestamptz, snapshot_version integer) language plpgsql as $$
begin
  return query select np.traits, np.summary, np.last_updated, np.snapshot_version from public.npc_personalities np
  where np.npc_ref = p_npc_ref and np.world_ref = p_world_ref
    and (np.adventure_ref = p_adventure_ref or (np.adventure_ref is null and p_adventure_ref is null))
  order by np.last_updated desc limit 1;
end; $$;
create or replace function public.update_npc_personality(p_npc_ref text, p_world_ref text, p_adventure_ref text default null,
  p_traits jsonb default null, p_summary text default null, p_session_id text default null) returns uuid language plpgsql as $$
declare v_id uuid; v_new_version integer; v_existing_id uuid;
begin
  select coalesce(max(snapshot_version), 0) + 1 into v_new_version from public.npc_personalities where npc_ref = p_npc_ref and world_ref = p_world_ref;
  select id into v_existing_id from public.npc_personalities
   where npc_ref = p_npc_ref and world_ref = p_world_ref and (adventure_ref = p_adventure_ref or (adventure_ref is null and p_adventure_ref is null));
  if v_existing_id is not null then
    update public.npc_personalities set traits = coalesce(p_traits, traits), summary = coalesce(p_summary, summary),
      snapshot_version = v_new_version, derived_from_session = p_session_id, last_updated = now()
    where id = v_existing_id returning id into v_id;
  else
    insert into public.npc_personalities (npc_ref, world_ref, adventure_ref, traits, summary, snapshot_version, derived_from_session)
    values (p_npc_ref, p_world_ref, p_adventure_ref, coalesce(p_traits, '{}'::jsonb), p_summary, v_new_version, p_session_id)
    returning id into v_id;
  end if;
  return v_id;
end; $$;
create or replace function public.reorder_media_links(p_link_orders jsonb) returns void language plpgsql as $$
declare link_order jsonb;
begin
  for link_order in select * from jsonb_array_elements(p_link_orders) loop
    update public.media_links set sort_order = (link_order->>'sortOrder')::int where id = (link_order->>'linkId')::uuid;
  end loop;
end; $$;
create or replace function public.cleanup_old_telemetry_events(retention_days integer default 30) returns integer language plpgsql as $$
declare deleted_count integer;
begin
  delete from public.telemetry_events where created_at < now() - interval '1 day' * retention_days;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end; $$;

-- ---------- triggers ----------
create trigger access_requests_touch_updated_at before update on public.access_requests for each row execute function public.tg_touch_updated_at();
create trigger sync_chimera_worlds_owner_ids_trigger before insert or update on public.chimera_worlds for each row execute function public.sync_chimera_worlds_owner_ids();
create trigger trigger_auto_generate_prompt_hash before insert or update on public.prompts for each row execute function public.auto_generate_prompt_hash();
create trigger trigger_auto_increment_prompt_version before insert on public.prompts for each row execute function public.auto_increment_prompt_version();
create trigger trigger_ensure_single_active_prompt before insert or update on public.prompts for each row execute function public.ensure_single_active_prompt();
create trigger trigger_chimera_instances_v3_modtime before update on public.chimera_instances_v3 for each row execute function public.update_chimera_instances_v3_modtime();
create trigger trigger_update_cookie_member_last_seen before update on public.cookie_group_members for each row execute function public.update_cookie_member_last_seen();
create trigger trigger_update_experiment_variations_updated_at before update on public.experiment_variations for each row execute function public.update_experiment_variations_updated_at();
create trigger trigger_update_experiments_updated_at before update on public.experiments for each row execute function public.update_experiments_updated_at();
create trigger trigger_update_injection_map_updated_at before update on public.injection_map for each row execute function public.update_injection_map_updated_at();
create trigger trigger_update_mechanics_conditions_updated_at before update on public.mechanics_conditions for each row execute function public.update_mechanics_updated_at();
create trigger trigger_update_mechanics_resources_updated_at before update on public.mechanics_resources for each row execute function public.update_mechanics_updated_at();
create trigger trigger_update_mechanics_skills_updated_at before update on public.mechanics_skills for each row execute function public.update_mechanics_updated_at();
create trigger trigger_update_npc_personalities_updated_at before update on public.npc_personalities for each row execute function public.update_npc_personalities_updated_at();
create trigger trigger_update_quest_graphs_updated_at before update on public.quest_graphs for each row execute function public.update_quest_graphs_updated_at();

do $$
declare t text;
begin
  foreach t in array array['ai_config','app_config','author_drafts','author_workspaces','chimera_entities','chimera_game_states','chimera_lore',
    'chimera_ruleset_templates','chimera_worlds','config_meta','cookie_groups','creator_namespaces','creators','dialogue_config','dialogue_graphs',
    'feature_flags','payment_sessions','premade_characters','pricing_config','prompts','user_profiles']
  loop
    execute format('create trigger update_%s_updated_at before update on public.%I for each row execute function public.update_updated_at_column()', t, t);
  end loop;
end $$;

-- Hosted signup hook: every new auth user gets a user_profiles row.
create trigger trigger_create_user_profile after insert on auth.users for each row execute function public.create_user_profile_on_auth_signup();

-- ---------- views ----------
create or replace view public.profiles_view as
  select p.id, p.role, p.is_verified_creator, au.updated_at, au.created_at, au.email, au.last_sign_in_at, au.raw_user_meta_data
  from public.profiles p join auth.users au on p.id = au.id;
create or replace view public.v_days_90 as select (current_date - offs) as day from generate_series(0, 89) offs;
