// Prompt Assembler Types
// Defines the contract for the deterministic prompt assembly system

export type Scope =
  | 'core' 
  | 'ruleset' 
  | 'world'
  | 'entry' 
  | 'entry_start'
  | 'npc'  
  | 'game_state' 
  | 'player' 
  | 'rng' 
  | 'input';

export type SegmentRow = {
  id: number;
  scope: Scope;
  ref_id: string | null;
  version: string;
  active: boolean;
  content: string;
  metadata: Record<string, any>;
};

export type AssembleArgs = {
  entryPointId: string;
  worldId: string;
  // rulesetId removed - now fetched from entry_point_rulesets
  // turn context
  gameId?: string;
  isFirstTurn?: boolean;               // drives entry_start
  // dynamic layers
  gameStateText?: string;              // produced elsewhere (summaries ok for now)
  playerText?: string;                 // char sheet / player bio summary
  rngText?: string;                    // seed/policy if used
  inputText?: string;                  // the user input (raw or summarized)
  // NPCs
  npcs?: Array<{
    npcId: string;
    tier: number;                      // computed by caller from relationships
  }>;
  // budgets
  tokenBudget?: number;                // hard cap, e.g., 8000
  npcTokenBudget?: number;             // per-assembly cap for NPC section
  // i18n
  locale?: string;                     // future selection of localized segments
};

// Phase 1: Audit scope details
export type AuditScopeDetail = {
  scope: Scope;
  segmentCount: number;
  tokensBeforeTruncation: number;
  tokensAfterTruncation: number;
  dropped: boolean;
};

// Structured assembly audit
export type AssemblyAudit = {
  assembledAt: string;
  context: {
    isFirstTurn: boolean;
    worldSlug?: string;
    entryPointId?: string;
  };
  scopes: AuditScopeDetail[];
  policyNotes: string[];
  summary: string; // Human-readable summary
};

export type AssembleResult = {
  prompt: string;
  meta: {
    order: Scope[];
    segmentIdsByScope: Record<Scope, Array<number>>;
    tokensEstimated: number;
    truncated?: {
      droppedScopes?: Scope[];           // e.g., ['npc']
      npcDroppedTiers?: Array<{ npcId: string; fromTier: number; toTier: number }>;
      inputTrimmed?: { fromChars: number; toChars: number };
      gameStateCompressed?: boolean;
    };
    audit?: AssemblyAudit;  // Structured audit trail
  };
};

// Database adapter interface for testability
export interface DbAdapter {
  getSegments(scope: Scope, refId?: string): Promise<SegmentRow[]>;
  getRulesetsForEntry(entryId: string): Promise<Array<{id: string, name: string, sort_order: number}>>;
}

// NPC tier drop information
export type NpcTierDrop = {
  npcId: string;
  fromTier: number;
  toTier: number;
};

// Truncation metadata
export type TruncationMeta = {
  droppedScopes?: Scope[];
  npcDroppedTiers?: NpcTierDrop[];
  inputTrimmed?: { fromChars: number; toChars: number };
  gameStateCompressed?: boolean;
  policyWarnings?: string[];           // Policy warnings for undecided truncation behavior
};

// NPC block result
export type NpcBlockResult = {
  body: string;
  segmentIds: number[];
  dropped?: NpcTierDrop[];
};

// Token budget configuration
export type BudgetConfig = {
  tokenBudget: number;
  npcTokenBudget: number;
  inputTrimChars: number;
  gameStateCompressChars: number;
};

// Assembly context for internal use
export type AssemblyContext = {
  args: AssembleArgs;
  dbAdapter: DbAdapter;
  segments: Record<Scope, SegmentRow[]>;
  parts: string[];
  segmentIds: Record<Scope, number[]>;
  meta: AssembleResult['meta'];
};
