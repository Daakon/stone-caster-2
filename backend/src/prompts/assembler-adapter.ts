/**
 * AssemblerAdapter - Compatibility layer for legacy validateContext and assemble methods
 * Maps old API surface to new V2 assembler
 */

import { DatabasePromptAssembler } from './database-prompt-assembler.js';
import type { PromptContext, PromptAssemblyResult } from './schemas.js';
import type { AssembleInput } from './assembler-types.js';

export interface ValidationResult {
  ok: boolean;
  issues?: string[];
}

export interface AssembleInputForStart {
  worldId: string;
  entryStartSlug: string;
  rulesetSlug?: string;
  scenarioSlug?: string | null;
  model?: string;
  budgetTokens?: number;
}

export interface AssembleInputForTurn {
  worldId: string;
  rulesetSlug?: string;
  scenarioSlug?: string | null;
  entryStartSlug?: string;
  npcHints?: string[];
  model?: string;
  budgetTokens?: number;
}

/**
 * Adapter that provides legacy API surface for prompt assembly
 * Internally uses DatabasePromptAssembler.assemblePromptV2
 */
export class AssemblerAdapter {
  constructor(private readonly assembler: DatabasePromptAssembler) {}

  /**
   * Validate context for prompt assembly
   * Performs minimal field checks on AssembleInput
   */
  validateContext(input: AssembleInput | PromptContext | { worldId?: string; entryStartSlug?: string }): ValidationResult {
    const issues: string[] = [];

    // Handle different input types
    if ('worldId' in input) {
      // AssembleInput format
      if (!input.worldId || typeof input.worldId !== 'string') {
        issues.push('worldId is required (must be UUID string)');
      }
      if ('entryStartSlug' in input && (!input.entryStartSlug || typeof input.entryStartSlug !== 'string')) {
        issues.push('entryStartSlug is required for start phase');
      }
    } else if ('world' in input && 'game' in input) {
      // PromptContext format (legacy)
      if (!input.world?.name) {
        issues.push('world.name is required');
      }
      if (!input.game?.id) {
        issues.push('game.id is required');
      }
    } else {
      issues.push('Invalid input format: expected AssembleInput or PromptContext');
    }

    return {
      ok: issues.length === 0,
      issues: issues.length > 0 ? issues : undefined,
    };
  }

  /**
   * Assemble prompt for game start (initial prompt)
   */
  async assembleForStart(params: AssembleInputForStart): Promise<{
    prompt: string;
    pieces: Array<{ scope: string; slug: string; version?: string; tokens: number }>;
    meta: {
      included: string[];
      dropped: string[];
      policy?: string[];
      model: string;
      worldId: string;
      rulesetSlug: string;
      scenarioSlug?: string | null;
      entryStartSlug: string;
      tokenEst: { input: number; budget: number; pct: number };
    };
  }> {
    // Validate required fields
    const validation = this.validateContext({
      worldId: params.worldId,
      entryStartSlug: params.entryStartSlug,
    });

    if (!validation.ok) {
      throw new Error(`Invalid assembleForStart input: ${validation.issues?.join(', ')}`);
    }

    // Call V2 assembler
    return this.assembler.assemblePromptV2({
      worldId: params.worldId,
      rulesetSlug: params.rulesetSlug,
      scenarioSlug: params.scenarioSlug,
      entryStartSlug: params.entryStartSlug,
      model: params.model,
      budgetTokens: params.budgetTokens,
    });
  }

  /**
   * Assemble prompt for a turn (after game start)
   */
  async assembleForTurn(params: AssembleInputForTurn): Promise<{
    prompt: string;
    pieces: Array<{ scope: string; slug: string; version?: string; tokens: number }>;
    meta: {
      included: string[];
      dropped: string[];
      policy?: string[];
      model: string;
      worldId: string;
      rulesetSlug: string;
      scenarioSlug?: string | null;
      entryStartSlug?: string;
      tokenEst: { input: number; budget: number; pct: number };
    };
  }> {
    // Validate required fields
    const validation = this.validateContext({
      worldId: params.worldId,
      // entryStartSlug is optional for turns
    });

    if (!validation.ok) {
      throw new Error(`Invalid assembleForTurn input: ${validation.issues?.join(', ')}`);
    }

    // Call V2 assembler (entryStartSlug optional for turns)
    return this.assembler.assemblePromptV2({
      worldId: params.worldId,
      rulesetSlug: params.rulesetSlug,
      scenarioSlug: params.scenarioSlug,
      entryStartSlug: params.entryStartSlug || '',
      npcHints: params.npcHints,
      model: params.model,
      budgetTokens: params.budgetTokens,
    });
  }
}

