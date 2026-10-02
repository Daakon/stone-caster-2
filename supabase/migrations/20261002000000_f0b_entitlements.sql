-- F0b entitlement contract. Product caps/default tier are intentionally unseeded.
begin;

create table if not exists public.chimera_tier_limits (
  tier_key text primary key check (length(tier_key) between 1 and 100),
  max_owned_stories integer not null check (max_owned_stories >= 0),
  max_saved_games integer not null check (max_saved_games >= 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.chimera_entitlement_config (
  singleton boolean primary key default true check (singleton),
  default_tier_key text not null references public.chimera_tier_limits(tier_key),
  updated_at timestamptz not null default now()
);
create table if not exists public.chimera_user_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier_key text not null references public.chimera_tier_limits(tier_key),
  assigned_at timestamptz not null default now()
);
create table if not exists public.chimera_entitlement_active_choices (
  user_id uuid not null references auth.users(id) on delete cascade,
  story_id uuid references public.chimera_stories(id) on delete cascade,
  game_state_id uuid references public.chimera_game_states(id) on delete cascade,
  priority integer not null check (priority >= 0),
  selected_at timestamptz not null default now(),
  check (num_nonnulls(story_id, game_state_id) = 1)
);
create unique index if not exists chimera_choices_story on public.chimera_entitlement_active_choices(user_id,story_id) where story_id is not null;
create unique index if not exists chimera_choices_game on public.chimera_entitlement_active_choices(user_id,game_state_id) where game_state_id is not null;
create unique index if not exists chimera_choices_priority_story on public.chimera_entitlement_active_choices(user_id,priority) where story_id is not null;
create unique index if not exists chimera_choices_priority_game on public.chimera_entitlement_active_choices(user_id,priority) where game_state_id is not null;
alter table public.chimera_stories add column if not exists last_edited_at timestamptz;
alter table public.chimera_game_states add column if not exists last_played_at timestamptz;
create index if not exists chimera_owned_story_activity on public.chimera_stories(owner_user_id,last_edited_at desc,created_at desc,id);
create index if not exists chimera_owned_game_activity on public.chimera_game_states(player_id,last_played_at desc,created_at desc,id);

-- Internal helper: entitlement row, then tier-policy row. Never acquires game locks.
create or replace function public.chimera_lock_entitlement(p_user_id uuid)
returns public.chimera_tier_limits language plpgsql security definer set search_path = pg_catalog, public as $$
declare policy public.chimera_tier_limits; tier text;
begin
  if p_user_id is null then raise exception 'ENTITLEMENT_OWNER_REQUIRED'; end if;
  if not exists (select 1 from public.chimera_user_entitlements where user_id=p_user_id) then
    select default_tier_key into tier from public.chimera_entitlement_config where singleton for share;
    if tier is null then raise exception 'ENTITLEMENT_NOT_CONFIGURED'; end if;
    insert into public.chimera_user_entitlements(user_id,tier_key) values(p_user_id,tier) on conflict(user_id) do nothing;
  end if;
  select tier_key into tier from public.chimera_user_entitlements where user_id=p_user_id for update;
  select * into policy from public.chimera_tier_limits where tier_key=tier for share;
  if not found then raise exception 'ENTITLEMENT_NOT_CONFIGURED'; end if;
  return policy;
end $$;

create or replace function public.chimera_entitlement_snapshot(p_user_id uuid, p_policy public.chimera_tier_limits)
returns jsonb language sql stable security definer set search_path = pg_catalog, public as $$
  select jsonb_build_object(
    'state','ready', 'tier_key',p_policy.tier_key,
    'limits',jsonb_build_object('max_owned_stories',p_policy.max_owned_stories,'max_saved_games',p_policy.max_saved_games),
    'usage',jsonb_build_object('owned_stories',(select count(*) from public.chimera_stories where owner_user_id=p_user_id and owner_kind='player'),
                             'saved_games',(select count(*) from public.chimera_game_states where player_id=p_user_id)),
    'stories',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'label',s.display_name) order by coalesce(s.last_edited_at,s.created_at) desc,s.created_at desc,s.id)
      from public.chimera_stories s where s.owner_user_id=p_user_id and s.owner_kind='player'),'[]'::jsonb),
    'games',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'label',coalesce(c.frozen_title,'Saved game')) order by coalesce(g.last_played_at,g.created_at) desc,g.created_at desc,g.id)
      from public.chimera_game_states g left join public.chimera_compiled_stories c on c.id=g.compiled_story_id where g.player_id=p_user_id),'[]'::jsonb),
    'selected_story_ids',coalesce((select jsonb_agg(story_id order by priority) from public.chimera_entitlement_active_choices where user_id=p_user_id and story_id is not null),'[]'::jsonb),
    'selected_game_ids',coalesce((select jsonb_agg(game_state_id order by priority) from public.chimera_entitlement_active_choices where user_id=p_user_id and game_state_id is not null),'[]'::jsonb),
    'writable_story_ids',coalesce((select jsonb_agg(id order by position) from (
      select s.id,row_number() over(order by c.priority nulls last,coalesce(s.last_edited_at,s.created_at) desc,s.created_at desc,s.id) position
      from public.chimera_stories s left join public.chimera_entitlement_active_choices c on c.user_id=p_user_id and c.story_id=s.id
      where s.owner_user_id=p_user_id and s.owner_kind='player'
      order by c.priority nulls last,coalesce(s.last_edited_at,s.created_at) desc,s.created_at desc,s.id limit p_policy.max_owned_stories
    ) ranked),'[]'::jsonb),
    'writable_game_ids',coalesce((select jsonb_agg(id order by position) from (
      select g.id,row_number() over(order by c.priority nulls last,coalesce(g.last_played_at,g.created_at) desc,g.created_at desc,g.id) position
      from public.chimera_game_states g left join public.chimera_entitlement_active_choices c on c.user_id=p_user_id and c.game_state_id=g.id
      where g.player_id=p_user_id
      order by c.priority nulls last,coalesce(g.last_played_at,g.created_at) desc,g.created_at desc,g.id limit p_policy.max_saved_games
    ) ranked),'[]'::jsonb)
  )
