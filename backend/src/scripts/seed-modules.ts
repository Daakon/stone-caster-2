/**
 * Module Seeder
 * Imports module manifest files into the modules table
 * Run: pnpm tsx backend/src/scripts/seed-modules.ts
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { supabaseAdmin } from '../services/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ModuleManifest {
  id: string;
  base_id: string;
  version: number;
  title: string;
  description?: string;
  state_slice: string;
  ai_hints: string[];
  exports: {
    capabilities: string[];
    actions: Array<{
      type: string;
      payload_schema: string;
    }>;
  };
  slots: string[];
  extras?: Record<string, unknown>;
}

async function seedModules() {
  console.log('🚀 Seeding modules from manifest files...\n');

  // Find content/modules directory
  const possiblePaths = [
    join(__dirname, '../../../content/modules'),
    join(process.cwd(), 'content/modules'),
    join(process.cwd(), '../content/modules'),
  ];

  let modulesPath = '';
  for (const path of possiblePaths) {
    try {
      if (statSync(path).isDirectory()) {
        modulesPath = path;
        break;
      }
    } catch (e) {
      // Continue
    }
  }

  if (!modulesPath) {
    console.error('❌ Could not find content/modules directory');
    process.exit(1);
  }

  console.log(`📁 Found modules directory: ${modulesPath}\n`);

  // Scan for manifest files
  const moduleDirs = readdirSync(modulesPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const moduleDir of moduleDirs) {
    const manifestPath = join(modulesPath, moduleDir, 'manifest.v3.json');
    
    try {
      if (!statSync(manifestPath).isFile()) {
        console.log(`⚠️  Skipping ${moduleDir}: manifest.v3.json not found`);
        continue;
      }

      const manifestContent = readFileSync(manifestPath, 'utf-8');
      const manifest: ModuleManifest = JSON.parse(manifestContent);

      // Validate manifest
      if (!manifest.id || !manifest.base_id || !manifest.version || !manifest.title) {
        console.error(`❌ Invalid manifest in ${moduleDir}: missing required fields`);
        errors++;
        continue;
      }

      // Check if module already exists
      const { data: existing, error: checkError } = await supabaseAdmin
        .from('modules')
        .select('id, version')
        .eq('id', manifest.id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error(`❌ Error checking ${manifest.id}:`, checkError);
        errors++;
        continue;
      }

      if (existing) {
        console.log(`⏭️  Skipping ${manifest.id}: already exists (version ${existing.version})`);
        skipped++;
        continue;
      }

      // Insert module (params stored in manifest, loaded on demand)
      const { error: insertError } = await supabaseAdmin
        .from('modules')
        .insert({
          id: manifest.id,
          base_id: manifest.base_id,
          version: manifest.version,
          title: manifest.title,
          description: manifest.description || null,
          state_slice: manifest.state_slice,
          ai_hints: manifest.ai_hints,
          exports: manifest.exports,
          slots: manifest.slots,
          extras: manifest.extras || null,
          // Note: params.defaults and params.presets are stored in manifest file, loaded on demand
        });

      if (insertError) {
        console.error(`❌ Error inserting ${manifest.id}:`, insertError);
        errors++;
        continue;
      }

      console.log(`✅ Imported ${manifest.id} (${manifest.title})`);
      imported++;
    } catch (error) {
      console.error(`❌ Error processing ${moduleDir}:`, error);
      errors++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   ✅ Imported: ${imported}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);

  if (errors === 0) {
    console.log('\n🎉 Module seeding completed successfully!');
  } else {
    console.log('\n⚠️  Module seeding completed with errors');
    process.exit(1);
  }
}

seedModules().catch(console.error);

