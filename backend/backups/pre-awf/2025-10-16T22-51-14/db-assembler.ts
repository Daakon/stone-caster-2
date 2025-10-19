import { PromptRepository, type PromptSegment } from '../repositories/prompt.repository.js';
import { replaceTemplateVariables, validateTemplateVariables, ALLOWLISTED_VARIABLES } from './variables.js';
import type { 
  PromptContext, 
  PromptAssemblyResult, 
  PromptAuditEntry
} from './schemas.js';

/**
 * Database-backed prompt assembler that replaces filesystem-based loading
 */
export class DatabasePromptAssembler {
  private promptRepository: PromptRepository;

  constructor(promptRepository: PromptRepository) {
    this.promptRepository = promptRepository;
  }

  /**
   * Assemble a complete prompt for the given context using database segments
   */
  async assemblePrompt(context: PromptContext): Promise<PromptAssemblyResult> {
    console.log(`[DB_ASSEMBLER] Assembling prompt for world: ${context.world.name}, adventure: ${context.adventure?.name || 'None'}`);

    try {
      // Get prompt segments from database
      const segments = await this.getPromptSegments(context);
      
      if (segments.length === 0) {
        throw new Error(`No prompt segments found for world: ${context.world.name}`);
      }

      // Build context object for variable replacement
      const contextObject = this.buildContextObject(context);
      
      // Assemble segments in load order
      const assembledSegments: string[] = [];
      const segmentIds: string[] = [];
      const warnings: string[] = [];
      
      for (const segment of segments) {
        try {
          const processedSegment = await this.processSegment(segment, contextObject);
          assembledSegments.push(processedSegment);
          segmentIds.push(segment.id);
        } catch (error) {
          const warning = `Failed to process segment ${segment.id}: ${error}`;
          warnings.push(warning);
          console.warn(warning);
        }
      }

      // Create the final prompt
      const prompt = this.createFinalPrompt(assembledSegments, context);
      
      // Create audit entry
      const audit: PromptAuditEntry = {
        templateIds: segmentIds,
        version: this.getPromptVersion(segments),
        hash: await this.createSegmentHash(segments),
        contextSummary: {
          world: context.world.name,
          adventure: context.adventure?.name || 'None',
          character: context.character?.name || 'Guest',
          turnIndex: context.game.turn_index,
        },
        tokenCount: this.estimateTokenCount(prompt),
        assembledAt: new Date().toISOString(),
      };

      console.log(`[DB_ASSEMBLER] Assembled prompt with ${assembledSegments.length} segments, ${this.estimateTokenCount(prompt)} tokens`);

      return {
        prompt,
        audit,
        metadata: {
          totalSegments: assembledSegments.length,
          totalVariables: this.countVariables(contextObject),
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
   * Get prompt segments from database based on context
   */
  private async getPromptSegments(context: PromptContext): Promise<PromptSegment[]> {
    const params = {
      world_slug: context.world.name.toLowerCase(),
      adventure_slug: context.adventure?.name?.toLowerCase(),
      include_start: context.game.turn_index === 0,
      scene_id: context.game.current_scene,
      include_enhancements: true,
    };

    return this.promptRepository.getCachedPromptSegments(params);
  }

  /**
   * Process a single segment with context
   */
  private async processSegment(
    segment: PromptSegment, 
    context: Record<string, any>
  ): Promise<string> {
    // Validate variables in segment content
    const validation = validateTemplateVariables(segment.content);
    if (!validation.valid) {
      console.warn(`Segment ${segment.id} contains invalid variables:`, validation.invalidVariables);
    }
    
    // Replace variables with context values
    let processedSegment = replaceTemplateVariables(segment.content, context);
    
    // Process file inclusions (legacy support)
    processedSegment = await this.processFileInclusions(processedSegment, context);
    
    return processedSegment;
  }

  /**
   * Process file inclusions in segments (replace <<<FILE ... >>> with actual content)
   * This maintains backward compatibility with existing prompt files
   */
  private async processFileInclusions(segment: string, context: Record<string, any>): Promise<string> {
    // Match <<<FILE path >>> patterns
    const filePattern = /<<<FILE\s+([^>]+)\s*>>>/g;
    
    let processedSegment = segment;
    let match;
    
    while ((match = filePattern.exec(segment)) !== null) {
      const filePath = match[1].trim();
      const fullPath = `AI API Prompts/${filePath}`;
      
      try {
        // Read the file content
        const { readFileSync } = await import('fs');
        const content = readFileSync(fullPath, 'utf-8');
        
        // Replace the placeholder with the actual content
        processedSegment = processedSegment.replace(match[0], content);
        
        console.log(`[DB_ASSEMBLER] Included file: ${filePath} (${content.length} chars)`);
      } catch (error) {
        console.warn(`[DB_ASSEMBLER] Could not include file ${filePath}:`, error);
        // Keep the original placeholder if file can't be loaded
      }
    }
    
    return processedSegment;
  }

  /**
   * Build context object from PromptContext
   */
  private buildContextObject(context: PromptContext): Record<string, any> {
    return {
      // Character variables - Basic identity
      'character.name': context.character?.name,
      'character.role': context.character?.role,
      'character.race': context.character?.race,
      'character.class': context.character?.class, // Legacy field
      'character.level': context.character?.level, // Legacy field - not used in skill-based system
      
      // PlayerV3 specific fields
      'character.essence': context.character?.essence,
      'character.age': context.character?.age,
      'character.build': context.character?.build,
      'character.eyes': context.character?.eyes,
      'character.traits': context.character?.traits,
      'character.backstory': context.character?.backstory,
      'character.motivation': context.character?.motivation,
      
      // Skills and abilities
      'character.skills': context.character?.skills,
      'character.stats': context.character?.stats, // Legacy field
      'character.inventory': context.character?.inventory,
      'character.relationships': context.character?.relationships,
      'character.goals': context.character?.goals,
      'character.flags': context.character?.flags,
      'character.reputation': context.character?.reputation,
      
      // Game variables
      'game.id': context.game.id,
      'game.turn_index': context.game.turn_index,
      'game.summary': context.game.summary,
      'game.current_scene': context.game.current_scene,
      'game.state_snapshot': context.game.state_snapshot,
      'game.option_id': context.game.option_id,
      
      // World variables
      'world.name': context.world.name,
      'world.setting': context.world.setting,
      'world.genre': context.world.genre,
      'world.themes': context.world.themes,
      'world.rules': context.world.rules,
      'world.mechanics': context.world.mechanics,
      'world.lore': context.world.lore,
      'world.logic': context.world.logic,
      
      // Adventure variables
      'adventure.name': context.adventure?.name,
      
      // Template variables for baseline.md
      'world_name': context.world.name,
      'adventure_name': context.adventure?.name || 'None',
      'game_state_json': JSON.stringify({
        time: context.runtime?.ticks,
        turn: context.game.turn_index,
        scene: context.game.current_scene,
        state: context.game.state_snapshot
      }),
      'player_state_json': JSON.stringify({
        name: context.character?.name,
        skills: context.character?.skills,
        inventory: context.character?.inventory,
        relationships: context.character?.relationships,
        goals: context.character?.goals,
        flags: context.character?.flags,
        reputation: context.character?.reputation
      }),
      'rng_json': JSON.stringify({
        d20: Math.floor(Math.random() * 20) + 1,
        d100: Math.floor(Math.random() * 100) + 1,
        seed: Date.now()
      }),
      'player_input_text': 'Test input for prompt assembly',
      'adventure.scenes': context.adventure?.scenes,
      'adventure.objectives': context.adventure?.objectives,
      'adventure.npcs': context.adventure?.npcs,
      'adventure.places': context.adventure?.places,
      'adventure.triggers': context.adventure?.triggers,
      
      // Runtime variables
      'runtime.ticks': context.runtime?.ticks,
      'runtime.presence': context.runtime?.presence,
      'runtime.ledgers': context.runtime?.ledgers,
      'runtime.flags': context.runtime?.flags,
      'runtime.last_acts': context.runtime?.last_acts,
      'runtime.style_hint': context.runtime?.style_hint,
      
      // System variables
      'system.schema_version': context.system.schema_version,
      'system.prompt_version': context.system.prompt_version,
      'system.load_order': context.system.load_order,
      'system.hash': context.system.hash,
    };
  }

  /**
   * Create the final prompt from assembled segments
   */
  private createFinalPrompt(segments: string[], context: PromptContext): string {
    const header = this.createPromptHeader(context);
    const templateInfo = this.createTemplateInfoHeader(segments);
    const body = segments.join('\n\n');
    const footer = this.createPromptFooter(context);
    
    // Minimize newlines and clean up the final prompt
    const fullPrompt = `${header}\n\n${templateInfo}\n\n${body}\n\n${footer}`.trim();
    
    // Remove excessive newlines and escape characters
    return fullPrompt
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Replace 3+ newlines with 2
      .replace(/\\n/g, '\n') // Convert literal \n to actual newlines
      .replace(/\\r/g, '\r') // Convert literal \r to actual carriage returns
      .trim();
  }

  /**
   * Create template information header showing which files are loaded
   */
  private createTemplateInfoHeader(segments: string[]): string {
    return `---`;
  }

  /**
   * Create prompt header with context summary
   */
  private createPromptHeader(context: PromptContext): string {
    const characterInfo = context.character 
      ? `${context.character.name} (${context.character.race})`
      : 'Guest Player';
    
    return `# RPG Storyteller AI System

## Context
- **World**: ${context.world.name}
- **Player**: ${characterInfo}
- **Adventure**: ${context.adventure?.name || 'None'}
- **Scene**: ${context.game.current_scene || 'Unknown'}
- **Turn**: ${context.game.turn_index + 1}

## Instructions
You are an AI Game Master. Follow the rules and guidelines below to generate appropriate responses.`;
  }

  /**
   * Create prompt footer with output requirements
   */
  private createPromptFooter(context: PromptContext): string {
    return `## Output Requirements

Return a single JSON object in AWF v1 format:

\`\`\`json
{
  "scn": {"id": "scene_id", "ph": "scene_phase"},
  "txt": "Narrative text describing what happens",
  "choices": [{"id": "choice_id", "label": "Choice text"}],
  "acts": [{"eid": "action_id", "t": "ACTION_TYPE", "payload": {}}],
  "val": {"ok": true, "errors": [], "repairs": []}
}
\`\`\`

Keep responses immersive and consistent with the world's tone.`;
  }

  /**
   * Get prompt version from segments
   */
  private getPromptVersion(segments: PromptSegment[]): string {
    const versions = segments.map(s => s.version).filter(v => v);
    return versions.length > 0 ? versions[0] : '1.0.0';
  }

  /**
   * Create hash from segments
   */
  private async createSegmentHash(segments: PromptSegment[]): Promise<string> {
    const { createHash } = await import('crypto');
    const hashes = segments.map(s => s.id).sort();
    return createHash('sha256').update(hashes.join('|')).digest('hex').substring(0, 16);
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokenCount(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Count variables in context object
   */
  private countVariables(context: Record<string, any>): number {
    return Object.keys(context).filter(key => 
      ALLOWLISTED_VARIABLES.has(key) && context[key] !== undefined
    ).length;
  }

  /**
   * Validate context against required variables
   */
  validateContext(context: PromptContext): { valid: boolean; missing: string[] } {
    const required = [
      'game.id',
      'game.turn_index',
      'world.name',
      'system.schema_version',
    ];
    
    const missing: string[] = [];
    
    for (const req of required) {
      if (!this.getContextValue(context, req)) {
        missing.push(req);
      }
    }
    
    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Get value from context using dot notation
   */
  private getContextValue(context: PromptContext, path: string): any {
    const parts = path.split('.');
    let current: any = context;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }
    
    return current;
  }
}