$$;

create or replace function public.chimera_entitlements_active()
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare policy public.chimera_tier_limits;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  begin policy := public.chimera_lock_entitlement(auth.uid());
  exception when others then
    if sqlerrm='ENTITLEMENT_NOT_CONFIGURED' then return jsonb_build_object('state','configuration_pending'); end if;
    raise;
  end;
  return public.chimera_entitlement_snapshot(auth.uid(),policy);
end $$;

create or replace function public.chimera_set_active_choices(p_story_ids uuid[], p_game_ids uuid[])
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare owner_id uuid := auth.uid(); policy public.chimera_tier_limits;
begin
  if owner_id is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_story_ids is null or p_game_ids is null or array_position(p_story_ids,null) is not null or array_position(p_game_ids,null) is not null
     or cardinality(p_story_ids)<>(select count(distinct id) from unnest(p_story_ids) id)
     or cardinality(p_game_ids)<>(select count(distinct id) from unnest(p_game_ids) id) then raise exception 'CHOICES_INVALID'; end if;
  -- Existing game/story locks precede the entitlement lock, including FK locks.
  perform id from public.chimera_game_states where id=any(p_game_ids) and player_id=owner_id order by id for key share;
  if (select count(*) from public.chimera_game_states where id=any(p_game_ids) and player_id=owner_id)<>cardinality(p_game_ids) then raise exception 'CHOICES_NOT_OWNED'; end if;
  perform id from public.chimera_stories where id=any(p_story_ids) and owner_user_id=owner_id and owner_kind='player' order by id for key share;
  if (select count(*) from public.chimera_stories where id=any(p_story_ids) and owner_user_id=owner_id and owner_kind='player')<>cardinality(p_story_ids) then raise exception 'CHOICES_NOT_OWNED'; end if;
  policy := public.chimera_lock_entitlement(owner_id);
  if cardinality(p_story_ids)>policy.max_owned_stories or cardinality(p_game_ids)>policy.max_saved_games then raise exception 'CHOICES_EXCEED_TIER_LIMIT'; end if;
  delete from public.chimera_entitlement_active_choices where user_id=owner_id;
  insert into public.chimera_entitlement_active_choices(user_id,story_id,priority)
    select owner_id,id,position::integer-1 from unnest(p_story_ids) with ordinality items(id,position);
  insert into public.chimera_entitlement_active_choices(user_id,game_state_id,priority)
    select owner_id,id,position::integer-1 from unnest(p_game_ids) with ordinality items(id,position);
  return public.chimera_entitlement_snapshot(owner_id,policy);
