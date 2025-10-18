/**
 * Dump AWF Bundle Script
 * Phase 3: Bundle Assembler - Development script for dumping sample bundles
 */

import { assembleBundle } from '../src/assemblers/awf-bundle-assembler.js';
import { stableStringify } from '../src/utils/awf-bundle-helpers.js';
import fs from 'fs';
import path from 'path';

interface ScriptArgs {
  session: string;
  text: string;
  output?: string;
}

/**
 * Parse command line arguments
 */
function parseArgs(): ScriptArgs {
  const args = process.argv.slice(2);
  const parsed: Partial<ScriptArgs> = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];
    
    switch (arg) {
      case '--session':
        if (nextArg) {
          parsed.session = nextArg;
          i++; // Skip next argument
        }
        break;
      case '--text':
        if (nextArg) {
          parsed.text = nextArg;
          i++; // Skip next argument
        }
        break;
      case '--output':
        if (nextArg) {
          parsed.output = nextArg;
          i++; // Skip next argument
        }
        break;
      default:
        if (arg.startsWith('--')) {
          console.warn(`Unknown argument: ${arg}`);
        }
        break;
    }
  }
  
  if (!parsed.session || !parsed.text) {
    console.error('Usage: npm run dump-awf-bundle -- --session <sessionId> --text "<player input>" [--output <outputPath>]');
    process.exit(1);
  }
  
  return parsed as ScriptArgs;
}

/**
 * Ensure output directory exists
 */
function ensureOutputDir(outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Main script execution
 */
async function main(): Promise<void> {
  try {
    const args = parseArgs();
    
    console.log('🚀 AWF Bundle Dump Script');
    console.log('========================');
    console.log(`Session ID: ${args.session}`);
    console.log(`Input Text: "${args.text}"`);
    
    // Assemble the bundle
    console.log('\n📦 Assembling bundle...');
    const startTime = Date.now();
    
    const result = await assembleBundle({
      sessionId: args.session,
      inputText: args.text,
    });
    
    const assemblyTime = Date.now() - startTime;
    
    // Generate output filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = args.output || path.join('/tmp', 'awf-bundles', `${args.session}-${timestamp}.json`);
    
    // Ensure output directory exists
    ensureOutputDir(outputPath);
    
    // Write bundle to file
    console.log(`\n💾 Writing bundle to: ${outputPath}`);
    const bundleJson = stableStringify(result.bundle);
    fs.writeFileSync(outputPath, bundleJson, 'utf8');
    
    // Print metrics
    console.log('\n📊 Bundle Metrics:');
    console.log('==================');
    console.log(`Byte Size: ${result.metrics.byteSize.toLocaleString()} bytes`);
    console.log(`Estimated Tokens: ${result.metrics.estimatedTokens.toLocaleString()}`);
    console.log(`NPC Count: ${result.metrics.npcCount}`);
    console.log(`Slice Count: ${result.metrics.sliceCount}`);
    console.log(`Build Time: ${result.metrics.buildTime}ms`);
    console.log(`Assembly Time: ${assemblyTime}ms`);
    
    // Print bundle structure summary
    console.log('\n🏗️  Bundle Structure:');
    console.log('====================');
    const bundle = result.bundle.awf_bundle;
    console.log(`Meta: engine=${bundle.meta.engine_version}, world=${bundle.meta.world}, adventure=${bundle.meta.adventure}`);
    console.log(`Turn: ${bundle.meta.turn_id} (first: ${bundle.meta.is_first_turn})`);
    console.log(`Contract: ${bundle.contract.id} v${bundle.contract.version}`);
    console.log(`World: ${bundle.world.ref} (${bundle.world.slice.length} slices)`);
    console.log(`Adventure: ${bundle.adventure.ref} (${bundle.adventure.slice.length} slices)`);
    console.log(`NPCs: ${bundle.npcs.count} active`);
    console.log(`Player: ${bundle.player.name}`);
    console.log(`Input: "${bundle.input.text}"`);
    
    if (bundle.adventure.start_hint) {
      console.log(`Start Hint: ${bundle.adventure.start_hint.scene} - ${bundle.adventure.start_hint.description}`);
    }
    
    // Print slice details
    console.log('\n🔍 Slice Details:');
    console.log('=================');
    console.log(`World Slices: ${bundle.world.slice.join(', ')}`);
    console.log(`Adventure Slices: ${bundle.adventure.slice.join(', ')}`);
    
    // Print NPC details
    if (bundle.npcs.active.length > 0) {
      console.log('\n👥 Active NPCs:');
      console.log('================');
      bundle.npcs.active.forEach((npc, index) => {
        console.log(`${index + 1}. ${npc.name} (${npc.role}) - ${npc.description}`);
        if (npc.location) {
          console.log(`   Location: ${npc.location}`);
        }
      });
    }
    
    // Print game state summary
    console.log('\n🎮 Game State Summary:');
    console.log('======================');
    const hotKeys = Object.keys(bundle.game_state.hot);
    const warmKeys = Object.keys(bundle.game_state.warm);
    const coldKeys = Object.keys(bundle.game_state.cold);
    console.log(`Hot State: ${hotKeys.length} keys (${hotKeys.slice(0, 3).join(', ')}${hotKeys.length > 3 ? '...' : ''})`);
    console.log(`Warm State: ${warmKeys.length} keys (${warmKeys.slice(0, 3).join(', ')}${warmKeys.length > 3 ? '...' : ''})`);
    console.log(`Cold State: ${coldKeys.length} keys (${coldKeys.slice(0, 3).join(', ')}${coldKeys.length > 3 ? '...' : ''})`);
    
    console.log('\n✅ Bundle dump completed successfully!');
    console.log(`📁 Output file: ${outputPath}`);
    
  } catch (error) {
    console.error('\n❌ Bundle dump failed:');
    console.error(error);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}


