#!/usr/bin/env tsx

/**
 * Legacy Import Verification Script
 * Phase 7: Verify no legacy admin imports remain before cleanup
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

interface LegacyImport {
  file: string;
  line: number;
  import: string;
  legacyPath: string;
}

const LEGACY_PATHS = [
  // Old admin routes
  'src/pages/admin/awf-core-contracts-admin',
  'src/pages/admin/awf-rulesets-admin',
  'src/pages/admin/awf-games-admin',
  'src/pages/admin/awf-prompts-admin',
  
  // Old admin components
  'src/components/admin/AwfCoreContractsAdmin',
  'src/components/admin/AwfRulesetsAdmin',
  'src/components/admin/AwfGamesAdmin',
  'src/components/admin/AwfPromptsAdmin',
  'src/components/admin/AdminRouter', // Old router
  
  // Old admin services
  'src/services/awfAdminService',
  'src/services/awfCoreContractsService',
  'src/services/awfRulesetsService',
  'src/services/awfGamesService',
  'src/services/awfPromptsService',
  
  // Old admin routes (legacy)
  'src/routes/admin',
  'src/routes/awf-admin',
  
  // Old admin pages (legacy)
  'src/pages/admin/awf',
  'src/pages/admin/legacy',
  
  // Old admin components (legacy)
  'src/components/admin/legacy',
  'src/components/admin/awf',
  
  // Old admin services (legacy)
  'src/services/admin/legacy',
  'src/services/admin/awf'
];

const EXCLUDED_PATHS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  'test-results',
  'playwright-report'
];

async function findLegacyImports(): Promise<LegacyImport[]> {
  const legacyImports: LegacyImport[] = [];
  
  // Get all TypeScript/JavaScript files
  const files = await glob('**/*.{ts,tsx,js,jsx}', {
    cwd: process.cwd(),
    ignore: EXCLUDED_PATHS.map(path => `**/${path}/**`)
  });
  
  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Check for import statements
        const importMatch = line.match(/^import\s+.*from\s+['"]([^'"]+)['"]/);
        if (importMatch) {
          const importPath = importMatch[1];
          
          // Check if this import matches any legacy path
          for (const legacyPath of LEGACY_PATHS) {
            if (importPath.includes(legacyPath) || importPath.startsWith(legacyPath)) {
              legacyImports.push({
                file,
                line: index + 1,
                import: line.trim(),
                legacyPath
              });
            }
          }
        }
      });
    } catch (error) {
      console.warn(`Warning: Could not read file ${file}: ${error}`);
    }
  }
  
  return legacyImports;
}

async function findLegacyRoutes(): Promise<string[]> {
  const legacyRoutes: string[] = [];
  
  // Check for old route definitions
  const routeFiles = await glob('**/*.{ts,tsx}', {
    cwd: process.cwd(),
    ignore: EXCLUDED_PATHS.map(path => `**/${path}/**`)
  });
  
  for (const file of routeFiles) {
    try {
      const content = readFileSync(file, 'utf-8');
      
      // Check for old route patterns
      const oldRoutePatterns = [
        /\/admin\/awf/,
        /\/admin\/legacy/,
        /\/admin\/old/,
        /AdminRouter/,
        /AwfAdminRouter/
      ];
      
      for (const pattern of oldRoutePatterns) {
        if (pattern.test(content)) {
          legacyRoutes.push(file);
          break;
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not read file ${file}: ${error}`);
    }
  }
  
  return legacyRoutes;
}

async function main() {
  console.log('🔍 Checking for legacy admin imports...\n');
  
  const legacyImports = await findLegacyImports();
  const legacyRoutes = await findLegacyRoutes();
  
  if (legacyImports.length > 0) {
    console.error('❌ Found legacy imports that need to be removed:\n');
    
    legacyImports.forEach(importInfo => {
      console.error(`  📁 ${importInfo.file}:${importInfo.line}`);
      console.error(`     ${importInfo.import}`);
      console.error(`     Legacy path: ${importInfo.legacyPath}\n`);
    });
    
    process.exit(1);
  }
  
  if (legacyRoutes.length > 0) {
    console.error('❌ Found legacy routes that need to be removed:\n');
    
    legacyRoutes.forEach(route => {
      console.error(`  📁 ${route}`);
    });
    
    process.exit(1);
  }
  
  console.log('✅ No legacy imports found!');
  console.log('✅ No legacy routes found!');
  console.log('\n🎉 Legacy cleanup verification passed!');
}

if (require.main === module) {
  main().catch(console.error);
}

export { findLegacyImports, findLegacyRoutes };




