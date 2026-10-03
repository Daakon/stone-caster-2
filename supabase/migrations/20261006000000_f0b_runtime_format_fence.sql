-- Durable fleet membership: no heartbeat expiry and no automatic retirement.
begin;
create table if not exists public.chimera_content_runtime_fleet (
  singleton boolean primary key default true check(singleton),
  app_name text not null unique check(app_name ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
  inventory_verified_at timestamptz not null
);
create table if not exists public.chimera_content_runtime_builds (
  app_name text not null references public.chimera_content_runtime_fleet(app_name) on delete restrict,
  machine_id text not null check(machine_id ~ '^[a-z0-9]{1,64}$'),
  machine_version text not null check(machine_version ~ '^[A-Za-z0-9_-]{1,128}$'),
  image_ref text check(length(image_ref) between 1 and 512 and image_ref !~ '[[:cntrl:]]'),
  format_min integer,
  format_max integer,
  last_reported_at timestamptz,
  retired_at timestamptz,
  primary key(app_name,machine_id,machine_version),
  check((format_min is null and format_max is null) or
    (format_min is not null and format_max is not null and format_min>0 and format_max>=format_min))
);
create index if not exists chimera_content_runtime_active on public.chimera_content_runtime_builds(app_name,format_min,format_max) where retired_at is null;
alter table public.chimera_content_runtime_fleet enable row level security;
alter table public.chimera_content_runtime_builds enable row level security;
revoke all on public.chimera_content_runtime_fleet,public.chimera_content_runtime_builds from public,anon,authenticated,service_role,stonecaster_content_deployer;
do $$ begin
  if not exists(select 1 from pg_roles where rolname='stonecaster_content_runtime_owner') then
    create role stonecaster_content_runtime_owner nologin noinherit nobypassrls;
  end if;
end $$;
grant usage on schema public to stonecaster_content_runtime_owner;
grant select on public.chimera_content_runtime_fleet to stonecaster_content_runtime_owner,stonecaster_content_sync_owner;
grant select on public.chimera_content_runtime_builds to stonecaster_content_runtime_owner,stonecaster_content_sync_owner;
grant insert on public.chimera_content_runtime_builds to stonecaster_content_runtime_owner;
grant update(image_ref,format_min,format_max,last_reported_at,retired_at) on public.chimera_content_runtime_builds to stonecaster_content_runtime_owner;
grant select(singleton,generation),update(generation) on public.chimera_content_catalog_state to stonecaster_content_runtime_owner;
-- Maintenance is not the earlier NOLOGIN function owner. Grant through temporary
-- membership, then remove it; an unprivileged GRANT can otherwise be a no-op.
do $$ begin execute format('grant stonecaster_content_readiness_owner to %I',current_user); end $$;
grant execute on function public.chimera_content_format_inventory() to stonecaster_content_runtime_owner;
do $$ begin execute format('revoke stonecaster_content_readiness_owner from %I',current_user); end $$;
drop policy if exists chimera_runtime_fleet_read on public.chimera_content_runtime_fleet;
create policy chimera_runtime_fleet_read on public.chimera_content_runtime_fleet for select to stonecaster_content_runtime_owner,stonecaster_content_sync_owner using(true);
drop policy if exists chimera_runtime_build_read on public.chimera_content_runtime_builds;
create policy chimera_runtime_build_read on public.chimera_content_runtime_builds for select to stonecaster_content_runtime_owner,stonecaster_content_sync_owner using(true);
drop policy if exists chimera_runtime_build_insert on public.chimera_content_runtime_builds;
create policy chimera_runtime_build_insert on public.chimera_content_runtime_builds for insert to stonecaster_content_runtime_owner with check(true);
drop policy if exists chimera_runtime_build_update on public.chimera_content_runtime_builds;
create policy chimera_runtime_build_update on public.chimera_content_runtime_builds for update to stonecaster_content_runtime_owner using(true) with check(true);
drop policy if exists chimera_runtime_catalog_read on public.chimera_content_catalog_state;
create policy chimera_runtime_catalog_read on public.chimera_content_catalog_state for select to stonecaster_content_runtime_owner using(singleton);
drop policy if exists chimera_runtime_catalog_lock on public.chimera_content_catalog_state;
create policy chimera_runtime_catalog_lock on public.chimera_content_catalog_state for update to stonecaster_content_runtime_owner using(singleton) with check(false);

grant create on schema public to stonecaster_content_runtime_owner;
do $$ begin execute format('grant stonecaster_content_runtime_owner to %I',current_user); end $$;
create or replace function public.chimera_register_content_runtime(
  p_app_name text,p_machine_id text,p_machine_version text,p_image_ref text,p_format_min integer,p_format_max integer
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public
as $$ begin
  if p_app_name is null or p_machine_id is null or p_machine_version is null or p_image_ref is null
     or p_format_min is null or p_format_max is null or p_format_min<1 or p_format_max<p_format_min then
    raise exception 'invalid runtime format registration' using errcode='22023';
  end if;
  -- Serialize registration, inventory maintenance and content sync on one lock.
  perform generation from public.chimera_content_catalog_state where singleton for update;
  if not found then raise exception 'content catalog is unavailable' using errcode='P0F01'; end if;
  if not exists(select 1 from public.chimera_content_runtime_fleet where app_name=p_app_name) then
    raise exception 'verified runtime fleet inventory is required' using errcode='P0F01';
  end if;
  insert into public.chimera_content_runtime_builds as existing(app_name,machine_id,machine_version,image_ref,format_min,format_max,last_reported_at)
  values(p_app_name,p_machine_id,p_machine_version,p_image_ref,p_format_min,p_format_max,clock_timestamp())
  on conflict(app_name,machine_id,machine_version) do update
    set image_ref=excluded.image_ref,format_min=excluded.format_min,format_max=excluded.format_max,
        last_reported_at=excluded.last_reported_at,retired_at=null
    where (existing.image_ref is null or existing.image_ref=excluded.image_ref)
      and (existing.format_min is null or (existing.format_min=excluded.format_min and existing.format_max=excluded.format_max));
  if not found then raise exception 'runtime build identity is immutable' using errcode='22023'; end if;
  -- An incompatible waking build is still recorded; its caller rejects readiness.
  return public.chimera_content_format_inventory();
end $$;
alter function public.chimera_register_content_runtime(text,text,text,text,integer,integer) owner to stonecaster_content_runtime_owner;
revoke all on function public.chimera_register_content_runtime(text,text,text,text,integer,integer) from public,anon,authenticated,stonecaster_content_deployer;
grant execute on function public.chimera_register_content_runtime(text,text,text,text,integer,integer) to service_role;
revoke create on schema public from stonecaster_content_runtime_owner;
do $$ begin execute format('revoke stonecaster_content_runtime_owner from %I',current_user); end $$;

-- Check at receipt insertion, inside the existing locked sync transaction.
-- A rejection rolls back every source write, generation and receipt together.
create or replace function public.chimera_guard_content_runtime_fleet()
returns trigger language plpgsql security invoker set search_path=pg_catalog,public
as $$ begin
  if new.commit_sha is null then return new; end if; -- Unknown historical receipts.
  perform generation from public.chimera_content_catalog_state where singleton for update;
  if not found or not exists(select 1 from public.chimera_content_runtime_fleet)
    or not exists(select 1 from public.chimera_content_runtime_builds where retired_at is null)
    or exists(select 1 from public.chimera_content_runtime_builds where retired_at is null
      and (format_min is null or image_ref is null or last_reported_at is null)) then
    raise exception 'content deployment requires a verified, fully reported runtime fleet' using errcode='P0F01';
  end if;
  if exists(select 1 from public.chimera_content_runtime_builds where retired_at is null
    and (new.format_version<format_min or new.format_version>format_max)) then
    raise exception 'content format is unsupported by the registered runtime fleet' using errcode='P0F02';
  end if;
  return new;
end $$;
revoke all on function public.chimera_guard_content_runtime_fleet() from public,anon,authenticated,service_role,stonecaster_content_deployer;
grant execute on function public.chimera_guard_content_runtime_fleet() to stonecaster_content_sync_owner;
drop trigger if exists content_deploy_runtime_fence on public.chimera_content_deploy_log;
create trigger content_deploy_runtime_fence before insert on public.chimera_content_deploy_log
for each row execute function public.chimera_guard_content_runtime_fleet();
create or replace view content_deploy.validation_formats as
select kinds.content_kind, 1 as supported_format_version, state.generation as catalog_generation,
  1 as deployment_provenance_version,1 as runtime_format_contract_version
from unnest(array['ruleset','world','entity','lore','tag','asset_tag','mechanic_skill','mechanic_condition',
  'mechanic_resource','premade_character','localization_glossary','localization_rule','localization_pack',
  'injection_map','dialogue_config','dialogue_graph','quest_graph','quest_graph_index','content_pack','exclusion_group',
  'world_ruleset_link','pack_entity_link','pack_lore_link','pack_ruleset_link','pack_dependency']) as kinds(content_kind)
cross join public.chimera_content_catalog_state state where state.singleton;
notify pgrst,'reload schema';
commit;
