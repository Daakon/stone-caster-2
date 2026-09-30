-- New sessions are created only after the F0a prelaunch reset. These pins make
-- their compiled rules and selected character explicit from the first insert.
alter table public.chimera_game_states
  add column if not exists player_character_id uuid,
  add column if not exists state_initialization_version smallint;

do $$
begin
  if exists (select 1 from public.chimera_game_states)
     and not exists (select 1 from public.chimera_prelaunch_resets) then
    raise exception 'Phase 0 pin migration requires a recorded prelaunch reset before touching existing game states';
  end if;
  if exists (
    select 1 from public.chimera_game_states
    where player_character_id is null or state_initialization_version is null
  ) then
    raise exception 'Phase 0 requires the approved prelaunch reset before enforcing new-session pins';
  end if;
end
$$;

alter table public.chimera_game_states
  alter column player_character_id set not null,
  alter column state_initialization_version set not null;

alter table public.chimera_game_states
  drop constraint if exists chimera_game_states_player_character_id_fkey;
alter table public.chimera_game_states
  add constraint chimera_game_states_player_character_id_fkey
  foreign key (player_character_id) references public.chimera_player_characters(id) on delete restrict;

alter table public.chimera_game_states
  drop constraint if exists chimera_game_states_initialization_version_check;
alter table public.chimera_game_states
  add constraint chimera_game_states_initialization_version_check
  check (state_initialization_version = 1);

create table if not exists public.chimera_prelaunch_testers (
  user_id uuid primary key references auth.users(id) on delete cascade
);
revoke all on public.chimera_prelaunch_testers from public, anon, authenticated, service_role;
alter table public.chimera_prelaunch_testers enable row level security;

create or replace function public.is_chimera_prelaunch_tester(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from public.chimera_prelaunch_testers where user_id = p_user_id)
$$;
revoke all on function public.is_chimera_prelaunch_tester(uuid) from public, anon, service_role, stonecaster_content_deployer;
grant execute on function public.is_chimera_prelaunch_tester(uuid) to authenticated;

create or replace function public.can_start_chimera_game()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null and (
    exists(select 1 from public.chimera_launch_guard where real_players_started_at is not null)
    or public.is_admin()
    or public.is_chimera_prelaunch_tester(auth.uid())
  )
$$;
revoke all on function public.can_start_chimera_game() from public, anon, service_role, stonecaster_content_deployer;
grant execute on function public.can_start_chimera_game() to authenticated;

create or replace function public.check_chimera_game_character_owner()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if current_user <> 'postgres' and not public.can_start_chimera_game() then
    raise exception 'game creation is restricted to admins and approved testers before launch';
  end if;
  if not exists (
    select 1 from public.chimera_player_characters c
    where c.id = new.player_character_id and c.user_id = new.player_id
  ) then
    raise exception 'selected character must belong to the game player';
  end if;
  return new;
end
$$;

revoke execute on function public.check_chimera_game_character_owner()
  from public, anon, authenticated, service_role, stonecaster_content_deployer;

drop trigger if exists chimera_game_character_owner on public.chimera_game_states;
create trigger chimera_game_character_owner
before insert or update of player_character_id, player_id on public.chimera_game_states
for each row execute function public.check_chimera_game_character_owner();

drop policy if exists chimera_compiled_stories_pinned_read on public.chimera_compiled_stories;
create policy chimera_compiled_stories_pinned_read on public.chimera_compiled_stories for select to authenticated
  using (frozen_owner_user_id = auth.uid() or public.is_admin() or public.is_chimera_prelaunch_tester(auth.uid())
    or exists (select 1 from public.chimera_game_states g where g.compiled_story_id = chimera_compiled_stories.id and g.player_id = auth.uid()));
drop policy if exists chimera_content_blobs_pinned_read on public.chimera_content_blobs;
drop policy if exists chimera_compiled_refs_pinned_read on public.chimera_compiled_content_refs;
create policy chimera_compiled_refs_pinned_read on public.chimera_compiled_content_refs for select to authenticated
  using (exists (select 1 from public.chimera_compiled_stories c where c.id = compiled_story_id
    and (c.frozen_owner_user_id = auth.uid() or public.is_admin() or public.is_chimera_prelaunch_tester(auth.uid())
      or exists (select 1 from public.chimera_game_states g where g.compiled_story_id = c.id and g.player_id = auth.uid()))));
create policy chimera_content_blobs_pinned_read on public.chimera_content_blobs for select to authenticated
  using (exists (select 1 from public.chimera_compiled_content_refs r join public.chimera_compiled_stories c on c.id = r.compiled_story_id
    where r.sha256 = chimera_content_blobs.sha256 and (c.frozen_owner_user_id = auth.uid() or public.is_admin()
      or public.is_chimera_prelaunch_tester(auth.uid())
      or exists (select 1 from public.chimera_game_states g where g.compiled_story_id = c.id and g.player_id = auth.uid()))));
