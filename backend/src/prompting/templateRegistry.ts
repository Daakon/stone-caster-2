import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve, basename, extname } from 'path';

/**
 * Template bundle structure for organizing prompt templates
 * @deprecated Use the new file-based template system instead
 */
export type TemplateBundle = {
  core: { 
    system?: string; 
    safety?: string; 
    formatting?: string; 
    tools?: string; 
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
 * New file-based template system result
 */
export type FileBasedTemplateResult = {
  prompt: string;
  filesLoaded: string[];
  variablesReplaced: Record<string, string>;
  metadata: {
    templatePath: string;
    totalFiles: number;
    tokenCount: number;
    assembledAt: string;
  };
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
    
  }

  /**
   * Load templates for a specific world
   */
  async loadTemplatesForWorld(worldSlug: string): Promise<TemplateBundle> {
    const normalizedSlug = this.normalizeWorldSlug(worldSlug);
    
    
    try {
      // Load core templates
      const core = await this.loadCoreTemplates();
      
      // Load world-specific templates
      const world = await this.loadWorldTemplates(normalizedSlug);
      
      // Load adventure templates
      const adventures = await this.loadAdventureTemplates(normalizedSlug);
      
      const bundle: TemplateBundle = { core, world, adventures };
      
      // Validate that we have at least some world content
      if (Object.keys(world).length === 0 && Object.keys(adventures).length === 0) {
        console.warn(`[TEMPLATE_REGISTRY] PromptTemplatesMissing { world: ${normalizedSlug} }`);
        throw new PromptTemplateMissingError(normalizedSlug);
      }
      
      
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
      const loadedFiles: string[] = [];
      
      for (const file of files) {
        if (file.isFile() && this.isTemplateFile(file.name)) {
          const filePath = join(this.coreDir, file.name);
          const content = this.readFileSafely(filePath);
          
          if (content) {
            const key = this.mapCoreFileToKey(file.name);
            if (key) {
              core[key] = content;
              loadedFiles.push(`Core/${file.name}`);
            }
          }
        }
      }

      if (loadedFiles.length > 0) {
        console.log(`[TEMPLATE_REGISTRY] Loaded core files: ${loadedFiles.join(', ')}`);
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
      const loadedFiles: string[] = [];
      
      for (const file of files) {
        if (file.isFile() && this.isTemplateFile(file.name)) {
          const filePath = join(worldDir, file.name);
          const content = this.readFileSafely(filePath);
          
          if (content) {
            const key = this.mapWorldFileToKey(file.name, worldSlug);
            if (key) {
              world[key] = content;
              loadedFiles.push(`Worlds/${worldSlug}/${file.name}`);
            }
          }
        }
      }

      if (loadedFiles.length > 0) {
        console.log(`[TEMPLATE_REGISTRY] Loaded world files: ${loadedFiles.join(', ')}`);
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
      const loadedFiles: string[] = [];
      
      for (const file of files) {
        if (file.isFile() && file.name.startsWith('adventure.') && file.name.endsWith('.json')) {
          const filePath = join(worldDir, file.name);
          const content = this.readFileSafely(filePath);
          
          if (content) {
            // Extract adventure slug from filename: adventure.falebridge.json -> falebridge
            const slug = file.name.replace('adventure.', '').replace('.json', '');
            adventures[slug] = content;
            loadedFiles.push(`Worlds/${worldSlug}/${file.name}`);
          }
        }
      }

      if (loadedFiles.length > 0) {
        console.log(`[TEMPLATE_REGISTRY] Loaded adventure files: ${loadedFiles.join(', ')}`);
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
    // Skip save instructions - not needed for AI prompts
    if (nameWithoutExt === 'save.instructions') return null;
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
      const content = readFileSync(filePath, 'utf-8');
      const ext = extname(filePath).toLowerCase();
      
      // Minimize JSON files before embedding them in prompts
      if (ext === '.json') {
        return this.minimizeJson(content);
      }
      
      return content;
    } catch (error) {
      console.warn(`[TEMPLATE_REGISTRY] Could not read file ${filePath}:`, error);
      return null;
    }
  }
  
  /**
   * Minimize JSON content by removing comments, whitespace, and formatting
   */
  private minimizeJson(content: string): string {
    try {
      // Remove JSON comments (// and /* */ style comments)
      let cleaned = content
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* */ comments
        .replace(/\/\/.*$/gm, '') // Remove // comments
        .replace(/^\s*[\r\n]/gm, '') // Remove empty lines
        .trim();
      
      // Clean control characters that can cause JSON parsing issues
      cleaned = cleaned
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters except \n, \r, \t
        .replace(/\r\n/g, '\n') // Normalize line endings
        .replace(/\r/g, '\n'); // Convert remaining \r to \n
      
      // Parse and re-stringify to ensure valid JSON and remove extra whitespace
      const parsed = JSON.parse(cleaned);
      return JSON.stringify(parsed, null, 0);
    } catch (error) {
      // If parsing fails, return the original content
      console.warn(`[TEMPLATE_REGISTRY] Failed to parse JSON for minimization:`, error);
      return content;
    }
  }
}

// Singleton instance
const fsLoader = new FSTemplateLoader();

/**
 * Get templates for a specific world using filesystem provider
 * @deprecated Use the new file-based template system instead
 */
export async function getTemplatesForWorld(worldSlug: string): Promise<TemplateBundle> {
  return fsLoader.loadTemplatesForWorld(worldSlug);
}

/**
 * New file-based template system
 * Loads and processes the stone_caster_mvp_webapp_prompt_template_just_add_files.md template
 */
export class FileBasedTemplateLoader {
  private readonly projectRoot: string;
  private readonly templatePath: string;

  constructor() {
    this.projectRoot = resolve(process.cwd());
    this.templatePath = join(this.projectRoot, 'AI API Prompts', 'baseline.md');
  }

  /**
   * Load and process the file-based template for a specific world
   */
  async loadTemplateForWorld(
    worldSlug: string, 
    context: {
      turn: number;
      scene_id: string;
      phase: string;
      time_block_json: string;
      weather_json: string;
      player_min_json: string;
      party_min_json: string;
      flags_json: string;
      last_outcome_min_json: string;
    }
  ): Promise<FileBasedTemplateResult> {
    try {
      // Check if template file exists
      if (!existsSync(this.templatePath)) {
        throw new Error(`Template file not found: ${this.templatePath}`);
      }

      // Read the template file
      let template = readFileSync(this.templatePath, 'utf-8');
      const filesLoaded: string[] = [];
      const variablesReplaced: Record<string, string> = {};

      // Replace variables in the template
      const variableReplacements = {
        '{{world_name}}': worldSlug,
        '{{adventure_name}}': context.scene_id || 'default',
        '{{game_state_json}}': context.time_block_json,
        '{{player_state_json}}': context.player_min_json,
        '{{rng_json}}': context.weather_json,
        '{{player_input_text}}': context.flags_json,
        '{{adventure_start_json}}': (context as any).adventure_start_json || '',
      };

      for (const [placeholder, value] of Object.entries(variableReplacements)) {
        if (template.includes(placeholder)) {
          template = template.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
          variablesReplaced[placeholder] = value;
        }
      }

      // Process file placeholders (<<<FILE ... >>>)
      const filePlaceholderRegex = /<<<FILE\s+([^>]+?)>>>/gs;
      let match;
      
      while ((match = filePlaceholderRegex.exec(template)) !== null) {
        // Extract just the first line (file path) from the captured content
        const filePath = match[1].split('\n')[0].trim();
        const fullPath = this.resolveFilePath(filePath, worldSlug);
        
        if (existsSync(fullPath)) {
          const fileContent = this.readFileSafely(fullPath);
          if (fileContent) {
            template = template.replace(match[0], fileContent);
            filesLoaded.push(filePath);
          } else {
            // If file can't be read, replace with a placeholder
            template = template.replace(match[0], `[FILE NOT FOUND: ${filePath}]`);
            console.warn(`[TEMPLATE_LOADER] Could not read file: ${fullPath}`);
          }
        } else {
          // If file doesn't exist, replace with a placeholder
          template = template.replace(match[0], `[FILE NOT FOUND: ${filePath}]`);
          console.warn(`[TEMPLATE_LOADER] File not found: ${fullPath}`);
        }
      }

      // Estimate token count
      const tokenCount = Math.ceil(template.length / 4);

      return {
        prompt: template,
        filesLoaded,
        variablesReplaced,
        metadata: {
          templatePath: this.templatePath,
          totalFiles: filesLoaded.length,
          tokenCount,
          assembledAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('[TEMPLATE_LOADER] Error loading file-based template:', error);
      throw new Error(`Failed to load template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Resolve file path based on the template's file references
   */
  private resolveFilePath(filePath: string, worldSlug: string): string {
    // Handle different file path patterns from the template
    if (filePath.startsWith('core.prompt.json')) {
      return join(this.projectRoot, 'AI API Prompts', 'core.prompt.json');
    }
    
    if (filePath.startsWith('worlds/')) {
      // Handle world files like "worlds/mystika/world.prompt.json"
      return join(this.projectRoot, 'AI API Prompts', filePath);
    }
    
    // Default: assume it's in the AI API Prompts directory
    return join(this.projectRoot, 'AI API Prompts', filePath);
  }

  /**
   * Capitalize first letter
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Safely read file content with error handling
   */
  private readFileSafely(filePath: string): string | null {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const ext = extname(filePath).toLowerCase();
      
      // Minimize JSON files before embedding them in prompts
      if (ext === '.json') {
        return this.minimizeJson(content);
      }
      
      return content;
    } catch (error) {
      console.warn(`[TEMPLATE_LOADER] Could not read file ${filePath}:`, error);
      return null;
    }
  }
  
  /**
   * Minimize JSON content by removing comments, whitespace, and formatting
   */
  private minimizeJson(content: string): string {
    try {
      // Remove JSON comments (// and /* */ style comments)
      let cleaned = content
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* */ comments
        .replace(/\/\/.*$/gm, '') // Remove // comments
        .replace(/^\s*[\r\n]/gm, '') // Remove empty lines
        .trim();
      
      // Parse and re-stringify to ensure valid JSON and remove extra whitespace
      const parsed = JSON.parse(cleaned);
      return JSON.stringify(parsed, null, 0);
    } catch (error) {
      // If parsing fails, return the original content
      console.warn(`[TEMPLATE_LOADER] Failed to parse JSON for minimization:`, error);
      return content;
    }
  }
}

// Singleton instance for the new file-based template loader
const fileBasedLoader = new FileBasedTemplateLoader();

/**
 * Get file-based template for a specific world
 */
export async function getFileBasedTemplateForWorld(
  worldSlug: string,
  context: {
    turn: number;
    scene_id: string;
    phase: string;
    time_block_json: string;
    weather_json: string;
    player_min_json: string;
    party_min_json: string;
    flags_json: string;
    last_outcome_min_json: string;
    adventure_start_json?: string;
  }
): Promise<FileBasedTemplateResult> {
  return fileBasedLoader.loadTemplateForWorld(worldSlug, context);
}
