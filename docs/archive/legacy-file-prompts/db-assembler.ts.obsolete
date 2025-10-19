import { type PromptSegment, PromptRepository } from '../repositories/prompt.repository.js';
import { replaceTemplateVariables, validateTemplateVariables, ALLOWLISTED_VARIABLES } from './variables.js';
import type { PromptAssemblyResult, PromptAuditEntry, PromptContext } from './schemas.js';

interface ContextValidationResult {
  valid: boolean;
  missing: string[];
}

/**
 * Database-backed prompt assembler that replaces filesystem-based loading.
 * Fetches prompt segments from Supabase, resolves template variables, and
 * returns a fully assembled prompt with audit metadata.
 */
export class DatabasePromptAssembler {
  constructor(private readonly promptRepository: PromptRepository) {}

  /**
   * Assemble a complete prompt using database segments.
   */
  async assemblePrompt(context: PromptContext): Promise<PromptAssemblyResult> {
    console.log(
      `[DB_ASSEMBLER] Assembling prompt for world: ${context.world.name}, adventure: ${context.adventure?.name ?? 'None'}`
    );

    const validation = this.validateContext(context);
    if (!validation.valid) {
      throw new Error(`Invalid context: missing ${validation.missing.join(', ')}`);
    }

    try {
      const segments = await this.getPromptSegments(context);
      if (segments.length === 0) {
        throw new Error(`No prompt segments found for world: ${context.world.name}`);
      }

      const variableContext = this.buildContextObject(context);
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

      const prompt = this.createFinalPrompt(assembledSegments, context);
      const audit = await this.buildAuditEntry(segmentIds, segments, context, prompt);

      console.log(
        `[DB_ASSEMBLER] Assembled prompt with ${assembledSegments.length} segments, ${this.estimateTokenCount(prompt)} tokens`
      );

      return {
        prompt,
        audit,
        metadata: {
          totalSegments: assembledSegments.length,
          totalVariables: this.countVariables(variableContext),
          loadOrder: segmentIds,
          warnings: warnings.length > 0 ? warnings : undefined,
        },
      };
    } catch (error) {
      console.error('[DB_ASSEMBLER] Error assembling prompt:', error);
      throw error;
    }
  }

