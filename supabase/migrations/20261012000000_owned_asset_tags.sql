begin;

-- Tag replacement is one caller-RLS transaction. The owner is always auth.uid();
-- neither approval nor an admin claim permits adopting another owner's tags.
create or replace function public.chimera_replace_owned_asset_tags(
  p_asset_type text, p_asset_id uuid, p_tag_names jsonb
) returns jsonb language plpgsql volatile security invoker
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid(); name text; tag uuid; found_asset uuid;
begin
  if actor is null or auth.role() is distinct from 'authenticated' then
    raise exception using errcode='42501',message='Authentication required';
  end if;
  if p_asset_id is null or p_asset_type is null or p_asset_type not in ('world','entity_template')
     or jsonb_typeof(p_tag_names) is distinct from 'array' then
    raise exception using errcode='22023',message='Invalid asset tags';
  end if;
  if jsonb_array_length(p_tag_names)>100 or exists(
    select 1 from jsonb_array_elements(p_tag_names) t(value)
    where jsonb_typeof(value) <> 'string' or length(value#>>'{}') not between 1 and 160
      or (value#>>'{}') !~ '^[A-Z0-9_]+$'
  ) then raise exception using errcode='22023',message='Invalid asset tags'; end if;

  -- Serialize replacements of this asset and prevent deletion during the write.
  if p_asset_type='world' then
    select id into found_asset from public.chimera_worlds
      where id=p_asset_id and owner_kind='player' and owner_user_id=actor for update;
  else
    select id into found_asset from public.chimera_entities
      where id=p_asset_id and owner_kind='player' and owner_user_id=actor for update;
  end if;
  if found_asset is null then raise exception using errcode='P0002',message='Owned asset not found'; end if;

  delete from public.chimera_asset_tags where asset_id=p_asset_id and asset_type=p_asset_type
    and owner_kind='player' and owner_user_id=actor;
  for name in select distinct value from jsonb_array_elements_text(p_tag_names) order by value loop
    insert into public.chimera_tags(tag_name,is_approved,owner_kind,owner_user_id,content_key)
      values(name,false,'player',actor,gen_random_uuid()::text)
      on conflict(owner_namespace,tag_name) do nothing;
    select id into tag from public.chimera_tags where owner_namespace=actor::text
      and owner_kind='player' and owner_user_id=actor and tag_name=name for share;
    if tag is null then raise exception using errcode='40001',message='Tag changed concurrently'; end if;
    insert into public.chimera_asset_tags(tag_id,asset_id,asset_type,owner_kind,owner_user_id,content_key)
      values(tag,p_asset_id,p_asset_type,'player',actor,concat(p_asset_type,':',p_asset_id,':',tag));
  end loop;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'tag_name',t.tag_name)
    order by t.tag_name,t.id),'[]'::jsonb)
    from public.chimera_asset_tags a join public.chimera_tags t on t.id=a.tag_id
    where a.asset_id=p_asset_id and a.asset_type=p_asset_type and a.owner_kind='player' and a.owner_user_id=actor
      and t.owner_kind='player' and t.owner_user_id=actor);
end;
$$;
revoke all on function public.chimera_replace_owned_asset_tags(text,uuid,jsonb) from public,anon,service_role;
grant execute on function public.chimera_replace_owned_asset_tags(text,uuid,jsonb) to authenticated;

commit;
