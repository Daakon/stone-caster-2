/**
 * AWF Core Ruleset Schema V1
 * Narrative/pacing/style policies - separated from core contracts
 */

import { z } from "zod";

export const CoreRulesetV1Schema = z.object({
  ruleset: z.object({
    name: z.string().min(1),

    "scn.phases": z.array(z.string().min(1)).min(1), // <<— required non-empty
    "txt.policy": z.string().min(1),                 // <<— required
    "choices.policy": z.string().min(1),             // <<— required

    language: z.object({
      one_language_only: z.boolean().optional(),
      use_meta_locale: z.boolean().optional()
    }).optional(),

    token_discipline: z.object({
      npcs_active_cap: z.number().int().positive().optional(),
      sim_nearby_token_cap: z.number().int().positive().optional(),
      mods_micro_slice_cap_per_namespace: z.number().int().positive().optional(),
      mods_micro_slice_cap_global: z.number().int().positive().optional(),
      episodic_cap: z.number().int().positive().optional(),
      episodic_note_max_chars: z.number().int().positive().optional()
    }).optional(),

    time: z.object({
      bands_cycle: z.array(z.string().min(1)).optional(),
      ticks_per_band: z.number().int().positive().optional()
    }).optional(),

    menus: z.object({
      min_choices: z.number().int().nonnegative().optional(),
      max_choices: z.number().int().positive().optional(),
      label_max_chars: z.number().int().positive().optional()
    }).optional(),

    mechanics_visibility: z.object({
      no_mechanics_in_txt: z.boolean().optional()
    }).optional(),

    safety: z.object({
      consent_required_for_impactful_actions: z.boolean().optional(),
      offer_player_reaction_when_npc_initiates: z.boolean().optional()
    }).optional(),

    defaults: z.object({                         // <<— required object
      txt_sentences_min: z.number().int().positive(),
      txt_sentences_max: z.number().int().positive(),
      time_ticks_min_step: z.number().int().positive().optional(),
      cooldowns: z.record(z.number().int().nonnegative()).optional()
    })
  }).strict()
}).strict();

// Type export
export type CoreRulesetV1 = z.infer<typeof CoreRulesetV1Schema>;
