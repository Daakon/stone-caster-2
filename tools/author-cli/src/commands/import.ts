/**
 * Import Command
 * Imports authoring assets from a zip archive
 */

import type { CommandModule } from 'yargs';
import { importArchive } from '../lib/import.js';

export const importCommand: CommandModule = {
  command: 'import',
  describe: 'Import authoring assets from a zip archive',
  builder: (yargs) => {
    return yargs
      .option('in', {
        alias: 'i',
        type: 'string',
        description: 'Input file path (.zip) or directory',
        demandOption: true,
      })
      .option('mode', {
        type: 'string',
        choices: ['dry', 'apply'],
        default: 'dry',
        description: 'Import mode: dry (preview) or apply (execute)',
      })
      .option('conflict', {
        type: 'string',
        choices: ['skip', 'replace', 'merge'],
        default: 'skip',
        description: 'Conflict resolution policy',
      })
      .option('scope', {
        type: 'string',
        choices: ['story', 'all'],
        default: 'story',
        description: 'Import scope',
      })
      .option('id', {
        type: 'string',
        description: 'Story ID (optional, for scoped import)',
      })
      .option('allow-prod', {
        type: 'boolean',
        default: false,
        description: 'Allow import to production database',
      });
  },
  handler: async (argv) => {
    try {
      // Check production guardrail
      const isProd = process.env.NODE_ENV === 'production' || 
                     process.env.DATABASE_URL?.includes('prod');
      
      if (isProd && !argv['allow-prod']) {
        console.error('Error: Import to production requires --allow-prod flag');
        process.exit(1);
      }

      const result = await importArchive({
        input: argv.in as string,
        mode: argv.mode as 'dry' | 'apply',
        conflict: argv.conflict as 'skip' | 'replace' | 'merge',
        scope: argv.scope as 'story' | 'all',
        storyId: argv.id as string | undefined,
      });

      if (argv.mode === 'dry') {
        console.log('\n=== DRY RUN PLAN ===');
        console.log(`Created: ${result.created.length}`);
        console.log(`Updated: ${result.updated.length}`);
        console.log(`Skipped: ${result.skipped.length}`);
        console.log('\nRun with --mode=apply to execute');
      } else {
        console.log('\n=== IMPORT COMPLETE ===');
        console.log(`Created: ${result.created.length}`);
        console.log(`Updated: ${result.updated.length}`);
        console.log(`Skipped: ${result.skipped.length}`);
        if (result.warnings.length > 0) {
          console.log('\nWarnings:');
          result.warnings.forEach(w => console.log(`  - ${w}`));
        }
      }
    } catch (error) {
      console.error('Import failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
};

