-- Durable metadata streams. Private-only writes never acquire the shared lock.
begin;
create table if not exists public.chimera_content_change_state (
  singleton boolean primary key default true check(singleton),
  generation bigint not null default 0 check(generation>=0),
  head_seq bigint not null default 0 check(head_seq>=0),
  last_transaction_id bigint
);
insert into public.chimera_content_change_state(singleton) values(true) on conflict do nothing;
create table if not exists public.chimera_content_changes (
  seq bigint primary key check(seq>0), shared_generation bigint not null check(shared_generation>0),
  kind text not null, namespace text not null, key text not null,
  old_facets jsonb, new_facets jsonb, committed_at timestamptz not null default clock_timestamp()
);
create table if not exists public.chimera_owner_content_generations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  generation bigint not null default 0 check(generation>=0),
  head_seq bigint not null default 0 check(head_seq>=0)
);
create table if not exists public.chimera_owner_content_changes (
  user_id uuid not null references public.chimera_owner_content_generations(user_id) on delete cascade,
  seq bigint not null check(seq>0), generation bigint not null check(generation>0),
  kind text not null, key text not null, old_facets jsonb, new_facets jsonb,
  committed_at timestamptz not null default clock_timestamp(), primary key(user_id,seq)
);
create index if not exists chimera_content_changes_time on public.chimera_content_changes(committed_at);
create index if not exists chimera_owner_content_changes_time on public.chimera_owner_content_changes(committed_at);

do $$ begin
  if not exists(select 1 from pg_roles where rolname='stonecaster_content_change_owner') then
    create role stonecaster_content_change_owner nologin noinherit nobypassrls;
  end if;
end $$;
grant usage on schema public to stonecaster_content_change_owner;
grant select,insert,update on public.chimera_content_change_state,public.chimera_owner_content_generations to stonecaster_content_change_owner;
grant select,insert on public.chimera_content_changes,public.chimera_owner_content_changes to stonecaster_content_change_owner;
grant select,update on public.chimera_content_catalog_state to stonecaster_content_change_owner;
grant select(id,owner_kind,owner_namespace,owner_user_id,content_key,release_state,visibility) on public.chimera_worlds,public.chimera_stories,public.chimera_content_packs to stonecaster_content_change_owner;
do $$ declare t text; begin
  foreach t in array array['chimera_worlds','chimera_stories','chimera_content_packs'] loop
    execute format('drop policy if exists content_change_parent_metadata on public.%I',t);
    execute format('create policy content_change_parent_metadata on public.%I for select to stonecaster_content_change_owner using(true)',t);
  end loop;
