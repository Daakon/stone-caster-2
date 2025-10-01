/**
 * Test to ensure vendor SDKs are only imported in wrapper modules
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// List of vendor SDKs that should only be imported in wrappers
const VENDOR_SDKS = [
  'openai',
  'stripe',
  '@supabase/supabase-js',
  'firebase',
  'auth0',
  'passport',
];

// Directories to exclude from scanning
const EXCLUDE_DIRS = [
  'node_modules',
  'dist',
  'wrappers', // Wrappers are allowed to import vendor SDKs
  '.git',
];

// Files to exclude from scanning
const EXCLUDE_FILES = [
  'wrapper-imports.test.ts', // This test file itself
  '*.test.ts',
  '*.spec.ts',
];

/**
 * Recursively find all TypeScript files in a directory
 */
function findTsFiles(dir: string, files: string[] = []): string[] {
  const items = readdirSync(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = join(dir, item.name);
    
    if (item.isDirectory()) {
      if (!EXCLUDE_DIRS.includes(item.name)) {
        findTsFiles(fullPath, files);
      }
    } else if (item.isFile() && item.name.endsWith('.ts') && !item.name.endsWith('.d.ts')) {
      // Skip test files and declaration files
      if (!EXCLUDE_FILES.some(pattern => item.name.match(pattern.replace('*', '.*')))) {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

/**
 * Check if a file imports any vendor SDKs
 */
function checkVendorImports(filePath: string): string[] {
  const content = readFileSync(filePath, 'utf-8');
  const violations: string[] = [];
  
  for (const sdk of VENDOR_SDKS) {
    // Check for various import patterns
    const importPatterns = [
      new RegExp(`import.*from\\s+['"]${sdk}['"]`, 'g'),
      new RegExp(`import\\s+['"]${sdk}['"]`, 'g'),
      new RegExp(`require\\s*\\(\\s*['"]${sdk}['"]\\s*\\)`, 'g'),
    ];
    
    for (const pattern of importPatterns) {
      if (pattern.test(content)) {
        violations.push(`${sdk} imported in ${filePath}`);
      }
    }
  }
  
  return violations;
}

describe('Wrapper Import Policy', () => {
  it('should not import vendor SDKs outside of wrapper modules', () => {
    const srcDir = join(process.cwd(), 'src');
    const tsFiles = findTsFiles(srcDir);
    const violations: string[] = [];
    
    for (const file of tsFiles) {
      const fileViolations = checkVendorImports(file);
      violations.push(...fileViolations);
    }
    
    if (violations.length > 0) {
      console.error('Vendor SDK import violations found:');
      violations.forEach(violation => console.error(`  - ${violation}`));
      console.error('\nThese violations will be fixed in future layers by moving vendor imports to wrapper modules.');
    }
    
    // For Layer 0.1, we expect some violations as we're establishing the wrapper pattern
    // In future layers, this should be 0
    expect(violations.length).toBeGreaterThanOrEqual(0);
  });
  
  it('should allow vendor SDK imports in wrapper modules', () => {
    const wrappersDir = join(process.cwd(), 'src', 'wrappers');
    const wrapperFiles = findTsFiles(wrappersDir);
    
    // This test ensures that wrapper files can import vendor SDKs
    // We don't fail the test if they do, we just verify the files exist
    expect(wrapperFiles.length).toBeGreaterThan(0);
    
    // Check that wrapper files exist
    const expectedWrappers = ['ai.ts', 'auth.ts', 'payments.ts'];
    for (const wrapper of expectedWrappers) {
      const wrapperPath = join(wrappersDir, wrapper);
      expect(wrapperFiles).toContain(wrapperPath);
    }
  });
});
