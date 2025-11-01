#!/usr/bin/env node
/**
 * CLI script for previewing prompts
 * Usage: pnpm tsx backend/scripts/prompt-preview.ts --game <uuid> [options]
 */

import { PromptPreviewService } from '../src/services/prompt-preview.service.js';

interface CliArgs {
  game?: string;
  mode?: 'start' | 'turn';
  turn?: number;
  message?: string;
  model?: string;
  budget?: number;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {};
  
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    
    if (arg === '--game' && i + 1 < process.argv.length) {
      args.game = process.argv[++i];
    } else if (arg === '--mode' && i + 1 < process.argv.length) {
      const mode = process.argv[++i];
      if (mode === 'start' || mode === 'turn') {
        args.mode = mode;
      } else {
        console.error(`Invalid mode: ${mode}. Must be 'start' or 'turn'`);
        process.exit(1);
      }
    } else if (arg === '--turn' && i + 1 < process.argv.length) {
      args.turn = parseInt(process.argv[++i], 10);
    } else if (arg === '--message' && i + 1 < process.argv.length) {
      args.message = process.argv[++i];
    } else if (arg === '--model' && i + 1 < process.argv.length) {
      args.model = process.argv[++i];
    } else if (arg === '--budget' && i + 1 < process.argv.length) {
      args.budget = parseInt(process.argv[++i], 10);
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: pnpm tsx backend/scripts/prompt-preview.ts --game <uuid> [options]

Options:
  --game <uuid>        Game ID (required)
  --mode start|turn    Preview mode (default: start)
  --turn <number>      Turn number (required for mode=turn)
  --message <text>     Player message (optional)
  --model <model>      Override model (optional)
  --budget <number>    Override token budget (optional)
  --help               Show this help message

Examples:
  pnpm tsx backend/scripts/prompt-preview.ts --game abc-123 --mode start
  pnpm tsx backend/scripts/prompt-preview.ts --game abc-123 --mode turn --turn 2 --message "Hello"
      `);
      process.exit(0);
    }
  }
  
  return args;
}

async function main() {
  const args = parseArgs();
  
  if (!args.game) {
    console.error('Error: --game <uuid> is required');
    console.error('Use --help for usage information');
    process.exit(1);
  }
  
  const mode = args.mode || 'start';
  
  if (mode === 'turn' && !args.turn) {
    console.error('Error: --turn <number> is required when --mode=turn');
    process.exit(1);
  }
  
  try {
    const previewService = new PromptPreviewService();
    const result = await previewService.preview({
      gameId: args.game,
      mode,
      turnNumber: args.turn,
      playerMessage: args.message,
      model: args.model,
      budgetTokens: args.budget,
    });
    
    if (!result.ok) {
      console.error(`Error: ${result.error?.message || 'Preview failed'}`);
      if (result.error?.code) {
        console.error(`Code: ${result.error.code}`);
      }
      if (result.error?.stack) {
        console.error(`\nStack:\n${result.error.stack}`);
      }
      process.exit(1);
    }
    
    if (!result.data) {
      console.error('Error: No data returned');
      process.exit(1);
    }
    
    // Print report
    console.log('\n=== Prompt Preview ===\n');
    console.log(`Phase: ${result.data.meta.phase}`);
    console.log(`Model: ${result.data.meta.model}`);
    console.log(`Token Est: ${result.data.meta.tokenEst.input} / ${result.data.meta.tokenEst.budget} (${(result.data.meta.tokenEst.pct * 100).toFixed(1)}%)`);
    console.log(`\nIncluded (${result.data.meta.included.length}):`);
    result.data.meta.included.forEach(item => {
      console.log(`  - ${item}`);
    });
    
    if (result.data.meta.dropped.length > 0) {
      console.log(`\nDropped (${result.data.meta.dropped.length}):`);
      result.data.meta.dropped.forEach(item => {
        console.log(`  - ${item}`);
      });
    }
    
    if (result.data.meta.policy && result.data.meta.policy.length > 0) {
      console.log(`\nPolicy Actions:`);
      result.data.meta.policy.forEach(action => {
        console.log(`  - ${action}`);
      });
    }
    
    console.log(`\nPieces (${result.data.pieces.length}):`);
    result.data.pieces.forEach(piece => {
      console.log(`  - ${piece.scope}:${piece.slug} (${piece.tokens} tokens${piece.version ? ` @${piece.version}` : ''})`);
    });
    
    console.log(`\nPrompt (first 400 chars):`);
    console.log('─'.repeat(80));
    const preview = result.data.prompt.substring(0, 400);
    console.log(preview);
    if (result.data.prompt.length > 400) {
      console.log(`... (${result.data.prompt.length - 400} more characters)`);
    }
    console.log('─'.repeat(80));
    
    console.log(`\nContext:`);
    console.log(`  Game ID: ${result.data.context.gameId}`);
    if (result.data.context.turnNumber) {
      console.log(`  Turn Number: ${result.data.context.turnNumber}`);
    }
    if (result.data.context.playerMessage) {
      console.log(`  Player Message: ${result.data.context.playerMessage}`);
    }
    
    console.log('\n✅ Preview completed successfully\n');
    process.exit(0);
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

main().catch(console.error);

