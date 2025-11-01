import { type PromptSegment, PromptRepository } from '../repositories/prompt.repository.js';
import { replaceTemplateVariables, validateTemplateVariables, ALLOWLISTED_VARIABLES } from './variables.js';
import type { PromptAssemblyResult, PromptAuditEntry, PromptContext } from './schemas.js';
import type { Scope, AssemblePiece, PolicyAction } from './assembler-types.js';
import {
  SCOPE_PRIORITY,
  PROTECTED_SCOPES,
  POLICY_ACTIONS,
} from './assembler-types.js';
import {
  roughTokenCount,
  mapLayerToScope,
  getEnvNumber,
  getEnvPercentage,
  formatPieceId,
} from './assembler-utils.js';

// Environment configuration with fallbacks
const PROMPT_TOKEN_BUDGET_DEFAULT = getEnvNumber('PROMPT_TOKEN_BUDGET_DEFAULT', 8_000);
const PROMPT_BUDGET_WARN_PCT = getEnvPercentage('PROMPT_BUDGET_WARN_PCT', 0.9);

/**
 * Standardized error types for DB-only prompt assembly
 */
export class DatabasePromptError extends Error {
  constructor(
    public readonly code: 'DB_PROMPTS_UNAVAILABLE' | 'DB_PROMPTS_EMPTY',
    message: string,
    public readonly context?: {
      worldSlug?: string;
      adventureSlug?: string;
      startingSceneId?: string;
    }
  ) {
    super(message);
    this.name = 'DatabasePromptError';
  }
}

/**
 * Database-only prompt assembly result
 */
export interface DatabasePromptResult {
  promptText: string;
  metadata: {
    totalSegments: number;
    totalVariables: number;
    loadOrder: string[];
    warnings?: string[];
    // Phase 2 additions
    included?: string[]; // Format: "scope:slug@version"
    dropped?: string[]; // Same format
    policy?: string[]; // Policy actions taken
    tokenEst?: {
      input: number;
      budget: number;
      pct: number;
    };
  };
  audit: PromptAuditEntry;
  // Phase 2: Pieces for metadata
  pieces?: AssemblePiece[];
}

/**
 * Database-only prompt assembly parameters
 */
export interface DatabasePromptParams {
  worldSlug: string;
  adventureSlug: string;
  startingSceneId: string;
  includeEnhancements?: boolean;
  // Phase 2 additions
  scenarioSlug?: string | null;
  rulesetSlug?: string;
  npcHints?: string[];
  model?: string;
  budgetTokens?: number;
}

/**
 * Database-only prompt assembler that replaces all filesystem-based loading.
 * This is the single entry point for all prompt assembly in the system.
 */
export class DatabasePromptAssembler {
  constructor(private readonly promptRepository: PromptRepository) {}

  /**
   * Phase 3: Assemble prompt using Phase 2 input format (worldId UUID, entryStartSlug, etc.)
   * Adapts Phase 2 AssembleInput to internal DatabasePromptParams format
   */
  async assemblePromptV2(input: {
    worldId: string; // UUID
    rulesetSlug?: string;
    scenarioSlug?: string | null;
    entryStartSlug: string;
    npcHints?: string[];
    model?: string;
    budgetTokens?: number;
    entryPointSlug?: string; // Entry point slug (for adventure_slug in RPC)
  }): Promise<{
    prompt: string;
    pieces: AssemblePiece[];
    meta: {
      included: string[];
      dropped: string[];
      policy?: string[];
      model: string;
      worldId: string;
      rulesetSlug: string;
      scenarioSlug?: string | null;
      entryStartSlug: string;
      tokenEst: {
        input: number;
        budget: number;
        pct: number;
      };
    };
  }> {
    // Resolve worldId UUID to worldSlug for assembler
    const { supabaseAdmin } = await import('../services/supabase.js');
    const { data: worldMapping } = await supabaseAdmin
      .from('world_id_mapping')
      .select('text_id')
      .eq('uuid_id', input.worldId)
      .single();

    if (!worldMapping) {
      throw new DatabasePromptError(
        'DB_PROMPTS_UNAVAILABLE',
        `World UUID '${input.worldId}' not found in world_id_mapping`,
        {}
      );
    }

    const worldSlug = worldMapping.text_id;

    // Call the existing assemblePrompt with adapted params
    const result = await this.assemblePrompt({
      worldSlug,
      adventureSlug: input.entryPointSlug || input.entryStartSlug, // Fallback to entry_start_slug if no entryPointSlug
      startingSceneId: input.entryStartSlug,
      rulesetSlug: input.rulesetSlug,
      scenarioSlug: input.scenarioSlug,
      npcHints: input.npcHints,
      model: input.model,
      budgetTokens: input.budgetTokens,
    });

    // Transform result to Phase 2 AssembleOutput format
    return {
      prompt: result.promptText,
      pieces: result.pieces || [],
      meta: {
        included: result.metadata.included || [],
        dropped: result.metadata.dropped || [],
        policy: result.metadata.policy,
        model: input.model || process.env.PROMPT_MODEL_DEFAULT || 'gpt-4o-mini',
        worldId: input.worldId,
        rulesetSlug: input.rulesetSlug || 'default',
        scenarioSlug: input.scenarioSlug,
        entryStartSlug: input.entryStartSlug,
        tokenEst: result.metadata.tokenEst || {
          input: 0,
          budget: input.budgetTokens || PROMPT_TOKEN_BUDGET_DEFAULT,
          pct: 0,
        },
      },
    };
  }

