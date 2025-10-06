import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve, basename, extname } from 'path';

/**
 * Template bundle structure for organizing prompt templates
 */
export type TemplateBundle = {
  core: { 
    system?: string; 
    safety?: string; 
    formatting?: string; 
    tools?: string; 
    saveInstructions?: string;
    [k: string]: string | undefined 
  };
  world: { 
    lore?: string; 
    logic?: string; 
    style?: string; 
    [k: string]: string | undefined 
  };
  adventures?: Record<string, string>; // keyed by adventure slug or filename
};

/**
 * Custom error for missing template bundles
 */
export class PromptTemplateMissingError extends Error {
  constructor(public world: string) {
    super(`No templates found for world: ${world}`);
    this.name = 'PromptTemplateMissingError';
  }
}

/**
 * Filesystem-based template loader
 */
class FSTemplateLoader {
  private readonly projectRoot: string;
  private readonly coreDir: string;
  private readonly worldsDir: string;

  constructor() {
    // Resolve project root (backend directory)
    this.projectRoot = resolve(process.cwd());
    this.coreDir = join(this.projectRoot, 'GPT Prompts', 'Core');
    this.worldsDir = join(this.projectRoot, 'GPT Prompts', 'Worlds');
    
    console.log(`[TEMPLATE_REGISTRY] Initialized with project root: ${this.projectRoot}`);
    console.log(`[TEMPLATE_REGISTRY] Core directory: ${this.coreDir}`);
    console.log(`[TEMPLATE_REGISTRY] Worlds directory: ${this.worldsDir}`);
  }

  /**
   * Load templates for a specific world
   */
  async loadTemplatesForWorld(worldSlug: string): Promise<TemplateBundle> {
    const normalizedSlug = this.normalizeWorldSlug(worldSlug);
    
    console.log(`[TEMPLATE_REGISTRY] Loading templates for world: ${normalizedSlug}`);
    
    try {
      // Load core templates
      const core = await this.loadCoreTemplates();
      console.log(`[TEMPLATE_REGISTRY] Loaded ${Object.keys(core).length} core templates`);
      
      // Load world-specific templates
      const world = await this.loadWorldTemplates(normalizedSlug);
      console.log(`[TEMPLATE_REGISTRY] Loaded ${Object.keys(world).length} world templates`);
      
      // Load adventure templates
      const adventures = await this.loadAdventureTemplates(normalizedSlug);
      console.log(`[TEMPLATE_REGISTRY] Loaded ${Object.keys(adventures).length} adventure templates`);
      
      const bundle: TemplateBundle = { core, world, adventures };
      
      // Validate that we have at least some world content
      if (Object.keys(world).length === 0 && Object.keys(adventures).length === 0) {
        console.warn(`[TEMPLATE_REGISTRY] PromptTemplatesMissing { world: ${normalizedSlug} }`);
        throw new PromptTemplateMissingError(normalizedSlug);
      }
      
      const totalFiles = Object.keys(core).length + Object.keys(world).length + Object.keys(adventures).length;
      console.log(`[TEMPLATE_REGISTRY] PromptTemplatesResolved { world: ${normalizedSlug}, source: 'fs', files: ${totalFiles} }`);
      
      return bundle;
    } catch (error) {
      if (error instanceof PromptTemplateMissingError) {
        throw error; // Re-throw our custom error
      }
      console.error(`[TEMPLATE_REGISTRY] Unexpected error loading templates for ${normalizedSlug}:`, error);
      throw new PromptTemplateMissingError(normalizedSlug);
    }
  }

  /**
   * Load core templates from the Core directory
   */
  private async loadCoreTemplates(): Promise<TemplateBundle['core']> {
    const core: TemplateBundle['core'] = {};
    
    if (!existsSync(this.coreDir)) {
      console.warn(`[TEMPLATE_REGISTRY] Core directory not found: ${this.coreDir}`);
      return core;
    }

    try {
      const files = readdirSync(this.coreDir, { withFileTypes: true });
      
      for (const file of files) {
        if (file.isFile() && this.isTemplateFile(file.name)) {
          const filePath = join(this.coreDir, file.name);
          const content = this.readFileSafely(filePath);
          
          if (content) {
            const key = this.mapCoreFileToKey(file.name);
            if (key) {
              core[key] = content;
            }
          }
        }
      }
    } catch (error) {
      console.warn(`[TEMPLATE_REGISTRY] Error loading core templates:`, error);
    }
    
    return core;
  }

