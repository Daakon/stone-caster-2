/**
 * Export Command
 * Exports authoring assets to a zip archive
 */

import type { CommandModule } from 'yargs';
import { createExportArchive } from '../lib/zip.js';

export const exportCommand: CommandModule = {
  command: 'export',
  describe: 'Export authoring assets to a zip archive',
  builder: (yargs) => {
    return yargs
      .option('out', {
        alias: 'o',
        type: 'string',
        description: 'Output file path (.zip) or directory (if --pretty)',
        demandOption: true,
      })
      .option('scope', {
        type: 'string',
        choices: ['story', 'all'],
        default: 'story',
        description: 'Export scope: story (by id) or all',
      })
      .option('id', {
        type: 'string',
        description: 'Story ID (required if scope=story)',
      })
      .option('templatesVersion', {
        type: 'number',
        description: 'Template version to pin (optional)',
      })
      .option('include', {
        type: 'string',
        description: 'Comma-separated list of asset types to include',
        default: 'worlds,rulesets,npcs,scenarios,graphs,templates,field_defs,modules,loadouts',
      })
      .option('pretty', {
        type: 'boolean',
        default: false,
        description: 'Output as unzipped folder instead of zip (for git storage)',
      });
  },
  handler: async (argv) => {
    try {
      const includes = (argv.include as string).split(',').map(s => s.trim());
      
      if (argv.scope === 'story' && !argv.id) {
        console.error('Error: --id is required when --scope=story');
        process.exit(1);
      }

      await createExportArchive({
        out: argv.out as string,
        scope: argv.scope as 'story' | 'all',
        storyId: argv.id as string | undefined,
        templatesVersion: argv.templatesVersion as number | undefined,
        includes,
        pretty: argv.pretty as boolean,
      });

      console.log('✓ Export completed successfully');
    } catch (error) {
      console.error('Export failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
};

