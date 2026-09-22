-- StoneCaster canonical local baseline (2/6): tables (structure identical to hosted stone-caster-2).
-- FKs are added in 000002 so table order is irrelevant here.
set search_path to public, extensions;

create table public.access_requests (
  id uuid default gen_random_uuid() not null,
  email text not null, user_id uuid, note text,
  status text default 'pending' not null,
  reason text, approved_by uuid, approved_at timestamptz, denied_by uuid, denied_at timestamptz,
  meta jsonb default '{}'::jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint access_requests_pkey primary key (id),
  constraint access_requests_status_check check (status = any (array['pending','approved','denied']))
);
create table public.ai_audit_logs (
  id uuid default uuid_generate_v4() not null,
  game_id uuid, turn_index integer, action_type varchar(50),
  prompt_text text not null, raw_response text, token_usage jsonb, cost_stones integer,
  model_used varchar(100), created_at timestamptz default now(), turn_id uuid,
  constraint ai_audit_logs_pkey primary key (id)
);
create table public.ai_config (
  key text not null, value jsonb not null, updated_at timestamptz default now() not null,
  constraint ai_config_pkey primary key (key)
);
create table public.analytics_events (
  id uuid default gen_random_uuid() not null, ts timestamptz default now() not null,
  session_id text not null, player_hash text not null, world_ref text not null, adventure_ref text not null,
  locale text default 'en-US' not null, experiment_key text, variation_key text,
  metrics jsonb default '{}'::jsonb not null, created_at timestamptz default now(),
  constraint analytics_events_pkey primary key (id)
);
create table public.app_config (
  key text not null, value jsonb not null, type text not null, updated_at timestamptz default now() not null,
  constraint app_config_pkey primary key (key),
  constraint app_config_type_check check (type = any (array['string','number','boolean','json']))
);
create table public.app_roles (
  user_id uuid not null, role text not null,
  constraint app_roles_pkey primary key (user_id, role),
  constraint app_roles_role_check check (role = any (array['moderator','admin']))
);
create table public.auth_ledger (
  id uuid default gen_random_uuid() not null, type text not null, user_id uuid, guest_cookie_id uuid,
  canonical_group_id uuid, source_group_id uuid, metadata jsonb default '{}'::jsonb, created_at timestamptz default now(),
  constraint auth_ledger_pkey primary key (id),
  constraint auth_ledger_type_check check (type = any (array['LINK_MERGE','GAME_MIGRATION','STONE_MIGRATION','USER_CREATION']))
);
create table public.author_drafts (
  id uuid default gen_random_uuid() not null, doc_type text not null, doc_ref text not null, payload jsonb not null,
  format text default 'json' not null, updated_by uuid not null, updated_at timestamptz default now(), notes text,
  created_at timestamptz default now(),
  constraint author_drafts_doc_type_doc_ref_key unique (doc_type, doc_ref),
  constraint author_drafts_pkey primary key (id),
  constraint author_drafts_doc_type_check check (doc_type = any (array['core','world','adventure','start','quest_graph','items','recipes','loot','vendors','npc_personality','localization','sim_config','party_config','weather_zone','region','event','npc_schedule'])),
  constraint author_drafts_format_check check (format = any (array['json','yaml']))
);
create table public.author_workspace_members (
  workspace_id uuid not null, user_id uuid not null, role text default 'member' not null, joined_at timestamptz default now(),
  constraint author_workspace_members_pkey primary key (workspace_id, user_id),
  constraint author_workspace_members_role_check check (role = any (array['member','editor','admin']))
);
create table public.author_workspaces (
  id uuid default gen_random_uuid() not null, name text not null, members uuid[] default '{}' not null,
  created_by uuid not null, created_at timestamptz default now(), updated_at timestamptz default now(),
  constraint author_workspaces_pkey primary key (id)
);
create table public.chimera_asset_tags (
  tag_id uuid not null, asset_id uuid not null, asset_type text not null, created_at timestamptz default now() not null,
  constraint pk_chimera_asset_tags primary key (tag_id, asset_id, asset_type)
);
create table public.chimera_assets (
  id uuid default gen_random_uuid() not null, owner_id uuid, url text not null, type text default 'image' not null,
  category text, meta jsonb default '{}'::jsonb, created_at timestamptz default now(),
  constraint chimera_assets_pkey primary key (id)
);
create table public.chimera_compiled_stories (
  id uuid default gen_random_uuid() not null, story_id uuid not null, version integer default 1,
  config_engine jsonb default '{}'::jsonb, prompt_interpreter_logic text, prompt_narrator_style text,
  snapshot_world jsonb default '{}'::jsonb, snapshot_entities jsonb default '{}'::jsonb,
  created_at timestamptz default now(), is_active boolean default false,
  ruleset_ids uuid[] default '{}', entity_ids uuid[] default '{}', creation_manifest jsonb,
  genesis_config jsonb default '{}'::jsonb, config_mechanics jsonb, config_interpreter jsonb,
  config_narrator jsonb, config_ui jsonb,
  constraint chimera_compiled_stories_pkey primary key (id)
);
create table public.chimera_content_pack_entity_links (
  pack_id uuid not null, entity_template_id uuid not null, created_at timestamptz default now() not null,
  constraint pk_pack_entity_link primary key (pack_id, entity_template_id)
);
create table public.chimera_content_pack_lore_links (
  pack_id uuid not null, lore_template_id text not null, created_at timestamptz default now() not null,
  constraint chimera_content_pack_lore_links_pkey primary key (pack_id, lore_template_id)
);
create table public.chimera_content_pack_ruleset_links (
  pack_id uuid not null, ruleset_template_id uuid not null, created_at timestamptz default now() not null,
  constraint pk_pack_ruleset_link primary key (pack_id, ruleset_template_id)
);
create table public.chimera_content_packs (
  id uuid default gen_random_uuid() not null, display_name text not null, owner_user_id uuid not null,
  pack_type chimera_pack_type not null, version integer default 1 not null, description_short text,
  visibility chimera_world_visibility default 'private' not null, is_system_asset boolean default false not null,
  created_at timestamptz default now() not null, updated_at timestamptz default now() not null,
  constraint uq_chimera_content_packs_owner_user_id_display_name unique (owner_user_id, display_name),
  constraint pk_chimera_content_packs primary key (id)
);
create table public.chimera_entities (
  id uuid default gen_random_uuid() not null, entity_type text not null, slug text not null, raw_data jsonb not null,
  created_at timestamptz default now() not null, updated_at timestamptz default now() not null,
  owner_user_id uuid, visibility visibility_status default 'private' not null, is_official boolean default false,
  world_id uuid, icon_image_url text, primary_image_url text, display_name text,
  constraint chimera_entities_key_key unique (slug),
  constraint chimera_entities_pkey primary key (id),
  constraint chimera_entities_entity_type_check check (entity_type = any (array['NPC','LOCATION','ITEM','FACTION'])),
  constraint chimera_entities_raw_data_not_empty check (raw_data is not null and raw_data <> '{}'::jsonb)
);
create table public.chimera_exclusion_groups (
  id uuid default gen_random_uuid() not null, group_name text not null,
  created_at timestamptz default now() not null, updated_at timestamptz default now() not null,
  constraint chimera_exclusion_groups_group_name_key unique (group_name),
  constraint pk_chimera_exclusion_groups primary key (id)
);
create table public.chimera_game_states (
  id uuid default gen_random_uuid() not null, story_id uuid not null, player_id uuid not null,
  created_at timestamptz default now() not null, updated_at timestamptz default now() not null,
  mechanical_state jsonb default '{}'::jsonb not null, narrative_focus jsonb default '{}'::jsonb not null,
  scene_registry jsonb default '{}'::jsonb not null, action_queue jsonb default '[]'::jsonb not null,
  compiled_system_prompt text,
  constraint chimera_game_states_pkey primary key (id)
);
create table public.chimera_instances_v3 (
  id uuid default gen_random_uuid() not null, user_id uuid not null, compiled_story_id uuid not null,
  status text default 'active' not null, current_state jsonb default '{}'::jsonb not null,
  event_log jsonb default '[]'::jsonb not null, turn_count integer default 0 not null,
  created_at timestamptz default now() not null, updated_at timestamptz default now() not null,
  constraint chimera_instances_v3_pkey primary key (id),
  constraint chimera_instances_v3_status_check check (status = any (array['active','ended']))
);
create table public.chimera_lore (
  id uuid default gen_random_uuid() not null, fragment jsonb not null, embedding vector(1536),
  created_at timestamptz default now() not null, updated_at timestamptz default now() not null,
  world_id uuid, visibility visibility_status default 'private' not null, owner_user_id uuid,
  is_official boolean default false, keywords text[] default '{}', entity_id uuid, story_id uuid,
  constraint chimera_lore_pkey primary key (id),
  constraint chimera_lore_fragment_not_empty check (fragment is not null and fragment <> '{}'::jsonb)
);
create table public.chimera_pack_dependencies (
  pack_id uuid not null, depends_on_pack_id uuid not null, dep_version_range text not null,
  dep_type text default 'required' not null, created_at timestamptz default now() not null,
  constraint pk_pack_dependencies primary key (pack_id, depends_on_pack_id)
);
create table public.chimera_player_characters (
  id uuid default gen_random_uuid() not null, user_id uuid not null, name text not null,
  state_snapshot jsonb default '{}'::jsonb not null, created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null, world_id uuid not null,
  constraint chimera_player_characters_pkey primary key (id)
);
create table public.chimera_ruleset_templates (
  id uuid default gen_random_uuid() not null, key text not null, ui_category text not null, exclusion_group text,
  dependencies jsonb default '[]'::jsonb not null, definition jsonb not null,
  created_at timestamptz default now() not null, updated_at timestamptz default now() not null,
  description_short text, description_long text,
  constraint chimera_ruleset_templates_key_key unique (key),
  constraint chimera_ruleset_templates_pkey primary key (id),
  constraint chimera_ruleset_templates_definition_not_empty check (definition is not null and definition <> '{}'::jsonb)
);
create table public.chimera_stories (
  id uuid default gen_random_uuid() not null, display_name text not null, owner_user_id uuid not null,
  visibility chimera_world_visibility default 'private' not null, version integer default 1 not null,
  story_definition jsonb default '{}'::jsonb, content_rating text default 'safe' not null,
  is_system_asset boolean default false not null, created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null, description_short text, configuration jsonb default '{}'::jsonb,
  world_id uuid, protagonist_id uuid, cast_ids uuid[] default '{}', active_ruleset_ids jsonb default '[]'::jsonb,
  status text default 'draft', title text default 'Untitled Story', primary_image_url text, description text,
  image_url text, current_compiled_id uuid, compile_status text default 'draft', opening_text text,
  entity_ids uuid[] default '{}', genesis_config jsonb default '{}'::jsonb,
  constraint uq_chimera_stories_owner_user_id_display_name unique (owner_user_id, display_name),
  constraint pk_chimera_stories primary key (id)
);
create table public.chimera_story_compiled_ruleset (
  story_id uuid not null, compiled_json jsonb default '{}'::jsonb not null, source_manifest jsonb default '[]'::jsonb not null,
  last_compiled_at timestamptz default now() not null,
  constraint pk_story_compiled_ruleset primary key (story_id)
);
create table public.chimera_story_content_pack_links (
  story_id uuid not null, pack_id uuid not null, created_at timestamptz default now() not null,
  constraint pk_story_pack_link_v2 primary key (story_id, pack_id)
);
create table public.chimera_story_entity_links (
  story_id uuid not null, entity_template_id uuid not null, created_at timestamptz default now() not null,
  constraint pk_story_entity_link primary key (story_id, entity_template_id)
);
create table public.chimera_story_links (
  story_id uuid not null, ruleset_template_id uuid not null, created_at timestamptz default now() not null,
  constraint pk_story_ruleset_link primary key (story_id, ruleset_template_id)
);
create table public.chimera_tags (
  id uuid default gen_random_uuid() not null, tag_name text not null, is_approved boolean default false not null,
  created_at timestamptz default now() not null, updated_at timestamptz default now() not null,
  constraint uq_chimera_tags_tag_name unique (tag_name),
  constraint pk_chimera_tags primary key (id)
);
create table public.chimera_turns (
  id uuid default gen_random_uuid() not null, game_state_id uuid not null, turn_index integer not null,
  player_input text not null, director_intent jsonb default '{}'::jsonb, mechanical_delta jsonb default '{}'::jsonb,
  narrator_output jsonb default '{}'::jsonb, created_at timestamptz default now() not null,
  constraint chimera_turns_pkey primary key (id)
);
create table public.chimera_world_ruleset_link (
  world_id uuid not null, ruleset_template_id uuid not null, created_at timestamptz default now() not null,
  constraint pk_world_ruleset_link_v2 primary key (world_id, ruleset_template_id)
);
create table public.chimera_worlds (
  id uuid default gen_random_uuid() not null, key text not null, definition jsonb not null, owner_id uuid,
  created_at timestamptz default now() not null, updated_at timestamptz default now() not null, owner_user_id uuid,
  character_schema_contributions jsonb default '{}'::jsonb not null, name text not null, slug text not null,
  description_short text, description_long text, visibility chimera_world_visibility default 'private' not null,
  tags text[] default '{}', is_official boolean default false, genre_tags text[] default '{}', genre text, setting text,
  constraint chimera_worlds_key_key unique (key),
  constraint chimera_worlds_pkey primary key (id),
  constraint chimera_worlds_definition_not_empty check (definition is not null and definition <> '{}'::jsonb)
);
create table public.config_meta (
  id boolean default true not null, version bigint default 1 not null, updated_at timestamptz default now() not null,
  constraint config_meta_pkey primary key (id),
  constraint config_meta_id_check check (id = true)
);
create table public.cookie_group_members (
  cookie_id uuid not null, group_id uuid not null, device_label text,
  last_seen_at timestamptz default now() not null, created_at timestamptz default now() not null,
  constraint cookie_group_members_pkey primary key (cookie_id)
);
create table public.cookie_groups (
  id uuid default gen_random_uuid() not null, user_id uuid,
  created_at timestamptz default now() not null, updated_at timestamptz default now() not null,
  constraint cookie_groups_user_id_key unique (user_id),
  constraint cookie_groups_pkey primary key (id)
);
create table public.cookie_issue_requests (
  id uuid default gen_random_uuid() not null, ip_address inet not null, user_agent text,
  created_at timestamptz default now() not null,
  constraint cookie_issue_requests_pkey primary key (id)
);
create table public.cookie_user_links (
  id uuid default gen_random_uuid() not null, cookie_id uuid not null, user_id uuid not null,
  created_at timestamptz default now() not null, updated_at timestamptz default now() not null,
  constraint cookie_user_links_cookie_id_key unique (cookie_id),
  constraint cookie_user_links_user_id_key unique (user_id),
  constraint cookie_user_links_pkey primary key (id)
);
create table public.creator_namespaces (
  namespace text not null, creator_id uuid not null, verified boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  constraint creator_namespaces_pkey primary key (namespace)
);
create table public.creators (
  creator_id uuid default gen_random_uuid() not null, display_name text not null, email_hash text not null,
  verified boolean default false, terms_accepted_at timestamptz, notes text,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  constraint creators_email_hash_key unique (email_hash),
  constraint creators_pkey primary key (creator_id)
);
create table public.csrf_tokens (
  id uuid default gen_random_uuid() not null, user_id uuid not null, token text not null,
  expires_at timestamptz not null, created_at timestamptz default now() not null,
  constraint csrf_tokens_pkey primary key (id)
);
create table public.dialogue_config (
  id text default 'default' not null, module_mode text default 'full', max_tokens integer default 220,
  max_candidates integer default 3, romance_enabled boolean default true, romance_min_trust integer default 65,
  romance_cooldown_turns integer default 3, safety_explicit_block boolean default true,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  constraint dialogue_config_pkey primary key (id),
  constraint dialogue_config_module_mode_check check (module_mode = any (array['off','readonly','full']))
);
create table public.dialogue_graphs (
  id text not null, world_ref text not null, adventure_ref text, doc jsonb not null, hash text not null,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  constraint dialogue_graphs_id_hash_key unique (id, hash),
  constraint dialogue_graphs_pkey primary key (id)
);
create table public.experiment_variations (
  experiment_key text not null, variation_key text not null, params jsonb default '{}'::jsonb not null,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  constraint experiment_variations_pkey primary key (experiment_key, variation_key)
);
create table public.experiments (
  key text not null, name text not null, status text default 'draft' not null, start_at timestamptz, stop_at timestamptz,
  hash_basis text default 'session' not null, allocations jsonb default '[]'::jsonb not null,
  guardrails jsonb default '{}'::jsonb not null, created_at timestamptz default now(), updated_at timestamptz default now(),
  constraint experiments_pkey primary key (key),
  constraint experiments_hash_basis_check check (hash_basis = any (array['session','player'])),
  constraint experiments_status_check check (status = any (array['draft','running','stopped']))
);
create table public.feature_flags (
  key text not null, enabled boolean default false not null, payload jsonb default '{}'::jsonb not null,
  updated_at timestamptz default now() not null,
  constraint feature_flags_pkey primary key (key)
);
create table public.idempotency_keys (
  id uuid default gen_random_uuid() not null, key varchar(255) not null, owner_id varchar(255) not null,
  game_id uuid not null, operation varchar(50) default 'turn' not null, request_hash varchar(64) not null,
  response_data jsonb not null, status varchar(20) default 'pending' not null,
  created_at timestamptz default now() not null, completed_at timestamptz,
  constraint idempotency_keys_key_owner_id_game_id_operation_key unique (key, owner_id, game_id, operation),
  constraint idempotency_keys_pkey primary key (id),
  constraint idempotency_keys_status_check check (status::text = any (array['pending','completed','failed']))
);
create table public.injection_map (
  id text default 'default' not null, doc jsonb not null,
  created_at timestamptz default now() not null, updated_at timestamptz default now() not null,
  constraint injection_map_pkey primary key (id)
);
create table public.localization_glossary (
  id uuid default gen_random_uuid() not null, locale text not null, entries jsonb default '[]'::jsonb not null,
  hash text not null, created_at timestamptz default now(), updated_at timestamptz default now(),
  constraint localization_glossary_locale_key unique (locale),
  constraint localization_glossary_pkey primary key (id)
);
create table public.localization_packs (
  id uuid default gen_random_uuid() not null, doc_type text not null, doc_ref text not null, locale text not null,
  payload jsonb not null, hash text not null, created_at timestamptz default now(), updated_at timestamptz default now(),
  constraint localization_packs_doc_ref_locale_key unique (doc_ref, locale),
  constraint localization_packs_pkey primary key (id),
  constraint localization_packs_doc_type_check check (doc_type = any (array['core','world','adventure','start']))
);
create table public.localization_rules (
  locale text not null, policy jsonb default '{}'::jsonb not null,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  constraint localization_rules_pkey primary key (locale)
);
create table public.mechanics_conditions (
  id text not null, stacking text default 'none' not null, cap integer, cleanse_keys text[] default '{}',
  tick_hooks jsonb default '{}'::jsonb, created_at timestamptz default now(), updated_at timestamptz default now(),
  constraint mechanics_conditions_pkey primary key (id),
  constraint mechanics_conditions_stacking_check check (stacking = any (array['none','add','cap']))
);
create table public.mechanics_resources (
  id text not null, min_value integer default 0 not null, max_value integer default 100 not null,
  regen_per_tick numeric(5,2) default 0, decay_per_tick numeric(5,2) default 0,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  constraint mechanics_resources_pkey primary key (id)
);
create table public.mechanics_skills (
  id text not null, description text not null, baseline integer default 10 not null, tags text[] default '{}',
  created_at timestamptz default now(), updated_at timestamptz default now(),
  constraint mechanics_skills_pkey primary key (id)
);
create table public.media_assets (
  id uuid default gen_random_uuid() not null, owner_user_id uuid not null, kind text not null,
  provider text default 'cloudflare_images' not null, provider_key text not null, visibility text default 'private' not null,
  status text default 'pending' not null, image_review_status text default 'approved' not null,
  width integer, height integer, sha256 text, created_at timestamptz default now() not null,
  ready_at timestamptz, content_type text,
  constraint media_assets_provider_key_unique unique (provider, provider_key),
  constraint media_assets_pkey primary key (id),
  constraint media_assets_image_review_status_check check (image_review_status = any (array['pending','approved','rejected'])),
  constraint media_assets_kind_check check (kind = any (array['npc','world','story','site'])),
  constraint media_assets_status_check check (status = any (array['pending','ready','failed'])),
  constraint media_assets_visibility_check check (visibility = any (array['private','unlisted','public']))
);
create table public.media_links (
  id uuid default gen_random_uuid() not null, world_id text, story_id text, npc_id uuid, media_id uuid not null,
  role text default 'gallery' not null, sort_order integer default 0 not null,
  constraint media_links_v2_pkey primary key (id),
  constraint media_links_one_target check ((world_id is not null)::integer + (story_id is not null)::integer + (npc_id is not null)::integer = 1)
);
create table public.npc_personalities (
  id uuid default gen_random_uuid() not null, npc_ref text not null, world_ref text not null, adventure_ref text,
  traits jsonb default '{}'::jsonb not null, summary text, last_updated timestamptz default now(),
  snapshot_version integer default 1, derived_from_session text,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  constraint npc_personalities_unique_adventure unique (npc_ref, world_ref, adventure_ref),
  constraint npc_personalities_pkey primary key (id)
);
create table public.payment_sessions (
  id uuid default gen_random_uuid() not null, user_id uuid not null, pack_id uuid not null, session_id text not null,
  status text default 'pending' not null, amount_cents integer not null, currency varchar(3) default 'USD' not null,
  metadata jsonb default '{}'::jsonb not null, created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint payment_sessions_session_id_key unique (session_id),
  constraint payment_sessions_pkey primary key (id),
  constraint payment_sessions_amount_cents_check check (amount_cents > 0),
  constraint payment_sessions_status_check check (status = any (array['pending','completed','failed','cancelled']))
);
create table public.premade_characters (
  id uuid default gen_random_uuid() not null, world_slug varchar(100) not null, archetype_key varchar(100) not null,
  display_name varchar(100) not null, summary text not null, avatar_url varchar(500),
  base_traits jsonb default '{}'::jsonb not null, is_active boolean default true not null,
  created_at timestamptz default now() not null, updated_at timestamptz default now() not null, world_id uuid,
  constraint premade_characters_world_id_archetype_key_key unique (world_id, archetype_key),
  constraint premade_characters_pkey primary key (id)
);
create table public.pricing_config (
  key text not null, value jsonb not null, updated_at timestamptz default now() not null,
  constraint pricing_config_pkey primary key (key)
);
create table public.profiles (
  id uuid not null, role text default 'pending' not null, joined_at timestamptz default now() not null,
  approved_by uuid, approval_note text, role_version integer default 1 not null,
  is_verified_creator boolean default false not null,
  constraint profiles_pkey primary key (id),
  constraint profiles_role_check check (role = any (array['pending','early_access','member','admin']))
);
create table public.prompts (
  id uuid default gen_random_uuid() not null, slug text not null, scope text not null, version integer default 1 not null,
  hash text not null, content text not null, active boolean default false not null, metadata jsonb default '{}'::jsonb not null,
  created_by uuid, created_at timestamptz default now() not null, updated_at timestamptz default now() not null,
  layer varchar(50), world_slug varchar(100), adventure_slug varchar(100), scene_id varchar(100),
  turn_stage varchar(50) default 'any', sort_order integer default 0 not null, locked boolean default false not null,
  updated_by uuid default gen_random_uuid(),
  constraint prompts_slug_scope_active_key unique (slug, scope, active) deferrable initially deferred,
  constraint prompts_slug_scope_version_key unique (slug, scope, version),
  constraint prompts_pkey primary key (id),
  constraint prompts_scope_check check (scope = any (array['world','scenario','adventure','quest']))
);
create table public.publish_history (
  id uuid default gen_random_uuid() not null, doc_type text not null, doc_ref text not null, from_draft_id uuid,
  to_version text not null, hash text not null, changelog_path text, playtest_report_path text,
  published_by uuid not null, published_at timestamptz default now(), created_at timestamptz default now(),
  constraint publish_history_pkey primary key (id)
);
create table public.quest_graph_indexes (
  id uuid default gen_random_uuid() not null, graph_id uuid not null, node_id text not null,
  deps jsonb default '[]'::jsonb not null, type text not null, synopsis text, hint text, created_at timestamptz default now(),
  constraint quest_graph_indexes_pkey primary key (id)
);
create table public.quest_graphs (
  id uuid default gen_random_uuid() not null, adventure_ref text not null, version text default '1.0.0' not null,
  doc jsonb default '{}'::jsonb not null, hash text not null, created_at timestamptz default now(), updated_at timestamptz default now(),
  constraint quest_graphs_adventure_ref_version_key unique (adventure_ref, version),
  constraint quest_graphs_pkey primary key (id)
);
create table public.slots (
  id uuid default gen_random_uuid() not null, type text not null, name text not null, description text not null,
  max_len integer, priority integer default 0, created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null, must_keep boolean default false not null, min_chars integer,
  constraint uk_slots_type_name unique (type, name),
  constraint slots_pkey primary key (id),
  constraint slots_type_check check (type = any (array['world','ruleset','npc','scenario','module','ux']))
);
create table public.snapshots (
  id uuid default gen_random_uuid() not null, session_id uuid not null, created_at timestamptz default now() not null,
  label text, content_hash text not null, payload jsonb not null,
  constraint snapshots_session_id_content_hash_key unique (session_id, content_hash),
  constraint snapshots_pkey primary key (id)
);
create table public.telemetry_events (
  id uuid default gen_random_uuid() not null, user_id uuid, cookie_id uuid, trace_id uuid not null, name text not null,
  props jsonb default '{}'::jsonb not null, created_at timestamptz default now() not null,
  constraint telemetry_events_pkey primary key (id)
);
create table public.translation_cache (
  id uuid default gen_random_uuid() not null, src_lang text not null, dst_lang text not null, src_hash text not null,
  contract_ver text not null, text_out text not null, tokens_est integer not null, created_at timestamptz default now(),
  constraint translation_cache_src_hash_src_lang_dst_lang_contract_ver_key unique (src_hash, src_lang, dst_lang, contract_ver),
  constraint translation_cache_pkey primary key (id)
);
create table public.turn_analytics (
  id uuid default gen_random_uuid() not null, turn_id uuid not null, raw_ai_response jsonb not null,
  raw_user_prompt text, raw_system_prompt text, model_identifier varchar(100), token_count integer,
  processing_time_ms integer, prompt_metadata jsonb, response_metadata jsonb, created_at timestamptz default now() not null,
  constraint turn_analytics_pkey primary key (id)
);
create table public.turn_metrics (
  turn_id uuid not null, story_id uuid not null, created_at timestamptz default now() not null,
  tokens_before integer not null, tokens_after integer not null, trims_count integer default 0 not null,
  top_trim_keys text[] default '{}', model_ms integer, rejects jsonb default '{}'::jsonb, cost_estimate_cents integer,
  constraint turn_metrics_pkey primary key (turn_id)
);
create table public.turn_wal (
  id uuid default gen_random_uuid() not null, session_id uuid not null, turn_id integer not null, awf_raw jsonb not null,
  applied boolean default false not null, created_at timestamptz default now() not null,
  constraint turn_wal_session_id_turn_id_key unique (session_id, turn_id),
  constraint turn_wal_pkey primary key (id)
);
create table public.user_profiles (
  id uuid default gen_random_uuid() not null, auth_user_id uuid not null, cookie_group_id uuid,
  display_name varchar(100) not null, avatar_url text, email varchar(255),
  preferences jsonb default '{"theme": "auto", "showTips": true, "notifications": {"push": false, "email": true}}'::jsonb not null,
  last_seen_at timestamptz default now() not null, created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null, role text default 'user', creator_slug text, public_bio text,
  profile_image_url text, website_url text, approved_avatar_image_url text, pending_avatar_image_url text,
  avatar_image_status avatar_image_status default 'none' not null,
  constraint user_profiles_auth_user_id_key unique (auth_user_id),
  constraint user_profiles_cookie_group_id_key unique (cookie_group_id),
  constraint user_profiles_pkey primary key (id),
  constraint user_profiles_role_check check (role = any (array['user','admin','prompt_admin']))
);
