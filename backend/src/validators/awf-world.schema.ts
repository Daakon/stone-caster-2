/**
 * Flexible World Schema Validators
 * Open, extensible validation for world documents
 */

import { z } from 'zod';

// Band schema with passthrough
const BandSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  ticks: z.number().int().positive().optional()
}).passthrough();

// Slice schema with passthrough
const SliceSchema = z.object({
  id: z.string(),
  kind: z.string(),
  text: z.string(),
  tags: z.array(z.string()).optional()
}).passthrough();

// Flexible World Document schema
export const WorldDocFlexSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),

  timeworld: z.object({
    timezone: z.string().optional(),
    calendar: z.string().optional(),
    seasons: z.array(z.string()).optional(),
    bands: z.array(BandSchema).optional(),
    weather_states: z.array(z.string()).optional(),
    weather_transition_bias: z.record(z.number()).optional()
  }).passthrough().optional(),

  magic: z.object({
    domains: z.array(z.string()).optional(),
    rules: z.array(z.string()).optional()
  }).passthrough().optional(),

  essence_behavior: z.record(z.unknown()).optional(),
  species_rules: z.record(z.unknown()).optional(),

  identity_language: z.object({
    linguistic_subs: z.record(z.string()).optional()
  }).passthrough().optional(),

  lexicon: z.object({
    substitutions: z.record(z.string()).optional(),
    avoid: z.array(z.string()).optional()
  }).passthrough().optional(),

  factions_world: z.array(z.unknown()).optional(),
  trade_and_geography: z.record(z.unknown()).optional(),

  lore_index: z.object({
    entries: z.array(z.unknown()).optional()
  }).passthrough().optional(),

  tone: z.object({
    style: z.array(z.string()).optional(),
    taboos: z.array(z.string()).optional()
  }).passthrough().optional(),

  locations: z.array(z.object({
    id: z.string(),
    name: z.string()
  }).passthrough()).optional(),

  bands: z.array(BandSchema).optional(),
  weather_states: z.array(z.string()).optional(),
  weather_transition_bias: z.record(z.number()).optional(),

  slices: z.array(SliceSchema).optional()
}).passthrough();

export type WorldDocFlex = z.infer<typeof WorldDocFlexSchema>;

// Validation function
export function validateWorld(doc: unknown): asserts doc is WorldDocFlex {
  WorldDocFlexSchema.parse(doc);
}