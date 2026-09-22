-- StoneCaster canonical local baseline (5/6): corrected Row Level Security.
-- RLS is enabled on EVERY public table. service_role bypasses RLS (backend admin client).
-- Every deviation from hosted behaviour is documented in docs/local-supabase/RLS_CHANGES.md.
-- Conventions: is_admin() = profiles.role = 'admin'; ownership is checked against auth.uid().
set search_path to public, extensions;

do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;

-- ===== access_requests: public may file a *pending* request only; requester/admin may read =====
create policy ar_insert_pending on public.access_requests for insert to anon, authenticated
  with check (status = 'pending' and approved_by is null and approved_at is null and denied_by is null and denied_at is null
              and (user_id is null or user_id = auth.uid()));
create policy ar_select_own on public.access_requests for select to authenticated using (user_id = auth.uid());
create policy ar_admin_all on public.access_requests for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ===== identity / roles =====
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_admin_select on public.profiles for select to authenticated using (public.is_admin());
create policy profiles_admin_update on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- (no self-update policy: hosted let a user rewrite their own profiles.role, i.e. self-promote to admin)

create policy app_roles_select_own on public.app_roles for select to authenticated using (user_id = auth.uid());

create policy user_profiles_select_own on public.user_profiles for select to authenticated using (auth_user_id = auth.uid());
create policy user_profiles_update_own on public.user_profiles for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());
create policy user_profiles_admin_select on public.user_profiles for select to authenticated using (public.is_admin());

-- ===== public read-only catalogs (writes: admin or service_role only) =====
do $$
declare t text;
begin
  foreach t in array array['app_config','pricing_config','feature_flags','config_meta','chimera_ruleset_templates','chimera_world_ruleset_link',
                           'chimera_exclusion_groups','chimera_tags','chimera_asset_tags']
  loop
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_public_read', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin_all', t);
  end loop;
end $$;
-- authors may propose (unapproved) tags
create policy chimera_tags_propose on public.chimera_tags for insert to authenticated with check (is_approved = false);

-- ===== authenticated-read registries (writes: admin / service_role) =====
do $$
declare t text;
begin
  foreach t in array array['mechanics_skills','mechanics_conditions','mechanics_resources','slots','dialogue_config','dialogue_graphs',
                           'quest_graphs','quest_graph_indexes','translation_cache']
  loop
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_auth_read', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin_all', t);
  end loop;
end $$;

-- ===== admin-only (server-side config; hosted allowed authenticated users to read prompts) =====
do $$
declare t text;
begin
  foreach t in array array['ai_config','prompts','injection_map','experiments','experiment_variations','localization_glossary','localization_rules',
                           'localization_packs','npc_personalities','analytics_events','publish_history','turn_metrics','creators','creator_namespaces']
  loop
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin_all', t);
  end loop;
end $$;
create policy creator_namespaces_public_read on public.creator_namespaces for select to anon, authenticated using (verified = true);

-- ===== premade characters: active ones are public, admin manages =====
create policy premade_characters_public_read on public.premade_characters for select to anon, authenticated using (is_active = true);
create policy premade_characters_admin_all on public.premade_characters for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ===== worlds =====
create policy chimera_worlds_read on public.chimera_worlds for select to anon, authenticated
  using (visibility = 'public' or is_official is true or owner_user_id = auth.uid());
create policy chimera_worlds_insert_own on public.chimera_worlds for insert to authenticated
  with check (owner_user_id = auth.uid() and coalesce(is_official, false) = false);
create policy chimera_worlds_update_own on public.chimera_worlds for update to authenticated
  using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid() and coalesce(is_official, false) = false);
create policy chimera_worlds_delete_own on public.chimera_worlds for delete to authenticated using (owner_user_id = auth.uid());
create policy chimera_worlds_admin_all on public.chimera_worlds for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ===== entities =====
create policy chimera_entities_read on public.chimera_entities for select to anon, authenticated
  using (visibility = 'public' or is_official is true or owner_user_id = auth.uid());
create policy chimera_entities_insert_own on public.chimera_entities for insert to authenticated
  with check (owner_user_id = auth.uid() and coalesce(is_official, false) = false);
create policy chimera_entities_update_own on public.chimera_entities for update to authenticated
  using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid() and coalesce(is_official, false) = false);
