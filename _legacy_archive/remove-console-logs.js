/**
 * Script to remove all console statements from frontend and backend
 * Run with: node remove-console-logs.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Patterns to match console statements
const consolePatterns = [
  // Match console.log, console.error, console.warn, console.info, console.debug
  // Including multi-line statements
  /console\.(log|error|warn|info|debug)\([^)]*\);?\s*/g,
  // Match console statements with objects/spread
  /console\.(log|error|warn|info|debug)\([^)]*(?:\{[^}]*\}[^)]*)*\);?\s*/g,
];

function removeConsoleStatements(content) {
  let modified = content;
  
  // Remove single-line console statements
  modified = modified.replace(/^\s*console\.(log|error|warn|info|debug)\([^;]*\);?\s*$/gm, '');
  
  // Remove console statements that span multiple lines (more complex)
  modified = modified.replace(/console\.(log|error|warn|info|debug)\([^)]*(?:\{[^}]*\}[^)]*)*\)[^;]*;?\s*/g, '');
  
  // Remove console statements followed by newline
  modified = modified.replace(/^\s*console\.(log|error|warn|info|debug)\([^\n]*\);?\s*\n/gm, '');
  
  // Clean up multiple consecutive empty lines
  modified = modified.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  return modified;
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let modified = content;
    
    // Remove all console statements
    modified = removeConsoleStatements(modified);
    
    // Only write if content changed
    if (modified !== originalContent) {
      fs.writeFileSync(filePath, modified, 'utf8');
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

function walkDir(dir, extensions = ['.ts', '.tsx', '.js', '.jsx']) {
  let files = [];
  const list = fs.readdirSync(dir);
  
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and other build directories
      if (!['node_modules', '.git', 'dist', 'build', '.next'].includes(file)) {
        files = files.concat(walkDir(filePath, extensions));
      }
    } else {
      const ext = path.extname(file);
      if (extensions.includes(ext)) {
        files.push(filePath);
      }
    }
  });
  
  return files;
}

// Main execution
const frontendDir = path.join(__dirname, 'frontend', 'src');
const backendDir = path.join(__dirname, 'backend', 'src');

console.log('Scanning for files...');
const frontendFiles = walkDir(frontendDir, ['.ts', '.tsx']);
const backendFiles = walkDir(backendDir, ['.ts', '.tsx']);

console.log(`Found ${frontendFiles.length} frontend files and ${backendFiles.length} backend files`);

let modifiedCount = 0;
frontendFiles.forEach(file => {
  if (processFile(file)) {
    modifiedCount++;
    console.log(`Modified: ${file}`);
  }
});

backendFiles.forEach(file => {
  if (processFile(file)) {
    modifiedCount++;
    console.log(`Modified: ${file}`);
  }
});

console.log(`\nDone! Modified ${modifiedCount} files.`);

