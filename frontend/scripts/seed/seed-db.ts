/*
  Seed script: uses src/mock/*.json to populate a local/dev database.
  Run: pnpm tsx frontend/scripts/seed/seed-db.ts
  Set VITE_ALLOW_RUNTIME_MOCKS=1 if running through Vite toolchain to bypass alias guard.
*/

import fs from 'node:fs/promises';
import path from 'node:path';

async function readJSON(relativePath: string) {
  const filePath = path.resolve(process.cwd(), 'frontend', 'src', relativePath);
  const buf = await fs.readFile(filePath, 'utf8');
  return JSON.parse(buf);
}

async function main() {
  const worlds = await readJSON('mock/worlds.json');
  const stories = await readJSON('mock/adventures.json');
  const npcs = await readJSON('mock/characters.json');

  // TODO: Replace with actual admin/ingest API calls or Supabase client ops.
  // For now, just print counts so devs can wire their own ingestion.
  // eslint-disable-next-line no-console
  console.log('Seed preview:', {
    worlds: Array.isArray(worlds) ? worlds.length : 0,
    stories: Array.isArray(stories) ? stories.length : 0,
    npcs: Array.isArray(npcs) ? npcs.length : 0,
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed', err);
  process.exit(1);
});













