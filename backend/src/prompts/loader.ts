import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';
import { createHash } from 'crypto';
import type { PromptTemplateMeta } from './schemas.js';

/**
 * Generic prompt file loader that reads JSON/MD files from GPT Prompts directory
 */
export class PromptLoader {
  private readonly promptsPath: string;
  private readonly loadOrderMap: Map<string, number>;

  constructor(promptsPath: string = 'GPT Prompts') {
    this.promptsPath = promptsPath;
    this.loadOrderMap = new Map([
      // Foundation Layer
      ['world-codex', 1],
      
      // Core Systems Layer
      ['systems.unified', 2],
      ['style.ui-global', 3],
      
      // Engine Layer
      ['core.rpg-storyteller', 4],
      ['engine.system', 5],
      ['awf.scheme', 6],
      
      // AI Behavior Layer
      ['agency.presence-and-guardrails', 7],
      
      // Data Management Layer
      ['save.instructions', 8],
      ['validation.save', 9],
      ['validation.assets', 10],
      ['validation.world-specific', 11],
      
      // Performance Layer
      ['performance.benchmarks', 12],
      
      // Content Layer
      ['adventure', 13],
      
      // Enhancement Layer
      ['essence-integration-enhancement', 14],
      ['adventure-expanded', 15],
    ]);
  }

  /**
   * Load all prompt files and create manifest entries
   */
  async loadPromptManifest(worldSlug?: string): Promise<PromptTemplateMeta[]> {
    const manifest: PromptTemplateMeta[] = [];
    
    // Load core files
    const coreFiles = await this.loadDirectory('Core');
    manifest.push(...coreFiles);
    
    // Load world-specific files if world is specified
    if (worldSlug) {
      const worldFiles = await this.loadWorldFiles(worldSlug);
      manifest.push(...worldFiles);
    }
    
    return manifest.sort((a, b) => a.loadOrder - b.loadOrder);
  }

  /**
   * Load world-specific files for a given world
   */
  private async loadWorldFiles(worldSlug: string): Promise<PromptTemplateMeta[]> {
    const worldFiles: PromptTemplateMeta[] = [];
    const worldDir = join(this.promptsPath, 'Worlds', this.capitalizeFirst(worldSlug));
    
    console.log(`[PROMPT_LOADER] Loading world files from: ${worldDir}`);
    
    try {
      const entries = readdirSync(worldDir, { withFileTypes: true });
      console.log(`[PROMPT_LOADER] Found ${entries.length} entries in world directory`);
      
      for (const entry of entries) {
        if (this.isPromptFile(entry.name)) {
          const filePath = join(worldDir, entry.name);
          console.log(`[PROMPT_LOADER] Loading file: ${entry.name}`);
          const promptMeta = await this.loadPromptFile(filePath, `Worlds/${this.capitalizeFirst(worldSlug)}`);
          if (promptMeta) {
            console.log(`[PROMPT_LOADER] Successfully loaded template: ${promptMeta.id}`);
            worldFiles.push(promptMeta);
          }
        }
      }
    } catch (error) {
      console.warn(`Could not load world directory ${worldDir}:`, error);
    }
    
    console.log(`[PROMPT_LOADER] Loaded ${worldFiles.length} world files for ${worldSlug}`);
    return worldFiles;
  }

