begin;

-- A private player's tag name must neither reserve nor reveal another namespace.
alter table public.chimera_tags drop constraint if exists uq_chimera_tags_tag_name;
create unique index if not exists chimera_tags_owner_name_uq
  on public.chimera_tags(owner_namespace, tag_name);

-- Direct authenticated table writes must not let the privileged entitlement
-- child trigger update a foreign story. Run before chimera_child_entitlement.
do $$ begin
  if not exists(select 1 from pg_roles where rolname='stonecaster_lore_parent_guard') then
    create role stonecaster_lore_parent_guard nologin noinherit nobypassrls;
  end if;
end $$;
grant usage on schema public, auth to stonecaster_lore_parent_guard;
grant select(id,owner_kind,owner_user_id) on public.chimera_stories to stonecaster_lore_parent_guard;
grant execute on function auth.uid(),auth.role() to stonecaster_lore_parent_guard;
drop policy if exists chimera_lore_parent_identity on public.chimera_stories;
create policy chimera_lore_parent_identity on public.chimera_stories
  for select to stonecaster_lore_parent_guard using(true);
do $$ begin execute format('grant stonecaster_lore_parent_guard to %I',current_user); end $$;
create or replace function public.chimera_guard_lore_story_owner()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
declare parents uuid[] := '{}'; parent uuid;
begin
  if auth.role() = 'authenticated' then
    if tg_op <> 'INSERT' then parents := array_append(parents,old.story_id); end if;
    if tg_op <> 'DELETE' then parents := array_append(parents,new.story_id); end if;
    for parent in select distinct id from unnest(parents) id where id is not null order by id loop
      perform id from public.chimera_stories where id=parent and owner_kind='player' and owner_user_id=auth.uid();
      if not found then
        -- FK cascades run after the owned parent was deleted. A top-level
        -- delete cannot use a hidden foreign parent as a missing-parent bypass.
        if tg_op='DELETE' and pg_trigger_depth()>1
           and not exists(select 1 from public.chimera_stories where id=parent) then continue; end if;
        raise exception using errcode='P0002', message='Owned context not found';
      end if;
    end loop;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
-- Transfer to a metadata-only owner, then remove the temporary transfer grants.
grant create on schema public to stonecaster_lore_parent_guard;
alter function public.chimera_guard_lore_story_owner() owner to stonecaster_lore_parent_guard;
revoke create on schema public from stonecaster_lore_parent_guard;
do $$ begin execute format('revoke stonecaster_lore_parent_guard from %I',current_user); end $$;
revoke all on function public.chimera_guard_lore_story_owner() from public, anon, authenticated, service_role;
drop trigger if exists chimera_author_lore_story_owner on public.chimera_lore;
create trigger chimera_author_lore_story_owner before insert or update or delete
  on public.chimera_lore for each row execute function public.chimera_guard_lore_story_owner();

create or replace function public.chimera_write_owned_lore(
  p_action text, p_id uuid default null, p_data jsonb default '{}'::jsonb
) returns jsonb
language plpgsql volatile security invoker
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  item public.chimera_lore;
  parent_story uuid;
  parent_world uuid;
  parent_entity uuid;
  selected uuid;
  tag_id uuid;
  name text;
  field text;
  allowed text[];
  patch jsonb;
  entry text;
