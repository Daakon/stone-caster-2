-- F0a: first-party source ownership, guarded sync, content-addressed compiles, and reset markers.
-- This migration formalizes the prelaunch schema. The separate wipe in supabase/ops is never run here.
set search_path = pg_catalog, public, extensions;

create schema if not exists content_deploy;
revoke all on schema content_deploy from public;
revoke all on schema content_deploy from anon, authenticated, service_role;
revoke usage on schema public from public;
revoke execute on all functions in schema public from public;
alter default privileges for role postgres in schema public revoke execute on functions from public;
alter default privileges for role postgres in schema public grant execute on functions to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
revoke execute on function public.assign_admin_role(uuid), public.assign_moderator_role(uuid),
  public.remove_user_roles(uuid), public.user_has_role(uuid, text), public.update_user_role(uuid, text),
  public.cleanup_old_telemetry_events(integer) from public, anon, authenticated;
grant execute on function public.assign_admin_role(uuid), public.assign_moderator_role(uuid),
  public.remove_user_roles(uuid), public.user_has_role(uuid, text), public.update_user_role(uuid, text),
  public.cleanup_old_telemetry_events(integer) to service_role;

-- Supabase connection and platform roles still need schema lookup; the deploy login does not.
do $$
declare
  r text;
begin
  foreach r in array array['anon','authenticated','service_role','authenticator','dashboard_user','postgres','pg_database_owner',
    'supabase_admin','supabase_auth_admin','supabase_etl_admin','supabase_functions_admin','supabase_privileged_role',
    'supabase_read_only_user','supabase_replication_admin','supabase_storage_admin'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant usage on schema public to %I', r);
    end if;
  end loop;
end
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'stonecaster_content_sync_owner') then
    create role stonecaster_content_sync_owner nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'stonecaster_content_deployer') then
    create role stonecaster_content_deployer login noinherit;
  end if;
  if exists (
    select 1 from pg_roles
    where rolname in ('stonecaster_content_sync_owner','stonecaster_content_deployer')
      and (rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls)
  ) then
    raise exception 'F0a content roles must not have elevated PostgreSQL attributes';
  end if;
  alter role stonecaster_content_sync_owner nologin noinherit;
  alter role stonecaster_content_deployer login noinherit;
end
$$;
grant connect on database postgres to stonecaster_content_deployer;

-- Existing role names may predate this migration. Strip every membership and direct object grant
-- before assigning the deliberately narrow deploy contract below.
do $$
declare
begin
  if exists (
    select 1 from pg_auth_members
    where member = (select oid from pg_roles where rolname = 'stonecaster_content_deployer')
  ) then
    raise exception 'F0a content deploy role must not inherit membership in any other role';
  end if;
end
$$;

create table if not exists public.chimera_content_catalog_state (
  singleton boolean primary key default true check (singleton),
  generation bigint not null default 0 check (generation >= 0),
  updated_at timestamptz not null default now()
);
insert into public.chimera_content_catalog_state(singleton, generation)
values (true, 0) on conflict (singleton) do nothing;

create table if not exists public.chimera_content_source_items (
  content_kind text not null,
  owner_kind text not null default 'first_party' check (owner_kind = 'first_party'),
  owner_namespace text not null default 'first_party' check (owner_namespace = 'first_party'),
  owner_user_id uuid,
  content_key text not null check (length(content_key) between 1 and 160),
  content_format_version integer not null check (content_format_version > 0),
  body jsonb not null check (jsonb_typeof(body) in ('object', 'array')),
  content_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(content_refs) = 'array'),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  release_state text not null default 'internal' check (release_state in ('internal', 'published')),
  catalog_generation bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (content_kind, owner_namespace, content_key),
  check (owner_user_id is null)
);

create table if not exists public.chimera_content_deploy_log (
  id uuid primary key,
  catalog_generation bigint not null,
  manifest_hash text not null check (manifest_hash ~ '^[0-9a-f]{64}$'),
  item_count integer not null check (item_count >= 0),
  deployed_by name not null,
  created_at timestamptz not null default now()
);

