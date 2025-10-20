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

// Scenario V1 (game startpoints)
export { ScenarioDocV1Schema } from './awf-scenario.schema.js';
export { type ScenarioDocV1 } from '../types/awf-scenario.js';

// World schemas (flexible)
export { WorldDocV1Schema, TimeworldSchema } from './awf-world.schema.js';
export { WorldDocFlexSchema, type WorldDocFlex } from './awf-world.schema.js';

// Adventure schemas (flexible)
export { AdventureDocV1Schema } from './awf-adventure.schema.js';

// Injection Map schemas
export { 
  InjectionRuleV1Schema, 
  InjectionMapDocV1Schema,
  DryRunRequestSchema,
  BundleDiffRequestSchema
} from './awf-injection-map.schema.js';
export { 
  type InjectionRuleV1,
  type InjectionMapDocV1,
  type InjectionMapRecord,
  type DryRunRequest,
  type DryRunResponse,
  type BundleDiffRequest,
  type BundleDiffResponse
} from '../types/awf-injection-map.js';

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
