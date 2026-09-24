[ActionRegistry] Module actions registered
[seedIfEmpty] Templates table not found - skipping template seeding (legacy table)
[ActionRegistry] Initialization complete. 6 actions registered.
[transformWorldForResponse] Transforming world: {
  worldId: '7b63a7ea-d10a-4092-b3cd-e294afb1d3f5',
  worldName: 'Test',
  hasDefinition: true,
  definitionKeys: [
    'id',
    'name',
    'images',
    'description_long',
    'description_short',
    'ruleset_template_ids'
  ],
  extractedImages: [
    {
      id: 'c142a81b-1795-4ed8-afbe-af129b06ed6c',
      url: 'https://imagedelivery.net/H1wcHgsbpczAJHyB61JpRw/8a0e3f6f-06aa-4b47-3158-c35f6df24c00/public',
      role: 'banner'
    },
    {
      id: 'c112d50b-d6a8-4678-b63a-e83427490c05',
      url: 'https://imagedelivery.net/H1wcHgsbpczAJHyB61JpRw/4d6879d2-2a17-4508-d100-85aca2d79000/public',
      role: 'gallery'
    }
  ],
  extractedImagesLength: 2
}
[transformWorldForResponse] Transforming world: {
  worldId: 'b3de4b0a-a879-43cf-8256-2153a5ff97a9',
  worldName: 'Mystika',
  hasDefinition: true,
  definitionKeys: [
    'id',
    'key',
    'name',
    'slug',
    'tags',
    'images',
    'summary',
    'description',
    'description_long',
    'description_short',
    'ruleset_template_ids'
  ],
  extractedImages: [
    {
      id: '3bfc13a1-83b4-466e-ae71-9d0d8e7c3b9f',
      url: 'https://imagedelivery.net/H1wcHgsbpczAJHyB61JpRw/625c47b4-db82-4b15-1e85-e947d9aa6c00/public',
      role: 'banner',
      label: 'Main Banner'
    }
  ],
  extractedImagesLength: 1
}
[transformWorldForResponse] Transforming world: {
  worldId: '7b63a7ea-d10a-4092-b3cd-e294afb1d3f5',
  worldName: 'Test',
  hasDefinition: true,
  definitionKeys: [
    'id',
    'name',
    'images',
    'description_long',
    'description_short',
    'ruleset_template_ids'
  ],
  extractedImages: [
    {
      id: 'c142a81b-1795-4ed8-afbe-af129b06ed6c',
      url: 'https://imagedelivery.net/H1wcHgsbpczAJHyB61JpRw/8a0e3f6f-06aa-4b47-3158-c35f6df24c00/public',
      role: 'banner'
    },
    {
      id: 'c112d50b-d6a8-4678-b63a-e83427490c05',
      url: 'https://imagedelivery.net/H1wcHgsbpczAJHyB61JpRw/4d6879d2-2a17-4508-d100-85aca2d79000/public',
      role: 'gallery'
    }
  ],
  extractedImagesLength: 2
}
[API] Bind Fate triggered for Story ID: 97af18c8-79fc-422c-a830-7cac257685a7
[Compiler V3] 🚀 Starting Compilation for 97af18c8-79fc-422c-a830-7cac257685a7 (User: b5c9906f-63ed-4234-afd8-7a8e5cf12085)
[Compiler V3] World Data Type: object -> Parsed Object Keys: 11
[Compiler V3] Strategy: Story Overrides (14 IDs)
[Compiler V3] Querying for 14 ruleset IDs...
[Compiler V3] Database returned 14 rulesets.