  /**
   * Assemble a complete prompt using database segments only.
   * This is the single public entry point for prompt assembly.
   */
  async assemblePrompt(params: DatabasePromptParams): Promise<DatabasePromptResult> {
    console.log(
      `[DB_ASSEMBLER] Assembling prompt for world: ${params.worldSlug}, adventure: ${params.adventureSlug}, scene: ${params.startingSceneId}`
    );

    try {
      // Fetch segments from database
      const allSegments = await this.getPromptSegments(params);
      
      if (allSegments.length === 0) {
        throw new DatabasePromptError(
          'DB_PROMPTS_EMPTY',
          `No prompt segments found for world: ${params.worldSlug}, adventure: ${params.adventureSlug}, scene: ${params.startingSceneId}. Run npm run ingest:prompts for these slugs and retry.`,
          {
            worldSlug: params.worldSlug,
            adventureSlug: params.adventureSlug,
            startingSceneId: params.startingSceneId,
          }
        );
      }

      // Phase 2: Order segments by strict scope priority
      const orderedSegments = this.orderSegmentsByScope(allSegments, params);
      
      // Build context object for variable replacement
      const variableContext = this.buildContextObject(params);
      
      // Phase 2: Process segments with token estimation
      const processedPieces: AssemblePiece[] = [];
      const assembledSegments: string[] = [];
      const segmentIds: string[] = [];
      const warnings: string[] = [];

      for (const { segment, scope } of orderedSegments) {
        try {
          const processed = await this.processSegment(segment, variableContext);
          const tokens = roughTokenCount(processed);
          const slug = segment.metadata?.slug || segment.metadata?.ref_id || segment.layer || segment.id;
          
          processedPieces.push({
            scope,
            slug,
            version: segment.version,
            tokens,
          });
          
          assembledSegments.push(processed);
          segmentIds.push(segment.id);
        } catch (error) {
          const warning = `Failed to process segment ${segment.id}: ${error instanceof Error ? error.message : String(error)}`;
          warnings.push(warning);
          console.warn(`[DB_ASSEMBLER] ${warning}`);
        }
      }

      // Phase 2: Apply budget policy
      const budget = params.budgetTokens || PROMPT_TOKEN_BUDGET_DEFAULT;
      const { finalPieces, dropped, policy, finalSegments, finalSegmentIds } = 
        await this.applyBudgetPolicy(processedPieces, assembledSegments, segmentIds, budget);
      
      // Create final prompt from final segments
      const promptText = this.createFinalPrompt(finalSegments, params);
      const audit = await this.buildAuditEntry(finalSegmentIds, allSegments.filter(s => finalSegmentIds.includes(s.id)), params, promptText);

      const inputTokens = roughTokenCount(promptText);
      const tokenPct = inputTokens / budget;

      // Phase 2: Enhanced metadata
      const metadata = {
        totalSegments: finalPieces.length,
        totalVariables: this.countVariables(variableContext),
        loadOrder: finalSegmentIds,
        warnings: warnings.length > 0 ? warnings : undefined,
        included: finalPieces.map(p => formatPieceId(p.scope, p.slug, p.version)),
        dropped: dropped.map(p => formatPieceId(p.scope, p.slug, p.version)),
        policy: policy.length > 0 ? policy : undefined,
        tokenEst: {
          input: inputTokens,
          budget,
          pct: tokenPct,
        },
      };

      console.log(
        `[DB_ASSEMBLER] Assembled prompt with ${finalPieces.length} segments (${dropped.length} dropped), ${inputTokens} tokens (${Math.round(tokenPct * 100)}% of budget)`
      );

      // Phase 2: Structured logging
      console.log('[DB_ASSEMBLER] Assembly metadata:', {
        worldId: params.worldSlug,
        rulesetSlug: params.rulesetSlug || 'default',
        scenarioSlug: params.scenarioSlug,
        entryStartSlug: params.adventureSlug,
        includedCount: finalPieces.length,
        droppedCount: dropped.length,
        tokenPct: Math.round(tokenPct * 100) / 100,
        policy: policy || [],
      });

      return {
        promptText,
        metadata,
        audit,
        pieces: finalPieces,
      };
    } catch (error) {
      if (error instanceof DatabasePromptError) {
        throw error;
      }
      
      console.error('[DB_ASSEMBLER] Error assembling prompt:', error);
      throw new DatabasePromptError(
        'DB_PROMPTS_UNAVAILABLE',
        `DB prompts unavailable. Run migration and then npm run ingest:prompts. Retry.`,
        {
          worldSlug: params.worldSlug,
          adventureSlug: params.adventureSlug,
          startingSceneId: params.startingSceneId,
        }
      );
    }
  }

