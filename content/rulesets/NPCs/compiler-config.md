Compiler Configuration / Aggregation.

This demonstrates how the Engine takes those 5 separate Rulesets (Foundation + 4 Expansions) and merges them into a single Master Entity Template and Master Prompt Template for the runtime.

Compiler Output 1: The Master Entity Template
Context: This is the JSON structure the Game Engine uses to spawn a new NPC. Logic: The Compiler performs a "Deep Merge" of all state_contributions from the active rulesets.

JSON

{
  "file_type": "compiled_state_template",
  "target_entity": "npc",
  "version": "v2025_01_build_44",
  "source_rulesets": [
    "fnd_core_personality_v1",
    "exp_quirks_habits_v2",
    "exp_values_motivations_v1",
    "exp_roles_background_v1",
    "exp_preferences_phobias_v1"
  ],
  "definitions": {
    "identity": {
      "core_traits": { "value": ["Neutral"], "source": "fnd_core_personality_v1" },
      "background_origin": { "value": "Commoner", "source": "exp_roles_background_v1" },
      "occupation_tags": { "value": [], "source": "exp_roles_background_v1" }
    },
    "behavior": {
      "quirk_registry": { "value": [], "source": "exp_quirks_habits_v2" },
      "active_quirks": { "value": [], "source": "exp_quirks_habits_v2" },
      "interest_triggers": { "value": [], "source": "exp_preferences_phobias_v1" },
      "aversion_triggers": { "value": [], "source": "exp_preferences_phobias_v1" }
    },
    "drive": {
      "core_values": { "value": [], "source": "exp_values_motivations_v1" },
      "current_objective": { "value": "Survive", "source": "exp_values_motivations_v1" }
    },
    "metrics": {
      "emotional_valence": { "value": 50, "source": "fnd_core_personality_v1" },
      "emotional_label": { "value": "Neutral", "source": "fnd_core_personality_v1" }
    }
  },
  "ui_layout_hints": {
    "tabs": ["Identity", "Psychology", "Background"],
    "field_mapping": {
        "core_traits": "Identity",
        "core_values": "Psychology",
        "quirk_registry": "Psychology"
    }
  }
}
Compiler Output 2: The Master Prompt Template
Context: This is the static instruction block sent to MAS 2 (The Narrator). Logic: The Compiler aggregates all style_injections, sorts them by priority, and creates the state_readouts map.

JSON

{
  "file_type": "compiled_prompt_template",
  "compatibility_hash": "a1b2c3d4",
  "system_instructions": [
    {
      "id": "trait_enforcement",
      "priority": 90,
      "text": "You must embody the archetypes listed in [CORE PERSONALITY]. If 'Lazy', avoid physical exertion. If 'Cruel', show lack of empathy."
    },
    {
      "id": "value_adherence",
      "priority": 85,
      "text": "The character MUST refuse requests that conflict with their [MORAL COMPASS]. They must actively steer conversation toward their [CURRENT OBJECTIVE]."
    },
    {
      "id": "preference_reaction",
      "priority": 75,
      "text": "If a topic in [SUBJECTS OF FASCINATION] is mentioned, become enthusiastic. If [SUBJECTS OF FEAR] is mentioned, become defensive or hostile."
    },
    {
      "id": "quirk_narration",
      "priority": 70,
      "text": "You must incorporate the [CURRENT VISIBLE MANNERISMS] into the description of the character's actions immediately."
    },
    {
      "id": "competence_display",
      "priority": 60,
      "text": "Assume high competence/jargon related to [KNOWN SKILLS]. Adjust vocabulary to match [SOCIAL ORIGIN]."
    }
  ],
  "dynamic_context_map": [
    { "label": "CORE PERSONALITY", "path": "tier1_entity.core_traits" },
    { "label": "MORAL COMPASS", "path": "tier1_entity.core_values" },
    { "label": "CURRENT OBJECTIVE", "path": "tier1_entity.current_objective" },
    { "label": "SUBJECTS OF FASCINATION", "path": "tier1_entity.interest_triggers" },
    { "label": "SUBJECTS OF FEAR", "path": "tier1_entity.aversion_triggers" },
    { "label": "CURRENT VISIBLE MANNERISMS", "path": "tier1_entity.active_quirks" },
    { "label": "SOCIAL ORIGIN", "path": "tier1_entity.background_origin" },
    { "label": "KNOWN SKILLS", "path": "tier1_entity.occupation_tags" }
  ]
}
Why this "Compile" step is critical:
Conflict Check: If we had two rulesets both trying to define "Background", the compiler would flag the collision here before the game starts.

Performance: The Runtime engine doesn't have to calculate "Which prompt comes first?" every single turn. It just reads the sorted system_instructions array.

Context Window Management: We can see exactly how many tokens we are using for "System Instructions" (the static block).

This concludes the Personality & Identity module.