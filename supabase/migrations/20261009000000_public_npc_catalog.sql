-- Read-only, request-RLS catalog. Filtering and counting share one snapshot.
create or replace function public.chimera_public_npc_page(
  p_search text default null,
  p_world text default null,
  p_world_key text default null,
  p_active_only boolean default false,
  p_limit integer default 20,
  p_offset integer default 0
) returns jsonb
language plpgsql stable security invoker
set search_path = public, pg_temp
as $$
declare result jsonb;
begin
  if p_limit is null or p_limit not between 1 and 100
     or p_offset is null or p_offset not between 0 and 1000
     or length(p_search) > 100 or length(p_world) > 200
     or length(p_world_key) > 200 or p_active_only is null then
    raise exception using errcode = '22023', message = 'Invalid NPC catalog request';
  end if;
  with sources as (
    select s.content_key, s.owner_namespace, s.created_at, s.updated_at,
      s.body, jsonb_build_object('content_key',s.content_key,
        'owner_namespace',s.owner_namespace,'created_at',s.created_at,
        'updated_at',s.updated_at,'release_state',s.release_state,'body',s.body) as item
    from public.chimera_content_source_items s
    where s.content_kind = 'entity' and s.owner_namespace = 'first_party'
      and s.release_state = 'published'
    union all
    select e.content_key, e.owner_namespace, e.created_at, e.updated_at,
      jsonb_build_object('display_name',e.display_name,'entity_type',e.entity_type,
        'raw_data',e.raw_data,'world_id',e.world_id) as body,
      jsonb_build_object('id',e.id,'key',e.key,'slug',e.slug,'content_key',e.content_key,
        'owner_kind',e.owner_kind,'owner_namespace',e.owner_namespace,
        'owner_user_id',e.owner_user_id,'release_state',e.release_state,
        'visibility',e.visibility,'display_name',e.display_name,'entity_type',e.entity_type,
        'raw_data',e.raw_data,'world_id',e.world_id,'primary_image_url',e.primary_image_url,
        'icon_image_url',e.icon_image_url,'created_at',e.created_at,'updated_at',e.updated_at) as item
    from public.chimera_entities e
    where e.owner_kind = 'player' and e.visibility = 'public'
  ), normalized as (
    select s.*,
      coalesce(body->>'entity_type',body#>>'{raw_data,entity_type}',body#>>'{raw_data,type}') as entity_type,
      coalesce(body->>'display_name',body#>>'{raw_data,display_name}',body#>>'{raw_data,name}') as name,
      coalesce(body->>'description_short',body#>>'{raw_data,description_short}',
        body#>>'{raw_data,description}',body->>'description_long',body#>>'{raw_data,description_long}') as description,
      coalesce(nullif(body#>'{raw_data,role_tags}','null'::jsonb),
        nullif(body#>'{raw_data,tags}','null'::jsonb),'[]'::jsonb) as role_tags
    from sources s
  ), filtered as (
    select * from normalized
    where entity_type = 'NPC'
      and (p_world is null or case when owner_namespace = 'first_party'
        then body->>'world_key' = p_world_key
        else coalesce(body->>'world_id',body#>>'{raw_data,world_id}') = p_world end)
      and (not p_active_only or body#>>'{raw_data,status}' = 'active')
      and (coalesce(p_search,'') = ''
        or strpos(lower(name),lower(p_search)) > 0
        or strpos(lower(description),lower(p_search)) > 0
        or exists (select 1 from jsonb_array_elements(
          case when jsonb_typeof(role_tags) = 'array' then role_tags else '[]'::jsonb end
        ) tag where jsonb_typeof(tag) = 'string' and strpos(lower(tag#>>'{}'),lower(p_search)) > 0))
  ), page as (
    select item, created_at, owner_namespace, content_key from filtered
    order by created_at desc, owner_namespace, content_key
    limit p_limit offset p_offset
  )
  select jsonb_build_object('items',coalesce((select jsonb_agg(item order by
    created_at desc,owner_namespace,content_key) from page),'[]'::jsonb),
    'total',(select count(*) from filtered)) into result;
  return result;
end;
$$;
revoke all on function public.chimera_public_npc_page(text,text,text,boolean,integer,integer) from public;
grant execute on function public.chimera_public_npc_page(text,text,text,boolean,integer,integer) to anon, authenticated, service_role;
comment on function public.chimera_public_npc_page(text,text,text,boolean,integer,integer)
is 'Public NPC authoring catalog: canonical published and player public only, under caller RLS; bounded page and exact filtered count.';
notify pgrst, 'reload schema';
