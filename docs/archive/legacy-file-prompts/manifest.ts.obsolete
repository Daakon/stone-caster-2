import { createHash } from 'crypto';
import { PromptLoader } from './loader.js';
import type { PromptTemplateMeta, WorldPromptConfig } from './schemas.js';

/**
 * Prompt manifest that catalogs all available prompt templates
 */
export class PromptManifest {
  private templates: Map<string, PromptTemplateMeta> = new Map();
  private worldConfigs: Map<string, WorldPromptConfig> = new Map();
  private loader: PromptLoader;

  constructor(promptsPath?: string) {
    this.loader = new PromptLoader(promptsPath);
  }

  /**
   * Initialize the manifest by loading all prompt files
   */
  async initialize(worldSlug?: string): Promise<void> {
    console.log(`[PROMPT_MANIFEST] Initializing manifest for world: ${worldSlug || 'all'}`);
    const templates = await this.loader.loadPromptManifest(worldSlug);
    
    console.log(`[PROMPT_MANIFEST] Loaded ${templates.length} templates`);
    for (const template of templates) {
      console.log(`[PROMPT_MANIFEST] Adding template: ${template.id} (order: ${template.loadOrder})`);
      this.templates.set(template.id, template);
    }
    
    // Build world configurations
    this.buildWorldConfigs();
    console.log(`[PROMPT_MANIFEST] Manifest initialized with ${this.templates.size} templates`);
  }

  /**
   * Get all templates for a specific world
   */
  getWorldTemplates(worldId: string): PromptTemplateMeta[] {
    const worldConfig = this.worldConfigs.get(worldId);
    if (!worldConfig) {
      return [];
    }
    
    return worldConfig.loadOrder
      .map(templateId => this.templates.get(templateId))
      .filter((template): template is PromptTemplateMeta => template !== undefined);
  }

  /**
   * Get all templates in the manifest
   */
  getAllTemplates(): PromptTemplateMeta[] {
    return Array.from(this.templates.values())
      .sort((a, b) => a.loadOrder - b.loadOrder);
  }

  /**
   * Get templates by scope
   */
  getTemplatesByScope(scope: PromptTemplateMeta['scope']): PromptTemplateMeta[] {
    return Array.from(this.templates.values())
      .filter(template => template.scope === scope)
      .sort((a, b) => a.loadOrder - b.loadOrder);
  }

  /**
   * Get a specific template by ID
   */
  getTemplate(id: string): PromptTemplateMeta | undefined {
    return this.templates.get(id);
  }

  /**
   * Get world configuration
   */
  getWorldConfig(worldId: string): WorldPromptConfig | undefined {
    return this.worldConfigs.get(worldId);
  }

  /**
   * Get all available worlds
   */
  getAvailableWorlds(): string[] {
    return Array.from(this.worldConfigs.keys());
  }

  /**
   * Validate that all required templates are present
   */
  validateWorldTemplates(worldId: string): { valid: boolean; missing: string[] } {
    const worldConfig = this.worldConfigs.get(worldId);
    if (!worldConfig) {
      return { valid: false, missing: ['world-config'] };
    }
    
    const missing: string[] = [];
    
    for (const requiredId of worldConfig.requiredSegments) {
      if (!this.templates.has(requiredId)) {
        missing.push(requiredId);
      }
    }
    
    return {
      valid: missing.length === 0,
      missing
    };
  }

  /**
   * Validate that all loaded templates are present
   */
  validateAllTemplates(): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    
    // Check for basic required templates
    const requiredTemplates = [
      'systems.unified',
      'engine.system',
      'awf.scheme',
      'agency.presence-and-guardrails'
    ];
    
    for (const requiredId of requiredTemplates) {
      if (!this.templates.has(requiredId)) {
        missing.push(requiredId);
      }
    }
    
    return {
      valid: missing.length === 0,
      missing
    };
  }

  /**
   * Get template hash for a specific world configuration
   */
  getWorldTemplateHash(worldId: string): string {
    const templates = this.getWorldTemplates(worldId);
    const hashes = templates.map(t => t.hash).sort();
    return this.createHash(hashes.join('|'));
  }

  /**
   * Build world configurations from available templates
   */
  private buildWorldConfigs(): void {
    const worldTemplates = this.getTemplatesByScope('world');
    const worlds = new Set<string>();
    
    // Extract world names from world-specific templates
    for (const template of worldTemplates) {
      if (template.worldSpecific) {
        // Extract world name from template ID (format: worldname-template)
        const parts = template.id.split('-');
        if (parts.length > 1) {
          worlds.add(parts[0]);
        }
      }
    }
    
    // Build configuration for each world
    for (const worldId of worlds) {
      const worldTemplates = this.getWorldTemplates(worldId);
      const config: WorldPromptConfig = {
        worldId,
        worldName: this.capitalize(worldId),
        loadOrder: worldTemplates.map(t => t.id),
        requiredSegments: worldTemplates.filter(t => t.required).map(t => t.id),
        optionalSegments: worldTemplates.filter(t => !t.required).map(t => t.id),
        worldSpecificSegments: worldTemplates.filter(t => t.worldSpecific).map(t => t.id),
        enhancementSegments: worldTemplates.filter(t => t.scope === 'enhancement').map(t => t.id),
      };
      
      this.worldConfigs.set(worldId, config);
    }
    
    // Add default world config for core-only templates
    const coreTemplates = this.getTemplatesByScope('core');
    if (coreTemplates.length > 0) {
      const defaultConfig: WorldPromptConfig = {
        worldId: 'default',
        worldName: 'Default',
        loadOrder: coreTemplates.map(t => t.id),
        requiredSegments: coreTemplates.filter(t => t.required).map(t => t.id),
        optionalSegments: coreTemplates.filter(t => !t.required).map(t => t.id),
        worldSpecificSegments: [],
        enhancementSegments: [],
      };
      
      this.worldConfigs.set('default', defaultConfig);
    }
  }

  /**
   * Create a hash from a string
   */
  private createHash(input: string): string {
    return createHash('sha256').update(input).digest('hex').substring(0, 16);
  }

  /**
   * Capitalize first letter
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Get manifest statistics
   */
  getStats(): {
    totalTemplates: number;
    worlds: number;
    scopes: Record<string, number>;
    averageSegments: number;
  } {
    const templates = Array.from(this.templates.values());
    const scopes: Record<string, number> = {};
    
    for (const template of templates) {
      scopes[template.scope] = (scopes[template.scope] || 0) + 1;
    }
    
    const totalSegments = templates.reduce((sum, t) => sum + t.segments.length, 0);
    
    return {
      totalTemplates: templates.length,
      worlds: this.worldConfigs.size,
      scopes,
      averageSegments: templates.length > 0 ? totalSegments / templates.length : 0,
    };
  }
}

// Singleton instance
let manifestInstance: PromptManifest | null = null;

/**
 * Get the global prompt manifest instance
 */
export async function getPromptManifest(promptsPath?: string, worldSlug?: string): Promise<PromptManifest> {
  if (!manifestInstance) {
    manifestInstance = new PromptManifest(promptsPath);
    await manifestInstance.initialize(worldSlug);
  }
  return manifestInstance;
}
