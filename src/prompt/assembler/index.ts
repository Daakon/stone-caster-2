// Prompt Assembler Main Export
// Provides the main assembly function and supporting types

export { assemblePrompt, validateAssembleArgs, createAssemblySummary } from './assembler';
export { MockDbAdapter, SupabaseDbAdapter, createMockDbAdapter } from './db';
export { buildNpcBlock } from './npc';
export { buildStateBlocks, createMockState } from './state';
export { estimateTokens, createBudgetConfig } from './budget';
export { block } from './markdown';
export type { 
  AssembleArgs, 
  AssembleResult, 
  Scope, 
  SegmentRow, 
  DbAdapter,
  TruncationMeta,
  NpcTierDrop,
  BudgetConfig
} from './types';
