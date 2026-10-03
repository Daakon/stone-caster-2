-- F0b per-build readiness: metadata only, not the all-machine deployment registry.
begin;
do $$ begin
  if not exists(select 1 from pg_roles where rolname='stonecaster_content_readiness_owner') then
    create role stonecaster_content_readiness_owner nologin noinherit nobypassrls;
  end if;
end $$;
grant usage on schema public to stonecaster_content_readiness_owner;
grant select(content_format_version) on public.chimera_content_source_items to stonecaster_content_readiness_owner;
grant select(format_version) on public.chimera_content_blobs to stonecaster_content_readiness_owner;
grant select(singleton,generation) on public.chimera_content_catalog_state to stonecaster_content_readiness_owner;
drop policy if exists chimera_content_sources_readiness on public.chimera_content_source_items;
create policy chimera_content_sources_readiness on public.chimera_content_source_items
  for select to stonecaster_content_readiness_owner using(true);
drop policy if exists chimera_content_blobs_readiness on public.chimera_content_blobs;
create policy chimera_content_blobs_readiness on public.chimera_content_blobs
  for select to stonecaster_content_readiness_owner using(true);
drop policy if exists chimera_content_catalog_readiness on public.chimera_content_catalog_state;
create policy chimera_content_catalog_readiness on public.chimera_content_catalog_state
  for select to stonecaster_content_readiness_owner using(singleton);
-- Indexed extrema avoid scanning content bodies or every retained blob per probe.
create index if not exists chimera_content_source_format_idx on public.chimera_content_source_items(content_format_version);
create index if not exists chimera_content_blob_format_idx on public.chimera_content_blobs(format_version);
grant create on schema public to stonecaster_content_readiness_owner;
do $$ begin execute format('grant stonecaster_content_readiness_owner to %I',current_user); end $$;
create or replace function public.chimera_content_format_inventory()
returns jsonb language sql stable security definer set search_path=pg_catalog,public
as $$
  select jsonb_build_object(
    'catalog_generation',(select generation::text from public.chimera_content_catalog_state where singleton),
    'source_min',(select min(content_format_version) from public.chimera_content_source_items),
    'source_max',(select max(content_format_version) from public.chimera_content_source_items),
    'blob_min',(select min(format_version) from public.chimera_content_blobs),
    'blob_max',(select max(format_version) from public.chimera_content_blobs)
  )
$$;
alter function public.chimera_content_format_inventory() owner to stonecaster_content_readiness_owner;
revoke all on function public.chimera_content_format_inventory() from public,anon,authenticated,stonecaster_content_deployer;
grant execute on function public.chimera_content_format_inventory() to service_role;
revoke create on schema public from stonecaster_content_readiness_owner;
do $$ begin execute format('revoke stonecaster_content_readiness_owner from %I',current_user); end $$;
notify pgrst,'reload schema';
commit;
