#!/usr/bin/env node
/**
 * Design-token guard for the frontend.
 *
 * Fails when a file under frontend/src gains hardcoded colours: hex/rgb/hsl
 * literals in TS/TSX, or Tailwind palette classes such as `text-cyan-400`,
 * `bg-zinc-800` or `from-purple-900`. Colours must come from
 * docs/design/play-redesign/tokens.css (shadcn variables, --sc-* properties,
 * or Tailwind theme entries that read them).
 *
 * Existing violations are recorded per file in
 * scripts/design-tokens-baseline.json. A file may never go above its baseline,
 * and new files must be clean. Fixing violations lowers the baseline on the next
 * `--update-baseline`.
 *
 * Usage:
 *   node scripts/check-design-tokens.mjs                  # check against baseline
 *   node scripts/check-design-tokens.mjs --list           # print every violation
 *   node scripts/check-design-tokens.mjs --update-baseline  # only after reducing counts
 *   node scripts/check-design-tokens.mjs --strict <dir>   # zero tolerance under <dir>
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'frontend', 'src');
const BASELINE = join(ROOT, 'scripts', 'design-tokens-baseline.json');
const args = process.argv.slice(2);
const LIST = args.includes('--list');
const UPDATE = args.includes('--update-baseline');
const strictIdx = args.indexOf('--strict');
const STRICT_DIR = strictIdx >= 0 ? args[strictIdx + 1] : null;

const SKIP = [/\.test\.tsx?$/, /\.spec\.tsx?$/, /__tests__/, /fixtures?\//, /[\\/]mock[\\/]/, /[\\/]archive[\\/]/, /index\.css$/];
const PALETTE = '(?:slate|zinc|gray|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)';
const PREFIX = '(?:text|bg|border|border-[trblxy]|from|via|to|ring|ring-offset|fill|stroke|outline|decoration|divide|placeholder|caret|accent|shadow)';
const RULES = [
  { id: 'tailwind-palette', re: new RegExp(`\\b${PREFIX}-${PALETTE}-(?:50|[1-9]00|950)(?:\\/\\d+)?\\b`, 'g') },
  { id: 'hex', re: /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b(?![\w-])/g, tsOnly: true },
  { id: 'rgb-hsl', re: /\b(?:rgba?|hsla?)\(\s*\d/g, tsOnly: true },
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { if (name !== 'node_modules') walk(p, out); }
    else if (/\.(tsx?|css)$/.test(name)) out.push(p);
  }
  return out;
}

function scan(file) {
  const rel = relative(ROOT, file).split(sep).join('/');
  if (SKIP.some((r) => r.test(rel))) return { rel, hits: [] };
  const text = readFileSync(file, 'utf8');
  const isTs = /\.tsx?$/.test(file);
  const hits = [];
  text.split('\n').forEach((line, i) => {
    if (/design-tokens-ignore/.test(line)) return;
    for (const rule of RULES) {
      if (rule.tsOnly && !isTs) continue;
      if (rule.id === 'hex' && /(?:href|url|#[a-z]+-|&#)/i.test(line) && !/['"`]#[0-9a-fA-F]{3,8}['"`]/.test(line)) continue;
      for (const m of line.matchAll(rule.re)) hits.push({ line: i + 1, rule: rule.id, match: m[0] });
    }
  });
  return { rel, hits };
}

if (!existsSync(SRC)) { console.error('Run from the repo root (frontend/src not found).'); process.exit(2); }
const results = walk(SRC).map(scan).filter((r) => r.hits.length);
const counts = Object.fromEntries(results.map((r) => [r.rel, r.hits.length]));

if (UPDATE) {
  writeFileSync(BASELINE, JSON.stringify({ note: 'Per-file counts of hardcoded colours. Only ever lower these.', files: counts }, null, 2) + '\n');
  console.log(`Baseline written: ${results.length} files, ${Object.values(counts).reduce((a, b) => a + b, 0)} violations.`);
  process.exit(0);
}

const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')).files ?? {} : {};
let failed = false;
for (const r of results) {
  const strict = STRICT_DIR && r.rel.startsWith(STRICT_DIR.replace(/\\/g, '/'));
  const allowed = strict ? 0 : baseline[r.rel] ?? 0;
  if (r.hits.length > allowed || LIST) {
    if (r.hits.length > allowed) failed = true;
    console.log(`${r.hits.length > allowed ? 'FAIL' : 'info'} ${r.rel}: ${r.hits.length} (allowed ${allowed})`);
    if (r.hits.length > allowed || LIST) for (const h of r.hits) console.log(`   ${h.line}: ${h.rule} ${h.match}`);
  }
}
const total = Object.values(counts).reduce((a, b) => a + b, 0);
const base = Object.values(baseline).reduce((a, b) => a + b, 0);
console.log(`${failed ? 'Design token check failed.' : 'Design token check passed.'} ${total} hardcoded colours remain (baseline ${base}). Use tokens from docs/design/play-redesign/tokens.css.`);
process.exit(failed ? 1 : 0);