end $$;
grant insert on public.chimera_content_changes to stonecaster_content_sync_owner;
do $$ declare t text; begin
  foreach t in array array['chimera_content_change_state','chimera_content_changes','chimera_owner_content_generations','chimera_owner_content_changes'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role,stonecaster_content_deployer',t);
    execute format('drop policy if exists content_change_owner on public.%I',t);
    execute format('create policy content_change_owner on public.%I for all to stonecaster_content_change_owner using(true) with check(true)',t);
  end loop;
end $$;
drop policy if exists content_change_catalog_lock on public.chimera_content_catalog_state;
create policy content_change_catalog_lock on public.chimera_content_catalog_state for all to stonecaster_content_change_owner using(singleton) with check(singleton);
drop policy if exists content_change_sync_insert on public.chimera_content_changes;
create policy content_change_sync_insert on public.chimera_content_changes for insert to stonecaster_content_sync_owner with check(true);

grant create on schema public to stonecaster_content_change_owner;
do $$ begin execute format('grant stonecaster_content_change_owner to %I',current_user); end $$;
create or replace function public.chimera_content_facets(p_row jsonb)
returns jsonb language sql immutable set search_path=pg_catalog,public as $$
  select coalesce(jsonb_object_agg(k,v),'{}'::jsonb) from jsonb_each(jsonb_build_object(
    'owner_kind',p_row->'owner_kind','owner_user_id',p_row->'owner_user_id',
    'release_state',p_row->'release_state','visibility',p_row->'visibility',
    'tags',coalesce(p_row->'tags',p_row->'body'->'tags',p_row->'definition'->'tags',p_row->'raw_data'->'tags'),
    'genre',coalesce(p_row->'genre',p_row->'body'->'genre'),
    'genre_tags',coalesce(p_row->'genre_tags',p_row->'body'->'genre_tags'),
    'world_id',p_row->'world_id','world_key',p_row->'body'->'world_key',
    'entity_type',coalesce(p_row->'entity_type',p_row->'body'->'entity_type')
  )) f(k,v)
  where (jsonb_typeof(v)='string' and length(v#>>'{}')<=512) or (jsonb_typeof(v)='array' and
    jsonb_array_length(case when jsonb_typeof(v)='array' then v else '[]'::jsonb end)<=64 and
    not exists(select 1 from jsonb_array_elements(case when jsonb_typeof(v)='array' then v else '[]'::jsonb end) a where jsonb_typeof(a)<>'string' or length(a#>>'{}')>512));
$$;
-- Keep one helper signature and no alternate emission entry point.
drop function if exists public.chimera_record_content_change(jsonb,jsonb,text,boolean);
create or replace function public.chimera_record_content_change(p_old jsonb,p_new jsonb,p_kind text,p_bump_catalog boolean,p_force boolean default false)
returns void language plpgsql set search_path=pg_catalog,public as $$
declare
  row_data jsonb:=coalesce(p_new,p_old); ns text:=row_data->>'owner_namespace';
  item_key text:=row_data->>'content_key'; old_f jsonb; new_f jsonb;
  is_shared boolean; next_seq bigint; next_gen bigint; owner_id uuid;
begin
  old_f:=case when p_old is not null then public.chimera_content_facets(p_old) end;
  new_f:=case when p_new is not null then public.chimera_content_facets(p_new) end;
  if not p_force and p_old is not null and p_new is not null and p_old->>'content_hash' is not distinct from p_new->>'content_hash' and old_f is not distinct from new_f then return; end if;
  if ns is null or item_key is null then raise exception 'content mutation identity is required' using errcode='22023'; end if;
  is_shared:=ns='first_party' or coalesce(p_old->>'visibility'='public',false) or coalesce(p_new->>'visibility'='public',false);
  if is_shared then
    -- Same lock order as the existing compile/sync fence. No sequence allocation
    -- outside the transaction: a consumer cannot skip a late lower-seq commit.
    perform generation from public.chimera_content_catalog_state where singleton for update;
    if p_bump_catalog then update public.chimera_content_catalog_state set generation=generation+1,updated_at=now() where singleton; end if;
    update public.chimera_content_change_state set
      generation=generation+case when last_transaction_id is distinct from txid_current() then 1 else 0 end,
      head_seq=head_seq+1,last_transaction_id=txid_current()
      where singleton returning generation,head_seq into next_gen,next_seq;
    insert into public.chimera_content_changes(seq,shared_generation,kind,namespace,key,old_facets,new_facets)
      values(next_seq,next_gen,p_kind,ns,item_key,old_f,new_f);
  else
    owner_id:=ns::uuid;
    insert into public.chimera_owner_content_generations(user_id) values(owner_id) on conflict do nothing;
    update public.chimera_owner_content_generations set generation=generation+1,head_seq=head_seq+1
      where user_id=owner_id returning generation,head_seq into next_gen,next_seq;
    insert into public.chimera_owner_content_changes(user_id,seq,generation,kind,key,old_facets,new_facets)
      values(owner_id,next_seq,next_gen,p_kind,item_key,old_f,new_f);
  end if;
end $$;
create or replace function public.chimera_emit_content_change()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare old_row jsonb; new_row jsonb; item_kind text; bump_catalog boolean;
  parent_field text; parent_kind text; parent_id uuid; parent_row jsonb;
begin
  if tg_op<>'INSERT' then old_row:=to_jsonb(old); end if;
  if tg_op<>'DELETE' then new_row:=to_jsonb(new); end if;
  item_kind:=coalesce(tg_argv[0],coalesce(new_row,old_row)->>'content_kind');
  bump_catalog:=coalesce(tg_argv[1]::boolean,false);
  if old_row is not null and new_row is not null and
    (old_row->>'owner_namespace',old_row->>'content_key',old_row->>'content_hash',public.chimera_content_facets(old_row)) is not distinct from
    (new_row->>'owner_namespace',new_row->>'content_key',new_row->>'content_hash',public.chimera_content_facets(new_row)) then return null; end if;
  if tg_table_name='chimera_world_ruleset_link' then parent_field:='world_id';parent_kind:='world';
  elsif tg_table_name in ('chimera_story_links','chimera_story_entity_links','chimera_story_content_pack_links','chimera_story_compiled_ruleset') then parent_field:='story_id';parent_kind:='story';
  elsif tg_table_name in ('chimera_content_pack_entity_links','chimera_content_pack_lore_links','chimera_content_pack_ruleset_links','chimera_pack_dependencies') then parent_field:='pack_id';parent_kind:='content_pack'; end if;
  if parent_field is not null then
    for parent_id in select distinct value::uuid from unnest(array[old_row->>parent_field,new_row->>parent_field]) v(value) where value is not null loop
      if parent_kind='world' then
        select jsonb_build_object('owner_kind',owner_kind,'owner_namespace',owner_namespace,'owner_user_id',owner_user_id,'content_key',content_key,'release_state',release_state,'visibility',visibility) into parent_row from public.chimera_worlds where id=parent_id;
      elsif parent_kind='story' then
        select jsonb_build_object('owner_kind',owner_kind,'owner_namespace',owner_namespace,'owner_user_id',owner_user_id,'content_key',content_key,'release_state',release_state,'visibility',visibility) into parent_row from public.chimera_stories where id=parent_id;
      else
        select jsonb_build_object('owner_kind',owner_kind,'owner_namespace',owner_namespace,'owner_user_id',owner_user_id,'content_key',content_key,'release_state',release_state,'visibility',visibility) into parent_row from public.chimera_content_packs where id=parent_id;
      end if;
      if parent_row is not null then
        perform public.chimera_record_content_change(parent_row,parent_row,parent_kind,false,true);
        if old_row->>parent_field=parent_id::text then old_row:=old_row||jsonb_build_object('visibility',parent_row->'visibility'); end if;
        if new_row->>parent_field=parent_id::text then new_row:=new_row||jsonb_build_object('visibility',parent_row->'visibility'); end if;
      end if;
    end loop;
  end if;
  if old_row is not null and new_row is not null and
    (old_row->>'owner_namespace',old_row->>'content_key') is distinct from (new_row->>'owner_namespace',new_row->>'content_key') then
    perform public.chimera_record_content_change(old_row,null,item_kind,bump_catalog);
    perform public.chimera_record_content_change(null,new_row,item_kind,bump_catalog);
  else
    perform public.chimera_record_content_change(old_row,new_row,item_kind,bump_catalog);
  end if;
  return null;
end $$;

-- One statement snapshot contains head, retention floor and ordered bounded pages.
-- Backend only: callers cannot enumerate private owners through a client RPC.
create or replace function public.chimera_content_change_page(p_after_seq bigint,p_owners jsonb,p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
  if p_after_seq<0 or p_owners is null or jsonb_typeof(p_owners)<>'array' or jsonb_array_length(p_owners)>32 or p_limit is null or p_limit not between 1 and 100 then
    raise exception 'invalid content change page' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(p_owners) r where r->>'user_id' is null or (r->>'after_seq')::bigint<0) or
     (select count(*) from jsonb_array_elements(p_owners))<>(select count(distinct r->>'user_id') from jsonb_array_elements(p_owners) r) then
    raise exception 'invalid owner cursors' using errcode='22023';
  end if;
  return (
    select jsonb_build_object('shared',jsonb_build_object(
      'generation',s.generation::text,'head_seq',s.head_seq::text,
      'retained_after_seq',coalesce((select min(seq)-1 from public.chimera_content_changes),s.head_seq)::text,
      'changes',coalesce((select jsonb_agg(jsonb_build_object('seq',c.seq::text,'generation',c.shared_generation::text,'kind',c.kind,'namespace',c.namespace,'key',c.key,'old_facets',c.old_facets,'new_facets',c.new_facets) order by c.seq)
        from (select * from public.chimera_content_changes where p_after_seq is not null and seq>p_after_seq order by seq limit p_limit) c),'[]'::jsonb)),
      'owners',coalesce((select jsonb_agg(jsonb_build_object(
        'user_id',o.user_id,'generation',coalesce(g.generation,0)::text,'head_seq',coalesce(g.head_seq,0)::text,
        'retained_after_seq',coalesce((select min(seq)-1 from public.chimera_owner_content_changes where user_id=o.user_id),g.head_seq,0)::text,
        'changes',coalesce((select jsonb_agg(jsonb_build_object('seq',c.seq::text,'generation',c.generation::text,'kind',c.kind,'namespace',c.user_id::text,'key',c.key,'old_facets',c.old_facets,'new_facets',c.new_facets) order by c.seq)
          from (select * from public.chimera_owner_content_changes where user_id=o.user_id and o.after_seq is not null and seq>o.after_seq order by seq limit p_limit) c),'[]'::jsonb)) order by o.user_id)
        from jsonb_to_recordset(p_owners) o(user_id uuid,after_seq bigint) left join public.chimera_owner_content_generations g on g.user_id=o.user_id),'[]'::jsonb))
    from public.chimera_content_change_state s where s.singleton
  );
end $$;
alter function public.chimera_content_facets(jsonb) owner to stonecaster_content_change_owner;
alter function public.chimera_record_content_change(jsonb,jsonb,text,boolean,boolean) owner to stonecaster_content_change_owner;
alter function public.chimera_emit_content_change() owner to stonecaster_content_change_owner;
alter function public.chimera_content_change_page(bigint,jsonb,integer) owner to stonecaster_content_change_owner;
revoke all on function public.chimera_content_facets(jsonb),public.chimera_record_content_change(jsonb,jsonb,text,boolean,boolean),public.chimera_emit_content_change(),public.chimera_content_change_page(bigint,jsonb,integer) from public,anon,authenticated,service_role,stonecaster_content_deployer;
grant execute on function public.chimera_content_change_page(bigint,jsonb,integer) to service_role;

-- Preserve ownership guards. Replace only the old global-generation triggers.
do $$ declare t text; k text; begin
  for t,k in select * from (values
    ('chimera_ruleset_templates','ruleset'),('chimera_worlds','world'),('chimera_entities','entity'),('chimera_lore','lore'),
    ('chimera_tags','tag'),('chimera_asset_tags','asset_tag'),('chimera_assets','asset'),('chimera_exclusion_groups','exclusion_group'),
    ('chimera_world_ruleset_link','world_ruleset_link'),('chimera_content_packs','content_pack'),('chimera_content_pack_entity_links','pack_entity_link'),
    ('chimera_content_pack_lore_links','pack_lore_link'),('chimera_content_pack_ruleset_links','pack_ruleset_link'),('chimera_pack_dependencies','pack_dependency'),
    ('chimera_stories','story'),('chimera_story_links','story_link'),('chimera_story_entity_links','story_entity_link'),
    ('chimera_story_content_pack_links','story_content_pack_link'),('chimera_story_compiled_ruleset','story_compiled_ruleset'),
    ('mechanics_skills','mechanic_skill'),('mechanics_conditions','mechanic_condition'),('mechanics_resources','mechanic_resource'),
    ('premade_characters','premade_character'),('localization_glossary','localization_glossary'),('localization_rules','localization_rule'),
    ('localization_packs','localization_pack'),('injection_map','injection_map'),('dialogue_config','dialogue_config'),('dialogue_graphs','dialogue_graph'),
    ('quest_graphs','quest_graph'),('quest_graph_indexes','quest_graph_index')
  ) v(table_name,kind) loop
    execute format('drop trigger if exists %I on public.%I',t||'_content_catalog_generation',t);
    execute format('drop trigger if exists %I on public.%I',t||'_content_changes',t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.chimera_emit_content_change(%L,%L)',t||'_content_changes',t,k,'true');
  end loop;
end $$;
drop trigger if exists chimera_content_sources_changes on public.chimera_content_source_items;
create trigger chimera_content_sources_changes after insert or update or delete on public.chimera_content_source_items
  for each row execute function public.chimera_emit_content_change();
do $$ begin execute format('revoke stonecaster_content_change_owner from %I',current_user); end $$;
revoke create on schema public from stonecaster_content_change_owner;
commit;
