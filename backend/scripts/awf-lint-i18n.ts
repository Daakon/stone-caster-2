#!/usr/bin/env tsx

/**
 * AWF i18n Linter CLI
 * Phase 12: Multilingual Support - CLI for localization linting
 */

import { runI18nLinter, LintOptions } from '../src/authoring/awf-lint-i18n.js';

async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  let locale = 'en-US';
  let paths: string[] = [];
  let strict = false;
  let outputFile: string | undefined;
  let allLocales = false;
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--locale':
        locale = args[++i];
        break;
      case '--paths':
        const pathArg = args[++i];
        paths = pathArg.split(',').map(p => p.trim());
        break;
      case '--strict':
        strict = true;
        break;
      case '--output':
        outputFile = args[++i];
        break;
      case '--all-locales':
        allLocales = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        } else {
          paths.push(arg);
        }
        break;
    }
  }
  
  // Default paths if none specified
  if (paths.length === 0) {
    paths = [
      'backend/src/**/*localization*.json',
      'backend/src/**/*glossary*.json',
      'backend/src/**/*rules*.json',
    ];
  }
  
  // Generate output filename if not specified
  if (!outputFile) {
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    outputFile = `awf-i18n-${timestamp}.json`;
  }
  
  try {
    if (allLocales) {
      // Lint all supported locales
      const supportedLocales = ['en-US', 'fr-FR', 'es-ES'];
      
      for (const targetLocale of supportedLocales) {
        console.log(`\n=== Linting locale: ${targetLocale} ===`);
        
        const options: LintOptions = {
          locale: targetLocale,
          paths,
          strict,
          outputFile: outputFile.replace('.json', `-${targetLocale}.json`),
        };
        
        await runI18nLinter(options);
      }
    } else {
      // Lint single locale
      const options: LintOptions = {
        locale,
        paths,
        strict,
        outputFile,
      };
      
      await runI18nLinter(options);
    }
  } catch (error) {
    console.error('[i18n Linter] Error:', error);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
AWF i18n Linter - Localization quality checker

Usage:
  tsx backend/scripts/awf-lint-i18n.ts [options] [paths...]

Options:
  --locale <locale>     Target locale (default: en-US)
  --paths <paths>       Comma-separated file paths/patterns
  --strict              Exit with error code on any issues
  --output <file>       Output report file (default: awf-i18n-YYYYMMDD.json)
  --all-locales         Lint all supported locales
  --help                Show this help message

Examples:
  # Lint French localization files
  tsx backend/scripts/awf-lint-i18n.ts --locale fr-FR --paths "**/*fr*.json"
  
  # Lint all locales in strict mode
  tsx backend/scripts/awf-lint-i18n.ts --all-locales --strict
  
  # Lint specific files with custom output
  tsx backend/scripts/awf-lint-i18n.ts --locale es-ES --output custom-report.json file1.json file2.json

Supported locales:
  - en-US (English)
  - fr-FR (French)
  - es-ES (Spanish)

Checks performed:
  - Placeholder integrity ({npc}, {location}, etc.)
  - Sentence length bounds per locale
  - Mixed language detection
  - Mechanics leakage (forbidden terms)
  - Glossary conformity
  - JSON structure validation
`);
}

// Run the CLI
main().catch(error => {
  console.error('[i18n Linter] Fatal error:', error);
  process.exit(1);
});