  /**
   * Load world-specific templates
   */
  private async loadWorldTemplates(worldSlug: string): Promise<TemplateBundle['world']> {
    const world: TemplateBundle['world'] = {};
    
    // Try exact case first, then case-insensitive search
    let worldDir = join(this.worldsDir, this.capitalizeFirst(worldSlug));
    
    if (!existsSync(worldDir)) {
      // Case-insensitive search
      const foundDir = this.findWorldDirectoryCaseInsensitive(worldSlug);
      if (foundDir) {
        worldDir = foundDir;
      }
    }
    
    if (!worldDir || !existsSync(worldDir)) {
      console.warn(`[TEMPLATE_REGISTRY] World directory not found for: ${worldSlug}`);
      return world;
    }

    try {
      const files = readdirSync(worldDir, { withFileTypes: true });
      
      for (const file of files) {
        if (file.isFile() && this.isTemplateFile(file.name)) {
          const filePath = join(worldDir, file.name);
          const content = this.readFileSafely(filePath);
          
          if (content) {
            const key = this.mapWorldFileToKey(file.name, worldSlug);
            if (key) {
              world[key] = content;
            }
          }
        }
      }
    } catch (error) {
      console.warn(`[TEMPLATE_REGISTRY] Error loading world templates for ${worldSlug}:`, error);
    }
    
    return world;
  }

  /**
   * Load adventure templates
   */
  private async loadAdventureTemplates(worldSlug: string): Promise<Record<string, string>> {
    const adventures: Record<string, string> = {};
    
    // Try exact case first, then case-insensitive search
    let worldDir = join(this.worldsDir, this.capitalizeFirst(worldSlug));
    
    if (!existsSync(worldDir)) {
      const foundDir = this.findWorldDirectoryCaseInsensitive(worldSlug);
      if (foundDir) {
        worldDir = foundDir;
      }
    }
    
    if (!worldDir || !existsSync(worldDir)) {
      return adventures;
    }

    try {
      const files = readdirSync(worldDir, { withFileTypes: true });
      
      for (const file of files) {
        if (file.isFile() && file.name.startsWith('adventure.') && file.name.endsWith('.json')) {
          const filePath = join(worldDir, file.name);
          const content = this.readFileSafely(filePath);
          
          if (content) {
            // Extract adventure slug from filename: adventure.falebridge.json -> falebridge
            const slug = file.name.replace('adventure.', '').replace('.json', '');
            adventures[slug] = content;
          }
        }
      }
    } catch (error) {
      console.warn(`[TEMPLATE_REGISTRY] Error loading adventure templates for ${worldSlug}:`, error);
    }
    
    return adventures;
  }

  /**
   * Map core file names to bundle keys
   */
  private mapCoreFileToKey(filename: string): string | null {
    const nameWithoutExt = basename(filename, extname(filename));
    
    // Core mapping based on filename patterns
    if (nameWithoutExt === 'engine.system') return 'system';
    if (nameWithoutExt === 'systems.unified') return 'tools';
    if (nameWithoutExt === 'style.ui-global') return 'formatting';
    if (nameWithoutExt === 'save.instructions') return 'saveInstructions';
    if (nameWithoutExt === 'agency.presence-and-guardrails') return 'safety';
    
    // Include other core files under their basename
    return nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '');
  }

  /**
   * Map world file names to bundle keys
   */
  private mapWorldFileToKey(filename: string, worldSlug: string): string | null {
    const nameWithoutExt = basename(filename, extname(filename));
    
    // World mapping based on filename patterns
    if (nameWithoutExt.includes('world-codex') && nameWithoutExt.includes('lore')) return 'lore';
    if (nameWithoutExt.includes('world-codex') && nameWithoutExt.includes('logic')) return 'logic';
    if (nameWithoutExt.startsWith('style.')) return 'style';
    
    // Include other world files under their basename
    return nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '');
  }

  /**
   * Find world directory with case-insensitive search
   */
  private findWorldDirectoryCaseInsensitive(worldSlug: string): string | null {
    if (!existsSync(this.worldsDir)) {
      return null;
    }

    try {
      const entries = readdirSync(this.worldsDir, { withFileTypes: true });
      const targetSlug = worldSlug.toLowerCase();
      
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.toLowerCase() === targetSlug) {
          return join(this.worldsDir, entry.name);
        }
      }
    } catch (error) {
      console.warn(`[TEMPLATE_REGISTRY] Error in case-insensitive world search:`, error);
    }
    
    return null;
  }

  /**
   * Normalize world slug (trim, lowercase)
   */
  private normalizeWorldSlug(worldSlug: string): string {
    return (worldSlug || '').trim().toLowerCase();
  }

  /**
   * Capitalize first letter
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Check if file is a template file
   */
  private isTemplateFile(filename: string): boolean {
    const ext = extname(filename).toLowerCase();
    return ext === '.json' || ext === '.md' || ext === '.txt';
  }

  /**
   * Safely read file content with error handling
   */
  private readFileSafely(filePath: string): string | null {
    try {
      return readFileSync(filePath, 'utf-8');
    } catch (error) {
      console.warn(`[TEMPLATE_REGISTRY] Could not read file ${filePath}:`, error);
      return null;
    }
  }
}

// Singleton instance
const fsLoader = new FSTemplateLoader();

/**
 * Get templates for a specific world using filesystem provider
 */
export async function getTemplatesForWorld(worldSlug: string): Promise<TemplateBundle> {
  return fsLoader.loadTemplatesForWorld(worldSlug);
}
