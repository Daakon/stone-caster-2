import { type PromptSegment, PromptRepository } from '../repositories/prompt.repository.js';
import { replaceTemplateVariables, validateTemplateVariables, ALLOWLISTED_VARIABLES } from './variables.js';
import type { PromptAssemblyResult, PromptAuditEntry, PromptContext } from './schemas.js';

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
  };
  audit: PromptAuditEntry;
}

/**
 * Database-only prompt assembly parameters
 */
export interface DatabasePromptParams {
  worldSlug: string;
  adventureSlug: string;
  startingSceneId: string;
  includeEnhancements?: boolean;
}

/**
 * Database-only prompt assembler that replaces all filesystem-based loading.
 * This is the single entry point for all prompt assembly in the system.
 */
export class DatabasePromptAssembler {
  constructor(private readonly promptRepository: PromptRepository) {}

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
      const segments = await this.getPromptSegments(params);
      
      if (segments.length === 0) {
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

      // Build context object for variable replacement
      const variableContext = this.buildContextObject(params);
      
      // Process segments
      const assembledSegments: string[] = [];
      const segmentIds: string[] = [];
      const warnings: string[] = [];

      for (const segment of segments) {
        try {
          const processed = await this.processSegment(segment, variableContext);
          assembledSegments.push(processed);
          segmentIds.push(segment.id);
        } catch (error) {
          const warning = `Failed to process segment ${segment.id}: ${error instanceof Error ? error.message : String(error)}`;
          warnings.push(warning);
          console.warn(`[DB_ASSEMBLER] ${warning}`);
        }
      }

      // Create final prompt
      const promptText = this.createFinalPrompt(assembledSegments, params);
      const audit = await this.buildAuditEntry(segmentIds, segments, params, promptText);

      console.log(
        `[DB_ASSEMBLER] Assembled prompt with ${assembledSegments.length} segments, ${this.estimateTokenCount(promptText)} tokens`
      );

      return {
        promptText,
        metadata: {
          totalSegments: assembledSegments.length,
          totalVariables: this.countVariables(variableContext),
          loadOrder: segmentIds,
          warnings: warnings.length > 0 ? warnings : undefined,
        },
        audit,
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
}
