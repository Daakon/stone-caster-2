/**
 * AWF Validators Index
 * Exports all validation schemas and utilities
 */

// Core Contract V2 (framework only)
export { CoreContractV2Schema, type CoreContractV2 } from './awf-core-contract.schema.js';

// Core Ruleset V1 (narrative/pacing/style)
export { CoreRulesetV1Schema, type CoreRulesetV1 } from './awf-ruleset.schema.js';

// NPC V1 (reusable character pool)
export { NPCDocV1Schema } from './awf-npc.schema.js';
export { type NPCDocV1 } from '../types/awf-npc.js';

// World schemas
export { WorldDocFlexSchema, type WorldDocFlex } from './awf-world.schema.js';

// Bundle validators
export { 
  AwfBundleSchema, 
  AwfBundleDocSchema,
  type AwfBundle,
  type AwfBundleDoc 
} from './awf-bundle-validators.js';

// Output validators
export { 
  AwfOutputSchema,
  type AwfOutput 
} from './awf-output-validator.js';

// Legacy validators (for compatibility)
export {
  CoreContractDocSchema,
  WorldDocSchema,
  InjectionMapDocSchema,
  CoreContractRecordSchema,
  WorldRecordSchema
} from './awf-validators.js';