[DEBUG] ===== TEMPLATE FETCH DEBUG =====
[DEBUG] Processing Ruleset ID: 13f11115-93e9-4820-9bb9-1a8a0306839d
[DEBUG] Ruleset Key: npc-roles-background
[DEBUG] Ruleset Name: N/A
[DEBUG] Raw definition type: object
[DEBUG] Raw definition (first 500 chars): {"id":"npc-roles-background","name":"NPC Roles & Background","actions":{},"ui_category":"expansion","dependencies":["npc-personalities"],"provides_tags":[],"ai_instructions":{"mas2_narrator":{"state_readouts":[{"path":"tier1_entity.background_origin","label":"SOCIAL ORIGIN"},{"path":"tier1_entity.occupation_tags","label":"KNOWN SKILLS/ROLES"}],"style_injections":[{"content":"Assume the character possesses high competence and jargon knowledge related to their [KNOWN SKILLS/ROLES]. Adjust their vo
[DEBUG] ✅ Actions found in raw definition: []
[DEBUG] Action count: 0
[DEBUG] ---
[DEBUG] Processing Ruleset ID: 661e1ef0-0f7c-4f82-88c0-b70e25fa9a8f
[DEBUG] Ruleset Key: npc-personalities
[DEBUG] Ruleset Name: N/A
[DEBUG] Raw definition type: object
[DEBUG] Raw definition (first 500 chars): {"id":"npc-personalities","name":"NPC Personalities","actions":{"add_personality_trait":{"kind":"system_auto","logic":[{"args":{"item":"New Trait","path":"tier1_entity.core_traits","operation":"add"},"step_id":"append_trait","function":"state.list_op"}],"trigger":{"type":"intent_match","keyword_id":"develop_character"}}},"ui_category":"foundation","dependencies":[],"provides_tags":[],"ai_instructions":{"mas2_narrator":{"state_readouts":[{"path":"tier1_entity.core_traits","label":"CORE PERSONALIT
[DEBUG] ✅ Actions found in raw definition: [ 'add_personality_trait' ]
[DEBUG] Action count: 1
[DEBUG] ---
[DEBUG] Processing Ruleset ID: add200c9-92c5-4b27-9c9e-115f65b45882
[DEBUG] Ruleset Key: npc-values-motivations
[DEBUG] Ruleset Name: N/A
[DEBUG] Raw definition type: object
[DEBUG] Raw definition (first 500 chars): {"id":"npc-values-motivations","name":"NPC Values & Motivations","actions":{},"ui_category":"expansion","dependencies":["npc-personalities"],"provides_tags":[],"ai_instructions":{"mas2_narrator":{"state_readouts":[{"path":"tier1_entity.core_values","label":"MORAL COMPASS"},{"path":"tier1_entity.current_objective","label":"CURRENT OBJECTIVE"}],"style_injections":[{"content":"The character MUST refuse requests that conflict with their [MORAL COMPASS]. They must actively steer conversation toward t
[DEBUG] ✅ Actions found in raw definition: []
[DEBUG] Action count: 0
[DEBUG] ---
[DEBUG] Processing Ruleset ID: 159a4f04-a0c1-4417-86ca-c7502bfd1d36
[DEBUG] Ruleset Key: npc-plot-drivers
[DEBUG] Ruleset Name: N/A
[DEBUG] Raw definition type: object
[DEBUG] Raw definition (first 500 chars): {"id":"npc-plot-drivers","name":"NPC Plot Drivers","actions":{},"ui_category":"expansion","dependencies":["npc-personalities"],"provides_tags":[],"ai_instructions":{"mas2_narrator":{"state_readouts":[{"path":"tier1_entity.plot_agenda","label":"ACTIVE AGENDA"},{"path":"tier1_entity.agenda_urgency","label":"AGENDA URGENCY"}],"style_injections":[{"content":"The NPC wants to achieve [ACTIVE AGENDA]. If [AGENDA URGENCY] is 'Demanding', they should interrupt unrelated actions to remind the player of t
[DEBUG] ✅ Actions found in raw definition: []
[DEBUG] Action count: 0
[DEBUG] ---
[DEBUG] Processing Ruleset ID: 4d6b06d2-08a3-4fe3-942a-a8af43072e83
[DEBUG] Ruleset Key: npc-quirks-habits
[DEBUG] Ruleset Name: N/A
[DEBUG] Raw definition type: object
[DEBUG] Raw definition (first 500 chars): {"id":"npc-quirks-habits","name":"NPC Quirks & Habits","actions":{"filter_quirks_by_context":{"kind":"system_auto","logic":[{"args":{"path":"tier1_entity.active_quirks","operation":"clear"},"step_id":"clear_active","function":"state.list_op"},{"args":{"filter_key":"trigger_state","source_list":"tier1_entity.quirk_registry","target_list":"tier1_entity.active_quirks","match_values":["Always","tier1_entity.emotional_label"]},"step_id":"populate_active","function":"logic.filter","description":"Copie
[DEBUG] ✅ Actions found in raw definition: [ 'filter_quirks_by_context' ]
[DEBUG] Action count: 1
[DEBUG] ---
[DEBUG] Processing Ruleset ID: ee2eeb72-48ce-4003-8778-c32c3242fc57
[DEBUG] Ruleset Key: npc-preferences-phobias
[DEBUG] Ruleset Name: N/A
[DEBUG] Raw definition type: object
[DEBUG] Raw definition (first 500 chars): {"id":"npc-preferences-phobias","name":"NPC Preferences & Phobias","actions":{"detect_aversion_match":{"kind":"system_auto","logic":[{"args":{"path":"tier1_entity.emotional_valence","amount":-15},"step_id":"damage_mood","function":"state.modify","conditions":[{"op":"contains_any","left":"tier1_entity.aversion_triggers","right":"input.keywords"}]}],"trigger":{"type":"intent_match","keyword_id":"general_conversation"}},"detect_interest_match":{"kind":"system_auto","logic":[{"args":{"path":"tier1_e
[DEBUG] ✅ Actions found in raw definition: [ 'detect_aversion_match', 'detect_interest_match' ]
[DEBUG] Action count: 2
[DEBUG] ---
[DEBUG] Processing Ruleset ID: 1cdfbd29-07e6-4aa5-98b0-a2a7b3e6ad4b
[DEBUG] Ruleset Key: d100-5-pillars
[DEBUG] Ruleset Name: N/A
[DEBUG] Raw definition type: object
[DEBUG] Raw definition (first 500 chars): {"id":"d100-5-pillars","name":"D100 5 Pillars","actions":{"resolve_skill_check":{"kind":"system_compute","logic":[{"args":{"entity":"@request.actor_id","target_node":"@request.skill_id","fallback_strategy":"nearest_root_node"},"step_id":"1_resolve_cascade_value","function":"state.lookup","description":"Look for the specific skill. If null, automatically find the parent 'root_' tag in the schema and use that value."},{"args":{"base":"@1_resolve_cascade_value.result","modifier":"@request.difficult
[DEBUG] ✅ Actions found in raw definition: [ 'resolve_skill_check' ]
[DEBUG] Action count: 1
[DEBUG] ---
[DEBUG] Processing Ruleset ID: 95d450b3-b597-4212-8bbd-d1422948f976
[DEBUG] Ruleset Key: needs-survival-basic
[DEBUG] Ruleset Name: N/A
[DEBUG] Raw definition type: object
[DEBUG] Raw definition (first 500 chars): {"id":"needs-survival-basic","name":"Needs & Survival - Basic","actions":{"consume_food":{"kind":"player_initiated","logic":[{"args":{"path":"tier1_entity.satiety","amount":40,"clamp_max":100},"step_id":"restore_satiety","function":"state.modify"},{"args":{"thresholds":{"0":"Starving","30":"Hungry","80":"Well Fed"},"output_path":"tier1_entity.hunger_state","source_path":"tier1_entity.satiety"},"step_id":"update_state_after_food","function":"logic.thresholds"}],"trigger":{"type":"intent_match","k
[DEBUG] ✅ Actions found in raw definition: [ 'consume_food', 'apply_metabolic_decay' ]
[DEBUG] Action count: 2
[DEBUG] ---
[DEBUG] Processing Ruleset ID: f782784c-6246-41e9-b98f-2411fdb7c286
[DEBUG] Ruleset Key: cinematic-combat-lite
[DEBUG] Ruleset Name: N/A
[DEBUG] Raw definition type: object
[DEBUG] Raw definition (first 500 chars): {"id":"cinematic-combat-lite","name":"Cinematic Combat Lite","target":"GLOBAL","actions":{"resolve_clash":{"kind":"player_initiated","logic":[{"args":{"path":"tier1_entity.current_stamina","amount":-5},"step_id":"deduct_cost","function":"state.modify"},{"args":{"path":"tier1_world.narrative.atmosphere","value":"Tense"},"step_id":"set_atmosphere","function":"state.set"},{"args":{"map":{"reckless":-20,"trickery":20,"defensive":-10,"aggressive":10},"input":"input.tactic_tag","default":0},"step_id":
[DEBUG] ✅ Actions found in raw definition: [ 'resolve_clash' ]
[DEBUG] Action count: 1
[DEBUG] ---
[DEBUG] Processing Ruleset ID: 9380a00e-2637-4128-84a8-938376f6bb55
[DEBUG] Ruleset Key: npc-relationships
[DEBUG] Ruleset Name: N/A
[DEBUG] Raw definition type: object
[DEBUG] Raw definition (first 500 chars): {"id":"npc-relationships","name":"NPC Relationships","target":"GLOBAL","actions":{"run_context_spotlight":{"kind":"system_auto","logic":[{"args":{"path":"tier1_entity.current_interaction_context","value":"None"},"step_id":"reset_context","function":"state.set"},{"args":{"min_value":8,"filter_key":"severity","source_list":"tier1_entity.relationships.{target_id}.tags","output_format":"object_list"},"step_id":"filter_high_severity","function":"logic.filter","output_to":"critical_memories"},{"args":
[DEBUG] ✅ Actions found in raw definition: [
  'run_context_spotlight',
  'check_intimacy_consent',
  'apply_relationship_delta',
  'propose_relationship_arc'
]
[DEBUG] Action count: 4
[DEBUG] 🔍 NPC-RELATIONSHIPS DETECTED! Checking for apply_relationship_delta...
[DEBUG] ✅ apply_relationship_delta FOUND in raw definition!
[DEBUG] Full action definition: {
  "kind": "system_compute",
  "logic": [
    {
      "args": {
        "map": {
          "flirt": "desire",
          "betray": "trust",
          "insult": "respect",
          "confide": "trust",
          "compliment": "warmth"
        },
        "default": "warmth",
        "input_value": "input.verb"
      },
      "step_id": "map_stat_key",
      "function": "logic.map",
      "output_to": "target_stat"
    },
    {
      "args": {
        "map": {
          "flirt": 5,
          "betray": -50,
          "insult": -15,
          "confide": 10,
          "compliment": 5
        },
        "default": 0,
        "input_value": "input.verb"
      },
      "step_id": "map_val_amount",
      "function": "logic.map",
      "output_to": "delta_amount"
    },
    {
      "args": {
        "path": "tier1_entity.relationships.{target_id}.stats.{target_stat}",
        "amount": "@delta_amount",
        "clamp_max": 100,
        "clamp_min": 0
      },
      "step_id": "apply_delta",
      "function": "state.modify"
    },
    {
      "args": {
        "item": {
          "role": "Confidant",
          "origin": "High Trust",
          "severity": 5,
          "turn_added": "tier1_world.current_turn"
        },
        "path": "tier1_entity.relationships.{target_id}.tags",
        "operation": "add"
      },
      "step_id": "grant_confidant_tag",
      "function": "state.list_op",
      "conditions": [
        {
          "op": "gte",
          "left": "tier1_entity.relationships.{target_id}.stats.trust",
          "right": 80
        }
      ]
    }
  ],
  "trigger": {
    "type": "intent_match",
    "keyword_id": "social_action"
  }
}
[DEBUG] ---
[DEBUG] Processing Ruleset ID: 283b104a-7acc-43a8-a82c-4039fe8e4015
[DEBUG] Ruleset Key: vitality-stamina-system
[DEBUG] Ruleset Name: N/A
[DEBUG] Raw definition type: object
[DEBUG] Raw definition (first 500 chars): {"id":"vitality-stamina-system","name":"Vitality & Stamina System","target":"GLOBAL","actions":{"take_rest":{"kind":"player_initiated","logic":[{"args":{"path":"tier1_world.current_tick","amount":20},"step_id":"advance_time","function":"state.modify","description":"Advances the world clock (0-24 scale). Engine handles wrap-around."},{"args":{"path":"tier1_entity.current_stamina","value":100},"step_id":"restore_stamina","function":"state.modify"},{"args":{"path":"tier1_entity.satiety","amount":-2
[DEBUG] ✅ Actions found in raw definition: [ 'take_rest' ]
[DEBUG] Action count: 1
[DEBUG] ---
[DEBUG] Processing Ruleset ID: e3af4246-9a50-4743-bb45-84c6fec7b282
[DEBUG] Ruleset Key: world-cycle-time-bands
[DEBUG] Ruleset Name: N/A
[DEBUG] Raw definition type: object
[DEBUG] Raw definition (first 500 chars): {"id":"world-cycle-time-bands","name":"World Cycle & Time Bands","actions":{"mas2_narrator":{"state_readouts":[{"path":"tier1_world.time_band","label":"TIME OF DAY"},{"path":"tier1_world.current_tick","label":"CLOCK TICK (0-24)"}],"style_injections":[{"content":"Use [TIME OF DAY] to strictly dictate lighting and NPC activity levels. 'High Noon' is bright/active. 'Deep Night' is dark/quiet/dangerous. 'Pre-Dawn' is foggy/cold.","category":"sensory","priority":95,"unique_id":"temporal_grounding"}]}
[DEBUG] ✅ Actions found in raw definition: [ 'mas2_narrator', 'mas1_interpreter' ]
[DEBUG] Action count: 2
[DEBUG] ---
[DEBUG] Processing Ruleset ID: 480bcc4b-71d1-4e0e-96c5-9a5e9d608d48
[DEBUG] Ruleset Key: npc-value-impact-tagging
[DEBUG] Ruleset Name: N/A
[DEBUG] Raw definition type: object
[DEBUG] Raw definition (first 500 chars): {"id":"npc-value-impact-tagging","name":"NPC Value Impact Tagging","actions":{"commit_impact_to_memory":{"kind":"system_auto","logic":[{"args":{"list_a":"tier1_entity.core_values","list_b":"input.violation_tags"},"step_id":"calc_conflict","function":"logic.intersection","output_to":"violated_value"},{"args":{"item":{"role":"Offender","origin":"Player violated my value of {violated_value}","severity":10,"turn_added":"tier1_world.current_turn"},"path":"tier1_entity.relationships.{target_id}.tags",
[DEBUG] ✅ Actions found in raw definition: [ 'commit_impact_to_memory' ]
[DEBUG] Action count: 1
[DEBUG] ---
[DEBUG] Processing Ruleset ID: 06b77c7c-5ba2-4713-9ae0-ebb40ed7ad8e
[DEBUG] Ruleset Key: stamina-based-magic
[DEBUG] Ruleset Name: N/A
[DEBUG] Raw definition type: object
[DEBUG] Raw definition (first 500 chars): {"id":"stamina-based-magic","name":"Stamina-Based Magic","actions":{"cast_spell":{"kind":"player_initiated","logic":[{"args":{"path":"tier1_entity.current_stamina","amount":-25,"clamp_min":0},"step_id":"deduct_cost","function":"state.modify","description":"Magic is heavy. Costs 25 Stamina (1/4 of tank)."},{"args":{"entity":"@request.actor_id","skill_id":"@tier1_entity.casting_stat_id","difficulty_mod":0},"step_id":"resolve_skill","function":"resolution.resolve","description":"Uses the entity's p
[DEBUG] ✅ Actions found in raw definition: [ 'cast_spell' ]
[DEBUG] Action count: 1
[DEBUG] ---
[DEBUG] ===== END TEMPLATE FETCH DEBUG =====


[DEBUG] ===== POST-PARSE VERIFICATION =====
[DEBUG] Post-parse Ruleset 13f11115-93e9-4820-9bb9-1a8a0306839d (npc-roles-background): 0 actions
[DEBUG] Action keys: []
[DEBUG] Post-parse Ruleset 661e1ef0-0f7c-4f82-88c0-b70e25fa9a8f (npc-personalities): 1 actions
[DEBUG] Action keys: [ 'add_personality_trait' ]
[DEBUG] Post-parse Ruleset add200c9-92c5-4b27-9c9e-115f65b45882 (npc-values-motivations): 0 actions
[DEBUG] Action keys: []
[DEBUG] Post-parse Ruleset 159a4f04-a0c1-4417-86ca-c7502bfd1d36 (npc-plot-drivers): 0 actions
[DEBUG] Action keys: []
[DEBUG] Post-parse Ruleset 4d6b06d2-08a3-4fe3-942a-a8af43072e83 (npc-quirks-habits): 1 actions
[DEBUG] Action keys: [ 'filter_quirks_by_context' ]
[DEBUG] Post-parse Ruleset ee2eeb72-48ce-4003-8778-c32c3242fc57 (npc-preferences-phobias): 2 actions
[DEBUG] Action keys: [ 'detect_aversion_match', 'detect_interest_match' ]
[DEBUG] Post-parse Ruleset 1cdfbd29-07e6-4aa5-98b0-a2a7b3e6ad4b (d100-5-pillars): 1 actions
[DEBUG] Action keys: [ 'resolve_skill_check' ]
[DEBUG] Post-parse Ruleset 95d450b3-b597-4212-8bbd-d1422948f976 (needs-survival-basic): 2 actions
[DEBUG] Action keys: [ 'consume_food', 'apply_metabolic_decay' ]
[DEBUG] Post-parse Ruleset f782784c-6246-41e9-b98f-2411fdb7c286 (cinematic-combat-lite): 1 actions
[DEBUG] Action keys: [ 'resolve_clash' ]
[DEBUG] Post-parse Ruleset 9380a00e-2637-4128-84a8-938376f6bb55 (npc-relationships): 4 actions
[DEBUG] Action keys: [
  'run_context_spotlight',
  'check_intimacy_consent',
  'apply_relationship_delta',
  'propose_relationship_arc'
]
[DEBUG] Post-parse Ruleset 283b104a-7acc-43a8-a82c-4039fe8e4015 (vitality-stamina-system): 1 actions
[DEBUG] Action keys: [ 'take_rest' ]
[DEBUG] Post-parse Ruleset e3af4246-9a50-4743-bb45-84c6fec7b282 (world-cycle-time-bands): 2 actions
[DEBUG] Action keys: [ 'mas2_narrator', 'mas1_interpreter' ]
[DEBUG] Post-parse Ruleset 480bcc4b-71d1-4e0e-96c5-9a5e9d608d48 (npc-value-impact-tagging): 1 actions
[DEBUG] Action keys: [ 'commit_impact_to_memory' ]
[DEBUG] Post-parse Ruleset 06b77c7c-5ba2-4713-9ae0-ebb40ed7ad8e (stamina-based-magic): 1 actions
[DEBUG] Action keys: [ 'cast_spell' ]
[DEBUG] ===== END POST-PARSE VERIFICATION =====

[Compiler V3] Refining 14 rulesets...

[DEBUG] ===== ENGINE REFINER: ACTION MERGE DEBUG =====
[DEBUG] Processing 14 rulesets...
[DEBUG] Initial actions count: 0
[DEBUG] Initial action keys: []

[DEBUG] --- Processing Ruleset: npc-roles-background (ID: 13f11115-93e9-4820-9bb9-1a8a0306839d) ---
[DEBUG] ✅ Actions found in definition.actions
[DEBUG] Action keys in definition: []
[DEBUG] Action count: 0
[DEBUG] Actions BEFORE merge: []
[DEBUG] Actions count BEFORE: 0
[DEBUG] Actions AFTER merge: []
[DEBUG] Actions count AFTER: 0

[DEBUG] --- Processing Ruleset: npc-personalities (ID: 661e1ef0-0f7c-4f82-88c0-b70e25fa9a8f) ---
[DEBUG] ✅ Actions found in definition.actions
[DEBUG] Action keys in definition: [ 'add_personality_trait' ]
[DEBUG] Action count: 1
[DEBUG]   - Extracting action: "add_personality_trait"
[DEBUG] Actions BEFORE merge: []
[DEBUG] Actions count BEFORE: 0
[DEBUG]   Processing action: "add_personality_trait"
[DEBUG]     ⚠️ Action steps is not an array: object
[DEBUG]     Merging "add_personality_trait" into runtime.actions...
[DEBUG]     ✅ Merged "add_personality_trait"
[DEBUG] Actions AFTER merge: [ 'add_personality_trait' ]
[DEBUG] Actions count AFTER: 1

[DEBUG] --- Processing Ruleset: npc-values-motivations (ID: add200c9-92c5-4b27-9c9e-115f65b45882) ---
[DEBUG] ✅ Actions found in definition.actions
[DEBUG] Action keys in definition: []
[DEBUG] Action count: 0
[DEBUG] Actions BEFORE merge: [ 'add_personality_trait' ]
[DEBUG] Actions count BEFORE: 1
[DEBUG] Actions AFTER merge: [ 'add_personality_trait' ]
[DEBUG] Actions count AFTER: 1

[DEBUG] --- Processing Ruleset: npc-plot-drivers (ID: 159a4f04-a0c1-4417-86ca-c7502bfd1d36) ---
[DEBUG] ✅ Actions found in definition.actions
[DEBUG] Action keys in definition: []
[DEBUG] Action count: 0
[DEBUG] Actions BEFORE merge: [ 'add_personality_trait' ]
[DEBUG] Actions count BEFORE: 1
[DEBUG] Actions AFTER merge: [ 'add_personality_trait' ]
[DEBUG] Actions count AFTER: 1

[DEBUG] --- Processing Ruleset: npc-quirks-habits (ID: 4d6b06d2-08a3-4fe3-942a-a8af43072e83) ---
[DEBUG] ✅ Actions found in definition.actions
[DEBUG] Action keys in definition: [ 'filter_quirks_by_context' ]
[DEBUG] Action count: 1
[DEBUG]   - Extracting action: "filter_quirks_by_context"
[DEBUG] Actions BEFORE merge: [ 'add_personality_trait' ]
[DEBUG] Actions count BEFORE: 1
[DEBUG]   Processing action: "filter_quirks_by_context"
[DEBUG]     ⚠️ Action steps is not an array: object
[DEBUG]     Merging "filter_quirks_by_context" into runtime.actions...
[DEBUG]     ✅ Merged "filter_quirks_by_context"
[DEBUG] Actions AFTER merge: [ 'add_personality_trait', 'filter_quirks_by_context' ]
[DEBUG] Actions count AFTER: 2

[DEBUG] --- Processing Ruleset: npc-preferences-phobias (ID: ee2eeb72-48ce-4003-8778-c32c3242fc57) ---
[DEBUG] ✅ Actions found in definition.actions
[DEBUG] Action keys in definition: [ 'detect_aversion_match', 'detect_interest_match' ]
[DEBUG] Action count: 2
[DEBUG]   - Extracting action: "detect_aversion_match"
[DEBUG]   - Extracting action: "detect_interest_match"
[DEBUG] Actions BEFORE merge: [ 'add_personality_trait', 'filter_quirks_by_context' ]
[DEBUG] Actions count BEFORE: 2
[DEBUG]   Processing action: "detect_aversion_match"
[DEBUG]     ⚠️ Action steps is not an array: object
[DEBUG]     Merging "detect_aversion_match" into runtime.actions...
[DEBUG]     ✅ Merged "detect_aversion_match"
[DEBUG]   Processing action: "detect_interest_match"
[DEBUG]     ⚠️ Action steps is not an array: object
[DEBUG]     Merging "detect_interest_match" into runtime.actions...
[DEBUG]     ✅ Merged "detect_interest_match"
[DEBUG] Actions AFTER merge: [
  'add_personality_trait',
  'filter_quirks_by_context',
  'detect_aversion_match',
  'detect_interest_match'
]
[DEBUG] Actions count AFTER: 4

[DEBUG] --- Processing Ruleset: d100-5-pillars (ID: 1cdfbd29-07e6-4aa5-98b0-a2a7b3e6ad4b) ---
[DEBUG] ✅ Actions found in definition.actions
[DEBUG] Action keys in definition: [ 'resolve_skill_check' ]
[DEBUG] Action count: 1
[DEBUG]   - Extracting action: "resolve_skill_check"
[DEBUG] Actions BEFORE merge: [
  'add_personality_trait',
  'filter_quirks_by_context',
  'detect_aversion_match',
  'detect_interest_match'
]
[DEBUG] Actions count BEFORE: 4
[DEBUG]   Processing action: "resolve_skill_check"
[DEBUG]     ⚠️ Action steps is not an array: object
[DEBUG]     Merging "resolve_skill_check" into runtime.actions...
[DEBUG]     ✅ Merged "resolve_skill_check"
[DEBUG] Actions AFTER merge: [
  'add_personality_trait',
  'filter_quirks_by_context',
  'detect_aversion_match',
  'detect_interest_match',
  'resolve_skill_check'
]
[DEBUG] Actions count AFTER: 5

[DEBUG] --- Processing Ruleset: needs-survival-basic (ID: 95d450b3-b597-4212-8bbd-d1422948f976) ---
[DEBUG] ✅ Actions found in definition.actions
[DEBUG] Action keys in definition: [ 'consume_food', 'apply_metabolic_decay' ]
[DEBUG] Action count: 2
[DEBUG]   - Extracting action: "consume_food"
[DEBUG]   - Extracting action: "apply_metabolic_decay"
[DEBUG] Actions BEFORE merge: [
  'add_personality_trait',
  'filter_quirks_by_context',
  'detect_aversion_match',
  'detect_interest_match',
  'resolve_skill_check'
]
[DEBUG] Actions count BEFORE: 5
[DEBUG]   Processing action: "consume_food"
[DEBUG]     ⚠️ Action steps is not an array: object
[DEBUG]     Merging "consume_food" into runtime.actions...
[DEBUG]     ✅ Merged "consume_food"
[DEBUG]   Processing action: "apply_metabolic_decay"
[DEBUG]     ⚠️ Action steps is not an array: object
[DEBUG]     Merging "apply_metabolic_decay" into runtime.actions...
[DEBUG]     ✅ Merged "apply_metabolic_decay"
[DEBUG] Actions AFTER merge: [
  'add_personality_trait',
  'filter_quirks_by_context',
  'detect_aversion_match',
  'detect_interest_match',
  'resolve_skill_check',
  'consume_food',
  'apply_metabolic_decay'
]
[DEBUG] Actions count AFTER: 7

[DEBUG] --- Processing Ruleset: cinematic-combat-lite (ID: f782784c-6246-41e9-b98f-2411fdb7c286) ---
[DEBUG] ✅ Actions found in definition.actions
[DEBUG] Action keys in definition: [ 'resolve_clash' ]
[DEBUG] Action count: 1
[DEBUG]   - Extracting action: "resolve_clash"
[DEBUG] Actions BEFORE merge: [
  'add_personality_trait',
  'filter_quirks_by_context',
  'detect_aversion_match',
  'detect_interest_match',
  'resolve_skill_check',
  'consume_food',
  'apply_metabolic_decay'
]
[DEBUG] Actions count BEFORE: 7
[DEBUG]   Processing action: "resolve_clash"
[DEBUG]     ⚠️ Action steps is not an array: object
[DEBUG]     Merging "resolve_clash" into runtime.actions...
[DEBUG]     ✅ Merged "resolve_clash"
[DEBUG] Actions AFTER merge: [
  'add_personality_trait',
  'filter_quirks_by_context',
  'detect_aversion_match',
  'detect_interest_match',
  'resolve_skill_check',
  'consume_food',
  'apply_metabolic_decay',
  'resolve_clash'
]
[DEBUG] Actions count AFTER: 8

[DEBUG] --- Processing Ruleset: npc-relationships (ID: 9380a00e-2637-4128-84a8-938376f6bb55) ---
[DEBUG] ✅ Actions found in definition.actions
[DEBUG] Action keys in definition: [
  'run_context_spotlight',
  'check_intimacy_consent',
  'apply_relationship_delta',
  'propose_relationship_arc'
]
[DEBUG] Action count: 4
[DEBUG]   - Extracting action: "run_context_spotlight"
[DEBUG]   - Extracting action: "check_intimacy_consent"
[DEBUG]   - Extracting action: "apply_relationship_delta"
[DEBUG]   - Extracting action: "propose_relationship_arc"
[DEBUG] Actions BEFORE merge: [
  'add_personality_trait',
  'filter_quirks_by_context',
  'detect_aversion_match',
  'detect_interest_match',
  'resolve_skill_check',
  'consume_food',
  'apply_metabolic_decay',
  'resolve_clash'
]
[DEBUG] Actions count BEFORE: 8
[DEBUG]   Processing action: "run_context_spotlight"
[DEBUG]     ⚠️ Action steps is not an array: object
[DEBUG]     Merging "run_context_spotlight" into runtime.actions...
[DEBUG]     ✅ Merged "run_context_spotlight"
[DEBUG]   Processing action: "check_intimacy_consent"
[DEBUG]     ⚠️ Action steps is not an array: object
[DEBUG]     Merging "check_intimacy_consent" into runtime.actions...
[DEBUG]     ✅ Merged "check_intimacy_consent"
[DEBUG]   Processing action: "apply_relationship_delta"
[DEBUG]     ⚠️ Action steps is not an array: object
[DEBUG]     Merging "apply_relationship_delta" into runtime.actions...
[DEBUG]     ✅ Merged "apply_relationship_delta"
[DEBUG]   Processing action: "propose_relationship_arc"
[DEBUG]     ⚠️ Action steps is not an array: object
[DEBUG]     Merging "propose_relationship_arc" into runtime.actions...
[DEBUG]     ✅ Merged "propose_relationship_arc"
[DEBUG] Actions AFTER merge: [
  'add_personality_trait',
  'filter_quirks_by_context',
  'detect_aversion_match',
  'detect_interest_match',
  'resolve_skill_check',
  'consume_food',
  'apply_metabolic_decay',
  'resolve_clash',
  'run_context_spotlight',
  'check_intimacy_consent',
  'apply_relationship_delta',
  'propose_relationship_arc'
]
[DEBUG] Actions count AFTER: 12
[DEBUG] ✅ apply_relationship_delta successfully merged!
[DEBUG] ✅ propose_relationship_arc successfully merged!

[DEBUG] --- Processing Ruleset: vitality-stamina-system (ID: 283b104a-7acc-43a8-a82c-4039fe8e4015) ---
[DEBUG] ✅ Actions found in definition.actions
[DEBUG] Action keys in definition: [ 'take_rest' ]
[DEBUG] Action count: 1
[DEBUG]   - Extracting action: "take_rest"
[DEBUG] Actions BEFORE merge: [
  'add_personality_trait',
  'filter_quirks_by_context',
  'detect_aversion_match',
  'detect_interest_match',
  'resolve_skill_check',
  'consume_food',
  'apply_metabolic_decay',
  'resolve_clash',
  'run_context_spotlight',
  'check_intimacy_consent',
  'apply_relationship_delta',
  'propose_relationship_arc'
]
[DEBUG] Actions count BEFORE: 12
[DEBUG]   Processing action: "take_rest"
[DEBUG]     ⚠️ Action steps is not an array: object
[DEBUG]     Merging "take_rest" into runtime.actions...
[DEBUG]     ✅ Merged "take_rest"
[DEBUG] Actions AFTER merge: [
  'add_personality_trait',
  'filter_quirks_by_context',
  'detect_aversion_match',
  'detect_interest_match',
  'resolve_skill_check',
  'consume_food',
  'apply_metabolic_decay',
  'resolve_clash',
  'run_context_spotlight',
  'check_intimacy_consent',
  'apply_relationship_delta',
  'propose_relationship_arc',
  'take_rest'
]
[DEBUG] Actions count AFTER: 13

[DEBUG] --- Processing Ruleset: world-cycle-time-bands (ID: e3af4246-9a50-4743-bb45-84c6fec7b282) ---
[DEBUG] ✅ Actions found in definition.actions
[DEBUG] Action keys in definition: [ 'mas2_narrator', 'mas1_interpreter' ]
[DEBUG] Action count: 2
[DEBUG]   - Extracting action: "mas2_narrator"
[DEBUG]   - Extracting action: "mas1_interpreter"
[DEBUG] Actions BEFORE merge: [
  'add_personality_trait',
  'filter_quirks_by_context',
  'detect_aversion_match',
  'detect_interest_match',
  'resolve_skill_check',
  'consume_food',
  'apply_metabolic_decay',
  'resolve_clash',
  'run_context_spotlight',
  'check_intimacy_consent',
  'apply_relationship_delta',
  'propose_relationship_arc',
  'take_rest'
]
[DEBUG] Actions count BEFORE: 13
[DEBUG]   Processing action: "mas2_narrator"
[DEBUG]     ⚠️ Action steps is not an array: object
[DEBUG]     Merging "mas2_narrator" into runtime.actions...
[DEBUG]     ✅ Merged "mas2_narrator"
[DEBUG]   Processing action: "mas1_interpreter"
[DEBUG]     ⚠️ Action steps is not an array: object
[DEBUG]     Merging "mas1_interpreter" into runtime.actions...
[DEBUG]     ✅ Merged "mas1_interpreter"
[DEBUG] Actions AFTER merge: [
  'add_personality_trait',
  'filter_quirks_by_context',
  'detect_aversion_match',
  'detect_interest_match',
  'resolve_skill_check',
  'consume_food',
  'apply_metabolic_decay',
  'resolve_clash',
  'run_context_spotlight',
  'check_intimacy_consent',
  'apply_relationship_delta',
  'propose_relationship_arc',
  'take_rest',
  'mas2_narrator',
  'mas1_interpreter'
]
[DEBUG] Actions count AFTER: 15

[DEBUG] --- Processing Ruleset: npc-value-impact-tagging (ID: 480bcc4b-71d1-4e0e-96c5-9a5e9d608d48) ---
[DEBUG] ✅ Actions found in definition.actions
[DEBUG] Action keys in definition: [ 'commit_impact_to_memory' ]
[DEBUG] Action count: 1
[DEBUG]   - Extracting action: "commit_impact_to_memory"
[DEBUG] Actions BEFORE merge: [
  'add_personality_trait',
  'filter_quirks_by_context',
  'detect_aversion_match',
  'detect_interest_match',
  'resolve_skill_check',
  'consume_food',
  'apply_metabolic_decay',
  'resolve_clash',
  'run_context_spotlight',
  'check_intimacy_consent',
  'apply_relationship_delta',
  'propose_relationship_arc',
  'take_rest',
  'mas2_narrator',
  'mas1_interpreter'
]
[DEBUG] Actions count BEFORE: 15
[DEBUG]   Processing action: "commit_impact_to_memory"
[DEBUG]     ⚠️ Action steps is not an array: object
[DEBUG]     Merging "commit_impact_to_memory" into runtime.actions...
[DEBUG]     ✅ Merged "commit_impact_to_memory"
[DEBUG] Actions AFTER merge: [
  'add_personality_trait',
  'filter_quirks_by_context',
  'detect_aversion_match',
  'detect_interest_match',
  'resolve_skill_check',
  'consume_food',
  'apply_metabolic_decay',
  'resolve_clash',
  'run_context_spotlight',
  'check_intimacy_consent',
  'apply_relationship_delta',
  'propose_relationship_arc',
  'take_rest',
  'mas2_narrator',
  'mas1_interpreter',
  'commit_impact_to_memory'
]
[DEBUG] Actions count AFTER: 16

[DEBUG] --- Processing Ruleset: stamina-based-magic (ID: 06b77c7c-5ba2-4713-9ae0-ebb40ed7ad8e) ---
[DEBUG] ✅ Actions found in definition.actions
[DEBUG] Action keys in definition: [ 'cast_spell' ]
[DEBUG] Action count: 1
[DEBUG]   - Extracting action: "cast_spell"
[DEBUG] Actions BEFORE merge: [
  'add_personality_trait',
  'filter_quirks_by_context',
  'detect_aversion_match',
  'detect_interest_match',
  'resolve_skill_check',
  'consume_food',
  'apply_metabolic_decay',
  'resolve_clash',
  'run_context_spotlight',
  'check_intimacy_consent',
  'apply_relationship_delta',
  'propose_relationship_arc',
  'take_rest',
  'mas2_narrator',
  'mas1_interpreter',
  'commit_impact_to_memory'
]
[DEBUG] Actions count BEFORE: 16
[DEBUG]   Processing action: "cast_spell"
[DEBUG]     ⚠️ Action steps is not an array: object
[DEBUG]     Merging "cast_spell" into runtime.actions...
[DEBUG]     ✅ Merged "cast_spell"
[DEBUG] Actions AFTER merge: [
  'add_personality_trait',
  'filter_quirks_by_context',
  'detect_aversion_match',
  'detect_interest_match',
  'resolve_skill_check',
  'consume_food',
  'apply_metabolic_decay',
  'resolve_clash',
  'run_context_spotlight',
  'check_intimacy_consent',
  'apply_relationship_delta',
  'propose_relationship_arc',
  'take_rest',
  'mas2_narrator',
  'mas1_interpreter',
  'commit_impact_to_memory',
  'cast_spell'
]
[DEBUG] Actions count AFTER: 17

[DEBUG] ===== FINAL MERGE RESULT =====
[DEBUG] Total actions in runtime.actions: 17
[DEBUG] Final action keys: [
  'add_personality_trait',
  'filter_quirks_by_context',
  'detect_aversion_match',
  'detect_interest_match',
  'resolve_skill_check',
  'consume_food',
  'apply_metabolic_decay',
  'resolve_clash',
  'run_context_spotlight',
  'check_intimacy_consent',
  'apply_relationship_delta',
  'propose_relationship_arc',
  'take_rest',
  'mas2_narrator',
  'mas1_interpreter',
  'commit_impact_to_memory',
  'cast_spell'
]
[DEBUG] ===== END ENGINE REFINER DEBUG =====

[Compiler V3] Resolving Entities: Target Count = 6
[Compiler V3] Snapshot Entities Prepared: 6 entities.

[DEBUG] ===== SERIALIZATION DEBUG (Before Save) =====
[DEBUG] Cartridge type: object
[DEBUG] Cartridge keys: [ 'runtime', 'active_rulesets' ]
[DEBUG] Final config_engine.runtime.actions count: 17
[DEBUG] Final config_engine.runtime.actions keys: [
  'add_personality_trait',
  'filter_quirks_by_context',
  'detect_aversion_match',
  'detect_interest_match',
  'resolve_skill_check',
  'consume_food',
  'apply_metabolic_decay',
  'resolve_clash',
  'run_context_spotlight',
  'check_intimacy_consent',
  'apply_relationship_delta',
  'propose_relationship_arc',
  'take_rest',
  'mas2_narrator',
  'mas1_interpreter',
  'commit_impact_to_memory',
  'cast_spell'
]
[DEBUG] ✅ apply_relationship_delta present in final config_engine
[DEBUG] ✅ propose_relationship_arc present in final config_engine
[DEBUG] Serialized config_engine (first 1000 chars): {"runtime":{"logic":{"intents":{"attack":"combat_action","defend":"combat_action","dodge":"combat_action","feint":"combat_action","charge":"combat_action","greet":"general_interaction","talk":"general_interaction","ask":"general_interaction","flirt":"social_action","compliment":"social_action","insult":"social_action","betray":"social_action","confide":"social_action","ask_out":"relationship_proposal","propose":"relationship_proposal","seduce":"relationship_proposal","kiss":"intimacy_action","touch":"intimacy_action","hug":"intimacy_action","rest":"rest_action","camp":"rest_action","sleep":"trigger_time_pass","wait":"trigger_time_pass","travel":"trigger_time_pass","explore":"trigger_time_pass"},"constraints":[{"logic":"Analyze the user's verb. If it matches a known Expansion Skill (e.g. 'Hide'), request that ID. If not, map to the nearest of the 5 Roots. DEFAULT: 'root_finesse' for dexterity, 'root_force' for strength.","context":"D100 5 Pillars"},{"logic":"Check [PHYSICAL CONDITION].
[DEBUG] ===== END SERIALIZATION DEBUG =====

[Compiler V3] Successfully saved compiled story. Key: 97af18c8-79fc-422c-a830-7cac257685a7, ID: 2e334752-1ea6-4e42-aab4-fa4e508fbb15

[INTEGRITY] ===== READ-AFTER-WRITE VERIFICATION =====
[INTEGRITY] Fetching saved record to verify persistence...
[INTEGRITY] ✅ Record fetched successfully. Verifying data integrity...
[INTEGRITY] Input actions count: 17
[INTEGRITY] Input action keys: [
  'add_personality_trait',
  'filter_quirks_by_context',
  'detect_aversion_match',
  'detect_interest_match',
  'resolve_skill_check',
  'consume_food',
  'apply_metabolic_decay',
  'resolve_clash',
  'run_context_spotlight',
  'check_intimacy_consent',
  'apply_relationship_delta',
  'propose_relationship_arc',
  'take_rest',
  'mas2_narrator',
  'mas1_interpreter',
  'commit_impact_to_memory',
  'cast_spell'
]
[INTEGRITY] Saved actions count: 17
[INTEGRITY] Saved action keys: [
  'take_rest',
  'cast_spell',
  'consume_food',
  'mas2_narrator',
  'resolve_clash',
  'mas1_interpreter',
  'resolve_skill_check',
  'add_personality_trait',
  'apply_metabolic_decay',
  'detect_aversion_match',
  'detect_interest_match',
  'run_context_spotlight',
  'check_intimacy_consent',
  'commit_impact_to_memory',
  'apply_relationship_delta',
  'filter_quirks_by_context',
  'propose_relationship_arc'
]
[INTEGRITY] ✅ Key "apply_relationship_delta" verified in saved record
[INTEGRITY] ✅ Key "propose_relationship_arc" verified in saved record
[INTEGRITY] Input config_engine string length: 47050
[INTEGRITY] Saved config_engine string length: 47050
[INTEGRITY] Length difference: 0 bytes
[INTEGRITY] ✅ Integrity check passed! All actions verified.
[INTEGRITY] ===== END READ-AFTER-WRITE VERIFICATION =====

[Compiler V3] ✅ Compilation Complete. Cartridge ID: 2e334752-1ea6-4e42-aab4-fa4e508fbb15 (Version: 1)