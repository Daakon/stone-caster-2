/**
 * AWF Core Contract Schema
 * Strict Zod schema for the new AWF core contract format
 */

import { z } from 'zod';

// Act Catalog Item Schema
const ActCatalogItemSchema = z.object({
  type: z.string().min(1),
  mode: z.string().min(1),
  target: z.string().min(1),
}).strict();

// Core Contract Schema - strict validation with no extra keys
export const CoreContractSchema = z.object({
  contract: z.object({
    awf_return: z.string().min(1),
    'scn.phases': z.array(z.string().min(1)).min(1),
    'txt.policy': z.string().min(1),
    'choices.policy': z.string().min(1),
    'acts.policy': z.string().min(1),
  }).strict(),
  rules: z.object({
    language: z.object({
      one_language_only: z.boolean(),
      use_meta_locale: z.boolean(),
    }).strict(),
    scales: z.object({
      skill_min: z.number().int().min(0),
      skill_max: z.number().int().min(0),
      relationship_min: z.number().int().min(0),
      relationship_max: z.number().int().min(0),
      baseline: z.number().int().min(0),
    }).strict(),
    token_discipline: z.object({
      npcs_active_cap: z.number().int().min(0),
      sim_nearby_token_cap: z.number().int().min(0),
      mods_micro_slice_cap_per_namespace: z.number().int().min(0),
      mods_micro_slice_cap_global: z.number().int().min(0),
      episodic_cap: z.number().int().min(0),
      episodic_note_max_chars: z.number().int().min(0),
    }).strict(),
    time: z.object({
      require_time_advance_each_nonfirst_turn: z.boolean(),
      allow_time_advance_on_first_turn: z.boolean(),
    }).strict(),
    menus: z.object({
      min_choices: z.number().int().min(1),
      max_choices: z.number().int().min(1),
      label_max_chars: z.number().int().min(1),
    }).strict(),
    mechanics_visibility: z.object({
      no_mechanics_in_txt: z.boolean(),
    }).strict(),
    safety: z.object({
      consent_required_for_impactful_actions: z.boolean(),
      offer_player_reaction_when_npc_initiates: z.boolean(),
    }).strict(),
  }).strict(),
  acts_catalog: z.array(ActCatalogItemSchema).min(1),
  defaults: z.object({
    txt_sentences_min: z.number().int().min(1),
    txt_sentences_max: z.number().int().min(1),
    time_ticks_min_step: z.number().int().min(1),
    time_band_cycle: z.array(z.string().min(1)).min(1),
    cooldowns: z.object({
      dialogue_candidate_cooldown_turns: z.number().int().min(0),
    }).strict(),
  }).strict(),
}).strict();

// Database Record Schema
export const CoreContractRecordSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  doc: CoreContractSchema,
  hash: z.string().min(1),
  active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// Type exports
export type CoreContract = z.infer<typeof CoreContractSchema>;
export type CoreContractRecord = z.infer<typeof CoreContractRecordSchema>;

// Validation function
export function validateCoreContract(doc: unknown): asserts doc is CoreContract {
  CoreContractSchema.parse(doc);
}

// Validation function for records
export function validateCoreContractRecord(record: unknown): asserts record is CoreContractRecord {
  CoreContractRecordSchema.parse(record);
}
