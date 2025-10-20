-- AWF Scenarios Seed Data
-- Development seed data for scenarios

-- Insert sample scenario
INSERT INTO public.scenarios (id, version, doc, hash) VALUES (
  'scenario.inn_last_ember',
  '1.0.0',
  '{
    "world_ref": "world.mystika@1.0.0",
    "adventure_ref": "adv.whispercross@1.0.0",
    "scenario": {
      "display_name": "Last Ember — Common Room",
      "synopsis": "A busy inn evening with travelers and rumors.",
      "start_scene": "inn.last_ember.common_room",
      "fixed_npcs": [
        { "npc_ref": "npc.kiera@1.0.0" },
        { "npc_ref": "npc.tavern_keeper@1.0.0" }
      ],
      "starting_party": [
        { "npc_ref": "npc.kiera@1.0.0" }
      ],
      "starting_flags": {
        "has_room_key": false
      },
      "tags": ["inn", "social", "low_combat"]
    }
  }'::jsonb,
  'seed_hash_inn_last_ember'
) ON CONFLICT (id, version) DO NOTHING;

-- Insert another sample scenario
INSERT INTO public.scenarios (id, version, doc, hash) VALUES (
  'scenario.forest_crossroads',
  '1.0.0',
  '{
    "world_ref": "world.mystika@1.0.0",
    "adventure_ref": "adv.whispercross@1.0.0",
    "scenario": {
      "display_name": "Forest Crossroads",
      "synopsis": "A quiet forest path where travelers meet.",
      "start_scene": "forest.crossroads.main_path",
      "fixed_npcs": [
        { "npc_ref": "npc.kiera@1.0.0" }
      ],
      "starting_flags": {
        "has_map": true,
        "knows_way": false
      },
      "tags": ["forest", "travel", "encounter"]
    }
  }'::jsonb,
  'seed_hash_forest_crossroads'
) ON CONFLICT (id, version) DO NOTHING;

-- Insert a scenario with i18n support
INSERT INTO public.scenarios (id, version, doc, hash) VALUES (
  'scenario.tavern_spanish',
  '1.0.0',
  '{
    "world_ref": "world.mystika@1.0.0",
    "scenario": {
      "display_name": "The Rusty Anchor",
      "synopsis": "A bustling tavern in the harbor district.",
      "start_scene": "tavern.rusty_anchor.main_room",
      "fixed_npcs": [
        { "npc_ref": "npc.tavern_keeper@1.0.0" }
      ],
      "starting_flags": {
        "has_coins": true
      },
      "tags": ["tavern", "harbor", "social"],
      "i18n": {
        "es": {
          "display_name": "El Ancla Oxidada",
          "synopsis": "Una taberna bulliciosa en el distrito del puerto.",
          "start_scene": "tavern.rusty_anchor.main_room"
        }
      }
    }
  }'::jsonb,
  'seed_hash_tavern_spanish'
) ON CONFLICT (id, version) DO NOTHING;