create policy chimera_entities_delete_own on public.chimera_entities for delete to authenticated using (owner_user_id = auth.uid());
create policy chimera_entities_admin_all on public.chimera_entities for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ===== lore =====
create policy chimera_lore_read on public.chimera_lore for select to anon, authenticated
  using (visibility = 'public' or is_official is true or owner_user_id = auth.uid()
         or exists (select 1 from public.chimera_worlds w where w.id = chimera_lore.world_id and (w.owner_user_id = auth.uid() or w.visibility = 'public')));
create policy chimera_lore_write_world_owner on public.chimera_lore for all to authenticated
  using (owner_user_id = auth.uid() or exists (select 1 from public.chimera_worlds w where w.id = chimera_lore.world_id and w.owner_user_id = auth.uid()))
  with check (coalesce(is_official, false) = false and (owner_user_id = auth.uid() or exists (select 1 from public.chimera_worlds w where w.id = chimera_lore.world_id and w.owner_user_id = auth.uid())));
create policy chimera_lore_admin_all on public.chimera_lore for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ===== content packs =====
create policy chimera_content_packs_read on public.chimera_content_packs for select to anon, authenticated
  using (visibility = 'public' or owner_user_id = auth.uid());
create policy chimera_content_packs_owner_all on public.chimera_content_packs for all to authenticated
  using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy chimera_content_packs_admin_all on public.chimera_content_packs for all to authenticated using (public.is_admin()) with check (public.is_admin());
do $$
declare t text;
begin
  foreach t in array array['chimera_content_pack_entity_links','chimera_content_pack_lore_links','chimera_content_pack_ruleset_links']
  loop
    execute format('create policy %I on public.%I for select to anon, authenticated using (exists (select 1 from public.chimera_content_packs p where p.id = %I.pack_id and (p.visibility = ''public'' or p.owner_user_id = auth.uid())))', t || '_read', t, t);
    execute format('create policy %I on public.%I for all to authenticated using (exists (select 1 from public.chimera_content_packs p where p.id = %I.pack_id and p.owner_user_id = auth.uid())) with check (exists (select 1 from public.chimera_content_packs p where p.id = %I.pack_id and p.owner_user_id = auth.uid()))', t || '_owner_all', t, t, t);
  end loop;
end $$;
create policy chimera_pack_dependencies_owner_all on public.chimera_pack_dependencies for all to authenticated
  using (exists (select 1 from public.chimera_content_packs p where p.id = chimera_pack_dependencies.pack_id and p.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.chimera_content_packs p where p.id = chimera_pack_dependencies.pack_id and p.owner_user_id = auth.uid()));
create policy chimera_pack_dependencies_read on public.chimera_pack_dependencies for select to anon, authenticated
  using (exists (select 1 from public.chimera_content_packs p where p.id = chimera_pack_dependencies.pack_id and (p.visibility = 'public' or p.owner_user_id = auth.uid())));

-- ===== stories and their link tables =====
create policy chimera_stories_public_read on public.chimera_stories for select to anon, authenticated using (visibility = 'public');
create policy chimera_stories_owner_all on public.chimera_stories for all to authenticated
  using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy chimera_stories_admin_all on public.chimera_stories for all to authenticated using (public.is_admin()) with check (public.is_admin());

do $$
declare t text;
begin
  foreach t in array array['chimera_story_links','chimera_story_entity_links','chimera_story_content_pack_links','chimera_story_compiled_ruleset']
  loop
    execute format('create policy %I on public.%I for all to authenticated using (exists (select 1 from public.chimera_stories s where s.id = %I.story_id and s.owner_user_id = auth.uid())) with check (exists (select 1 from public.chimera_stories s where s.id = %I.story_id and s.owner_user_id = auth.uid()))', t || '_owner_all', t, t, t);
  end loop;
end $$;

create policy chimera_compiled_stories_read on public.chimera_compiled_stories for select to anon, authenticated
  using (exists (select 1 from public.chimera_stories s where s.id = chimera_compiled_stories.story_id and (s.owner_user_id = auth.uid() or s.visibility = 'public')));
create policy chimera_compiled_stories_owner_write on public.chimera_compiled_stories for all to authenticated
  using (exists (select 1 from public.chimera_stories s where s.id = chimera_compiled_stories.story_id and s.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.chimera_stories s where s.id = chimera_compiled_stories.story_id and s.owner_user_id = auth.uid()));

-- ===== gameplay (user-owned) =====
create policy chimera_game_states_own on public.chimera_game_states for all to authenticated
  using (player_id = auth.uid()) with check (player_id = auth.uid());
create policy chimera_turns_own on public.chimera_turns for all to authenticated
  using (exists (select 1 from public.chimera_game_states g where g.id = chimera_turns.game_state_id and g.player_id = auth.uid()))
  with check (exists (select 1 from public.chimera_game_states g where g.id = chimera_turns.game_state_id and g.player_id = auth.uid()));
