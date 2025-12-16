/**
 * Mock Rulesets Data
 * Temporary data for UI testing - mimics database content
 * 
 * Structure matches RulesetDefinition from @shared/types/chimera-authoring
 */

import type { RulesetDefinition } from '@shared/types/chimera-authoring';

export const AVAILABLE_RULESETS: RulesetDefinition[] = [
  // ============================================================================
  // FOUNDATION RULESETS
  // ============================================================================
  {
    id: 'foundation-d100-5-pillars',
    name: 'D100 Skills System',
    description_short: 'Five-pillar skill system with d100 rolls',
    description_long: 'A comprehensive skill-based system using five core pillars: Force, Finesse, Awareness, Insight, and Influence. All actions resolve with d100 rolls against skill values.',
    ui_category: 'foundation',
    exclusion_group: 'skill_system_root',
    dependencies: [],
    provides_tags: ['d100', 'skills', 'five_pillars', 'tactical', 'crunchy'],
    state_contributions: {
      tier1_entity: ['root_force', 'root_finesse', 'root_awareness', 'root_insight', 'root_influence'],
    },
    actions: {},
    ai_instructions: {},
  },
  {
    id: 'foundation-d100-lite',
    name: 'Simple Rolls',
    description_short: 'Lightweight d100 system for quick play',
    description_long: 'A simplified d100 system that focuses on fast resolution without complex skill trees. Perfect for narrative-focused games.',
    ui_category: 'foundation',
    exclusion_group: 'skill_system_root',
    dependencies: [],
    provides_tags: ['d100', 'simple', 'narrative', 'lightweight'],
    state_contributions: {
      tier1_entity: ['root_force', 'root_finesse'],
    },
    actions: {},
    ai_instructions: {},
  },
  {
    id: 'foundation-world-cycle-time-bands',
    name: 'World Cycle & Time Bands',
    description_short: 'Narrative time tracking with world cycles',
    description_long: 'Adds time-of-day cycles and world state changes. The world evolves through different time bands (Dawn, Day, Dusk, Night) with unique properties.',
    ui_category: 'foundation',
    exclusion_group: 'time_core',
    dependencies: [],
    provides_tags: ['time', 'cycles', 'world_state', 'narrative'],
    state_contributions: {
      tier0_narrative: ['current_time_band', 'world_cycle_phase'],
    },
    actions: {},
    ai_instructions: {},
  },
  {
    id: 'foundation-precise-clock',
    name: 'Precise Clock',
    description_short: 'Hour-by-hour time tracking',
    description_long: 'Tracks time with precise hour-by-hour granularity. Perfect for time-sensitive adventures and detailed scheduling.',
    ui_category: 'foundation',
    exclusion_group: 'time_core',
    dependencies: [],
    provides_tags: ['time', 'precise', 'scheduling', 'tactical'],
    state_contributions: {
      tier0_narrative: ['current_hour', 'current_day', 'current_month'],
    },
    actions: {},
    ai_instructions: {},
  },

  // ============================================================================
  // EXPANSION RULESETS
  // ============================================================================
  {
    id: 'expansion-npc-personalities',
    name: 'NPC Personalities',
    description_short: 'Deep personality system for NPCs',
    description_long: 'Adds rich personality traits, motivations, and behavioral patterns to NPCs. Enables more dynamic and memorable non-player characters.',
    ui_category: 'expansion',
    exclusion_group: null,
    dependencies: [],
    provides_tags: ['npc', 'personality', 'social', 'narrative'],
    state_contributions: {
      tier1_entity: ['personality_traits', 'core_values', 'quirks'],
    },
    actions: {},
    ai_instructions: {},
  },
  {
    id: 'expansion-npc-quirks',
    name: 'NPC Quirks & Mannerisms',
    description_short: 'Adds unique quirks and mannerisms to NPCs',
    description_long: 'Extends the personality system with specific quirks, speech patterns, and behavioral tics. Requires NPC Personalities to function.',
    ui_category: 'expansion',
    exclusion_group: null,
    dependencies: ['expansion-npc-personalities'],
    provides_tags: ['npc', 'quirks', 'mannerisms', 'social', 'narrative'],
    state_contributions: {
      tier1_entity: ['quirks', 'speech_patterns'],
    },
    actions: {},
    ai_instructions: {},
  },
  {
    id: 'expansion-vitality-stamina',
    name: 'Vitality & Stamina',
    description_short: 'Physical resource management system',
    description_long: 'Adds stamina and vitality tracking for physical actions. Characters must manage their energy reserves during extended activities.',
    ui_category: 'expansion',
    exclusion_group: 'vitality_core',
    dependencies: [],
    provides_tags: ['resources', 'stamina', 'vitality', 'tactical', 'crunchy'],
    state_contributions: {
      tier1_entity: ['current_stamina', 'max_stamina', 'vitality'],
    },
    actions: {},
    ai_instructions: {},
  },
  {
    id: 'expansion-simple-hp',
    name: 'Simple HP System',
    description_short: 'Basic hit points for health tracking',
    description_long: 'A straightforward hit point system for tracking character health. Simpler than the vitality system, perfect for lighter gameplay.',
    ui_category: 'expansion',
    exclusion_group: 'vitality_core',
    dependencies: [],
    provides_tags: ['health', 'hp', 'simple', 'narrative', 'lightweight'],
    state_contributions: {
      tier1_entity: ['current_hp', 'max_hp'],
    },
    actions: {},
    ai_instructions: {},
  },
  {
    id: 'expansion-advanced-combat',
    name: 'Advanced Combat System',
    description_short: 'Complex tactical combat mechanics',
    description_long: 'Adds advanced combat mechanics including positioning, cover, and tactical maneuvers. Requires the D100 Skills System for full functionality.',
    ui_category: 'expansion',
    exclusion_group: null,
    dependencies: ['foundation-d100-5-pillars'],
    provides_tags: ['combat', 'tactical', 'advanced', 'crunchy'],
    state_contributions: {
      tier1_entity: ['combat_position', 'cover_bonus'],
    },
    actions: {},
    ai_instructions: {},
  },
  {
    id: 'expansion-hardcore-survival',
    name: 'Hardcore Survival',
    description_short: 'Intense survival mechanics with time pressure',
    description_long: 'Adds challenging survival mechanics including hunger, thirst, fatigue, and environmental hazards. Requires both Vitality & Stamina and World Cycle systems.',
    ui_category: 'expansion',
    exclusion_group: null,
    dependencies: ['expansion-vitality-stamina', 'foundation-world-cycle-time-bands'],
    provides_tags: ['survival', 'hardcore', 'challenge', 'tactical', 'crunchy'],
    state_contributions: {
      tier1_entity: ['hunger', 'thirst', 'fatigue'],
      tier0_narrative: ['environmental_hazards'],
    },
    actions: {},
    ai_instructions: {},
  },

  // ============================================================================
  // FLAVOR RULESETS
  // ============================================================================
  {
    id: 'flavor-magic-system',
    name: 'Magic System',
    description_short: 'Adds spellcasting and magical abilities',
    description_long: 'Introduces a flexible magic system with spell schools, mana pools, and magical effects. Can be adapted to various fantasy settings.',
    ui_category: 'flavor',
    exclusion_group: null,
    dependencies: [],
    provides_tags: ['magic', 'spells', 'mana', 'fantasy', 'narrative'],
    state_contributions: {
      tier1_entity: ['mana_pool', 'spell_slots'],
    },
    actions: {},
    ai_instructions: {},
  },
  {
    id: 'flavor-stealth-system',
    name: 'Stealth & Shadows',
    description_short: 'Sneaking and stealth mechanics',
    description_long: 'Adds stealth mechanics for sneaking, hiding, and ambushing. Includes detection systems and shadow-based abilities.',
    ui_category: 'flavor',
    exclusion_group: null,
    dependencies: [],
    provides_tags: ['stealth', 'sneaking', 'shadows', 'tactical'],
    state_contributions: {
      tier1_entity: ['stealth_rating', 'detection_level'],
    },
    actions: {},
    ai_instructions: {},
  },
  {
    id: 'flavor-social-intrigue',
    name: 'Social Intrigue',
    description_short: 'Political and social manipulation systems',
    description_long: 'Adds mechanics for social maneuvering, reputation, and political influence. Perfect for court intrigue and faction-based gameplay.',
    ui_category: 'flavor',
    exclusion_group: null,
    dependencies: [],
    provides_tags: ['social', 'politics', 'reputation', 'narrative'],
    state_contributions: {
      tier1_entity: ['reputation', 'influence_points'],
      tier0_narrative: ['faction_standing'],
    },
    actions: {},
    ai_instructions: {},
  },
];
