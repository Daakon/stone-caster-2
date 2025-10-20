/**
 * AWF Injection Map Types
 * Versioned injection map registry for bundle assembly
 */

export interface InjectionRuleV1 {
  from: string;                         // data source key or pointer template
  to: string;                           // JSON Pointer target (absolute)
  skipIfEmpty?: boolean;
  fallback?: { ifMissing?: unknown };
  limit?: { units: "tokens"|"count"; max: number };
}

export interface InjectionMapDocV1 {
  rules: InjectionRuleV1[];
  notes?: string;
}

export interface InjectionMapRecord {
  id: string;
  version: string;
  label: string;
  doc: InjectionMapDocV1;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DryRunRequest {
  game_id?: string;
  game_snapshot?: any;
}

export interface DryRunResponse {
  bundlePreview: any;
  bytes: number;
  tokensEst: number;
}

export interface BundleDiffRequest {
  left: {
    mapRef?: string;
    rawMap?: InjectionMapDocV1;
    game_id?: string;
    game_snapshot?: any;
  };
  right: {
    mapRef?: string;
    rawMap?: InjectionMapDocV1;
    game_id?: string;
    game_snapshot?: any;
  };
}

export interface BundleDiffResponse {
  diff: any;
  leftBytes: number;
  rightBytes: number;
  leftTokens: number;
  rightTokens: number;
  deltaBytes: number;
  deltaTokens: number;
}
