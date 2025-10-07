import { getPromptManifest } from './manifest.js';
import { replaceTemplateVariables, validateTemplateVariables, ALLOWLISTED_VARIABLES } from './variables.js';
import type { 
  PromptContext, 
  PromptAssemblyResult, 
  PromptAuditEntry,
  PromptTemplateMeta 
} from './schemas.js';

/**
 * Service that assembles prompts from templates and runtime context
 */
export class PromptAssembler {
  private manifest: any;

  constructor() {
    this.manifest = null;
  }

  /**
   * Initialize the assembler with the prompt manifest
   */
  async initialize(worldSlug?: string): Promise<void> {
    this.manifest = await getPromptManifest(worldSlug);
  }

  /**
   * Assemble a complete prompt for the given context
   */
  async assemblePrompt(context: PromptContext): Promise<PromptAssemblyResult> {
    if (!this.manifest) {
      await this.initialize();
    }

    // Get all templates from the manifest (already filtered by world during initialization)
    const templates = this.manifest.getAllTemplates();
    
    if (templates.length === 0) {
      throw new Error(`No templates found for world: ${context.world.name}`);
    }

    // Validate templates
    const validation = this.manifest.validateAllTemplates();
    if (!validation.valid) {
      console.warn(`Missing required templates:`, validation.missing);
    }

    // Build context object for variable replacement
    const contextObject = this.buildContextObject(context);
    
    // Assemble segments in load order
    const assembledSegments: string[] = [];
    const templateIds: string[] = [];
    const warnings: string[] = [];
    
    for (const template of templates) {
      try {
        const processedSegments = await this.processTemplate(template, contextObject);
        assembledSegments.push(...processedSegments);
        templateIds.push(template.id);
      } catch (error) {
        const warning = `Failed to process template ${template.id}: ${error}`;
        warnings.push(warning);
        console.warn(warning);
      }
    }

    // Create the final prompt
    const prompt = this.createFinalPrompt(assembledSegments, context);
    
    // Log prompt assembly details
    console.log(`[PROMPT_ASSEMBLER] Assembled prompt with ${assembledSegments.length} segments`);
    console.log(`[PROMPT_ASSEMBLER] Final prompt length: ${prompt.length} characters`);
    console.log(`[PROMPT_ASSEMBLER] Templates used: ${templateIds.join(', ')}`);
    
    // Create audit entry
    const audit: PromptAuditEntry = {
      templateIds,
      version: this.getPromptVersion(templates),
      hash: this.manifest.getWorldTemplateHash(context.world.name),
      contextSummary: {
        world: context.world.name,
        adventure: context.adventure?.name || 'None',
        character: context.character?.name || 'Guest',
        turnIndex: context.game.turn_index,
      },
      tokenCount: this.estimateTokenCount(prompt),
      assembledAt: new Date().toISOString(),
    };

    return {
      prompt,
      audit,
      metadata: {
        totalSegments: assembledSegments.length,
        totalVariables: this.countVariables(contextObject),
        loadOrder: templateIds,
        warnings: warnings.length > 0 ? warnings : undefined,
      },
    };
  }

  /**
   * Process a single template with context
   */
  private async processTemplate(
    template: PromptTemplateMeta, 
    context: Record<string, any>
  ): Promise<string[]> {
    const processedSegments: string[] = [];
    
    for (const segment of template.segments) {
      // Validate variables in segment
      const validation = validateTemplateVariables(segment);
      if (!validation.valid) {
        console.warn(`Template ${template.id} contains invalid variables:`, validation.invalidVariables);
      }
      
      // Replace variables with context values
      const processedSegment = replaceTemplateVariables(segment, context);
      processedSegments.push(processedSegment);
    }
    
    return processedSegments;
  }

  /**
   * Build context object from PromptContext
   */
  private buildContextObject(context: PromptContext): Record<string, any> {
    return {
      // Character variables
      'character.name': context.character?.name,
      'character.level': context.character?.level,
      'character.race': context.character?.race,
      'character.class': context.character?.class,
      'character.skills': context.character?.skills,
      'character.stats': context.character?.stats,
      'character.inventory': context.character?.inventory,
      'character.relationships': context.character?.relationships,
      'character.flags': context.character?.flags,
      
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
    const body = segments.join('\n\n');
    const footer = this.createPromptFooter(context);
    
    // Minimize newlines and clean up the final prompt
    const fullPrompt = `${header}\n\n${body}\n\n${footer}`.trim();
    
    // Remove excessive newlines and escape characters
    return fullPrompt
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Replace 3+ newlines with 2
      .replace(/\\n/g, '\n') // Convert literal \n to actual newlines
      .replace(/\\r/g, '\r') // Convert literal \r to actual carriage returns
      .trim();
  }

  /**
   * Create prompt header with context summary
   */
  private createPromptHeader(context: PromptContext): string {
    const characterInfo = context.character 
      ? `${context.character.name} (Level ${context.character.level} ${context.character.race} ${context.character.class})`
      : 'Guest Player';
    
    return `# RPG Storyteller AI System

## Current Context
- **World**: ${context.world.name}
- **Player**: ${characterInfo}
- **Adventure**: ${context.adventure?.name || 'None'}
- **Scene**: ${context.game.current_scene || 'Unknown'}
- **Turn**: ${context.game.turn_index + 1}
- **Schema Version**: ${context.system.schema_version}

## Instructions
You are an AI Game Master operating within the RPG Storyteller system. Follow the rules and guidelines below to generate appropriate responses.`;
  }

  /**
   * Create prompt footer with output requirements
   */
  private createPromptFooter(context: PromptContext): string {
    return `## Output Requirements

Return a single JSON object in AWF v1 format with the following structure:

\`\`\`json
{
  "scn": {
    "id": "scene_id",
    "ph": "scene_phase"
  },
  "txt": "Narrative text describing what happens",
  "choices": [
    {
      "id": "choice_id",
      "label": "Choice text"
    }
  ],
  "acts": [
    {
      "eid": "action_id",
      "t": "ACTION_TYPE",
      "payload": {}
    }
  ],
  "val": {
    "ok": true,
    "errors": [],
    "repairs": []
  }
}
\`\`\`

Remember: Keep responses immersive, consistent with the world's tone, and appropriate for the character's level and situation.`;
  }

  /**
   * Get prompt version from templates
   */
  private getPromptVersion(templates: PromptTemplateMeta[]): string {
    const versions = templates.map(t => t.version).filter(v => v);
    return versions.length > 0 ? versions[0] : '1.0.0';
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
   * Get available worlds
   */
  async getAvailableWorlds(): Promise<string[]> {
    if (!this.manifest) {
      await this.initialize();
    }
    return this.manifest.getAvailableWorlds();
  }

  /**
   * Get world configuration
   */
  async getWorldConfig(worldId: string): Promise<any> {
    if (!this.manifest) {
      await this.initialize();
    }
    return this.manifest.getWorldConfig(worldId);
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