  /**
   * Validate that all required context properties exist.
   */
  validateContext(context: PromptContext): ContextValidationResult {
    const requiredPaths = [
      'game.id',
      'game.turn_index',
      'world.name',
      'system.schema_version',
      'system.prompt_version',
    ];

    const missing: string[] = [];

    for (const path of requiredPaths) {
      if (this.getContextValue(context, path) === undefined) {
        missing.push(path);
      }
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  private async getPromptSegments(context: PromptContext): Promise<PromptSegment[]> {
    const worldSlug = (context.world.name ?? '').toLowerCase() || null;
    const adventureSlug =
      ((context.adventure as Record<string, unknown> | undefined)?.slug as string | undefined) ??
      (context.adventure?.name?.toLowerCase() ?? null);

    const sceneId =
      context.game.current_scene ??
      (context.game.state_snapshot as Record<string, unknown> | undefined)?.currentScene ??
      (context.game.state_snapshot as Record<string, unknown> | undefined)?.current_scene ??
      null;

    return this.promptRepository.getCachedPromptSegments({
      world_slug: worldSlug ?? undefined,
      adventure_slug: adventureSlug ?? undefined,
      include_start: context.game.turn_index === 0,
      scene_id: sceneId ?? undefined,
      include_enhancements: true,
    });
  }

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
    processed = await this.processFileInclusions(processed);
    return processed;
  }

  private async processFileInclusions(segment: string): Promise<string> {
    const filePattern = /<<<FILE\s+([^>]+)\s*>>>/g;
    let result = segment;
    let match: RegExpExecArray | null;

    while ((match = filePattern.exec(segment)) !== null) {
      const relativePath = match[1].trim();
      const fullPath = `${process.cwd()}/AI API Prompts/${relativePath}`;

      try {
        const { readFileSync } = await import('fs');
        const content = readFileSync(fullPath, 'utf-8');
        result = result.replace(match[0], content);
        console.log(`[DB_ASSEMBLER] Included file: ${relativePath} (${content.length} chars)`);
      } catch (error) {
        console.warn(`[DB_ASSEMBLER] Could not include file ${relativePath}:`, error);
      }
    }

    return result;
  }

  private buildContextObject(context: PromptContext): Record<string, unknown> {
    const snapshot = (context.game.state_snapshot ?? {}) as Record<string, unknown>;
    const character = context.character ?? {};
    const adventure = context.adventure ?? {};
    const runtime = context.runtime ?? {};

    return {
      // Character fields
      'character.name': character.name,
      'character.role': (character as Record<string, unknown>).role,
      'character.race': (character as Record<string, unknown>).race,
      'character.class': (character as Record<string, unknown>).class,
      'character.level': (character as Record<string, unknown>).level,
      'character.essence': (character as Record<string, unknown>).essence,
      'character.age': (character as Record<string, unknown>).age,
      'character.build': (character as Record<string, unknown>).build,
      'character.eyes': (character as Record<string, unknown>).eyes,
      'character.traits': (character as Record<string, unknown>).traits,
      'character.backstory': (character as Record<string, unknown>).backstory,
      'character.motivation': (character as Record<string, unknown>).motivation,
      'character.skills': (character as Record<string, unknown>).skills,
      'character.stats': (character as Record<string, unknown>).stats,
      'character.inventory': (character as Record<string, unknown>).inventory,
      'character.relationships': (character as Record<string, unknown>).relationships,
      'character.goals': (character as Record<string, unknown>).goals,
      'character.flags': (character as Record<string, unknown>).flags,
      'character.reputation': (character as Record<string, unknown>).reputation,

      // Game fields
      'game.id': context.game.id,
      'game.turn_index': context.game.turn_index,
      'game.summary': context.game.summary,
      'game.current_scene': context.game.current_scene,
      'game.state_snapshot': context.game.state_snapshot,
      'game.option_id': context.game.option_id,

      // World fields
      'world.name': context.world.name,
      'world.setting': context.world.setting,
      'world.genre': context.world.genre,
      'world.themes': context.world.themes,
      'world.rules': context.world.rules,
      'world.mechanics': context.world.mechanics,
      'world.lore': context.world.lore,
      'world.logic': context.world.logic,

      // Adventure fields
      'adventure.name': adventure.name,
      'adventure.scenes': (adventure as Record<string, unknown>).scenes,
      'adventure.objectives': (adventure as Record<string, unknown>).objectives,
      'adventure.npcs': (adventure as Record<string, unknown>).npcs,
      'adventure.places': (adventure as Record<string, unknown>).places,
      'adventure.triggers': (adventure as Record<string, unknown>).triggers,

      // Runtime fields
      'runtime.ticks': runtime.ticks,
      'runtime.presence': runtime.presence,
      'runtime.ledgers': runtime.ledgers,
      'runtime.flags': runtime.flags,
      'runtime.last_acts': runtime.last_acts,
      'runtime.style_hint': runtime.style_hint,

      // System fields
      'system.schema_version': context.system.schema_version,
      'system.prompt_version': context.system.prompt_version,
      'system.load_order': context.system.load_order,
      'system.hash': context.system.hash,

      // Legacy helpers used by certain markdown templates
      world_name: context.world.name,
      adventure_name: adventure.name ?? 'None',
      game_state_json: JSON.stringify({
        time: runtime.ticks,
        turn: context.game.turn_index,
        scene: context.game.current_scene,
        state: snapshot,
      }),
      player_state_json: JSON.stringify({
        name: character.name,
        skills: (character as Record<string, unknown>).skills,
        inventory: (character as Record<string, unknown>).inventory,
        relationships: (character as Record<string, unknown>).relationships,
        goals: (character as Record<string, unknown>).goals,
        flags: (character as Record<string, unknown>).flags,
        reputation: (character as Record<string, unknown>).reputation,
      }),
      rng_json: JSON.stringify({
        d20: Math.floor(Math.random() * 20) + 1,
        d100: Math.floor(Math.random() * 100) + 1,
        seed: Date.now(),
      }),
      player_input_text: snapshot.playerInput ?? snapshot.player_input ?? 'Begin the adventure.',
    };
  }

  private createFinalPrompt(segments: string[], context: PromptContext): string {
    const header = this.createPromptHeader(context);
    const templateInfo = this.createTemplateInfoHeader();
    const body = segments.join('\n\n');
    const footer = this.createPromptFooter();

    const rawPrompt = `${header}\n\n${templateInfo}\n\n${body}\n\n${footer}`.trim();
    return rawPrompt
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .trim();
  }

  private createTemplateInfoHeader(): string {
    return '---';
  }

  private createPromptHeader(context: PromptContext): string {
    const characterInfo =
      context.character && context.character.name
        ? `${context.character.name}${context.character.race ? ` (${context.character.race})` : ''}`
        : 'Guest Player';

    return [
      '# RPG Storyteller AI System',
      '',
      '## Context',
      `- **World**: ${context.world.name}`,
      `- **Player**: ${characterInfo}`,
      `- **Adventure**: ${context.adventure?.name ?? 'None'}`,
      `- **Scene**: ${context.game.current_scene ?? 'Unknown'}`,
      `- **Turn**: ${context.game.turn_index + 1}`,
      '',
      '## Instructions',
      'You are an AI Game Master. Follow the rules and guidelines below to generate appropriate responses.',
    ].join('\n');
  }

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
      '```',
      '',
      'Keep responses immersive and consistent with the world tone.',
    ].join('\n');
  }

  private async buildAuditEntry(
    segmentIds: string[],
    segments: PromptSegment[],
    context: PromptContext,
    prompt: string
  ): Promise<PromptAuditEntry> {
    return {
      templateIds: segmentIds,
      version: this.getPromptVersion(segments),
      hash: await this.createSegmentHash(segments),
      contextSummary: {
        world: context.world.name,
        adventure: context.adventure?.name ?? 'None',
        character: context.character?.name ?? 'Guest',
        turnIndex: context.game.turn_index,
      },
      tokenCount: this.estimateTokenCount(prompt),
      assembledAt: new Date().toISOString(),
    };
  }

  private getPromptVersion(segments: PromptSegment[]): string {
    const versions = segments.map((segment) => segment.version).filter(Boolean);
    return versions.length > 0 ? versions[0]! : '1.0.0';
  }

  private async createSegmentHash(segments: PromptSegment[]): Promise<string> {
    const { createHash } = await import('crypto');
    const ids = segments.map((segment) => segment.id).sort();
    return createHash('sha256').update(ids.join('|')).digest('hex').substring(0, 16);
  }

  private estimateTokenCount(text: string): number {
    // Rough approximation: 1 token ~ 4 characters.
    return Math.ceil(text.length / 4);
  }

  private countVariables(contextMap: Record<string, unknown>): number {
    return Array.from(ALLOWLISTED_VARIABLES.values()).filter(
      (key) => contextMap[key] !== undefined && contextMap[key] !== null
    ).length;
  }

  private getContextValue(context: PromptContext, path: string): unknown {
    return path.split('.').reduce<unknown>((value, part) => {
      if (value && typeof value === 'object' && part in value) {
        return (value as Record<string, unknown>)[part];
      }
      return undefined;
    }, context);
  }
}

