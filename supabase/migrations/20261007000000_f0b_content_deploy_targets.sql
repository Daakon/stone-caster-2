-- Additive, rerunnable metadata for the dedicated pre-launch deploy role.
-- No source bodies, app credentials, or direct writes are exposed.
create or replace view content_deploy.validation_formats as
select kinds.content_kind, 1 as supported_format_version,
  state.generation as catalog_generation,
  1 as deployment_provenance_version, 1 as runtime_format_contract_version,
  1 as deployment_target_contract_version,
  (select app_name from public.chimera_content_runtime_fleet where singleton) as runtime_app_name,
  coalesce((select real_players_started_at is not null from public.chimera_launch_guard where id), true) as real_players_started
from unnest(array[
  'ruleset','world','entity','lore','tag','asset_tag','mechanic_skill',
  'mechanic_condition','mechanic_resource','premade_character',
  'localization_glossary','localization_rule','localization_pack','injection_map',
  'dialogue_config','dialogue_graph','quest_graph','quest_graph_index',
  'content_pack','exclusion_group','world_ruleset_link','pack_entity_link',
  'pack_lore_link','pack_ruleset_link','pack_dependency'
]) kinds(content_kind)
cross join public.chimera_content_catalog_state state where state.singleton;
comment on view content_deploy.validation_formats is
  'Narrow deploy validation metadata. Hosted workflow remains pre-launch only; fleet transaction fence is enforced separately.';
