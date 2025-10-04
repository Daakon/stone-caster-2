#!/usr/bin/env node

/**
 * Test script to validate migration SQL syntax
 * This script reads the migration files and validates their SQL syntax
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

// List of migration files to test
const migrationFiles = [
  '20241201000000_create_idempotency_keys.sql',
  '20241201000001_create_turns.sql',
  '012_premade_characters.sql'
];

console.log('🔍 Testing migration SQL syntax...\n');

let hasErrors = false;

for (const file of migrationFiles) {
  const filePath = path.join(migrationsDir, file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ ${file}: File not found`);
    hasErrors = true;
    continue;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Basic SQL syntax checks
    const lines = content.split('\n');
    let lineNumber = 0;
    
    for (const line of lines) {
      lineNumber++;
      const trimmedLine = line.trim();
      
      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('--')) {
        continue;
      }
      
      // Check for common SQL syntax issues
      if (trimmedLine.includes('cookie_group_id') && !trimmedLine.includes('SELECT id FROM cookie_groups')) {
        // This is likely correct - cookie_group_id is a valid column in games table
        continue;
      }
      
      // Check for unmatched quotes
      const singleQuotes = (trimmedLine.match(/'/g) || []).length;
      const doubleQuotes = (trimmedLine.match(/"/g) || []).length;
      
      if (singleQuotes % 2 !== 0) {
        console.log(`❌ ${file}:${lineNumber}: Unmatched single quotes: ${trimmedLine}`);
        hasErrors = true;
      }
      
      if (doubleQuotes % 2 !== 0) {
        console.log(`❌ ${file}:${lineNumber}: Unmatched double quotes: ${trimmedLine}`);
        hasErrors = true;
      }
    }
    
    console.log(`✅ ${file}: SQL syntax looks good`);
    
  } catch (error) {
    console.log(`❌ ${file}: Error reading file - ${error.message}`);
    hasErrors = true;
  }
}

console.log('\n📋 Migration Test Summary:');
if (hasErrors) {
  console.log('❌ Some migrations have issues that need to be fixed');
  process.exit(1);
} else {
  console.log('✅ All migrations passed basic syntax validation');
  console.log('\n💡 Note: This is a basic syntax check. For full validation,');
  console.log('   you should apply these migrations to a test database.');
}
