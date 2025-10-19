#!/usr/bin/env node

/**
 * CI Guard: Check for file-based prompt references
 * 
 * This script scans the codebase for any references to file-based prompt loading
 * and fails the build if any are found. This ensures the database-only approach
 * is maintained.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Patterns that indicate file-based prompt usage
const FORBIDDEN_PATTERNS = [
  // File paths
  /AI API Prompts/i,
  /\.prompt\.json$/i,
  /adventure\.start\.prompt\.json$/i,
  /adventure\.prompt\.json$/i,
  /index\.prompt\.json$/i,
  
  // Class names and functions
  /FilesystemPromptAssembler/i,
  /PromptLoader/i,
  /PromptManifest/i,
  /getFileBasedTemplateForWorld/i,
  /loadPromptManifest/i,
  /loadPromptFiles/i,
  
  // File system operations for prompts
  /readFileSync.*prompt/i,
  /readFile.*prompt/i,
  /fs\.read.*prompt/i,
  
  // Template registry file-based functions
  /getTemplatesForWorld/i,
  /PromptTemplateMissingError/i,
];

// Directories and files to exclude from scanning
const EXCLUDE_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  'docs/archive',
  'docs/legacy-file-prompts',
  'backend/backups',
  'backend/coverage',
  'backend/dist',
  'backend/node_modules',
  'backend/docs',
  'backend/scripts',
  'backend/tests',
  'backend/TEMPLATE_REGISTRY_IMPLEMENTATION.md',
  'backend/src/prompts/README.md',
  'backend/src/prompts/runtime-guards.ts', // Contains patterns for detection
  'backend/scripts/check-file-prompt-references.js', // Self-reference
];

// File extensions to scan
const SCAN_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.md', '.json'];

/**
 * Check if a file should be excluded from scanning
 */
function shouldExcludeFile(filePath) {
  const relativePath = path.relative(process.cwd(), filePath);
  
  return EXCLUDE_DIRS.some(excludeDir => {
    // Check for exact directory matches
    if (relativePath.startsWith(excludeDir)) return true;
    if (relativePath.includes(`/${excludeDir}/`)) return true;
    if (relativePath.includes(`\\${excludeDir}\\`)) return true;
    
    // Check for specific file matches
    if (relativePath === excludeDir) return true;
    
    return false;
  });
}

/**
 * Check if a file has the right extension to scan
 */
function shouldScanFile(filePath) {
  return SCAN_EXTENSIONS.some(ext => filePath.endsWith(ext));
}

/**
 * Scan a file for forbidden patterns
 */
function scanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const violations = [];
    
    FORBIDDEN_PATTERNS.forEach((pattern, index) => {
      const matches = content.match(new RegExp(pattern.source, 'g'));
      if (matches) {
        matches.forEach(match => {
          const lines = content.substring(0, content.indexOf(match)).split('\n');
          const lineNumber = lines.length;
          
          violations.push({
            file: filePath,
            line: lineNumber,
            match: match,
            pattern: pattern.source
          });
        });
      }
    });
    
    return violations;
  } catch (error) {
    console.warn(`Warning: Could not read file ${filePath}: ${error.message}`);
    return [];
  }
}

/**
 * Recursively scan directory for files
 */
function scanDirectory(dirPath) {
  const violations = [];
  
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        if (!shouldExcludeFile(fullPath)) {
          violations.push(...scanDirectory(fullPath));
        }
      } else if (entry.isFile() && shouldScanFile(fullPath)) {
        if (!shouldExcludeFile(fullPath)) {
          violations.push(...scanFile(fullPath));
        }
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not scan directory ${dirPath}: ${error.message}`);
  }
  
  return violations;
}

/**
 * Main function
 */
function main() {
  console.log('🔍 Checking for file-based prompt references...\n');
  
  const startTime = Date.now();
  const violations = scanDirectory(process.cwd());
  const endTime = Date.now();
  
  console.log(`⏱️  Scan completed in ${endTime - startTime}ms\n`);
  
  if (violations.length === 0) {
    console.log('✅ No file-based prompt references found!');
    console.log('🎉 Database-only prompt system is properly implemented.');
    process.exit(0);
  }
  
  console.log(`❌ Found ${violations.length} file-based prompt reference(s):\n`);
  
  // Group violations by file
  const violationsByFile = violations.reduce((acc, violation) => {
    if (!acc[violation.file]) {
      acc[violation.file] = [];
    }
    acc[violation.file].push(violation);
    return acc;
  }, {});
  
  // Display violations
  Object.entries(violationsByFile).forEach(([file, fileViolations]) => {
    console.log(`📁 ${file}:`);
    fileViolations.forEach(violation => {
      console.log(`   Line ${violation.line}: "${violation.match}"`);
      console.log(`   Pattern: ${violation.pattern}`);
    });
    console.log('');
  });
  
  console.log('🚫 Build failed: File-based prompt references detected!');
  console.log('\n💡 To fix this:');
  console.log('   1. Remove or replace file-based prompt references');
  console.log('   2. Use DatabasePromptAssembler instead');
  console.log('   3. Ensure PROMPT_SOURCE_STRATEGY=database is set');
  console.log('   4. Move legacy files to docs/archive/legacy-file-prompts/');
  
  process.exit(1);
}

// Run the check
main();
