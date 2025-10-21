// scripts/scan_secrets.ts
// Simple safety net to catch hardcoded API keys in source code
// Run with: npm run scan:secrets

import fs from 'fs';
import path from 'path';

const root = process.cwd();

// Regex patterns for common API key formats
const suspicious = [
  /AIza[0-9A-Za-z\-_]{35}/g,  // Google/Gemini API keys
  /sk-[0-9A-Za-z]{20,}/g,      // OpenAI API keys
];

let hits: Array<{file:string, line:number, match:string}> = [];

/**
 * Scan a single file for suspicious patterns
 */
function scan(file: string) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  
  lines.forEach((ln, i) => {
    suspicious.forEach(re => {
      const m = ln.match(re);
      if (m) {
        hits.push({ 
          file: path.relative(root, file), 
          line: i + 1, 
          match: m[0] 
        });
      }
    });
  });
}

/**
 * Recursively walk directory tree
 */
function walk(dir: string) {
  for (const name of fs.readdirSync(dir)) {
    // Skip git directories and node_modules
    if (name.startsWith('.git') || name === 'node_modules') continue;
    
    const p = path.join(dir, name);
    const stat = fs.statSync(p);
    
    if (stat.isDirectory()) {
      walk(p);
    } else if (/\.(ts|tsx|js|jsx|md|json)$/.test(name)) {
      scan(p);
    }
  }
}

// Execute scan
walk(root);

if (hits.length) {
  console.error('❌ Potential secrets found:');
  hits.forEach(h => {
    console.error(`  - ${h.file}:${h.line} -> ${h.match.slice(0, 6)}…`);
  });
  console.error('\n⚠️  Remove hardcoded secrets and use environment variables instead.');
  process.exit(1);
}

console.log('✓ OK: no obvious hardcoded API keys found.');