  /**
   * Capitalize first letter of string
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Load files from a specific directory
   */
  private async loadDirectory(dirName: string): Promise<PromptTemplateMeta[]> {
    const dirPath = join(this.promptsPath, dirName);
    const files: PromptTemplateMeta[] = [];
    
    try {
      const entries = readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Handle subdirectories (like Worlds/Mystika, Worlds/Verya)
          const subFiles = await this.loadSubdirectory(join(dirPath, entry.name), entry.name);
          files.push(...subFiles);
        } else if (this.isPromptFile(entry.name)) {
          const filePath = join(dirPath, entry.name);
          const promptMeta = await this.loadPromptFile(filePath, dirName);
          if (promptMeta) {
            files.push(promptMeta);
          }
        }
      }
    } catch (error) {
      console.warn(`Could not load directory ${dirPath}:`, error);
    }
    
    return files;
  }

  /**
   * Load files from subdirectories (like Worlds/Mystika)
   */
  private async loadSubdirectory(dirPath: string, worldName: string): Promise<PromptTemplateMeta[]> {
    const files: PromptTemplateMeta[] = [];
    
    try {
      const entries = readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile() && this.isPromptFile(entry.name)) {
          const filePath = join(dirPath, entry.name);
          const promptMeta = await this.loadPromptFile(filePath, 'Worlds', worldName);
          if (promptMeta) {
            files.push(promptMeta);
          }
        }
      }
    } catch (error) {
      console.warn(`Could not load subdirectory ${dirPath}:`, error);
    }
    
    return files;
  }

  /**
   * Check if a file is a prompt file (JSON or MD)
   */
  private isPromptFile(filename: string): boolean {
    const ext = extname(filename).toLowerCase();
    return ext === '.json' || ext === '.md';
  }

  /**
   * Load a single prompt file and create metadata
   */
  private async loadPromptFile(
    filePath: string, 
    scope: string, 
    worldName?: string
  ): Promise<PromptTemplateMeta | null> {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const filename = basename(filePath);
      const ext = extname(filename);
      const nameWithoutExt = basename(filename, ext);
      
      // Determine scope and load order
      const { scope: finalScope, loadOrder } = this.determineScopeAndOrder(
        nameWithoutExt, 
        scope, 
        worldName
      );
      
      // Parse content based on file type
      let segments: string[];
      let variables: string[] = [];
      
      if (ext === '.json') {
        // Clean the JSON content before parsing
        console.log(`[PROMPT_LOADER] Cleaning JSON content for ${filename} (${content.length} -> ${this.cleanJsonContent(content).length} chars)`);
        const cleanedContent = this.cleanJsonContent(content);
        const parsed = JSON.parse(cleanedContent);
        segments = this.extractSegmentsFromJson(parsed, nameWithoutExt);
        variables = this.extractVariablesFromContent(cleanedContent);
      } else if (ext === '.md') {
        segments = this.extractSegmentsFromMarkdown(content, nameWithoutExt);
        variables = this.extractVariablesFromContent(content);
      } else {
        return null;
      }
      
      // Generate hash
      const hash = createHash('sha256').update(content).digest('hex');
      
      // Extract version if available
      const version = this.extractVersion(content, nameWithoutExt);
      
      return {
        id: this.generateId(nameWithoutExt, worldName),
        scope: finalScope,
        version,
        hash,
        variables,
        segments,
        loadOrder,
        worldSpecific: !!worldName,
        required: this.isRequired(nameWithoutExt, finalScope),
      };
    } catch (error) {
      console.warn(`Could not load prompt file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Determine scope and load order for a file
   */
  private determineScopeAndOrder(
    filename: string, 
    directoryScope: string, 
    worldName?: string
  ): { scope: PromptTemplateMeta['scope'], loadOrder: number } {
    // World-specific files
    if (worldName) {
      if (filename.startsWith('world-codex')) {
        return { scope: 'world', loadOrder: filename.includes('lore') ? 1 : 2 };
      } else if (filename.startsWith('adventure')) {
        return { scope: 'adventure', loadOrder: 9 };
      } else if (filename.startsWith('style')) {
        return { scope: 'world', loadOrder: 4 };
      } else {
        return { scope: 'world', loadOrder: 10 };
      }
    }
    
    // Core files
    const loadOrder = this.loadOrderMap.get(filename) || 99;
    
    if (filename.startsWith('world-') || filename.startsWith('adventure-')) {
      return { scope: 'world', loadOrder };
    } else if (filename.startsWith('scenario-') || filename.startsWith('quest-')) {
      return { scope: 'scenario', loadOrder };
    } else if (filename.includes('enhancement')) {
      return { scope: 'enhancement', loadOrder };
    } else {
      return { scope: 'core', loadOrder };
    }
  }

  /**
   * Extract segments from JSON content
   */
  private extractSegmentsFromJson(parsed: any, filename: string): string[] {
    // For JSON files, we'll create segments based on the structure
    const segments: string[] = [];
    
    if (typeof parsed === 'object' && parsed !== null) {
      // Create a formatted segment from the JSON
      const formatted = this.formatJsonAsPrompt(parsed, filename);
      segments.push(formatted);
    }
    
    return segments;
  }

  /**
   * Extract segments from Markdown content
   */
  private extractSegmentsFromMarkdown(content: string, filename: string): string[] {
    // Split markdown into logical sections
    const sections = content.split(/\n(?=#{1,3}\s)/);
    return sections.map(section => section.trim()).filter(section => section.length > 0);
  }

  /**
   * Clean and minimize JSON content by removing unnecessary whitespace, comments, and formatting
   */
  private cleanJsonContent(content: string): string {
    // Remove JSON comments (// and /* */ style comments)
    let cleaned = content
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* */ comments
      .replace(/\/\/.*$/gm, '') // Remove // comments
      .replace(/^\s*[\r\n]/gm, '') // Remove empty lines
      .trim();
    
    try {
      // Parse and re-stringify to ensure valid JSON and remove extra whitespace
      const parsed = JSON.parse(cleaned);
      return JSON.stringify(parsed, null, 0);
    } catch (error) {
      // If parsing fails, return the cleaned content as-is
      console.warn('Failed to parse JSON content for cleaning:', error);
      return cleaned;
    }
  }

  /**
   * Minimize JSON content by removing unnecessary whitespace and formatting
   */
  private minimizeJson(obj: any): string {
    return JSON.stringify(obj, null, 0);
  }

  /**
   * Format JSON content as a prompt segment with minimized JSON in markdown code blocks
   */
  private formatJsonAsPrompt(parsed: any, filename: string): string {
    // Create a human-readable format from JSON
    let formatted = `## ${this.formatFilename(filename)}\n\n`;
    
    if (parsed.name || parsed.title) {
      formatted += `**Name**: ${parsed.name || parsed.title}\n\n`;
    }
    
    if (parsed.version) {
      formatted += `**Version**: ${parsed.version}\n\n`;
    }
    
    if (parsed.about || parsed.description) {
      formatted += `**About**: ${parsed.about || parsed.description}\n\n`;
    }
    
    // Add key sections with minimized JSON in code blocks
    const keySections = ['rules', 'mechanics', 'policies', 'constraints', 'guidelines', 'awf_contract', 'schemas', 'beats', 'scheduler', 'integration'];
    for (const section of keySections) {
      if (parsed[section]) {
        formatted += `### ${this.capitalize(section)}\n\n`;
        formatted += this.formatJsonSection(parsed[section]);
        formatted += '\n\n';
      }
    }
    
    // Add complete minimized JSON at the end for reference
    formatted += `### Complete Configuration\n\n\`\`\`json\n${this.minimizeJson(parsed)}\n\`\`\`\n\n`;
    
    return formatted.trim();
  }

  /**
   * Format a JSON section for prompt use with minimized JSON in markdown code blocks
   */
  private formatJsonSection(section: any): string {
    if (typeof section === 'string') {
      return section;
    } else if (Array.isArray(section)) {
      // For arrays, show a summary and include minimized JSON
      const summary = section.length > 0 ? `${section.length} items` : 'Empty array';
      return `${summary}\n\n\`\`\`json\n${this.minimizeJson(section)}\n\`\`\``;
    } else if (typeof section === 'object' && section !== null) {
      // For objects, show key summary and include minimized JSON
      const keys = Object.keys(section);
      const summary = keys.length > 0 ? `Keys: ${keys.join(', ')}` : 'Empty object';
      return `${summary}\n\n\`\`\`json\n${this.minimizeJson(section)}\n\`\`\``;
    }
    return `\`\`\`json\n${this.minimizeJson(section)}\n\`\`\``;
  }

  /**
   * Extract variables from content using template syntax
   */
  private extractVariablesFromContent(content: string): string[] {
    const variablePattern = /\{\{([^}]+)\}\}/g;
    const matches = Array.from(content.matchAll(variablePattern));
    return [...new Set(matches.map(match => match[1].trim()))];
  }

  /**
   * Extract version from content
   */
  private extractVersion(content: string, filename: string): string {
    // Try to extract version from JSON
    try {
      const parsed = JSON.parse(content);
      if (parsed.version) {
        return parsed.version;
      }
    } catch {
      // Not JSON, try markdown
    }
    
    // Try to extract from markdown headers or content
    const versionMatch = content.match(/version[:\s]+([^\s\n]+)/i);
    if (versionMatch) {
      return versionMatch[1];
    }
    
    return '1.0.0';
  }

  /**
   * Generate a unique ID for the prompt
   */
  private generateId(filename: string, worldName?: string): string {
    const baseId = filename.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    return worldName ? `${worldName}-${baseId}` : baseId;
  }

  /**
   * Check if a prompt is required
   */
  private isRequired(filename: string, scope: string): boolean {
    const requiredFiles = [
      'systems.unified',
      'engine.system',
      'agency.presence-and-guardrails',
      'world-codex'
    ];
    
    return requiredFiles.some(required => filename.includes(required)) || scope === 'core';
  }

  /**
   * Format filename for display
   */
  private formatFilename(filename: string): string {
    return filename
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Capitalize first letter
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
