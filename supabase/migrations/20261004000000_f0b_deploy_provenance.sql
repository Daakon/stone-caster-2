-- F0b deployment provenance: metadata only; no release/delete/format/cache rollout.
begin;
alter table public.chimera_content_deploy_log
  add column if not exists commit_sha text,
  add column if not exists format_version integer,
  add column if not exists changed_keys jsonb,
  add column if not exists old_new_hashes jsonb,
  add column if not exists outcome text;
alter table public.chimera_content_deploy_log drop constraint if exists chimera_deploy_provenance;
alter table public.chimera_content_deploy_log add constraint chimera_deploy_provenance check (
  (commit_sha is null and format_version is null and changed_keys is null and old_new_hashes is null and outcome is null)
  or (commit_sha is not null and commit_sha ~ '^[0-9a-f]{40}$' and format_version is not null and format_version>0
    and changed_keys is not null and jsonb_typeof(changed_keys)='array'
    and old_new_hashes is not null and jsonb_typeof(old_new_hashes)='array' and outcome is not null and outcome='applied')
);
create unique index if not exists chimera_deploy_generation on public.chimera_content_deploy_log(catalog_generation);

create or replace view content_deploy.validation_formats as
select kinds.content_kind, 1 as supported_format_version, state.generation as catalog_generation, 1 as deployment_provenance_version
from unnest(array['ruleset','world','entity','lore','tag','asset_tag','mechanic_skill','mechanic_condition',
  'mechanic_resource','premade_character','localization_glossary','localization_rule','localization_pack',
  'injection_map','dialogue_config','dialogue_graph','quest_graph','quest_graph_index','content_pack','exclusion_group',
  'world_ruleset_link','pack_entity_link','pack_lore_link','pack_ruleset_link','pack_dependency']) as kinds(content_kind)
cross join public.chimera_content_catalog_state state where state.singleton;

-- Keep earlier receipts explicitly unknown; do not invent historical commit hashes.
create or replace function public.prevent_content_deploy_log_mutation()
returns trigger language plpgsql set search_path=pg_catalog,public
as $$ begin raise exception 'content deployment history is append-only'; end $$;
drop trigger if exists content_deploy_log_immutable on public.chimera_content_deploy_log;
create trigger content_deploy_log_immutable before update or delete on public.chimera_content_deploy_log
for each row execute function public.prevent_content_deploy_log_mutation();
revoke all on function public.prevent_content_deploy_log_mutation() from public,anon,authenticated,service_role,stonecaster_content_deployer;

-- Temporary owner membership permits replacing the existing scoped function.
grant create on schema content_deploy to stonecaster_content_sync_owner;
do $$ begin execute format('grant stonecaster_content_sync_owner to %I',current_user); end $$;
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
  commit_sha text;
  old_hash text;
  changed_keys jsonb := '[]'::jsonb;
  hash_changes jsonb := '[]'::jsonb;
begin
  if session_user <> 'stonecaster_content_deployer' then
    raise exception 'content sync accepts only stonecaster_content_deployer';
  end if;
  if p_deploy_id is null or jsonb_typeof(p_bundle) <> 'object' or jsonb_typeof(p_bundle->'items') <> 'array' then
    raise exception 'invalid content sync bundle';
  end if;
  commit_sha := p_bundle->'deployment'->>'commit_sha';
  if commit_sha is null or commit_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'a full Git commit SHA is required for content deployment' using errcode='22023';
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
    select content_hash into old_hash from public.chimera_content_source_items
      where content_kind=item_kind and owner_namespace=item_namespace and content_key=item_key;
    if old_hash is distinct from item_hash then
      changed_keys := changed_keys || jsonb_build_array(jsonb_build_object('kind',item_kind,'namespace',item_namespace,'key',item_key));
      hash_changes := hash_changes || jsonb_build_array(jsonb_build_object('kind',item_kind,'namespace',item_namespace,'key',item_key,'old_hash',old_hash,'new_hash',item_hash));
    end if;
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
  insert into public.chimera_content_deploy_log(id,catalog_generation,manifest_hash,item_count,deployed_by,commit_sha,format_version,changed_keys,old_new_hashes,outcome)
  values (p_deploy_id,next_generation,manifest_hash,item_count,session_user,commit_sha,1,changed_keys,hash_changes,'applied');
  return jsonb_build_object('generation', next_generation, 'manifest_hash', manifest_hash, 'item_count', item_count,'deploy_id',p_deploy_id,'commit_sha',commit_sha,'format_version',1,'changed_keys',changed_keys,'old_new_hashes',hash_changes,'outcome','applied');
end
$$;

revoke create on schema content_deploy from stonecaster_content_sync_owner;
do $$ begin execute format('revoke stonecaster_content_sync_owner from %I',current_user); end $$;
-- Replacing the existing function retains its owner and execution grants.

revoke all on public.chimera_content_deploy_log from public,anon,authenticated,service_role,stonecaster_content_deployer;
grant select on public.chimera_content_deploy_log to authenticated;
drop policy if exists chimera_deploy_admin_read on public.chimera_content_deploy_log;
create policy chimera_deploy_admin_read on public.chimera_content_deploy_log for select to authenticated using (public.is_admin());

create or replace function public.chimera_admin_content_deploy_log(p_limit integer,p_before_generation bigint)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public
as $$
declare result jsonb; begin
  if auth.role() is distinct from 'authenticated' or auth.uid() is null or not public.is_admin() then
    raise exception 'authenticated administrator required' using errcode='42501';
  end if;
  if p_limit is null or p_limit<1 or p_limit>100 or (p_before_generation is not null and p_before_generation<1) then
    raise exception 'invalid deploy-history page' using errcode='22023';
  end if;
  with candidates as (
    select * from public.chimera_content_deploy_log
    where p_before_generation is null or catalog_generation<p_before_generation
    order by catalog_generation desc limit p_limit+1
  ), page as (
    select * from candidates order by catalog_generation desc limit p_limit
  ) select jsonb_build_object(
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'generation',catalog_generation::text,'manifest_hash',manifest_hash,'item_count',item_count,
      'actor',deployed_by::text,'deployed_at',created_at,'provenance',case when commit_sha is null then 'legacy' else 'recorded' end,
      'commit_sha',commit_sha,'format_version',format_version,'changed_keys',changed_keys,'old_new_hashes',old_new_hashes,'outcome',outcome
    ) order by catalog_generation desc) from page),'[]'::jsonb),
    'next_before_generation',case when (select count(*) from candidates)>p_limit then (select min(catalog_generation)::text from page) else null end
  ) into result;
  return result;
end $$;
revoke all on function public.chimera_admin_content_deploy_log(integer,bigint) from public,anon,service_role,stonecaster_content_deployer;
grant execute on function public.chimera_admin_content_deploy_log(integer,bigint) to authenticated;
notify pgrst,'reload schema';
commit;
