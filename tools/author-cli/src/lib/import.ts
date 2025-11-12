/**
 * Import Utilities
 * Imports and validates archive data
 */

import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import JSZip from 'jszip';
import type { ExportManifest } from './zip.js';

export interface ImportOptions {
  input: string;
  mode: 'dry' | 'apply';
  conflict: 'skip' | 'replace' | 'merge';
  scope: 'story' | 'all';
  storyId?: string;
}

export interface ImportResult {
  created: string[];
  updated: string[];
  skipped: string[];
  warnings: string[];
}

/**
 * Import archive
 */
export async function importArchive(options: ImportOptions): Promise<ImportResult> {
  const { input, mode, conflict, scope, storyId } = options;

  // Read manifest
  let manifest: ExportManifest;
  let data: Record<string, any[]> = {};

  const inputStat = await stat(input);
  if (inputStat.isDirectory()) {
    // Read from directory
    const manifestPath = join(input, 'manifest.json');
    manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
    
    // Read all type directories
    for (const type of manifest.includes) {
      const typeDir = join(input, type);
      try {
        const files = await readdir(typeDir);
        data[type] = await Promise.all(
          files
            .filter(f => f.endsWith('.json'))
            .map(async f => {
              const content = await readFile(join(typeDir, f), 'utf-8');
              return JSON.parse(content);
            })
        );
      } catch {
        data[type] = [];
      }
    }
  } else {
    // Read from zip
    const zipBuffer = await readFile(input);
    const zip = await JSZip.loadAsync(zipBuffer);
    
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) {
      throw new Error('Manifest not found in archive');
    }
    manifest = JSON.parse(await manifestFile.async('string'));

    // Read all files
    for (const type of manifest.includes) {
      data[type] = [];
      zip.folder(type)?.forEach(async (relativePath, file) => {
        if (file.name.endsWith('.json')) {
          const content = await file.async('string');
          data[type].push(JSON.parse(content));
        }
      });
    }
  }

  // Validate manifest version
  if (manifest.version !== 1) {
    throw new Error(`Unsupported manifest version: ${manifest.version}. Expected 1.`);
  }

  // TODO: Validate data against schemas
  // TODO: Apply import plan based on mode and conflict policy
  // TODO: Execute within transactions per type

  return {
    created: [],
    updated: [],
    skipped: [],
    warnings: [],
  };
}

