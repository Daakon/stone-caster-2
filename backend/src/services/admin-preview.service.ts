/**
 * Admin Preview Service
 * Thin wrapper around v3 assembler with preview-specific overrides and diagnostics
 */

import { EntryPointAssemblerV3, EntryPointAssemblerError } from '../prompts/entry-point-assembler-v3.js';
import { config } from '../config/index.js';
import { createHash } from 'crypto';

export interface PreviewOverrides {
  rulesetSlug?: string;
  budget?: number;
  warnPct?: number;
  npcLimit?: number;
  includeNpcs?: boolean;
  entryStartSlug?: string;
}

export interface PreviewDiagnostics {
  tokenEstDetail: Array<{ id: string; tokens: number }>;
  npcBefore: number;
  npcAfter: number;
  budgetOverrides: {
    budget?: number;
    warnPct?: number;
    npcLimit?: number;
    includeNpcs?: boolean;
  };
  prompt_hash: string;
  byScope?: Record<string, number>;
}

export interface PreviewResult {
  prompt: string;
  pieces: Array<{ scope: string; slug: string; version?: string; tokens: number }>;
  meta: {
    included: string[];
    dropped: string[];
    policy?: string[];
    tokenEst: { input: number; budget: number; pct: number };
    selectionContext?: any;
    npcTrimmedCount?: number;
  };
  diagnostics: PreviewDiagnostics;
}

export class AdminPreviewService {
  /**
   * Preview entry point prompt assembly (no AI call)
   */
  async previewEntryPoint(
    entryPointId: string,
    overrides: PreviewOverrides = {}
  ): Promise<PreviewResult> {
    const assembler = new EntryPointAssemblerV3();

    // Apply overrides or use defaults
    const budget = overrides.budget ?? config.prompt.tokenBudgetDefault;
    const warnPct = overrides.warnPct ?? config.prompt.budgetWarnPct;
    const includeNpcs = overrides.includeNpcs !== false; // Default true

    try {
      // Assemble prompt with overrides
      const assembleResult = await assembler.assemble({
        entryPointId,
        entryStartSlug: overrides.entryStartSlug,
        model: config.prompt.modelDefault,
        budgetTokens: budget,
      });

      // Start with original pieces
      let finalPieces = [...assembleResult.pieces];
      let npcTrimmedByLimit = 0;
      
      // Apply npcLimit override if specified (hard cap before budget policy)
      if (overrides.npcLimit !== undefined && overrides.npcLimit >= 0) {
        const npcPieces = finalPieces.filter(p => p.scope === 'npc');
        const nonNPCPieces = finalPieces.filter(p => p.scope !== 'npc');
        
        if (npcPieces.length > overrides.npcLimit) {
          // Sort NPCs by slug for deterministic trimming (preserve order from assembler)
          const sortedNPCs = [...npcPieces].sort((a, b) => {
            return a.slug.localeCompare(b.slug);
          });
          
          const trimmedNPCs = sortedNPCs.slice(0, overrides.npcLimit);
          npcTrimmedByLimit = npcPieces.length - trimmedNPCs.length;
          finalPieces = [...nonNPCPieces, ...trimmedNPCs];
        }
      }

      // Apply includeNpcs override
      if (overrides.includeNpcs === false) {
        finalPieces = finalPieces.filter(p => p.scope !== 'npc');
      }

      // Calculate diagnostics
      const originalNPCs = assembleResult.pieces.filter(p => p.scope === 'npc');
      const npcBefore = originalNPCs.length;
      const npcAfter = finalPieces.filter(p => p.scope === 'npc').length;
      
      // Recalculate token estimates with final pieces
      const finalTokenEst = finalPieces.reduce((sum, p) => sum + (p.tokens || 0), 0);

      // Token estimate detail (using final pieces)
      const tokenEstDetail = finalPieces.map(p => ({
        id: `${p.scope}:${p.slug}@${p.version || '1.0.0'}`,
        tokens: p.tokens || 0,
      }));

      // Token distribution by scope (using final pieces)
      const byScope: Record<string, number> = {};
      for (const piece of finalPieces) {
        const scope = piece.scope;
        byScope[scope] = (byScope[scope] || 0) + (piece.tokens || 0);
      }

      // Reassemble prompt text with final pieces (if pieces changed)
      // For now, return original prompt since reassembly is complex
      // In production, you might want to regenerate prompt text here
      let finalPrompt = assembleResult.prompt;

      // Compute prompt hash
      const promptHash = createHash('sha256')
        .update(finalPrompt)
        .digest('hex');

      // Update dropped list if NPCs were trimmed
      const dropped = [...(assembleResult.meta.dropped || [])];
      if (npcTrimmedByLimit > 0 || overrides.includeNpcs === false) {
        const droppedNPCs = originalNPCs
          .filter(p => !finalPieces.some(fp => fp.scope === 'npc' && fp.slug === p.slug))
          .map(p => `${p.scope}:${p.slug}@${p.version || '1.0.0'}`);
        dropped.push(...droppedNPCs);
      }

      return {
        prompt: finalPrompt,
        pieces: finalPieces.map(p => ({
          scope: p.scope,
          slug: p.slug,
          version: p.version,
          tokens: p.tokens || 0,
        })),
        meta: {
          included: finalPieces.map(p => `${p.scope}:${p.slug}@${p.version || '1.0.0'}`),
          dropped,
          policy: assembleResult.meta.policy,
          tokenEst: {
            input: finalTokenEst,
            budget,
            pct: budget > 0 ? finalTokenEst / budget : 0,
          },
          selectionContext: assembleResult.meta.selectionContext,
          npcTrimmedCount: (assembleResult.meta.npcTrimmedCount || 0) + npcTrimmedByLimit,
        },
        diagnostics: {
          tokenEstDetail,
          npcBefore,
          npcAfter,
          budgetOverrides: {
            budget: overrides.budget,
            warnPct: overrides.warnPct,
            npcLimit: overrides.npcLimit,
            includeNpcs,
          },
          prompt_hash: promptHash,
          byScope,
        },
      };
    } catch (error) {
      if (error instanceof EntryPointAssemblerError) {
        throw error;
      }
      throw new Error(`Failed to preview entry point: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

