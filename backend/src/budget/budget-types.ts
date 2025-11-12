/**
 * Budget Types
 * Type definitions for the token budgeting engine
 */

export interface LinearSection {
  key: string;
  label: string;
  text: string;
  slot?: {
    name: string;
    must_keep: boolean;
    min_chars?: number;
    priority?: number;
  };
}

export interface BudgetInput {
  linearSections: LinearSection[];
  maxTokens: number;
}

export interface TrimResult {
  key: string;
  removedChars: number;
  removedTokens: number;
}

export interface BudgetOutput {
  sections: LinearSection[];
  totalTokensBefore: number;
  totalTokensAfter: number;
  trims: TrimResult[];
  warnings: string[];
}

export type Category = 'CORE' | 'RULESET' | 'MODULES' | 'WORLD' | 'SCENARIO' | 'NPCS' | 'STATE' | 'INPUT';

export const CATEGORY_PRECEDENCE: Record<Category, number> = {
  CORE: 0,
  RULESET: 1,
  MODULES: 2,
  WORLD: 3,
  SCENARIO: 4,
  NPCS: 5,
  STATE: 6,
  INPUT: 7,
};