end $$;

create or replace function public.chimera_admin_set_tier(p_tier text,p_stories integer,p_games integer,p_default boolean)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'admin required' using errcode='42501'; end if;
  if p_stories is null or p_games is null or p_stories<0 or p_games<0 or length(trim(p_tier)) not between 1 and 100 then raise exception 'TIER_POLICY_INVALID'; end if;
  if p_default then perform singleton from public.chimera_entitlement_config where singleton for update; end if;
  insert into public.chimera_tier_limits(tier_key,max_owned_stories,max_saved_games) values(p_tier,p_stories,p_games)
    on conflict(tier_key) do update set max_owned_stories=excluded.max_owned_stories,max_saved_games=excluded.max_saved_games,updated_at=now();
  if p_default then
    insert into public.chimera_entitlement_config(singleton,default_tier_key) values(true,p_tier)
      on conflict(singleton) do update set default_tier_key=excluded.default_tier_key,updated_at=now();
  end if;
end $$;

create or replace function public.chimera_admin_assign_tier(p_user_id uuid,p_tier text)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'admin required' using errcode='42501'; end if;
  -- Assignment serializes with creation/choice updates on this same user row.
  if not exists(select 1 from public.chimera_tier_limits where tier_key=p_tier) then raise exception 'TIER_NOT_FOUND'; end if;
  insert into public.chimera_user_entitlements(user_id,tier_key) values(p_user_id,p_tier) on conflict(user_id) do nothing;
  perform user_id from public.chimera_user_entitlements where user_id=p_user_id for update;
  perform tier_key from public.chimera_tier_limits where tier_key=p_tier for share;
  if not found then raise exception 'TIER_NOT_FOUND'; end if;
  update public.chimera_user_entitlements set tier_key=p_tier,assigned_at=now() where user_id=p_user_id;
end $$;

create or replace function public.chimera_signup_entitlement()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  begin perform public.chimera_lock_entitlement(new.id);
  exception when others then raise warning 'Chimera entitlement repair deferred: SQLSTATE %',sqlstate;
  end;
  return new;
end $$;
drop trigger if exists chimera_signup_entitlement on auth.users;
create trigger chimera_signup_entitlement after insert on auth.users for each row execute function public.chimera_signup_entitlement();

create or replace function public.chimera_guard_entitled_content()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare policy public.chimera_tier_limits; snapshot jsonb; owner_id uuid;
begin
  owner_id := case when tg_table_name='chimera_stories' then (to_jsonb(new)->>'owner_user_id')::uuid else (to_jsonb(new)->>'player_id')::uuid end;
  if tg_table_name='chimera_stories' and to_jsonb(new)->>'owner_kind'<>'player' then return new; end if;
  policy := public.chimera_lock_entitlement(owner_id);
  if tg_op='INSERT' then
    if tg_table_name='chimera_stories' then
      if (select count(*) from public.chimera_stories where owner_user_id=owner_id and owner_kind='player')>=policy.max_owned_stories then raise exception 'STORY_LIMIT_REACHED'; end if;
    else
      if (select count(*) from public.chimera_game_states where player_id=owner_id)>=policy.max_saved_games then raise exception 'GAME_LIMIT_REACHED'; end if;
    end if;
  else
    snapshot := public.chimera_entitlement_snapshot(owner_id,policy);
    if tg_table_name='chimera_stories' then
      if not (snapshot->'writable_story_ids') ? new.id::text then raise exception 'STORY_READ_ONLY_TIER_LIMIT'; end if;
      new.last_edited_at := now();
    else
      if not (snapshot->'writable_game_ids') ? new.id::text then raise exception 'GAME_READ_ONLY_TIER_LIMIT'; end if;
      if coalesce((new.narrative_focus->>'committed_turn')::integer,0)>coalesce((old.narrative_focus->>'committed_turn')::integer,0) then new.last_played_at := now(); end if;
    end if;
  end if;
  return new;
