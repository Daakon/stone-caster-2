import { z } from 'zod';

/**
 * Prompt template metadata schema
 */
export const PromptTemplateMetaSchema = z.object({
  id: z.string(),
  scope: z.enum(['core', 'world', 'adventure', 'scenario', 'quest', 'enhancement']),
  version: z.string(),
  hash: z.string(),
  variables: z.array(z.string()),
  segments: z.array(z.string()),
  loadOrder: z.number(),
  dependencies: z.array(z.string()).optional(),
  worldSpecific: z.boolean().optional(),
  required: z.boolean().optional(),
});

export type PromptTemplateMeta = z.infer<typeof PromptTemplateMetaSchema>;

/**
 * Assembled prompt context schema
 */
export const PromptContextSchema = z.object({
  character: z.object({
    name: z.string().optional(),
    level: z.number().optional(),
    race: z.string().optional(),
    class: z.string().optional(),
    skills: z.record(z.number()).optional(),
    stats: z.record(z.number()).optional(),
    inventory: z.array(z.string()).optional(),
    relationships: z.record(z.any()).optional(),
    flags: z.record(z.any()).optional(),
  }).optional(),
  
  game: z.object({
    id: z.string(),
    turn_index: z.number(),
    summary: z.string().optional(),
    current_scene: z.string().optional(),
    state_snapshot: z.any().optional(),
    option_id: z.string().optional(),
  }),
  
  world: z.object({
    name: z.string(),
    setting: z.string().optional(),
    genre: z.string().optional(),
    themes: z.array(z.string()).optional(),
    rules: z.any().optional(),
    mechanics: z.any().optional(),
    lore: z.string().optional(),
    logic: z.any().optional(),
  }),
  
  adventure: z.object({
    name: z.string().optional(),
    scenes: z.array(z.any()).optional(),
    objectives: z.array(z.string()).optional(),
    npcs: z.array(z.any()).optional(),
    places: z.array(z.any()).optional(),
    triggers: z.array(z.any()).optional(),
  }).optional(),
  
  runtime: z.object({
    ticks: z.number().optional(),
    presence: z.string().optional(),
    ledgers: z.record(z.any()).optional(),
    flags: z.record(z.any()).optional(),
    last_acts: z.array(z.any()).optional(),
    style_hint: z.string().optional(),
  }).optional(),
  
  system: z.object({
    schema_version: z.string(),
    prompt_version: z.string(),
    load_order: z.array(z.string()),
    hash: z.string(),
  }),
});

export type PromptContext = z.infer<typeof PromptContextSchema>;

/**
 * Prompt audit entry schema
 */
export const PromptAuditEntrySchema = z.object({
  templateIds: z.array(z.string()),
  version: z.string(),
  hash: z.string(),
  contextSummary: z.object({
    world: z.string(),
    adventure: z.string().optional(),
    character: z.string().optional(),
    turnIndex: z.number(),
  }),
  tokenCount: z.number().optional(),
  assembledAt: z.string(),
});

export type PromptAuditEntry = z.infer<typeof PromptAuditEntrySchema>;

/**
 * Prompt assembly result schema
 */
export const PromptAssemblyResultSchema = z.object({
  prompt: z.string(),
  audit: PromptAuditEntrySchema,
  metadata: z.object({
    totalSegments: z.number(),
    totalVariables: z.number(),
    loadOrder: z.array(z.string()),
    warnings: z.array(z.string()).optional(),
  }),
});

export type PromptAssemblyResult = z.infer<typeof PromptAssemblyResultSchema>;

/**
 * World-specific prompt configuration
 */
export const WorldPromptConfigSchema = z.object({
  worldId: z.string(),
  worldName: z.string(),
  loadOrder: z.array(z.string()),
  requiredSegments: z.array(z.string()),
  optionalSegments: z.array(z.string()),
  worldSpecificSegments: z.array(z.string()),
  enhancementSegments: z.array(z.string()).optional(),
});

export type WorldPromptConfig = z.infer<typeof WorldPromptConfigSchema>;
