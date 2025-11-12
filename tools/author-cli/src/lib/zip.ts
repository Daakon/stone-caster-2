/**
 * Zip Archive Utilities
 * Creates export archives with manifest
 */

import JSZip from 'jszip';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { normalizeData } from './validate.js';

export interface ExportOptions {
  out: string;
  scope: 'story' | 'all';
  storyId?: string;
  templatesVersion?: number;
  includes: string[];
  pretty: boolean;
}

export interface ExportManifest {
  version: number;
  createdAt: string;
  includes: string[];
  storyId?: string;
  templatesVersion?: number;
}

/**
 * Create export archive
 */
export async function createExportArchive(options: ExportOptions): Promise<void> {
  const { out, scope, storyId, templatesVersion, includes, pretty } = options;

  // TODO: Load data from database via services
  // For now, this is a skeleton
  const manifest: ExportManifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    includes,
    ...(storyId && { storyId }),
    ...(templatesVersion && { templatesVersion }),
  };

  const data: Record<string, any[]> = {
    worlds: [],
    rulesets: [],
    npcs: [],
    scenarios: [],
    graphs: [],
    templates: [],
    field_defs: [],
    modules: [],
    loadouts: [],
  };

  // Normalize and sort data
  for (const type of includes) {
    if (type in data) {
      data[type as keyof typeof data] = normalizeData(data[type as keyof typeof data]);
    }
  }

  if (pretty) {
    // Output as directory
    await mkdir(out, { recursive: true });
    await writeFile(
      join(out, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    for (const [type, items] of Object.entries(data)) {
      if (includes.includes(type) && items.length > 0) {
        const typeDir = join(out, type);
        await mkdir(typeDir, { recursive: true });
        
        for (const item of items) {
          const filename = `${item.id || item.name || 'item'}.json`;
          await writeFile(
            join(typeDir, filename),
            JSON.stringify(item, null, 2)
          );
        }
      }
    }

    console.log(`✓ Exported to ${out}/`);
    console.log(`  Manifest: ${Object.keys(data).reduce((sum, k) => sum + data[k as keyof typeof data].length, 0)} items`);
  } else {
    // Output as zip
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    for (const [type, items] of Object.entries(data)) {
      if (includes.includes(type) && items.length > 0) {
        for (const item of items) {
          const filename = `${item.id || item.name || 'item'}.json`;
          zip.file(`${type}/${filename}`, JSON.stringify(item, null, 2));
        }
      }
    }

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    await writeFile(out, buffer);
    console.log(`✓ Exported to ${out}`);
  }
}