end $$;

-- Insert checks run in privileged backend RPCs, also protecting accidental bypass.
drop trigger if exists chimera_story_entitlement on public.chimera_stories;
create trigger chimera_story_entitlement before insert or update on public.chimera_stories for each row execute function public.chimera_guard_entitled_content();
drop trigger if exists chimera_game_entitlement on public.chimera_game_states;
create trigger chimera_game_entitlement before insert or update on public.chimera_game_states for each row execute function public.chimera_guard_entitled_content();

-- Editing linked rules, cast, packs or lore is still an edit of its parent story.
-- Lock parents before entitlements; cascade deletion skips an already-gone parent.
create or replace function public.chimera_guard_entitled_story_child()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare parent public.chimera_stories; parent_ids uuid[] := '{}'; policy public.chimera_tier_limits;
begin
  if tg_op<>'INSERT' then parent_ids := array_append(parent_ids,old.story_id); end if;
  if tg_op<>'DELETE' then parent_ids := array_append(parent_ids,new.story_id); end if;
  for parent in select * from public.chimera_stories where id=any(parent_ids) and owner_kind='player' order by id for update loop
    policy := public.chimera_lock_entitlement(parent.owner_user_id);
    if not (public.chimera_entitlement_snapshot(parent.owner_user_id,policy)->'writable_story_ids') ? parent.id::text then raise exception 'STORY_READ_ONLY_TIER_LIMIT'; end if;
    update public.chimera_stories set last_edited_at=now() where id=parent.id;
  end loop;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['chimera_story_compiled_ruleset','chimera_story_content_pack_links','chimera_story_entity_links','chimera_story_links','chimera_lore'] loop
    execute format('drop trigger if exists chimera_child_entitlement on public.%I',t);
    execute format('create trigger chimera_child_entitlement before insert or update or delete on public.%I for each row execute function public.chimera_guard_entitled_story_child()',t);
  end loop;
end $$;

