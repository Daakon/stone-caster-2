#!/usr/bin/env tsx

/**
 * Prompt Ingestion Script
 * 
 * This script reads prompt files from the filesystem and ingests them into the database.
 * It maintains the existing load order and structure while adding database metadata.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';
import { createHash } from 'crypto';
import { z } from 'zod';

// Environment setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Schema for prompt metadata
const PromptSegmentSchema = z.object({
  id: z.string(),
  content: z.string(),
});

const PromptFileSchema = z.object({
  segments: z.array(PromptSegmentSchema).optional(),
  variables: z.array(z.string()).optional(),
  version: z.string().optional(),
  id: z.string().optional(),
  contract: z.any().optional(),
  identity_rules: z.array(z.string()).optional(),
  turn_rules: z.any().optional(),
  beats: z.any().optional(),
  progress_tracking: z.any().optional(),
  entities: z.any().optional(),
  timekeeping: z.any().optional(),
});

type PromptFile = z.infer<typeof PromptFileSchema>;

// Load order mapping (from existing system)
const LOAD_ORDER_MAP = new Map([
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

// Layer mapping
const LAYER_MAP = new Map([
  ['world-codex', 'world'],
  ['systems.unified', 'core'],
  ['style.ui-global', 'core'],
  ['core.rpg-storyteller', 'core'],
  ['engine.system', 'core'],
  ['awf.scheme', 'core'],
  ['agency.presence-and-guardrails', 'core'],
  ['save.instructions', 'adventure'],
  ['validation.save', 'optional'],
  ['validation.assets', 'optional'],
  ['validation.world-specific', 'world'],
  ['performance.benchmarks', 'optional'],
  ['adventure', 'adventure'],
  ['essence-integration-enhancement', 'optional'],
  ['adventure-expanded', 'adventure'],
]);

interface PromptRecord {
  layer: string;
  world_slug: string | null;
  adventure_slug: string | null;
  scene_id: string | null;
  turn_stage: string;
  sort_order: number;
  version: string;
  hash: string;
  content: string;
  metadata: any;
  active: boolean;
  locked: boolean;
}

class PromptIngester {
  private promptsPath: string;
  private records: PromptRecord[] = [];

  constructor(promptsPath: string = 'AI API Prompts') {
    this.promptsPath = promptsPath;
  }

  async ingest(): Promise<void> {
    console.log('🚀 Starting prompt ingestion...');
    
    try {
      // Process core prompts
      await this.processCorePrompts();
      
      // Process world-specific prompts
      await this.processWorldPrompts();
      
      // Process adventure-specific prompts
      await this.processAdventurePrompts();
      
      // Upsert to database
      await this.upsertToDatabase();
      
      console.log('✅ Prompt ingestion completed successfully');
    } catch (error) {
      console.error('❌ Prompt ingestion failed:', error);
      throw error;
    }
  }

  private async processCorePrompts(): Promise<void> {
    console.log('📁 Processing core prompts...');
    
    const coreFiles = [
      'core.prompt.json',
      'core.rpg-storyteller.json',
      'engine.system.json',
      'awf.scheme.json',
      'agency.presence-and-guardrails.json',
      'baseline.md'
    ];

    for (const filename of coreFiles) {
      const filePath = join(this.promptsPath, filename);
      if (this.fileExists(filePath)) {
        await this.processFile(filePath, 'core', null, null);
      }
    }
  }

  private async processWorldPrompts(): Promise<void> {
    console.log('🌍 Processing world-specific prompts...');
    
    const worldsPath = join(this.promptsPath, 'worlds');
    if (!this.fileExists(worldsPath)) {
      console.log('No worlds directory found');
      return;
    }

    const worlds = readdirSync(worldsPath);
    
    for (const worldSlug of worlds) {
      const worldPath = join(worldsPath, worldSlug);
      if (!statSync(worldPath).isDirectory()) continue;

      // Process world-level files
      const worldFiles = ['world.prompt.json', 'world-codex.mystika-lore.md', 'world-codex.mystika-logic.json'];
      for (const filename of worldFiles) {
        const filePath = join(worldPath, filename);
        if (this.fileExists(filePath)) {
          await this.processFile(filePath, 'world', worldSlug, null);
        }
      }
    }
  }

  private async processAdventurePrompts(): Promise<void> {
    console.log('🎭 Processing adventure-specific prompts...');
    
    const worldsPath = join(this.promptsPath, 'worlds');
    if (!this.fileExists(worldsPath)) return;

    const worlds = readdirSync(worldsPath);
    
    for (const worldSlug of worlds) {
      const worldPath = join(worldsPath, worldSlug);
      if (!statSync(worldPath).isDirectory()) continue;

      const adventuresPath = join(worldPath, 'adventures');
      if (!this.fileExists(adventuresPath)) continue;

      const adventures = readdirSync(adventuresPath);
      
      for (const adventureSlug of adventures) {
        const adventurePath = join(adventuresPath, adventureSlug);
        if (!statSync(adventurePath).isDirectory()) continue;

        // Process adventure files
        const adventureFiles = ['adventure.prompt.json', 'adventure.start.prompt.json', 'adventure.start.prompt.md'];
        for (const filename of adventureFiles) {
          const filePath = join(adventurePath, filename);
          if (this.fileExists(filePath)) {
            await this.processFile(filePath, 'adventure', worldSlug, adventureSlug);
          }
        }
      }
    }
  }

  private async processFile(
    filePath: string, 
    scope: string, 
    worldSlug: string | null, 
    adventureSlug: string | null
  ): Promise<void> {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const filename = basename(filePath);
      const ext = extname(filename);
      const nameWithoutExt = basename(filename, ext);
      
      console.log(`  📄 Processing: ${filename}`);
      
      // Determine layer and sort order
      const { layer, sortOrder } = this.determineLayerAndOrder(nameWithoutExt, scope);
      
      // Parse content based on file type
      let segments: string[] = [];
      let metadata: any = {};
      
      if (ext === '.json') {
        const parsed = JSON.parse(content);
        const validated = PromptFileSchema.parse(parsed);
        
        if (validated.segments) {
          segments = validated.segments.map(s => s.content);
        } else {
          // Single segment from the entire JSON
          segments = [this.formatJsonAsPrompt(validated, nameWithoutExt)];
        }
        
        metadata = {
          variables: validated.variables || [],
          version: validated.version || '1.0.0',
          original_id: validated.id,
          contract: validated.contract,
          identity_rules: validated.identity_rules,
          turn_rules: validated.turn_rules,
          beats: validated.beats,
          progress_tracking: validated.progress_tracking,
          entities: validated.entities,
          timekeeping: validated.timekeeping,
        };
      } else if (ext === '.md') {
        segments = [content];
        metadata = {
          version: '1.0.0',
          file_type: 'markdown',
        };
      }
      
      // Create records for each segment
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const hash = createHash('sha256').update(segment).digest('hex');
        
        const record: PromptRecord = {
          layer,
          world_slug: worldSlug,
          adventure_slug: adventureSlug,
          scene_id: null,
          turn_stage: this.determineTurnStage(filename),
          sort_order: sortOrder + i,
          version: metadata.version || '1.0.0',
          hash,
          content: segment,
          metadata,
          active: true,
          locked: false,
        };
        
        this.records.push(record);
      }
      
    } catch (error) {
      console.warn(`⚠️  Failed to process ${filePath}:`, error);
    }
  }

  private determineLayerAndOrder(filename: string, scope: string): { layer: string; sortOrder: number } {
    // Check for exact match first
    if (LOAD_ORDER_MAP.has(filename)) {
      const sortOrder = LOAD_ORDER_MAP.get(filename)!;
      const layer = LAYER_MAP.get(filename) || 'core';
      return { layer, sortOrder };
    }
    
    // Check for partial matches
    for (const [pattern, sortOrder] of LOAD_ORDER_MAP) {
      if (filename.includes(pattern)) {
        const layer = LAYER_MAP.get(pattern) || 'core';
        return { layer, sortOrder };
      }
    }
    
    // Default based on scope
    const layerMap: Record<string, string> = {
      'core': 'core',
      'world': 'world',
      'adventure': 'adventure',
    };
    
    return {
      layer: layerMap[scope] || 'core',
      sortOrder: 999
    };
  }

  private determineTurnStage(filename: string): string {
    if (filename.includes('start')) return 'start';
    if (filename.includes('end')) return 'end';
    return 'any';
  }

  private formatJsonAsPrompt(data: any, filename: string): string {
    // Format JSON data as a readable prompt segment
    const sections: string[] = [];
    
    if (data.contract) {
      sections.push(`Contract: ${JSON.stringify(data.contract, null, 2)}`);
    }
    
    if (data.identity_rules) {
      sections.push(`Identity Rules: ${data.identity_rules.join(', ')}`);
    }
    
    if (data.turn_rules) {
      sections.push(`Turn Rules: ${JSON.stringify(data.turn_rules, null, 2)}`);
    }
    
    if (data.beats) {
      sections.push(`Beats: ${JSON.stringify(data.beats, null, 2)}`);
    }
    
    if (data.progress_tracking) {
      sections.push(`Progress Tracking: ${JSON.stringify(data.progress_tracking, null, 2)}`);
    }
    
    if (data.entities) {
      sections.push(`Entities: ${JSON.stringify(data.entities, null, 2)}`);
    }
    
    if (data.timekeeping) {
      sections.push(`Timekeeping: ${JSON.stringify(data.timekeeping, null, 2)}`);
    }
    
    return sections.join('\n\n');
  }

  private async upsertToDatabase(): Promise<void> {
    console.log(`💾 Upserting ${this.records.length} prompt records to database...`);
    
    const { error } = await supabase
      .from('prompting.prompts')
      .upsert(
        this.records.map(record => ({
          slug: `${record.layer}-${record.world_slug || 'core'}-${record.adventure_slug || 'system'}-${record.hash.substring(0, 8)}`,
          scope: record.world_slug ? 'world' : 'adventure',
          layer: record.layer,
          world_slug: record.world_slug,
          adventure_slug: record.adventure_slug,
          scene_id: record.scene_id,
          turn_stage: record.turn_stage,
          sort_order: record.sort_order,
          version: parseInt(record.version.split('.')[0]) || 1,
          hash: record.hash,
          content: record.content,
          metadata: record.metadata,
          active: record.active,
          locked: record.locked,
        }))
      );
    
    if (error) {
      throw new Error(`Database upsert failed: ${error.message}`);
    }
    
    console.log('✅ Successfully upserted all prompt records');
  }

  private fileExists(filePath: string): boolean {
    try {
      return statSync(filePath).isFile();
    } catch {
      return false;
    }
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting prompt ingestion...');
  const ingester = new PromptIngester();
  await ingester.ingest();
  console.log('✅ Prompt ingestion completed successfully');
}

// Run main function
main().catch(console.error);

export { PromptIngester };