  /**
   * Get prompt segments from database
   */
  private async getPromptSegments(params: DatabasePromptParams): Promise<PromptSegment[]> {
    try {
      return await this.promptRepository.getCachedPromptSegments({
        world_slug: params.worldSlug,
        adventure_slug: params.adventureSlug,
        include_start: true, // Always include start for new games
        scene_id: params.startingSceneId,
        include_enhancements: params.includeEnhancements ?? true,
      });
    } catch (error) {
      console.error('[DB_ASSEMBLER] Error fetching prompt segments:', error);
      throw new DatabasePromptError(
        'DB_PROMPTS_UNAVAILABLE',
        `DB prompts unavailable. Run migration and then npm run ingest:prompts. Retry.`,
        {
          worldSlug: params.worldSlug,
          adventureSlug: params.adventureSlug,
          startingSceneId: params.startingSceneId,
        }
      );
    }
  }

  /**
   * Process a single segment with variable replacement
   */
  private async processSegment(
    segment: PromptSegment,
    contextMap: Record<string, unknown>
  ): Promise<string> {
    const variableCheck = validateTemplateVariables(segment.content);
    if (!variableCheck.valid) {
      console.warn(
        `[DB_ASSEMBLER] Segment ${segment.id} contains invalid variables: ${variableCheck.invalidVariables.join(', ')}`
      );
    }

    let processed = replaceTemplateVariables(segment.content, contextMap);
    
    // Note: File inclusions are removed in DB-only mode
    // All content must come from database segments
    
    return processed;
  }

  /**
   * Build context object for variable replacement
   */
  private buildContextObject(params: DatabasePromptParams): Record<string, unknown> {
    return {
      // World fields
      'world.name': params.worldSlug,
      'world.slug': params.worldSlug,
      
      // Adventure fields
      'adventure.name': params.adventureSlug,
      'adventure.slug': params.adventureSlug,
      
      // Scene fields
      'scene.id': params.startingSceneId,
      'scene.name': params.startingSceneId,
      
      // System fields
      'system.schema_version': '1.0.0',
      'system.prompt_version': '1.0.0',
      
      // Legacy helpers for compatibility
      world_name: params.worldSlug,
      adventure_name: params.adventureSlug,
      scene_name: params.startingSceneId,
      
      // Phase 2 additions
      'ruleset.slug': params.rulesetSlug || 'default',
      'scenario.slug': params.scenarioSlug || '',
      'entry.slug': params.adventureSlug,
      
      // Game state (minimal for new games)
      game_state_json: JSON.stringify({
        time: 0,
        turn: 0,
        scene: params.startingSceneId,
        state: {},
      }),
      
      // Player state (minimal for new games)
      player_state_json: JSON.stringify({
        name: 'Guest Player',
        skills: {},
        inventory: {},
        relationships: {},
        goals: {},
        flags: {},
        reputation: {},
      }),
      
      // RNG for consistency
      rng_json: JSON.stringify({
        d20: Math.floor(Math.random() * 20) + 1,
        d100: Math.floor(Math.random() * 100) + 1,
        seed: Date.now(),
      }),
      
      // Default input
      player_input_text: 'Begin the adventure.',
    };
  }

  /**
   * Create the final prompt from assembled segments
   */
  private createFinalPrompt(segments: string[], params: DatabasePromptParams): string {
    const header = this.createPromptHeader(params);
    const body = segments.join('\n\n');
    const footer = this.createPromptFooter();

    const rawPrompt = `${header}\n\n${body}\n\n${footer}`.trim();
    return rawPrompt
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .trim();
  }