create or replace function public.chimera_create_owned_story(p_user_id uuid,p_story jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare result public.chimera_stories;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'backend creation required' using errcode='42501'; end if;
  perform public.chimera_lock_entitlement(p_user_id);
  insert into public.chimera_stories(id,owner_user_id,display_name,title,description_short,description,image_url,content_rating,world_id,configuration,visibility,status,last_edited_at)
  values(coalesce((p_story->>'id')::uuid,gen_random_uuid()),p_user_id,p_story->>'display_name',p_story->>'display_name',p_story->>'description_short',p_story->>'description',p_story->>'image_url',coalesce(p_story->>'content_rating','safe'),
    (p_story->>'world_id')::uuid,coalesce(p_story->'configuration','{}'::jsonb),'private','draft',now()) returning * into result;
  return to_jsonb(result);
end $$;

create or replace function public.chimera_assert_game_writable(p_game_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare owner_id uuid; policy public.chimera_tier_limits;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  select player_id into owner_id from public.chimera_game_states where id=p_game_id and player_id=auth.uid() for update;
  if not found then raise exception 'game not found' using errcode='42501'; end if;
  policy := public.chimera_lock_entitlement(owner_id);
  if not (public.chimera_entitlement_snapshot(owner_id,policy)->'writable_game_ids') ? p_game_id::text then raise exception 'GAME_READ_ONLY_TIER_LIMIT'; end if;
end $$;

create or replace function public.chimera_create_pinned_game(p_user_id uuid,p_compiled_id uuid,p_character_id uuid,p_bundle jsonb)
returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare result uuid; cartridge public.chimera_compiled_stories; claims text := current_setting('request.jwt.claims',true); subject text := current_setting('request.jwt.claim.sub',true);
begin
  if auth.role() is distinct from 'service_role' then raise exception 'backend creation required' using errcode='42501'; end if;
  perform set_config('request.jwt.claim.sub',p_user_id::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',p_user_id,'role','authenticated')::text,true);
  if not public.can_start_chimera_game() then raise exception 'game creation restricted before launch' using errcode='42501'; end if;
  select * into cartridge from public.chimera_compiled_stories where id=p_compiled_id for update;
  if not found or not coalesce(cartridge.frozen_owner_user_id=p_user_id or public.is_admin() or public.is_chimera_prelaunch_tester(p_user_id),false) then raise exception 'compiled story not found' using errcode='42501'; end if;
  if not exists(select 1 from public.chimera_player_characters where id=p_character_id and user_id=p_user_id) then raise exception 'owned character required' using errcode='42501'; end if;
  perform public.chimera_lock_entitlement(p_user_id);
  insert into public.chimera_game_states(story_id,compiled_story_id,player_character_id,state_initialization_version,player_id,mechanical_state,narrative_focus,scene_registry,action_queue,compiled_system_prompt)
  values(cartridge.story_id,p_compiled_id,p_character_id,1,p_user_id,coalesce(p_bundle->'mechanical','{}'::jsonb),coalesce(p_bundle->'narrative','{}'::jsonb),coalesce(p_bundle->'registry','{}'::jsonb),coalesce(p_bundle->'queue','[]'::jsonb),null) returning id into result;
  perform set_config('request.jwt.claims',coalesce(claims,''),true);
  perform set_config('request.jwt.claim.sub',coalesce(subject,''),true);
  return result;
end $$;

-- All writes go through audited, validated functions; service-role JWTs are not admins.
do $$ declare t text; begin
  foreach t in array array['chimera_tier_limits','chimera_entitlement_config','chimera_user_entitlements','chimera_entitlement_active_choices'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  end loop;
end $$;
grant select on public.chimera_tier_limits,public.chimera_entitlement_config,public.chimera_user_entitlements,public.chimera_entitlement_active_choices to authenticated;
drop policy if exists chimera_tier_admin_read on public.chimera_tier_limits;
create policy chimera_tier_admin_read on public.chimera_tier_limits for select to authenticated using(public.is_admin());
drop policy if exists chimera_entitlement_config_admin_read on public.chimera_entitlement_config;
create policy chimera_entitlement_config_admin_read on public.chimera_entitlement_config for select to authenticated using(public.is_admin());
drop policy if exists chimera_entitlement_self_read on public.chimera_user_entitlements;
create policy chimera_entitlement_self_read on public.chimera_user_entitlements for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists chimera_choices_self_read on public.chimera_entitlement_active_choices;
create policy chimera_choices_self_read on public.chimera_entitlement_active_choices for select to authenticated using(user_id=auth.uid());
revoke insert on public.chimera_stories,public.chimera_game_states from authenticated,anon,service_role;
revoke all on function public.chimera_lock_entitlement(uuid),public.chimera_entitlement_snapshot(uuid,public.chimera_tier_limits),public.chimera_signup_entitlement(),public.chimera_guard_entitled_content() from public,anon,authenticated,service_role;
revoke all on function public.chimera_guard_entitled_story_child() from public,anon,authenticated,service_role;
revoke all on function public.chimera_entitlements_active(),public.chimera_set_active_choices(uuid[],uuid[]),public.chimera_admin_set_tier(text,integer,integer,boolean),public.chimera_admin_assign_tier(uuid,text),public.chimera_assert_game_writable(uuid),public.chimera_create_owned_story(uuid,jsonb),public.chimera_create_pinned_game(uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.chimera_entitlements_active(),public.chimera_set_active_choices(uuid[],uuid[]),public.chimera_admin_set_tier(text,integer,integer,boolean),public.chimera_admin_assign_tier(uuid,text),public.chimera_assert_game_writable(uuid) to authenticated;
grant execute on function public.chimera_create_owned_story(uuid,jsonb),public.chimera_create_pinned_game(uuid,uuid,uuid,jsonb) to service_role;
-- The F0a invoker ownership trigger calls this pure JSON canonicalizer on edits.
grant execute on function public.content_canonical_json(jsonb) to authenticated,service_role;

notify pgrst, 'reload schema';
commit;
