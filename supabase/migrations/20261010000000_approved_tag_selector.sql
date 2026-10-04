-- Fresh authoring selector, not a public tag catalog. Approval never grants access.
create or replace function public.chimera_approved_tag_page(
  p_limit integer default 50,
  p_offset integer default 0
) returns jsonb
language plpgsql stable security invoker
set search_path = public, pg_temp
as $$
declare
  result jsonb;
  request_owner uuid := auth.uid();
  preview boolean;
begin
  if request_owner is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if p_limit is null or p_limit not between 1 and 50
     or p_offset is null or p_offset not between 0 and 1000 then
    raise exception using errcode = '22023', message = 'Invalid tag selector request';
  end if;
  preview := public.is_admin();
  with available as (
    select s.content_key as id, s.body->>'tag_name' as tag_name,
      s.owner_namespace, s.content_key
    from public.chimera_content_source_items s
    where s.content_kind = 'tag' and s.owner_namespace = 'first_party'
      and (s.release_state = 'published' or preview)
      and s.body->'is_approved' = 'true'::jsonb
      and jsonb_typeof(s.body->'tag_name') = 'string'
      and length(s.body->>'tag_name') > 0
    union all
    select t.id::text, t.tag_name, t.owner_namespace, t.content_key
    from public.chimera_tags t
    where t.owner_kind = 'player' and t.owner_user_id = request_owner
      and t.is_approved = true and length(t.tag_name) > 0
  ), page as (
    select * from available
    order by tag_name collate "C", owner_namespace collate "C", content_key collate "C", id
    limit p_limit offset p_offset
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'tag_name',tag_name,'is_approved',true)
    order by tag_name collate "C", owner_namespace collate "C", content_key collate "C", id), '[]'::jsonb)
    into result from page;
  return result;
end;
$$;
revoke all on function public.chimera_approved_tag_page(integer,integer) from public, anon, service_role;
grant execute on function public.chimera_approved_tag_page(integer,integer) to authenticated;
comment on function public.chimera_approved_tag_page(integer,integer)
is 'Authenticated approved-tag selector: caller-owned player tags and current first-party published tags (internal only for verified admins), caller RLS, bounded merged page, no legacy first-party projection.';
notify pgrst, 'reload schema';