  /**
   * Create prompt header
   */
  private createPromptHeader(params: DatabasePromptParams): string {
    return [
      '# RPG Storyteller AI System',
      '',
      '## Context',
      `- **World**: ${params.worldSlug}`,
      `- **Player**: Guest Player`,
      `- **Adventure**: ${params.adventureSlug}`,
      `- **Scene**: ${params.startingSceneId}`,
      `- **Turn**: 1`,
      '',
      '## Instructions',
      'You are an AI Game Master. Follow the rules and guidelines below to generate appropriate responses.',
    ].join('\n');
  }

  /**
   * Create prompt footer
   */
  private createPromptFooter(): string {
    return [
      '## Output Requirements',
      '',
      'Return a single JSON object in AWF v1 format:',
      '',
      '```json',
      '{',
      '  "scn": {"id": "scene_id", "ph": "scene_phase"},',
      '  "txt": "Narrative text describing what happens",',
      '  "choices": [{"id": "choice_id", "label": "Choice text"}],',
      '  "acts": [{"eid": "action_id", "t": "ACTION_TYPE", "payload": {}}],',
      '  "val": {"ok": true, "errors": [], "repairs": []}',
      '}',
      '',
      'Keep responses immersive and consistent with the world tone.',
    ].join('\n');
  }

  /**
   * Build audit entry
   */
  private async buildAuditEntry(
    segmentIds: string[],
    segments: PromptSegment[],
    params: DatabasePromptParams,
    prompt: string
  ): Promise<PromptAuditEntry> {
    return {
      templateIds: segmentIds,
      version: this.getPromptVersion(segments),
      hash: await this.createSegmentHash(segments),
      contextSummary: {
        world: params.worldSlug,
        adventure: params.adventureSlug,
        character: 'Guest',
        turnIndex: 0,
      },
      tokenCount: this.estimateTokenCount(prompt),
      assembledAt: new Date().toISOString(),
    };
  }

  /**
   * Get prompt version from segments
   */
  private getPromptVersion(segments: PromptSegment[]): string {
    const versions = segments.map((segment) => segment.version).filter(Boolean);
    return versions.length > 0 ? versions[0]! : '1.0.0';
  }

  /**
   * Create segment hash
   */
  private async createSegmentHash(segments: PromptSegment[]): Promise<string> {
    const { createHash } = await import('crypto');
    const ids = segments.map((segment) => segment.id).sort();
    return createHash('sha256').update(ids.join('|')).digest('hex').substring(0, 16);
  }

  /**
   * Estimate token count
   */
  private estimateTokenCount(text: string): number {
    // Rough approximation: 1 token ~ 4 characters.
    return Math.ceil(text.length / 4);
  }

  /**
   * Count variables in context
   */
  private countVariables(contextMap: Record<string, unknown>): number {
    return Array.from(ALLOWLISTED_VARIABLES.values()).filter(
      (key) => contextMap[key] !== undefined && contextMap[key] !== null
    ).length;
  }

  /**
   * Phase 2: Order segments by strict scope priority
   * Order: core → ruleset → world → scenario? → entry → npc
   */
  private orderSegmentsByScope(
    segments: PromptSegment[],
    params: DatabasePromptParams
  ): Array<{ segment: PromptSegment; scope: Scope }> {
    // Map segments to scope using layer field
    const mapped = segments.map(segment => {
      let scope: Scope = 'core';
      
      // Check metadata for scope first
      if (segment.metadata?.scope && 
          ['core', 'ruleset', 'world', 'scenario', 'entry', 'npc'].includes(segment.metadata.scope)) {
        scope = segment.metadata.scope as Scope;
      } else {
        // Map layer to scope
        scope = mapLayerToScope(segment.layer || 'core');
      }
      
      return { segment, scope };
    });

    // Filter based on input requirements
    const filtered = mapped.filter(({ scope }) => {
      // Always include core, ruleset, world
      if (scope === 'core' || scope === 'ruleset' || scope === 'world') {
        return true;
      }
      
      // Include scenario only if scenarioSlug provided
      if (scope === 'scenario') {
        return params.scenarioSlug !== undefined && params.scenarioSlug !== null;
      }
      
      // Always include entry (required)
      if (scope === 'entry') {
        return true;
      }
      
      // Include npc if hints provided
      if (scope === 'npc') {
        return params.npcHints && params.npcHints.length > 0;
      }
      
      return false;
    });

    // Sort by scope priority, then sort_order within scope
    filtered.sort((a, b) => {
      const priorityA = SCOPE_PRIORITY[a.scope];
      const priorityB = SCOPE_PRIORITY[b.scope];
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      return (a.segment.sort_order || 0) - (b.segment.sort_order || 0);
    });

    // Deduplicate NPCs
    return this.deduplicateNpcs(filtered);
  }

