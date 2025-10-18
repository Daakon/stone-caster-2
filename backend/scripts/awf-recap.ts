#!/usr/bin/env tsx

import { RecapService } from '../src/services/recap.service.js';

const args = process.argv.slice(2);

const recapService = new RecapService();

async function generateRecap() {
  const sessionIndex = args.indexOf('--session');
  const lastTurnsIndex = args.indexOf('--lastTurns');
  
  if (sessionIndex === -1 || !args[sessionIndex + 1]) {
    console.error('Usage: yarn awf:recap --session <id> [--lastTurns <number>]');
    process.exit(1);
  }
  
  const sessionId = args[sessionIndex + 1];
  const lastTurns = lastTurnsIndex !== -1 ? parseInt(args[lastTurnsIndex + 1]) : undefined;
  
  try {
    const recap = await recapService.generateRecap({
      session_id: sessionId,
      lastTurns
    });
    
    console.log('📖 Session Recap');
    console.log('================');
    console.log('');
    console.log('Recap Text:');
    console.log(recap.recapTxt);
    console.log('');
    console.log('Objectives:');
    for (const objective of recap.objectives) {
      console.log(`- ${objective.name} (${objective.status})`);
    }
    console.log('');
    console.log('Source Information:');
    console.log(`- Pins used: ${recap.source.pinsUsed.join(', ') || 'None'}`);
    console.log(`- Turns used: ${recap.source.turnsUsed}`);
  } catch (error) {
    console.error('❌ Failed to generate recap:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

async function main() {
  await generateRecap();
}

main().catch(console.error);


