-- F0b bounded snapshot GC. No automatic or source deletion occurs in this migration.
begin;

do $$ begin
  if not exists(select 1 from pg_roles where rolname='stonecaster_content_gc_owner') then
    create role stonecaster_content_gc_owner nologin noinherit;
  end if;
  if not exists(select 1 from pg_roles where rolname='stonecaster_content_gc_operator') then
    create role stonecaster_content_gc_operator nologin noinherit;
  end if;
  if exists(select 1 from pg_roles where rolname in ('stonecaster_content_gc_owner','stonecaster_content_gc_operator')
    and (rolcanlogin or rolsuper or rolbypassrls or rolcreaterole or rolcreatedb or rolreplication or rolinherit)) then
    raise exception 'GC roles must be restricted NOLOGIN NOINHERIT roles';
  end if;
end $$;
grant usage on schema public to stonecaster_content_gc_owner,stonecaster_content_gc_operator;
-- Temporary migration ownership follows the F0a scoped-function-owner pattern.
grant create on schema public to stonecaster_content_gc_owner;
do $$ begin execute format('grant stonecaster_content_gc_owner to %I',current_user); end $$;
grant stonecaster_content_gc_operator to postgres;
grant select on public.chimera_stories,public.chimera_game_states,public.chimera_compiled_stories,public.chimera_compiled_content_refs,public.chimera_content_blobs to stonecaster_content_gc_owner;
grant delete on public.chimera_compiled_stories,public.chimera_content_blobs to stonecaster_content_gc_owner;
-- PostgreSQL requires UPDATE privilege/policies for row locking. Column grants
-- and a false WITH CHECK permit the locks without permitting any row update.
grant update(id) on public.chimera_compiled_stories,public.chimera_stories to stonecaster_content_gc_owner;
grant update(sha256) on public.chimera_content_blobs to stonecaster_content_gc_owner;

do $$ declare t text; begin
  foreach t in array array['chimera_stories','chimera_game_states','chimera_compiled_stories','chimera_compiled_content_refs','chimera_content_blobs'] loop
    execute format('drop policy if exists %I on public.%I',t || '_gc_read',t);
    execute format('create policy %I on public.%I for select to stonecaster_content_gc_owner using (true)',t || '_gc_read',t);
  end loop;
  foreach t in array array['chimera_compiled_stories','chimera_content_blobs'] loop
    execute format('drop policy if exists %I on public.%I',t || '_gc_delete',t);
    execute format('create policy %I on public.%I for delete to stonecaster_content_gc_owner using (true)',t || '_gc_delete',t);
  end loop;
  foreach t in array array['chimera_compiled_stories','chimera_stories','chimera_content_blobs'] loop
    execute format('drop policy if exists %I on public.%I',t || '_gc_lock',t);
    execute format('create policy %I on public.%I for update to stonecaster_content_gc_owner using (true) with check (false)',t || '_gc_lock',t);
  end loop;
end $$;

-- A current pointer must prevent deletion, never be silently cleared by GC.
alter table public.chimera_stories drop constraint if exists chimera_stories_current_compiled_id_fkey;
alter table public.chimera_stories add constraint chimera_stories_current_compiled_id_fkey
  foreign key(current_compiled_id) references public.chimera_compiled_stories(id) on delete restrict;
create index if not exists chimera_gc_story_pointer on public.chimera_stories(current_compiled_id) where current_compiled_id is not null;
create index if not exists chimera_gc_game_pin on public.chimera_game_states(compiled_story_id);
create index if not exists chimera_gc_blob_ref on public.chimera_compiled_content_refs(sha256);
create index if not exists chimera_gc_compile_order on public.chimera_compiled_stories(created_at,id);
create index if not exists chimera_gc_blob_order on public.chimera_content_blobs(created_at,sha256);

-- Only the NOLOGIN function owner can delete a blob; updates remain forbidden.
create or replace function public.prevent_content_blob_mutation()
returns trigger language plpgsql set search_path = pg_catalog, public
as $$ begin
  if tg_op='DELETE' and current_user='stonecaster_content_gc_owner' then return old; end if;
  raise exception 'content blobs are immutable';
end $$;

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

  -- Serialize current-pointer publication with GC before taking blob locks.
  if p_story_id is not null then
    perform id from public.chimera_stories where id = p_story_id for update;
    if not found then raise exception 'source story not found'; end if;
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
    perform sha256 from public.chimera_content_blobs where sha256 = source.content_hash for key share;
    if not found then raise exception 'content blob collected during compile' using errcode = '40001'; end if;
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
  perform sha256 from public.chimera_content_blobs where sha256 = payload_hash for key share;
  if not found then raise exception 'compiled payload collected during compile' using errcode = '40001'; end if;
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