  /**
   * Phase 2: Deduplicate NPC segments by slug
   */
  private deduplicateNpcs(
    ordered: Array<{ segment: PromptSegment; scope: Scope }>
  ): Array<{ segment: PromptSegment; scope: Scope }> {
    const seen = new Set<string>();
    const result: Array<{ segment: PromptSegment; scope: Scope }> = [];
    
    for (const item of ordered) {
      if (item.scope === 'npc') {
        const slug = item.segment.metadata?.slug || 
                    item.segment.metadata?.ref_id ||
                    item.segment.layer || 
                    'unknown';
        
        if (seen.has(slug)) {
          continue;
        }
        
        seen.add(slug);
      }
      
      result.push(item);
    }
    
    // Sort NPCs by slug for deterministic order
    const npcStartIndex = result.findIndex(item => item.scope === 'npc');
    if (npcStartIndex >= 0) {
      const nonNpcs = result.slice(0, npcStartIndex);
      const npcs = result.slice(npcStartIndex);
      npcs.sort((a, b) => {
        const slugA = a.segment.metadata?.slug || a.segment.metadata?.ref_id || a.segment.layer || '';
        const slugB = b.segment.metadata?.slug || b.segment.metadata?.ref_id || b.segment.layer || '';
        return slugA.localeCompare(slugB);
      });
      return [...nonNpcs, ...npcs];
    }
    
    return result;
  }

  /**
   * Phase 2: Apply budget policy with warn threshold and drop logic
   */
  private async applyBudgetPolicy(
    pieces: AssemblePiece[],
    segments: string[],
    segmentIds: string[],
    budget: number
  ): Promise<{
    finalPieces: AssemblePiece[];
    dropped: AssemblePiece[];
    policy: PolicyAction[];
    finalSegments: string[];
    finalSegmentIds: string[];
  }> {
    const policy: PolicyAction[] = [];
    
    // Combine pieces with segments and ids for synchronized removal
    const combined = pieces.map((piece, idx) => ({
      piece,
      segment: segments[idx] || '',
      segmentId: segmentIds[idx] || '',
      index: idx,
    }));
    
    let current = [...combined];
    let currentTokens = current.reduce((sum, item) => sum + item.piece.tokens, 0);
    
    // Check warn threshold
    const pct = currentTokens / budget;
    if (pct >= PROMPT_BUDGET_WARN_PCT) {
      policy.push(POLICY_ACTIONS.SCENARIO_POLICY_UNDECIDED);
    }
    
    // If over budget, drop in order: scenario first, then npcs
    if (currentTokens > budget) {
      // Drop scenario if present
      const scenarioIndex = current.findIndex(item => item.piece.scope === 'scenario');
      if (scenarioIndex >= 0) {
        const dropped = current.splice(scenarioIndex, 1)[0];
        policy.push(POLICY_ACTIONS.SCENARIO_DROPPED);
        currentTokens -= dropped.piece.tokens;
      }
      
      // If still over budget, drop NPCs (from end, lowest priority)
      while (currentTokens > budget && current.length > 0) {
        let lastNpcIndex = -1;
        for (let i = current.length - 1; i >= 0; i--) {
          if (current[i].piece.scope === 'npc' && !PROTECTED_SCOPES.has(current[i].piece.scope as Scope)) {
            lastNpcIndex = i;
            break;
          }
        }
        
        if (lastNpcIndex >= 0) {
          const dropped = current.splice(lastNpcIndex, 1)[0];
          policy.push(POLICY_ACTIONS.NPC_DROPPED);
          currentTokens -= dropped.piece.tokens;
        } else {
          // No more droppable segments, but still over budget
          // Core/ruleset/world are protected, so we log warning
          console.warn(
            `[DB_ASSEMBLER] Still over budget (${currentTokens}/${budget}) after dropping all scenario/npc, but core/ruleset/world are protected`
          );
          break;
        }
      }
    }
    
    // Split back into separate arrays
    const finalPieces = current.map(item => item.piece);
    const finalSegments = current.map(item => item.segment);
    const finalSegmentIds = current.map(item => item.segmentId);
    
    // Calculate dropped pieces
    const dropped: AssemblePiece[] = pieces.filter(p => 
      !finalPieces.some(cp => cp.slug === p.slug && cp.scope === p.scope)
    );
    
    return {
      finalPieces,
      dropped,
      policy,
      finalSegments,
      finalSegmentIds,
    };
  }
}
