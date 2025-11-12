/**
 * Preview Overrides Types
 * Temporary overrides for preview (non-persisting)
 */

export interface PreviewOverrides {
  moduleParamsOverrides?: Record<string /* moduleId */, Record<string, unknown>>;
  extrasOverrides?: {
    world?: Record<string, unknown>;
    ruleset?: Record<string, unknown>;
    scenario?: Record<string, unknown>;
    npcs?: Record<string /* npcId */, Record<string, unknown>>;
  };
}

export interface PreviewResponse {
  source: 'preview-overrides' | 'preview';
  tp: any; // TurnPacketV3
  linearized: string;
  warnings?: string[];
  tokens?: {
    before: number;
    after?: number;
    trimPlan?: Array<{ key: string; removedTokens: number }>;
  };
}

