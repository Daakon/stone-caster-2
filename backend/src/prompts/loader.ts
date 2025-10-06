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
      ['world-codex', 2],
      
      // Core Systems Layer
      ['systems.unified', 3],
      ['style.ui-global', 4],
      
      // Engine Layer
      ['core.rpg-storyteller', 5],
      ['engine.system', 6],
      ['awf.scheme', 7],
      
      // AI Behavior Layer
      ['agency.presence-and-guardrails', 8],
      
      // Content Layer
      ['adventure', 9],
      
      // Enhancement Layer
      ['essence-integration-enhancement', 10],
      ['adventure-expanded', 11],
    ]);
  }

  /**
   * Load all prompt files and create manifest entries
   */
  async loadPromptManifest(): Promise<PromptTemplateMeta[]> {
    const manifest: PromptTemplateMeta[] = [];
    
    // Load core files
    const coreFiles = await this.loadDirectory('Core');
    manifest.push(...coreFiles);
    
    // Load world files (will be filtered by world context later)
    const worldFiles = await this.loadDirectory('Worlds');
    manifest.push(...worldFiles);
    
    return manifest.sort((a, b) => a.loadOrder - b.loadOrder);
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
        const parsed = JSON.parse(content);
        segments = this.extractSegmentsFromJson(parsed, nameWithoutExt);
        variables = this.extractVariablesFromContent(content);
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
   * Format JSON content as a prompt segment
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
    
    // Add key sections
    const keySections = ['rules', 'mechanics', 'policies', 'constraints', 'guidelines'];
    for (const section of keySections) {
      if (parsed[section]) {
        formatted += `### ${this.capitalize(section)}\n\n`;
        formatted += this.formatJsonSection(parsed[section]);
        formatted += '\n\n';
      }
    }
    
    return formatted.trim();
  }

  /**
   * Format a JSON section for prompt use
   */
  private formatJsonSection(section: any): string {
    if (typeof section === 'string') {
      return section;
    } else if (Array.isArray(section)) {
      return section.map(item => `- ${typeof item === 'string' ? item : JSON.stringify(item)}`).join('\n');
    } else if (typeof section === 'object') {
      return Object.entries(section)
        .map(([key, value]) => `- **${key}**: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
        .join('\n');
    }
    return JSON.stringify(section);
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