create table if not exists public.chimera_content_blobs (
  sha256 text primary key check (sha256 ~ '^[0-9a-f]{64}$'),
  format_version integer not null check (format_version > 0),
  body jsonb not null,
  byte_count bigint not null check (byte_count >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.chimera_compiled_content_refs (
  compiled_story_id uuid not null,
  role text not null check (length(role) between 1 and 64),
  kind text not null,
  owner_namespace text not null,
  content_key text not null,
  sha256 text not null,
  primary key (compiled_story_id, role, kind, owner_namespace, content_key),
  foreign key (compiled_story_id) references public.chimera_compiled_stories(id) on delete cascade,
  foreign key (sha256) references public.chimera_content_blobs(sha256) on delete restrict
);

alter table public.chimera_compiled_stories
  add column if not exists source_manifest jsonb not null default '[]'::jsonb,
  add column if not exists catalog_generation bigint,
  add column if not exists payload_blob_hash text,
  add column if not exists frozen_owner_user_id uuid,
  add column if not exists frozen_title text;
alter table public.chimera_compiled_stories alter column story_id drop not null;
do $$
begin
  if exists (select 1 from public.chimera_compiled_stories where payload_blob_hash is null) then
    raise exception 'F0a requires the approved prelaunch reset before replacing legacy mutable compiled stories';
  end if;
end
$$;
alter table public.chimera_compiled_stories alter column payload_blob_hash set not null;
alter table public.chimera_compiled_stories drop constraint if exists chimera_compiled_stories_story_id_fkey;
alter table public.chimera_compiled_stories drop constraint if exists chimera_compiled_stories_payload_blob_hash_fkey;
alter table public.chimera_compiled_stories
  add constraint chimera_compiled_stories_story_id_fkey
  foreign key (story_id) references public.chimera_stories(id) on delete set null;
alter table public.chimera_compiled_stories
  add constraint chimera_compiled_stories_payload_blob_hash_fkey
  foreign key (payload_blob_hash) references public.chimera_content_blobs(sha256) on delete restrict;

alter table public.chimera_game_states add column if not exists compiled_story_id uuid;
alter table public.chimera_game_states alter column story_id drop not null;
do $$
begin
  if exists (select 1 from public.chimera_game_states where compiled_story_id is null) then
    raise exception 'F0a requires the approved prelaunch wipe before pinning existing game states to a compiled story';
  end if;
end
$$;
alter table public.chimera_game_states alter column compiled_story_id set not null;
alter table public.chimera_game_states drop constraint if exists chimera_game_states_compiled_story_id_fkey;
alter table public.chimera_game_states
  add constraint chimera_game_states_compiled_story_id_fkey
  foreign key (compiled_story_id) references public.chimera_compiled_stories(id) on delete restrict;

alter table public.chimera_player_characters alter column world_id drop not null;
alter table public.chimera_player_characters drop constraint if exists chimera_player_characters_world_id_fkey;
alter table public.chimera_player_characters
  add constraint chimera_player_characters_world_id_fkey
  foreign key (world_id) references public.chimera_worlds(id) on delete set null;

-- Add the same ownership and content identity fields to each authorable source table.
-- Existing owner IDs are retained; unowned system/catalog rows become first-party rows.
do $$
declare
  t text;
  has_unowned boolean;
  source_tables text[] := array[
    'chimera_ruleset_templates', 'chimera_worlds', 'chimera_entities', 'chimera_lore',
    'chimera_tags', 'chimera_asset_tags', 'chimera_assets', 'chimera_exclusion_groups',
    'chimera_world_ruleset_link', 'chimera_content_packs', 'chimera_content_pack_entity_links',
    'chimera_content_pack_lore_links', 'chimera_content_pack_ruleset_links', 'chimera_pack_dependencies',
    'chimera_stories', 'chimera_story_links', 'chimera_story_entity_links',
    'chimera_story_content_pack_links', 'chimera_story_compiled_ruleset',
    'mechanics_skills', 'mechanics_conditions', 'mechanics_resources', 'premade_characters',
    'localization_glossary', 'localization_rules', 'localization_packs',
    'injection_map', 'dialogue_config', 'dialogue_graphs', 'quest_graphs', 'quest_graph_indexes'
  ];
begin
  foreach t in array source_tables loop
    execute format('alter table public.%I add column if not exists owner_kind text default ''player''', t);
    execute format('alter table public.%I add column if not exists owner_namespace text', t);
    execute format('alter table public.%I add column if not exists owner_user_id uuid', t);
    execute format('alter table public.%I add column if not exists content_key text', t);
    execute format('alter table public.%I add column if not exists content_format_version integer not null default 1', t);
    execute format('alter table public.%I add column if not exists content_hash text', t);
    execute format('alter table public.%I add column if not exists release_state text not null default ''internal''', t);
  end loop;

  -- Compatibility key columns are projections of content_key, not globally unique identities.
  alter table public.chimera_entities add column if not exists key text;

  foreach t in array source_tables loop
    execute format($q$
      update public.%1$I as target
      set owner_user_id = coalesce(target.owner_user_id, nullif(to_jsonb(target)->>'owner_id', '')::uuid),
          content_key = coalesce(
            nullif(to_jsonb(target)->>'content_key', ''), nullif(to_jsonb(target)->>'key', ''),
            nullif(to_jsonb(target)->>'slug', ''), nullif(to_jsonb(target)->>'tag_name', ''),
            nullif(to_jsonb(target)->>'archetype_key', ''), nullif(to_jsonb(target)->>'group_name', ''),
            nullif(to_jsonb(target)->>'name', ''), nullif(to_jsonb(target)->>'id', ''),
            nullif(concat_ws(':', nullif(to_jsonb(target)->>'pack_id', ''), nullif(to_jsonb(target)->>'asset_id', ''),
                      nullif(to_jsonb(target)->>'tag_id', ''), nullif(to_jsonb(target)->>'entity_template_id', ''),
                      nullif(to_jsonb(target)->>'lore_template_id', ''), nullif(to_jsonb(target)->>'ruleset_template_id', ''),
                      nullif(to_jsonb(target)->>'depends_on_pack_id', ''), nullif(to_jsonb(target)->>'story_id', ''),
                      nullif(to_jsonb(target)->>'world_id', '')), ''),
            md5(to_jsonb(target)::text)
          )
    $q$, t);

    if t in ('chimera_ruleset_templates', 'chimera_tags', 'chimera_exclusion_groups',
             'mechanics_skills', 'mechanics_conditions', 'mechanics_resources', 'premade_characters',
             'localization_glossary', 'localization_rules', 'localization_packs',
             'injection_map', 'dialogue_config', 'dialogue_graphs', 'quest_graphs', 'quest_graph_indexes') then
      execute format('update public.%I set owner_kind = ''first_party'', owner_user_id = null', t);
    elsif t in ('chimera_worlds', 'chimera_entities', 'chimera_lore') then
      execute format('select exists (select 1 from public.%I where owner_user_id is null and coalesce(is_official, false) = false)', t)
        into has_unowned;
      if has_unowned then
        raise exception 'F0a ownership migration found unowned non-official rows in %; reconcile them before migrating', t;
      end if;
      execute format('update public.%I set owner_kind = case when coalesce(is_official, false) then ''first_party'' else ''player'' end, owner_user_id = case when coalesce(is_official, false) then null else owner_user_id end', t);
    elsif t = 'chimera_stories' then
      execute $q$
        update public.chimera_stories set owner_kind = 'player', owner_user_id = owner_user_id
      $q$;
    elsif t = 'chimera_content_packs' then
      execute $q$
        update public.chimera_content_packs set owner_kind = 'player', owner_user_id = owner_user_id
      $q$;
    else
      execute format('update public.%I set owner_kind = case when owner_user_id is null then ''first_party'' else ''player'' end', t);
    end if;

    execute format($q$
      update public.%1$I set
        owner_namespace = case when owner_kind = 'first_party' then 'first_party' else owner_user_id::text end,
        content_hash = encode(extensions.digest(convert_to((to_jsonb(%1$I) - array['content_hash','created_at','updated_at','owner_user_id','owner_id','owner_namespace','owner_kind','content_key','release_state','is_official'])::text, 'UTF8'), 'sha256'), 'hex')
      where owner_namespace is null or content_hash is null
    $q$, t);

    execute format('alter table public.%I alter column owner_kind set not null', t);
    execute format('alter table public.%I alter column owner_namespace set not null', t);
    execute format('alter table public.%I alter column content_key set not null', t);
    execute format('alter table public.%I alter column content_hash set not null', t);
    execute format('alter table public.%I alter column owner_kind set default ''player''', t);
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_content_owner_check');
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_content_format_release_check');
    execute format('alter table public.%I add constraint %I check ((owner_kind = ''first_party'' and owner_namespace = ''first_party'' and owner_user_id is null) or (owner_kind = ''player'' and owner_user_id is not null and owner_namespace = owner_user_id::text))', t, t || '_content_owner_check');
    execute format('alter table public.%I add constraint %I check (content_format_version > 0 and release_state in (''internal'',''published''))', t, t || '_content_format_release_check');
    execute format('create unique index if not exists %I on public.%I(owner_namespace, content_key)', t || '_owner_key_uq', t);
  end loop;

  alter table public.chimera_ruleset_templates drop constraint if exists chimera_ruleset_templates_key_key;
  alter table public.chimera_worlds drop constraint if exists chimera_worlds_key_key;
  alter table public.chimera_entities drop constraint if exists chimera_entities_key_key;
  drop index if exists public.idx_chimera_worlds_slug;
  update public.chimera_entities set key = content_key;

  update public.chimera_world_ruleset_link rel
     set owner_kind = w.owner_kind, owner_user_id = w.owner_user_id,
         owner_namespace = w.owner_namespace,
         content_key = w.owner_namespace || ':' || w.content_key || ':' || r.owner_namespace || ':' || r.content_key
    from public.chimera_worlds w, public.chimera_ruleset_templates r
   where rel.world_id = w.id and rel.ruleset_template_id = r.id;
  update public.chimera_asset_tags rel
     set owner_kind = a.owner_kind, owner_user_id = a.owner_user_id,
         owner_namespace = a.owner_namespace,
         content_key = a.owner_namespace || ':' || a.content_key || ':' || t.owner_namespace || ':' || t.content_key
    from public.chimera_assets a, public.chimera_tags t
   where rel.asset_id = a.id and rel.tag_id = t.id;
  update public.chimera_content_pack_entity_links rel
     set owner_kind = p.owner_kind, owner_user_id = p.owner_user_id, owner_namespace = p.owner_namespace,
         content_key = p.owner_namespace || ':' || p.content_key || ':' || e.owner_namespace || ':' || e.content_key
    from public.chimera_content_packs p, public.chimera_entities e
   where rel.pack_id = p.id and rel.entity_template_id = e.id;
  update public.chimera_content_pack_lore_links rel
     set owner_kind = p.owner_kind, owner_user_id = p.owner_user_id, owner_namespace = p.owner_namespace,
         content_key = p.owner_namespace || ':' || p.content_key || ':' || l.owner_namespace || ':' || l.content_key
    from public.chimera_content_packs p, public.chimera_lore l
   where rel.pack_id = p.id and rel.lore_template_id = l.id::text;
  update public.chimera_content_pack_ruleset_links rel
     set owner_kind = p.owner_kind, owner_user_id = p.owner_user_id, owner_namespace = p.owner_namespace,
         content_key = p.owner_namespace || ':' || p.content_key || ':' || r.owner_namespace || ':' || r.content_key
    from public.chimera_content_packs p, public.chimera_ruleset_templates r
   where rel.pack_id = p.id and rel.ruleset_template_id = r.id;
  update public.chimera_pack_dependencies rel
     set owner_kind = p.owner_kind, owner_user_id = p.owner_user_id, owner_namespace = p.owner_namespace,
         content_key = p.owner_namespace || ':' || p.content_key || ':' || d.owner_namespace || ':' || d.content_key
    from public.chimera_content_packs p, public.chimera_content_packs d
   where rel.pack_id = p.id and rel.depends_on_pack_id = d.id;
  update public.chimera_story_links rel
     set owner_kind = s.owner_kind, owner_user_id = s.owner_user_id, owner_namespace = s.owner_namespace,
         content_key = s.owner_namespace || ':' || s.content_key || ':' || r.owner_namespace || ':' || r.content_key
    from public.chimera_stories s, public.chimera_ruleset_templates r
   where rel.story_id = s.id and rel.ruleset_template_id = r.id;
  update public.chimera_story_entity_links rel
     set owner_kind = s.owner_kind, owner_user_id = s.owner_user_id, owner_namespace = s.owner_namespace,
         content_key = s.owner_namespace || ':' || s.content_key || ':' || e.owner_namespace || ':' || e.content_key
    from public.chimera_stories s, public.chimera_entities e
   where rel.story_id = s.id and rel.entity_template_id = e.id;
  update public.chimera_story_content_pack_links rel
     set owner_kind = s.owner_kind, owner_user_id = s.owner_user_id, owner_namespace = s.owner_namespace,
         content_key = s.owner_namespace || ':' || s.content_key || ':' || p.owner_namespace || ':' || p.content_key
    from public.chimera_stories s, public.chimera_content_packs p
   where rel.story_id = s.id and rel.pack_id = p.id;
  update public.chimera_story_compiled_ruleset rel
     set owner_kind = s.owner_kind, owner_user_id = s.owner_user_id, owner_namespace = s.owner_namespace,
         content_key = s.owner_namespace || ':' || s.content_key
    from public.chimera_stories s where rel.story_id = s.id;
end
$$;

-- Canonical JSON serialization used by both stored hashes and the deploy function.
create or replace function public.content_canonical_json(p_value jsonb)
returns text language plpgsql immutable strict set search_path = pg_catalog
as $$
declare
  result text;
begin
  case jsonb_typeof(p_value)
    when 'object' then
      select '{' || coalesce(string_agg(to_json(key)::text || ':' || public.content_canonical_json(value), ',' order by key collate "C"), '') || '}'
        into result from jsonb_each(p_value);
      return result;
    when 'array' then
      select '[' || coalesce(string_agg(public.content_canonical_json(value), ',' order by ordinal), '') || ']'
        into result from jsonb_array_elements(p_value) with ordinality as items(value, ordinal);
      return result;
    else
      return p_value::text;
  end case;
end
$$;

create or replace function public.enforce_content_ownership()
returns trigger language plpgsql set search_path = pg_catalog, public, extensions
as $$
declare
  row_json jsonb;
  computed_key text;
  content_only jsonb;
  parent_kind text;
  parent_owner uuid;
begin
  if tg_op = 'DELETE' then
    if old.owner_kind = 'first_party' and current_user <> 'stonecaster_content_sync_owner' then
      raise exception 'first-party content can only be removed by the validated content sync function';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.owner_kind = 'first_party' and current_user <> 'stonecaster_content_sync_owner' then
    raise exception 'first-party content ownership is immutable outside the content sync function';
  end if;

  row_json := to_jsonb(new);
  if new.owner_user_id is null and row_json ? 'owner_id' and nullif(row_json->>'owner_id','') is not null then
    new.owner_user_id := (row_json->>'owner_id')::uuid;
  end if;
  if new.owner_user_id is null then
    if tg_table_name = 'chimera_lore' then
      if nullif(row_json->>'world_id','') is not null then
        select owner_kind, owner_user_id into parent_kind, parent_owner from public.chimera_worlds where id = (row_json->>'world_id')::uuid;
      elsif nullif(row_json->>'entity_id','') is not null then
        select owner_kind, owner_user_id into parent_kind, parent_owner from public.chimera_entities where id = (row_json->>'entity_id')::uuid;
      end if;
    elsif tg_table_name = 'chimera_world_ruleset_link' then
      select owner_kind, owner_user_id into parent_kind, parent_owner from public.chimera_worlds where id = (row_json->>'world_id')::uuid;
    elsif tg_table_name in ('chimera_content_pack_entity_links','chimera_content_pack_lore_links','chimera_content_pack_ruleset_links','chimera_pack_dependencies') then
      select owner_kind, owner_user_id into parent_kind, parent_owner from public.chimera_content_packs where id = (row_json->>'pack_id')::uuid;
    elsif tg_table_name in ('chimera_story_links','chimera_story_entity_links','chimera_story_content_pack_links','chimera_story_compiled_ruleset') then
      select owner_kind, owner_user_id into parent_kind, parent_owner from public.chimera_stories where id = (row_json->>'story_id')::uuid;
    elsif tg_table_name = 'chimera_asset_tags' then
      select owner_kind, owner_user_id into parent_kind, parent_owner from public.chimera_assets where id = (row_json->>'asset_id')::uuid;
    end if;
    if parent_kind = 'first_party' then
      if current_user <> 'stonecaster_content_sync_owner' then raise exception 'players and service routes cannot author references to first-party content'; end if;
      new.owner_kind := 'first_party';
      new.owner_user_id := null;
    elsif parent_kind = 'player' and parent_owner is not null then
      new.owner_kind := 'player';
      new.owner_user_id := parent_owner;
    end if;
  end if;
  if new.owner_kind = 'first_party' then
    if current_user <> 'stonecaster_content_sync_owner' then
      raise exception 'only the content sync function may write first-party content';
    end if;
    new.owner_user_id := null;
    new.owner_namespace := 'first_party';
  elsif new.owner_kind = 'player' then
    if current_user = 'authenticated' then
      if auth.uid() is null then raise exception 'authenticated content writes require auth.uid()'; end if;
      if new.owner_user_id is not null and new.owner_user_id <> auth.uid() then raise exception 'content owner must match auth.uid()'; end if;
      new.owner_user_id := auth.uid();
    end if;
    if new.owner_user_id is null then raise exception 'player content requires an owner'; end if;
    new.owner_namespace := new.owner_user_id::text;
  else
    raise exception 'invalid content owner_kind';
  end if;

  computed_key := coalesce(nullif(new.content_key, ''), nullif(row_json->>'key', ''), nullif(row_json->>'slug', ''),
    nullif(row_json->>'tag_name', ''), nullif(row_json->>'archetype_key', ''), nullif(row_json->>'group_name', ''),
    nullif(row_json->>'name', ''), nullif(row_json->>'id', ''),
    nullif(concat_ws(':', nullif(row_json->>'pack_id', ''), nullif(row_json->>'asset_id', ''), nullif(row_json->>'tag_id', ''),
      nullif(row_json->>'entity_template_id', ''), nullif(row_json->>'lore_template_id', ''), nullif(row_json->>'ruleset_template_id', ''),
      nullif(row_json->>'depends_on_pack_id', ''), nullif(row_json->>'story_id', ''), nullif(row_json->>'world_id', '')), ''),
    encode(extensions.digest(convert_to(row_json::text, 'UTF8'), 'sha256'), 'hex'));
  new.content_key := computed_key;

  row_json := to_jsonb(new);
  if row_json ? 'key' then row_json := jsonb_set(row_json, '{key}', to_jsonb(computed_key)); end if;
  if tg_table_name = 'chimera_entities' and row_json ? 'slug' then row_json := jsonb_set(row_json, '{slug}', to_jsonb(computed_key)); end if;
  if row_json ? 'owner_id' then row_json := jsonb_set(row_json, '{owner_id}', coalesce(to_jsonb(new.owner_user_id), 'null'::jsonb)); end if;
  if row_json ? 'is_official' then row_json := jsonb_set(row_json, '{is_official}', to_jsonb(new.owner_kind = 'first_party')); end if;
  new := jsonb_populate_record(new, row_json);

  content_only := to_jsonb(new) - array['id','created_at','updated_at','owner_user_id','owner_id','owner_namespace','owner_kind','content_key','content_hash','release_state','is_official','catalog_generation'];
  new.content_hash := encode(extensions.digest(convert_to(public.content_canonical_json(content_only), 'UTF8'), 'sha256'), 'hex');
  row_json := to_jsonb(new);
  if row_json ? 'updated_at' then
    row_json := jsonb_set(row_json, '{updated_at}', to_jsonb(now()));
    new := jsonb_populate_record(new, row_json);
  end if;
  return new;
end
$$;

create or replace function public.publish_frozen_chimera_compile(
  p_expected_generation bigint,
  p_story_id uuid,
  p_title text,
  p_refs jsonb,
  p_payload jsonb
) returns uuid
language plpgsql security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  current_generation bigint;
  compiled_id uuid := gen_random_uuid();
  payload_hash text;
  payload_size bigint;
  blob_body jsonb;
  manifest jsonb := '[]'::jsonb;
  ref jsonb;
  source public.chimera_content_source_items%rowtype;
  source_hash text;
  item_count integer := 0;
  compile_version integer := 1;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'internal first-party compilation is restricted to admins';
  end if;
  if p_expected_generation is null or coalesce(length(trim(p_title)), 0) = 0 then
    raise exception 'compile generation and frozen title are required';
  end if;
  if jsonb_typeof(p_refs) <> 'array' or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid frozen compile payload';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_refs) items(value)
    group by value->>'role', value->>'kind', value->>'owner_namespace', value->>'key' having count(*) > 1
  ) then raise exception 'compiled source refs contain duplicate keys'; end if;

  select generation into current_generation
    from public.chimera_content_catalog_state where singleton for update;
  if current_generation <> p_expected_generation then
    raise exception 'content catalog changed during compile: expected %, found %', p_expected_generation, current_generation using errcode = '40001';
  end if;

  for ref in select value from jsonb_array_elements(p_refs)
              order by value->>'role', value->>'kind', value->>'owner_namespace', value->>'key' loop
    if ref->>'owner_namespace' <> 'first_party' or nullif(ref->>'role','') is null then
      raise exception 'invalid compiled source reference';
    end if;
    select * into source from public.chimera_content_source_items
      where content_kind = ref->>'kind'
        and owner_namespace = ref->>'owner_namespace'
        and content_key = ref->>'key'
      for share;
    if not found or source.content_hash <> ref->>'sha256' then
      raise exception 'source changed or is missing: %:%', ref->>'kind', ref->>'key' using errcode = '40001';
    end if;
    if source.release_state <> 'published' and source.release_state <> 'internal' then
      raise exception 'source has an invalid release state';
    end if;
    blob_body := jsonb_build_object('format_version',source.content_format_version,'body',source.body,'refs',source.content_refs);
    insert into public.chimera_content_blobs(sha256, format_version, body, byte_count)
    values (source.content_hash, source.content_format_version, blob_body,
      octet_length(convert_to(public.content_canonical_json(blob_body), 'UTF8')))
    on conflict (sha256) do nothing;
    if not exists (select 1 from public.chimera_content_blobs b where b.sha256 = source.content_hash
                   and b.format_version = source.content_format_version and b.body = blob_body) then
      raise exception 'content hash collision for %:%', source.content_kind, source.content_key;
    end if;
    manifest := manifest || jsonb_build_array(jsonb_build_object(
      'kind', source.content_kind, 'owner_namespace', source.owner_namespace,
      'key', source.content_key, 'sha256', source.content_hash
    ));
    item_count := item_count + 1;
  end loop;
  if item_count = 0 then raise exception 'frozen compile requires at least one source ref'; end if;
  if p_story_id is not null then
    if not exists (select 1 from public.chimera_stories where id = p_story_id) then
      raise exception 'source story not found';
    end if;
    select coalesce(max(version), 0) + 1 into compile_version
      from public.chimera_compiled_stories where story_id = p_story_id;
  end if;

  blob_body := jsonb_build_object('format_version',1,'body',p_payload,'refs','[]'::jsonb);
  payload_hash := encode(extensions.digest(convert_to(public.content_canonical_json(blob_body), 'UTF8'), 'sha256'), 'hex');
  payload_size := octet_length(convert_to(public.content_canonical_json(blob_body), 'UTF8'));
  insert into public.chimera_content_blobs(sha256, format_version, body, byte_count)
  values (payload_hash, 1, blob_body, payload_size) on conflict (sha256) do nothing;
  if not exists (select 1 from public.chimera_content_blobs b where b.sha256 = payload_hash and b.format_version = 1 and b.body = blob_body) then
    raise exception 'compiled payload hash collision';
  end if;

  insert into public.chimera_compiled_stories(
    id, story_id, version, config_engine, creation_manifest, snapshot_world, snapshot_entities,
    genesis_config, source_manifest, catalog_generation, payload_blob_hash, frozen_owner_user_id, frozen_title, is_active
  ) values (
    compiled_id, p_story_id, compile_version, '{}'::jsonb,
    '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
    '{}'::jsonb, manifest, current_generation, payload_hash,
    auth.uid(), p_title, true
  );
  insert into public.chimera_compiled_content_refs(compiled_story_id, role, kind, owner_namespace, content_key, sha256)
  select compiled_id, value->>'role', value->>'kind', value->>'owner_namespace', value->>'key', value->>'sha256'
    from jsonb_array_elements(p_refs);
  insert into public.chimera_compiled_content_refs(compiled_story_id, role, kind, owner_namespace, content_key, sha256)
  values (compiled_id, 'compiled_payload', 'compiled_payload', 'first_party', compiled_id::text, payload_hash);
  if p_story_id is not null then
    update public.chimera_stories set current_compiled_id = compiled_id, compile_status = 'compiled', updated_at = now()
      where id = p_story_id;
  end if;
  return compiled_id;
end
$$;

create or replace function public.bump_content_catalog_generation()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  update public.chimera_content_catalog_state
     set generation = generation + 1, updated_at = now()
   where singleton = true;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

create or replace function public.content_row_visible(p_row jsonb)
returns boolean language plpgsql stable security invoker set search_path = pg_catalog, public
as $$
declare
  kind text := p_row->>'owner_kind';
  release text := p_row->>'release_state';
  owner_id uuid := nullif(p_row->>'owner_user_id','')::uuid;
  visibility text := p_row->>'visibility';
begin
  if kind = 'first_party' then
    return release = 'published' or public.is_admin();
  end if;
  return owner_id = auth.uid() or visibility = 'public';
end
$$;

-- Apply the ownership boundary and catalog-generation fence to every authorable table.
do $$
declare
  policy_row record;
  t text;
  source_tables text[] := array[
    'chimera_ruleset_templates', 'chimera_worlds', 'chimera_entities', 'chimera_lore',
    'chimera_tags', 'chimera_asset_tags', 'chimera_assets', 'chimera_exclusion_groups',
    'chimera_world_ruleset_link', 'chimera_content_packs', 'chimera_content_pack_entity_links',
    'chimera_content_pack_lore_links', 'chimera_content_pack_ruleset_links', 'chimera_pack_dependencies',
    'chimera_stories', 'chimera_story_links', 'chimera_story_entity_links',
    'chimera_story_content_pack_links', 'chimera_story_compiled_ruleset',
    'mechanics_skills', 'mechanics_conditions', 'mechanics_resources', 'premade_characters',
    'localization_glossary', 'localization_rules', 'localization_packs',
    'injection_map', 'dialogue_config', 'dialogue_graphs', 'quest_graphs', 'quest_graph_indexes'
  ];
begin
  foreach t in array source_tables loop
    execute format('drop trigger if exists %I on public.%I', t || '_content_owner_guard', t);
    execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.enforce_content_ownership()', t || '_content_owner_guard', t);
    execute format('drop trigger if exists %I on public.%I', t || '_content_catalog_generation', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.bump_content_catalog_generation()', t || '_content_catalog_generation', t);
  end loop;
end
$$;

alter table public.chimera_content_source_items enable row level security;
drop policy if exists chimera_content_sources_read on public.chimera_content_source_items;
drop policy if exists chimera_content_sources_sync_owner on public.chimera_content_source_items;
create policy chimera_content_sources_read on public.chimera_content_source_items for select to anon, authenticated
  using ((release_state = 'published') or public.is_admin());
create policy chimera_content_sources_sync_owner on public.chimera_content_source_items for all to stonecaster_content_sync_owner
  using (true) with check (owner_kind = 'first_party' and owner_namespace = 'first_party');
revoke all on public.chimera_content_source_items from public, anon, authenticated, service_role;
grant select on public.chimera_content_source_items to anon, authenticated, service_role;

-- Remove the legacy official/public bypass policies and replace them with owner/release-aware access.
do $$
declare
  policy_row record;
  t text;
  source_tables text[] := array[
    'chimera_ruleset_templates', 'chimera_worlds', 'chimera_entities', 'chimera_lore',
    'chimera_tags', 'chimera_asset_tags', 'chimera_assets', 'chimera_exclusion_groups',
    'chimera_world_ruleset_link', 'chimera_content_packs', 'chimera_content_pack_entity_links',
    'chimera_content_pack_lore_links', 'chimera_content_pack_ruleset_links', 'chimera_pack_dependencies',
    'chimera_stories', 'chimera_story_links', 'chimera_story_entity_links',
    'chimera_story_content_pack_links', 'chimera_story_compiled_ruleset',
    'mechanics_skills', 'mechanics_conditions', 'mechanics_resources', 'premade_characters',
    'localization_glossary', 'localization_rules', 'localization_packs',
    'dialogue_config', 'dialogue_graphs', 'quest_graphs', 'quest_graph_indexes'
  ];
begin
  foreach t in array source_tables loop
    execute format('alter table public.%I enable row level security', t);
    for policy_row in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', policy_row.policyname, t);
    end loop;
    execute format('create policy %I on public.%I for select to anon, authenticated using (public.content_row_visible(to_jsonb(%I)))', t || '_content_read', t, t);
    execute format('create policy %I on public.%I for all to authenticated using (owner_kind = ''player'' and owner_user_id = auth.uid()) with check (owner_kind = ''player'' and owner_user_id = auth.uid())', t || '_player_write', t);
    execute format('create policy %I on public.%I for all to service_role using (true) with check (true)', t || '_service_compat', t);
  end loop;
end
$$;

-- Content blobs are immutable once inserted; compiled refs preserve the exact hashes they consume.
create or replace function public.prevent_content_blob_mutation()
returns trigger language plpgsql set search_path = pg_catalog, public
as $$
begin
  raise exception 'content blobs are immutable';
end
$$;
drop trigger if exists chimera_content_blobs_immutable on public.chimera_content_blobs;
create trigger chimera_content_blobs_immutable before update or delete on public.chimera_content_blobs
for each row execute function public.prevent_content_blob_mutation();

-- Narrow validation metadata exposed to the deploy login; it has no raw source or table access.
create or replace view content_deploy.validation_formats as
select kinds.content_kind, 1 as supported_format_version, state.generation as catalog_generation
from unnest(array['ruleset','world','entity','lore','tag','asset_tag','mechanic_skill','mechanic_condition',
  'mechanic_resource','premade_character','localization_glossary','localization_rule','localization_pack',
  'injection_map','dialogue_config','dialogue_graph','quest_graph','quest_graph_index','content_pack','exclusion_group',
  'world_ruleset_link','pack_entity_link','pack_lore_link','pack_ruleset_link','pack_dependency']) as kinds(content_kind)
cross join public.chimera_content_catalog_state state where state.singleton;

create or replace function content_deploy.content_sync_apply(
  p_expected_generation bigint,
  p_deploy_id uuid,
  p_bundle jsonb
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, content_deploy, extensions
as $$
declare
  current_generation bigint;
  next_generation bigint;
  item jsonb;
  ref jsonb;
  item_kind text;
  item_key text;
  item_namespace text;
  item_format integer;
  item_body jsonb;
  item_refs jsonb;
  item_document jsonb;
  item_hash text;
  manifest_parts text[] := array[]::text[];
  item_count integer := 0;
  manifest_hash text;
begin
  if session_user <> 'stonecaster_content_deployer' then
    raise exception 'content sync accepts only stonecaster_content_deployer';
  end if;
  if p_deploy_id is null or jsonb_typeof(p_bundle) <> 'object' or jsonb_typeof(p_bundle->'items') <> 'array' then
    raise exception 'invalid content sync bundle';
  end if;
  if p_expected_generation is null then raise exception 'expected catalog generation is required'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_bundle->'items') rows(value)
    group by value->>'kind', value->>'owner_namespace', value->>'key' having count(*) > 1
  ) then raise exception 'content sync bundle contains duplicate owner-scoped keys'; end if;

  select generation into current_generation from public.chimera_content_catalog_state where singleton for update;
  if current_generation <> p_expected_generation then
    raise exception 'content catalog generation changed: expected %, found %', p_expected_generation, current_generation using errcode = '40001';
  end if;

  for item in select value from jsonb_array_elements(p_bundle->'items') order by value->>'kind', value->>'owner_namespace', value->>'key' loop
    item_kind := item->>'kind';
    item_namespace := item->>'owner_namespace';
    item_key := item->>'key';
    item_format := nullif(item->>'format_version','')::integer;
    item_body := item->'body';
    item_refs := coalesce(item->'refs','[]'::jsonb);
    if item_kind not in ('ruleset','world','entity','lore','tag','asset_tag','mechanic_skill','mechanic_condition','mechanic_resource',
      'premade_character','localization_glossary','localization_rule','localization_pack','injection_map','dialogue_config','dialogue_graph',
      'quest_graph','quest_graph_index','content_pack','exclusion_group','world_ruleset_link','pack_entity_link','pack_lore_link',
      'pack_ruleset_link','pack_dependency') then
      raise exception 'unsupported content kind %', item_kind;
    end if;
    if item_namespace <> 'first_party' or item_key is null or item_key !~ '^[a-z0-9][a-z0-9._:-]{0,159}$' then
      raise exception 'invalid first-party content identity';
    end if;
    if item_format is null or item_format <> 1 or jsonb_typeof(item_body) <> 'object' or jsonb_typeof(item_refs) <> 'array' then
      raise exception 'unsupported content format for %:%', item_kind, item_key;
    end if;
    item_document := jsonb_build_object('format_version',item_format,'body',item_body,'refs',item_refs);
    item_hash := encode(extensions.digest(convert_to(public.content_canonical_json(item_document), 'UTF8'), 'sha256'), 'hex');
    for ref in select value from jsonb_array_elements(item_refs) loop
      if not exists (
        select 1 from jsonb_array_elements(p_bundle->'items') candidate(value)
         where candidate.value->>'kind' = ref->>'kind'
           and candidate.value->>'owner_namespace' = coalesce(ref->>'owner_namespace','first_party')
           and candidate.value->>'key' = ref->>'key'
      ) then
        raise exception 'dangling first-party key reference %:% -> %:%', item_kind, item_key, ref->>'kind', ref->>'key';
      end if;
    end loop;
    insert into public.chimera_content_source_items(content_kind, owner_namespace, content_key, content_format_version, body, content_refs, content_hash, release_state, catalog_generation)
    values (item_kind, item_namespace, item_key, item_format, item_body, item_refs, item_hash, 'internal', current_generation + 1)
    on conflict (content_kind, owner_namespace, content_key) do update
      set content_format_version = excluded.content_format_version,
          body = excluded.body,
          content_refs = excluded.content_refs,
          content_hash = excluded.content_hash,
          catalog_generation = excluded.catalog_generation,
          updated_at = now();
    manifest_parts := array_append(manifest_parts, item_kind || E'\t' || item_namespace || E'\t' || item_key || E'\t' || item_hash);
    item_count := item_count + 1;
  end loop;

  if item_count = 0 then raise exception 'refusing an empty content sync'; end if;
  manifest_hash := encode(extensions.digest(convert_to(array_to_string(manifest_parts, E'\n'), 'UTF8'), 'sha256'), 'hex');
  next_generation := current_generation + 1;
  update public.chimera_content_catalog_state set generation = next_generation, updated_at = now() where singleton;
  insert into public.chimera_content_deploy_log(id, catalog_generation, manifest_hash, item_count, deployed_by)
  values (p_deploy_id, next_generation, manifest_hash, item_count, session_user);
  return jsonb_build_object('generation', next_generation, 'manifest_hash', manifest_hash, 'item_count', item_count);
end
$$;

grant create on schema content_deploy to stonecaster_content_sync_owner;
do $$
declare
  existing_owner oid;
  sync_owner oid := (select oid from pg_roles where rolname = 'stonecaster_content_sync_owner');
begin
  select proowner into existing_owner from pg_proc where oid = 'content_deploy.content_sync_apply(bigint,uuid,jsonb)'::regprocedure;
  if existing_owner <> sync_owner then
    execute format('grant stonecaster_content_sync_owner to %I', current_user);
    alter function content_deploy.content_sync_apply(bigint, uuid, jsonb) owner to stonecaster_content_sync_owner;
    execute format('revoke stonecaster_content_sync_owner from %I', current_user);
  end if;
end
$$;
revoke create on schema content_deploy from stonecaster_content_sync_owner;
revoke all on function content_deploy.content_sync_apply(bigint, uuid, jsonb) from public;
revoke all on function content_deploy.content_sync_apply(bigint, uuid, jsonb) from anon, authenticated, service_role;
revoke execute on function public.content_canonical_json(jsonb), public.enforce_content_ownership(),
  public.bump_content_catalog_generation(), public.prevent_content_blob_mutation() from public, anon, authenticated, service_role;
grant execute on function public.content_row_visible(jsonb) to anon, authenticated;
revoke execute on function public.content_row_visible(jsonb) from public, service_role, stonecaster_content_deployer;
grant usage on schema content_deploy to stonecaster_content_deployer;
grant usage on schema content_deploy to stonecaster_content_sync_owner;
grant select on content_deploy.validation_formats to stonecaster_content_deployer;
grant execute on function content_deploy.content_sync_apply(bigint, uuid, jsonb) to stonecaster_content_deployer;
revoke all on schema public from stonecaster_content_deployer;
revoke all on all tables in schema public from stonecaster_content_deployer;
revoke all on all sequences in schema public from stonecaster_content_deployer;
revoke all on all functions in schema public from stonecaster_content_deployer;
revoke all on all tables in schema content_deploy from stonecaster_content_deployer;
grant select on content_deploy.validation_formats to stonecaster_content_deployer;

grant select, insert, update on public.chimera_content_source_items to stonecaster_content_sync_owner;
grant select, update on public.chimera_content_catalog_state to stonecaster_content_sync_owner;
grant insert on public.chimera_content_deploy_log to stonecaster_content_sync_owner;
grant usage on schema public, extensions to stonecaster_content_sync_owner;
grant execute on function public.content_canonical_json(jsonb) to stonecaster_content_sync_owner;
grant execute on function extensions.digest(bytea, text) to stonecaster_content_sync_owner;

alter table public.chimera_content_catalog_state enable row level security;
alter table public.chimera_content_deploy_log enable row level security;
alter table public.chimera_content_blobs enable row level security;
alter table public.chimera_compiled_content_refs enable row level security;
revoke all on public.chimera_content_deploy_log from public, anon, authenticated, service_role;
revoke all on public.chimera_content_catalog_state from public, anon, authenticated, service_role;
revoke all on public.chimera_content_blobs from public, anon, authenticated;
revoke all on public.chimera_compiled_content_refs from public, anon;
drop policy if exists chimera_content_catalog_sync_owner on public.chimera_content_catalog_state;
drop policy if exists chimera_content_deploy_log_sync_owner on public.chimera_content_deploy_log;
drop policy if exists chimera_content_catalog_admin_read on public.chimera_content_catalog_state;
create policy chimera_content_catalog_sync_owner on public.chimera_content_catalog_state for all to stonecaster_content_sync_owner
  using (singleton) with check (singleton);
create policy chimera_content_deploy_log_sync_owner on public.chimera_content_deploy_log for insert to stonecaster_content_sync_owner
  with check (true);
create policy chimera_content_catalog_admin_read on public.chimera_content_catalog_state for select to authenticated using (public.is_admin());
grant select on public.chimera_content_catalog_state to authenticated, service_role;
grant select on public.chimera_content_blobs, public.chimera_compiled_content_refs to authenticated, service_role;
grant insert on public.chimera_content_blobs to service_role;
grant insert, select on public.chimera_compiled_content_refs to service_role;

grant select on public.chimera_content_deploy_log to service_role;
grant execute on function public.content_row_visible(jsonb) to anon, authenticated;

-- Compiled story metadata is readable by its owner, administrators, and players with a pinned session.
do $$
declare
  policy_row record;
begin
  for policy_row in select policyname from pg_policies where schemaname = 'public' and tablename = 'chimera_compiled_stories' loop
    execute format('drop policy %I on public.chimera_compiled_stories', policy_row.policyname);
  end loop;
  for policy_row in select policyname from pg_policies where schemaname = 'public' and tablename = 'chimera_compiled_content_refs' loop
    execute format('drop policy %I on public.chimera_compiled_content_refs', policy_row.policyname);
  end loop;
  for policy_row in select policyname from pg_policies where schemaname = 'public' and tablename = 'chimera_content_blobs' loop
    execute format('drop policy %I on public.chimera_content_blobs', policy_row.policyname);
  end loop;
end
$$;
create policy chimera_compiled_stories_pinned_read on public.chimera_compiled_stories for select to authenticated
  using (frozen_owner_user_id = auth.uid() or public.is_admin()
    or exists (select 1 from public.chimera_game_states g where g.compiled_story_id = chimera_compiled_stories.id and g.player_id = auth.uid()));
create policy chimera_compiled_refs_pinned_read on public.chimera_compiled_content_refs for select to authenticated
  using (exists (select 1 from public.chimera_compiled_stories c where c.id = compiled_story_id
    and (c.frozen_owner_user_id = auth.uid() or public.is_admin()
      or exists (select 1 from public.chimera_game_states g where g.compiled_story_id = c.id and g.player_id = auth.uid()))));
create policy chimera_content_blobs_pinned_read on public.chimera_content_blobs for select to authenticated
  using (exists (select 1 from public.chimera_compiled_content_refs r join public.chimera_compiled_stories c on c.id = r.compiled_story_id
    where r.sha256 = chimera_content_blobs.sha256 and (c.frozen_owner_user_id = auth.uid() or public.is_admin()
      or exists (select 1 from public.chimera_game_states g where g.compiled_story_id = c.id and g.player_id = auth.uid()))));
revoke all on function public.publish_frozen_chimera_compile(bigint, uuid, text, jsonb, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.publish_frozen_chimera_compile(bigint, uuid, text, jsonb, jsonb) to authenticated, service_role;

create table if not exists public.chimera_launch_guard (
  id boolean primary key default true check (id),
  real_players_started_at timestamptz
);
insert into public.chimera_launch_guard(id) values (true) on conflict (id) do nothing;
create table if not exists public.chimera_prelaunch_resets (
  reset_key text primary key,
  backup_sha256 text not null check (backup_sha256 ~ '^[0-9a-f]{64}$'),
  operator_id uuid not null,
  completed_at timestamptz not null default now(),
  row_counts jsonb not null
);
revoke all on public.chimera_launch_guard, public.chimera_prelaunch_resets from public, anon, authenticated, service_role;

create or replace function public.enforce_irreversible_chimera_launch_marker()
returns trigger language plpgsql set search_path = pg_catalog, public
as $$
begin
  if old.real_players_started_at is not null and new.real_players_started_at is distinct from old.real_players_started_at then
    raise exception 'the real-player launch marker is irreversible';
  end if;
  return new;
end
$$;
drop trigger if exists chimera_launch_guard_irreversible on public.chimera_launch_guard;
create trigger chimera_launch_guard_irreversible before update on public.chimera_launch_guard
for each row execute function public.enforce_irreversible_chimera_launch_marker();

create or replace function public.prevent_chimera_prelaunch_reset_mutation()
returns trigger language plpgsql set search_path = pg_catalog, public
as $$
begin
  raise exception 'prelaunch reset markers are append-only';
end
$$;
drop trigger if exists chimera_prelaunch_reset_append_only on public.chimera_prelaunch_resets;
create trigger chimera_prelaunch_reset_append_only before update or delete on public.chimera_prelaunch_resets
for each row execute function public.prevent_chimera_prelaunch_reset_mutation();
revoke execute on function public.enforce_irreversible_chimera_launch_marker(), public.prevent_chimera_prelaunch_reset_mutation()
  from public, anon, authenticated, service_role, stonecaster_content_deployer;
