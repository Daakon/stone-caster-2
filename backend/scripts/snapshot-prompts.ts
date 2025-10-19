#!/usr/bin/env tsx

/**
 * Snapshot script to export current prompt/layer files to a dated backup directory
 * This script creates a timestamped backup of all prompt and layer files before AWF bundle migration
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface SnapshotOptions {
  sourceDirs: string[];
  outputDir: string;
  timestamp: string;
}

/**
 * Create a timestamped backup directory
 */
function createBackupDir(baseDir: string, timestamp: string): string {
  const backupDir = join(baseDir, 'pre-awf', timestamp);
  
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }
  
  return backupDir;
}

/**
 * Copy a file to the backup directory, preserving directory structure
 */
function copyFileToBackup(sourcePath: string, backupDir: string, relativePath: string): void {
  const targetPath = join(backupDir, relativePath);
  const targetDir = dirname(targetPath);
  
  // Create target directory if it doesn't exist
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }
  
  // Copy file
  const content = readFileSync(sourcePath, 'utf-8');
  writeFileSync(targetPath, content, 'utf-8');
  
  console.log(`  ✓ Copied: ${relativePath}`);
}

/**
 * Recursively scan directory and copy files
 */
function scanAndCopyDirectory(sourceDir: string, backupDir: string, basePath: string = ''): void {
  const fullSourcePath = join(__dirname, '..', sourceDir);
  
  if (!existsSync(fullSourcePath)) {
    console.log(`  ⚠ Skipping non-existent directory: ${sourceDir}`);
    return;
  }
  
  const stats = statSync(fullSourcePath);
  if (!stats.isDirectory()) {
    console.log(`  ⚠ Skipping non-directory: ${sourceDir}`);
    return;
  }
  
  console.log(`  📁 Scanning: ${sourceDir}`);
  
  // Get all files recursively
  const files = getAllFiles(fullSourcePath);
  
  for (const file of files) {
    const relativePath = file.replace(fullSourcePath, '').replace(/^[/\\]/, '');
    const targetPath = join(basePath, relativePath);
    
    copyFileToBackup(file, backupDir, targetPath);
  }
}

/**
 * Get all files in a directory recursively
 */
function getAllFiles(dirPath: string): string[] {
  const files: string[] = [];
  
  function scanDir(currentPath: string): void {
    const items = readdirSync(currentPath, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = join(currentPath, item.name);
      
      if (item.isDirectory()) {
        scanDir(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }
  
  scanDir(dirPath);
  return files;
}

/**
 * Main snapshot function
 */
function createSnapshot(options: SnapshotOptions): void {
  console.log('🔄 Creating prompt/layer snapshot...');
  console.log(`📅 Timestamp: ${options.timestamp}`);
  console.log(`📁 Output directory: ${options.outputDir}`);
  
  // Create backup directory
  const backupDir = createBackupDir(options.outputDir, options.timestamp);
  console.log(`📂 Created backup directory: ${backupDir}`);
  
  // Copy each source directory
  for (const sourceDir of options.sourceDirs) {
    scanAndCopyDirectory(sourceDir, backupDir);
  }
  
  // Create a manifest file with snapshot info
  const manifest = {
    timestamp: options.timestamp,
    created: new Date().toISOString(),
    sourceDirs: options.sourceDirs,
    backupDir: backupDir,
    description: 'Pre-AWF bundle migration snapshot of prompt and layer files'
  };
  
  const manifestPath = join(backupDir, 'snapshot-manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  
  console.log('✅ Snapshot completed successfully!');
  console.log(`📄 Manifest: ${manifestPath}`);
  console.log(`📂 Backup location: ${backupDir}`);
}

/**
 * Main execution
 */
function main(): void {
  console.log('🔄 Starting prompt/layer snapshot...');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputDir = join(__dirname, '..', 'backups');
  
  console.log(`📅 Timestamp: ${timestamp}`);
  console.log(`📁 Output directory: ${outputDir}`);
  
  const options: SnapshotOptions = {
    sourceDirs: [
      'AI API Prompts',
      'src/prompts'
    ],
    outputDir,
    timestamp
  };
  
  try {
    createSnapshot(options);
  } catch (error) {
    console.error('❌ Snapshot failed:', error);
    process.exit(1);
  }
}

// Always run main when script is executed
main();

export { createSnapshot, SnapshotOptions };