begin
  if actor is null then raise exception using errcode='42501', message='Authentication required'; end if;
  if p_action is null or p_action not in ('create','update','delete')
     or p_data is null or jsonb_typeof(p_data) <> 'object'
     or (p_action='create' and p_id is not null)
     or (p_action<>'create' and p_id is null) then
    raise exception using errcode='22023', message='Invalid lore write request';
  end if;
  allowed := case p_action when 'create' then array['world_id','entity_id','story_id','display_name','entry_text','keywords','type','tag_names']
    when 'update' then array['display_name','entry_text','keywords','type','tag_names'] else '{}'::text[] end;
  if exists(select 1 from jsonb_object_keys(p_data) k where not k=any(allowed))
     or (p_action='update' and p_data='{}'::jsonb) then
    raise exception using errcode='22023', message='Unsupported lore fields';
  end if;
  foreach field in array array['display_name','entry_text','type','world_id','entity_id','story_id'] loop
    if p_data ? field and jsonb_typeof(p_data->field) <> 'string' then
      raise exception using errcode='22023', message='Invalid lore field';
    end if;
  end loop;
  if (p_action='create' and (not p_data ? 'display_name' or not p_data ? 'entry_text'))
     or (p_data ? 'display_name' and length(p_data->>'display_name') not between 1 and 200)
     or (p_data ? 'entry_text' and length(p_data->>'entry_text') not between 1 and 100000)
     or length(p_data->>'type') > 200 then
    raise exception using errcode='22023', message='Invalid lore text';
  end if;
  foreach field in array array['keywords','tag_names'] loop
    if p_data ? field then
      if jsonb_typeof(p_data->field) <> 'array' then
        raise exception using errcode='22023', message='Invalid lore list';
      end if;
      if jsonb_array_length(p_data->field) > 100 or exists(
        select 1 from jsonb_array_elements(p_data->field) v
        where jsonb_typeof(v) <> 'string' or length(v#>>'{}') > case when field='tag_names' then 160 else 200 end
          or (field='tag_names' and not (v#>>'{}') ~ '^[A-Z0-9_]+$')
      ) then raise exception using errcode='22023', message='Invalid lore list entries'; end if;
    end if;
  end loop;

  if p_action='create' then
    -- Specific context wins. Never persist lower-priority, unchecked parents.
    if p_data ? 'entity_id' then
      selected := (p_data->>'entity_id')::uuid;
      select id,world_id into parent_entity,parent_world from public.chimera_entities
        where id=selected and owner_kind='player' and owner_user_id=actor for share;
    elsif p_data ? 'story_id' then
      selected := (p_data->>'story_id')::uuid;
      select id,world_id into parent_story,parent_world from public.chimera_stories
        where id=selected and owner_kind='player' and owner_user_id=actor for update;
    elsif p_data ? 'world_id' then
      selected := (p_data->>'world_id')::uuid;
      select id into parent_world from public.chimera_worlds
        where id=selected and owner_kind='player' and owner_user_id=actor for share;
    else raise exception using errcode='22023', message='Lore context required'; end if;
    if not found then raise exception using errcode='P0002', message='Owned context not found'; end if;
    patch := jsonb_build_object('display_name',p_data->>'display_name','entry_text',p_data->>'entry_text',
      'created_at',now(),'updated_at',now());
    if p_data ? 'type' then patch := patch || jsonb_build_object('type',p_data->>'type'); end if;
    insert into public.chimera_lore(world_id,entity_id,story_id,fragment,keywords,owner_kind,owner_user_id,visibility)
      values(parent_world,parent_entity,parent_story,patch,
        array(select jsonb_array_elements_text(coalesce(p_data->'keywords','[]'::jsonb))), 'player',actor,'private')
      returning * into item;
  else
    select story_id into parent_story from public.chimera_lore
      where id=p_id and owner_kind='player' and owner_user_id=actor;
    if not found then raise exception using errcode='P0002', message='Owned lore not found'; end if;
    -- Entitlement child triggers lock story then policy; match that order before lore.
    -- Legacy foreign-story links must not let the child trigger edit another owner's story.
    if parent_story is not null then
      perform id from public.chimera_stories where id=parent_story and owner_kind='player' and owner_user_id=actor for update;
      if not found then raise exception using errcode='P0002', message='Owned context not found'; end if;
    end if;
    select * into item from public.chimera_lore
      where id=p_id and owner_kind='player' and owner_user_id=actor for update;
    if not found then raise exception using errcode='P0002', message='Owned lore not found'; end if;
    if item.story_id is distinct from parent_story then
      raise exception using errcode='40001', message='Lore parent changed concurrently';
    end if;
    if p_action='delete' then
      delete from public.chimera_asset_tags where asset_id=item.id and asset_type='lore_entry'
        and owner_kind='player' and owner_user_id=actor;
      delete from public.chimera_lore where id=item.id and owner_kind='player' and owner_user_id=actor;
      return jsonb_build_object('id',item.id,'deleted',true);
    end if;
    if jsonb_typeof(item.fragment) <> 'object' then
      raise exception using errcode='23514', message='Lore fragment must be an object';
    end if;
    patch := p_data - array['keywords','tag_names'];
    patch := patch || jsonb_build_object('updated_at',clock_timestamp());
    update public.chimera_lore set fragment=fragment||patch,
      keywords=case when p_data ? 'keywords' then array(select jsonb_array_elements_text(p_data->'keywords')) else keywords end,
      embedding=case when p_data ? 'entry_text' and fragment->>'entry_text' is distinct from p_data->>'entry_text' then null else embedding end
      where id=item.id and owner_kind='player' and owner_user_id=actor returning * into item;
  end if;

  if p_data ? 'tag_names' then
    delete from public.chimera_asset_tags where asset_id=item.id and asset_type='lore_entry'
      and owner_kind='player' and owner_user_id=actor;
    -- Stable order across concurrent lore edits; names are normalized before this RPC.
    for name in select distinct v collate "C" from jsonb_array_elements_text(p_data->'tag_names') v order by 1 loop
      tag_id := gen_random_uuid();
      insert into public.chimera_tags(id,content_key,tag_name,is_approved,owner_kind,owner_user_id)
        values(tag_id,tag_id::text,name,false,'player',actor)
        on conflict(owner_namespace,tag_name) do nothing returning id into tag_id;
      if tag_id is null then
        select id into tag_id from public.chimera_tags where owner_kind='player' and owner_user_id=actor and tag_name=name for share;
      end if;
      if tag_id is null then raise exception using errcode='40001', message='Tag changed concurrently'; end if;
      insert into public.chimera_asset_tags(tag_id,asset_id,asset_type,owner_kind,owner_user_id)
        values(tag_id,item.id,'lore_entry','player',actor);
    end loop;
  end if;
  entry := case when jsonb_typeof(item.fragment->'entry_text')='string' then item.fragment->>'entry_text'
    when jsonb_typeof(item.fragment->'content')='string' then item.fragment->>'content' else null end;
  return jsonb_build_object('id',item.id,'content_key',item.content_key,'owner_kind',item.owner_kind,
    'owner_namespace',item.owner_namespace,'owner_user_id',item.owner_user_id,'visibility',item.visibility,
    'release_state',item.release_state,'is_official',false,'world_id',item.world_id,'entity_id',item.entity_id,
    'story_id',item.story_id,'fragment',item.fragment,'keywords',coalesce(to_jsonb(item.keywords),'[]'::jsonb),
    'display_name',case when jsonb_typeof(item.fragment->'display_name')='string' then item.fragment->>'display_name' else null end,
    'entry_text',entry,'content_chunk',entry,'type',case when jsonb_typeof(item.fragment->'type')='string' then item.fragment->>'type' else null end,
    'embedding',null,'created_at',item.created_at,'updated_at',item.updated_at,
    'tags',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'tag_name',t.tag_name) order by t.tag_name collate "C",t.id)
      from public.chimera_asset_tags a join public.chimera_tags t on t.id=a.tag_id
      where a.asset_id=item.id and a.asset_type='lore_entry' and a.owner_kind='player' and a.owner_user_id=actor
        and t.owner_kind='player' and t.owner_user_id=actor),'[]'::jsonb));
end;
$$;
revoke all on function public.chimera_write_owned_lore(text,uuid,jsonb) from public, anon, service_role;
grant execute on function public.chimera_write_owned_lore(text,uuid,jsonb) to authenticated;
comment on function public.chimera_write_owned_lore(text,uuid,jsonb)
is 'Atomic caller-RLS lore create/update/delete and owner-scoped tag replacement. Selected parent owned on create; lore owner on edits; story locks/entitlement triggers retained; no first-party writes or visibility transitions.';
notify pgrst, 'reload schema';
commit;
