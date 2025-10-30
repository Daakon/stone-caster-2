#!/usr/bin/env tsx

/**
 * Legacy Cleanup Script
 * Phase 7: Remove legacy admin code in safe order
 */

import { readFileSync, writeFileSync, unlinkSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { glob } from 'glob';

interface CleanupStep {
  name: string;
  description: string;
  files: string[];
  action: 'delete' | 'update';
  backup?: boolean;
}

const CLEANUP_STEPS: CleanupStep[] = [
  {
    name: 'Remove Legacy Admin Pages',
    description: 'Remove old admin pages that are no longer needed',
    files: [
      'frontend/src/pages/admin/awf-core-contracts-admin.tsx',
      'frontend/src/pages/admin/awf-rulesets-admin.tsx',
      'frontend/src/pages/admin/awf-games-admin.tsx',
      'frontend/src/pages/admin/awf-prompts-admin.tsx'
    ],
    action: 'delete',
    backup: true
  },
  {
    name: 'Remove Legacy Admin Components',
    description: 'Remove old admin components',
    files: [
      'frontend/src/components/admin/AwfCoreContractsAdmin.tsx',
      'frontend/src/components/admin/AwfRulesetsAdmin.tsx',
      'frontend/src/components/admin/AwfGamesAdmin.tsx',
      'frontend/src/components/admin/AwfPromptsAdmin.tsx',
      'frontend/src/components/admin/AdminRouter.tsx' // Old router
    ],
    action: 'delete',
    backup: true
  },
  {
    name: 'Remove Legacy Admin Services',
    description: 'Remove old admin services',
    files: [
      'frontend/src/services/awfAdminService.ts',
      'frontend/src/services/awfCoreContractsService.ts',
      'frontend/src/services/awfRulesetsService.ts',
      'frontend/src/services/awfGamesService.ts',
      'frontend/src/services/awfPromptsService.ts'
    ],
    action: 'delete',
    backup: true
  },
  {
    name: 'Update App.tsx',
    description: 'Remove references to old AdminRouter',
    files: ['frontend/src/App.tsx'],
    action: 'update'
  },
  {
    name: 'Remove Legacy Test Files',
    description: 'Remove old admin test files',
    files: [
      'frontend/tests/admin/awf-core-contracts-admin.test.tsx',
      'frontend/tests/admin/awf-rulesets-admin.test.tsx',
      'frontend/tests/admin/awf-games-admin.test.tsx',
      'frontend/tests/admin/awf-prompts-admin.test.tsx',
      'frontend/tests/services/awfAdminService.test.ts'
    ],
    action: 'delete',
    backup: true
  }
];

async function backupFile(filePath: string): Promise<void> {
  if (!existsSync(filePath)) return;
  
  const backupPath = `${filePath}.backup.${Date.now()}`;
  const content = readFileSync(filePath, 'utf-8');
  writeFileSync(backupPath, content);
  console.log(`  📦 Backed up: ${filePath} → ${backupPath}`);
}

async function deleteFile(filePath: string): Promise<void> {
  if (!existsSync(filePath)) {
    console.log(`  ⚠️  File not found: ${filePath}`);
    return;
  }
  
  unlinkSync(filePath);
  console.log(`  🗑️  Deleted: ${filePath}`);
}

async function updateAppTsx(): Promise<void> {
  const appTsxPath = 'frontend/src/App.tsx';
  
  if (!existsSync(appTsxPath)) {
    console.log(`  ⚠️  App.tsx not found: ${appTsxPath}`);
    return;
  }
  
  const content = readFileSync(appTsxPath, 'utf-8');
  
  // Remove old AdminRouter import and usage
  const updatedContent = content
    .replace(/import.*AdminRouter.*from.*['"].*['"];?\n/g, '')
    .replace(/<AdminRouter\s*\/>/g, '')
    .replace(/<Route\s+path="\/admin.*?AdminRouter.*?\/>/g, '');
  
  if (content !== updatedContent) {
    writeFileSync(appTsxPath, updatedContent);
    console.log(`  ✏️  Updated: ${appTsxPath}`);
  } else {
    console.log(`  ✅ No changes needed: ${appTsxPath}`);
  }
}

async function executeStep(step: CleanupStep): Promise<void> {
  console.log(`\n🔧 ${step.name}`);
  console.log(`   ${step.description}`);
  
  if (step.action === 'delete') {
    for (const file of step.files) {
      if (step.backup) {
        await backupFile(file);
      }
      await deleteFile(file);
    }
  } else if (step.action === 'update') {
    for (const file of step.files) {
      if (file.includes('App.tsx')) {
        await updateAppTsx();
      }
    }
  }
}

async function verifyCleanup(): Promise<boolean> {
  console.log('\n🔍 Verifying cleanup...');
  
  let hasErrors = false;
  
  // Check if any legacy files still exist
  for (const step of CLEANUP_STEPS) {
    if (step.action === 'delete') {
      for (const file of step.files) {
        if (existsSync(file)) {
          console.error(`  ❌ Legacy file still exists: ${file}`);
          hasErrors = true;
        }
      }
    }
  }
  
  if (hasErrors) {
    console.error('\n❌ Cleanup verification failed!');
    return false;
  }
  
  console.log('✅ Cleanup verification passed!');
  return true;
}

async function main() {
  console.log('🧹 Starting legacy admin cleanup...\n');
  
  try {
    // Execute cleanup steps
    for (const step of CLEANUP_STEPS) {
      await executeStep(step);
    }
    
    // Verify cleanup
    const success = await verifyCleanup();
    
    if (success) {
      console.log('\n🎉 Legacy cleanup completed successfully!');
      console.log('\n📋 Next steps:');
      console.log('  1. Run tests to ensure nothing is broken');
      console.log('  2. Check that new admin routes work correctly');
      console.log('  3. Remove backup files when confident');
    } else {
      console.log('\n❌ Cleanup verification failed!');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { CLEANUP_STEPS, executeStep, verifyCleanup };