create policy ai_audit_logs_select_own on public.ai_audit_logs for select to authenticated
  using (exists (select 1 from public.chimera_game_states g where g.id = ai_audit_logs.game_id and g.player_id = auth.uid()));
-- lets the turn pipeline (user-scoped client) link an audit row to its turn; column-limited to turn_id in 000005
create policy ai_audit_logs_link_own on public.ai_audit_logs for update to authenticated
  using (exists (select 1 from public.chimera_game_states g where g.id = ai_audit_logs.game_id and g.player_id = auth.uid()))
  with check (exists (select 1 from public.chimera_game_states g where g.id = ai_audit_logs.game_id and g.player_id = auth.uid()));
create policy chimera_instances_v3_own on public.chimera_instances_v3 for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy chimera_player_characters_own on public.chimera_player_characters for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy idempotency_keys_own on public.idempotency_keys for all to authenticated
  using (owner_id = auth.uid()::text) with check (owner_id = auth.uid()::text);

-- ===== media =====
create policy media_assets_public_read on public.media_assets for select to anon, authenticated using (visibility = 'public');
create policy media_assets_owner_read on public.media_assets for select to authenticated using (owner_user_id = auth.uid());
create policy media_assets_owner_insert on public.media_assets for insert to authenticated with check (owner_user_id = auth.uid());
create policy media_assets_owner_update on public.media_assets for update to authenticated
  using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy media_assets_admin_all on public.media_assets for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy media_links_public_read on public.media_links for select to anon, authenticated
  using (exists (select 1 from public.media_assets m where m.id = media_links.media_id and m.visibility = 'public'));
create policy media_links_admin_all on public.media_links for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy chimera_assets_public_read on public.chimera_assets for select to anon, authenticated using (true);
create policy chimera_assets_owner_write on public.chimera_assets for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy chimera_assets_admin_all on public.chimera_assets for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ===== authoring =====
create policy author_drafts_own on public.author_drafts for all to authenticated
  using (updated_by = auth.uid()) with check (updated_by = auth.uid());
create policy author_drafts_admin_all on public.author_drafts for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy author_workspaces_read on public.author_workspaces for select to authenticated
  using (created_by = auth.uid() or exists (select 1 from public.author_workspace_members m where m.workspace_id = author_workspaces.id and m.user_id = auth.uid()));
create policy author_workspaces_insert on public.author_workspaces for insert to authenticated with check (created_by = auth.uid());
create policy author_workspaces_update on public.author_workspaces for update to authenticated
  using (created_by = auth.uid() or exists (select 1 from public.author_workspace_members m where m.workspace_id = author_workspaces.id and m.user_id = auth.uid() and m.role = 'admin'))
  with check (created_by = auth.uid() or exists (select 1 from public.author_workspace_members m where m.workspace_id = author_workspaces.id and m.user_id = auth.uid() and m.role = 'admin'));
create policy author_workspace_members_read on public.author_workspace_members for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.author_workspaces w where w.id = author_workspace_members.workspace_id and w.created_by = auth.uid()));
create policy author_workspace_members_manage on public.author_workspace_members for all to authenticated
  using (exists (select 1 from public.author_workspaces w where w.id = author_workspace_members.workspace_id and w.created_by = auth.uid()))
  with check (exists (select 1 from public.author_workspaces w where w.id = author_workspace_members.workspace_id and w.created_by = auth.uid()));

-- ===== guest cookies / sessions / telemetry (server-managed; users may read their own) =====
create policy cookie_groups_select_own on public.cookie_groups for select to authenticated using (user_id = auth.uid());
create policy cookie_group_members_select_own on public.cookie_group_members for select to authenticated
  using (exists (select 1 from public.cookie_groups g where g.id = cookie_group_members.group_id and g.user_id = auth.uid()));
create policy cookie_user_links_select_own on public.cookie_user_links for select to authenticated using (user_id = auth.uid());
create policy auth_ledger_select_own on public.auth_ledger for select to authenticated using (user_id = auth.uid());
create policy csrf_tokens_own on public.csrf_tokens for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy payment_sessions_select_own on public.payment_sessions for select to authenticated using (user_id = auth.uid());
create policy telemetry_events_select_own on public.telemetry_events for select to authenticated using (user_id = auth.uid());
-- cookie_issue_requests, snapshots, turn_wal, turn_analytics: RLS on, no policies => service_role only.