create or replace function public.chimera_content_gc(p_batch_size integer,p_dry_run boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public
as $$
declare
  candidate record;
  compiled_candidates integer:=0;
  blob_candidates integer:=0;
  compiled_deleted integer:=0;
  blobs_deleted integer:=0;
  removed integer;
  reclaimed numeric:=0;
  eligible_bytes numeric:=0;
begin
  if p_batch_size is null or p_batch_size<1 or p_batch_size>1000 or p_dry_run is null then
    raise exception 'GC requires an explicit batch size from 1 to 1000 and dry-run flag' using errcode='22023';
  end if;
  if p_dry_run then
    select count(*) into compiled_candidates from (
      select c.id from public.chimera_compiled_stories c
      where not exists(select 1 from public.chimera_game_states g where g.compiled_story_id=c.id)
        and not exists(select 1 from public.chimera_stories s where s.current_compiled_id=c.id)
      order by c.created_at,c.id limit p_batch_size
    ) candidates;
    select count(*),coalesce(sum(byte_count),0) into blob_candidates,eligible_bytes from (
      select b.byte_count from public.chimera_content_blobs b
      where not exists(select 1 from public.chimera_compiled_content_refs r where r.sha256=b.sha256)
        and not exists(select 1 from public.chimera_compiled_stories c where c.payload_blob_hash=b.sha256)
      order by b.created_at,b.sha256 limit p_batch_size
    ) candidates;
  else
    for candidate in
      select c.id,c.story_id from public.chimera_compiled_stories c
      where not exists(select 1 from public.chimera_game_states g where g.compiled_story_id=c.id)
        and not exists(select 1 from public.chimera_stories s where s.current_compiled_id=c.id)
      order by c.created_at,c.id limit p_batch_size for update of c skip locked
    loop
      compiled_candidates:=compiled_candidates+1;
      if candidate.story_id is not null and exists(select 1 from public.chimera_stories where id=candidate.story_id) then
        perform id from public.chimera_stories where id=candidate.story_id for update skip locked;
        if not found then continue; end if;
      end if;
      -- Recheck after both locks; FKs are the final guard against a new pin/pointer.
      delete from public.chimera_compiled_stories c where c.id=candidate.id
        and not exists(select 1 from public.chimera_game_states g where g.compiled_story_id=c.id)
        and not exists(select 1 from public.chimera_stories s where s.current_compiled_id=c.id);
      get diagnostics removed=row_count;
      compiled_deleted:=compiled_deleted+removed;
    end loop;
    for candidate in
      select b.sha256,b.byte_count from public.chimera_content_blobs b
      where not exists(select 1 from public.chimera_compiled_content_refs r where r.sha256=b.sha256)
        and not exists(select 1 from public.chimera_compiled_stories c where c.payload_blob_hash=b.sha256)
      order by b.created_at,b.sha256 limit p_batch_size for update of b skip locked
    loop
      blob_candidates:=blob_candidates+1;
      eligible_bytes:=eligible_bytes+candidate.byte_count;
      delete from public.chimera_content_blobs b where b.sha256=candidate.sha256
        and not exists(select 1 from public.chimera_compiled_content_refs r where r.sha256=b.sha256)
        and not exists(select 1 from public.chimera_compiled_stories c where c.payload_blob_hash=b.sha256);
      get diagnostics removed=row_count;
      blobs_deleted:=blobs_deleted+removed;
      reclaimed:=reclaimed+removed*candidate.byte_count;
    end loop;
  end if;
  return jsonb_build_object('dry_run',p_dry_run,'batch_size',p_batch_size,
    'compiled_candidates',compiled_candidates,'blob_candidates',blob_candidates,
    'compiled_deleted',compiled_deleted,'blobs_deleted',blobs_deleted,
    'bytes_eligible',eligible_bytes::text,'bytes_reclaimed',reclaimed::text);
end $$;
alter function public.chimera_content_gc(integer,boolean) owner to stonecaster_content_gc_owner;
revoke all on function public.chimera_content_gc(integer,boolean) from public,anon,authenticated,service_role,stonecaster_content_deployer;
grant execute on function public.chimera_content_gc(integer,boolean) to stonecaster_content_gc_operator;
revoke all on function public.prevent_content_blob_mutation() from public,anon,authenticated,service_role;
-- Existing compile/session execution grants are retained by CREATE OR REPLACE.
revoke create on schema public from stonecaster_content_gc_owner;
do $$ begin execute format('revoke stonecaster_content_gc_owner from %I',current_user); end $$;
notify pgrst,'reload schema';
commit;
