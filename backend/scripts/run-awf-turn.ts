#!/usr/bin/env tsx

import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { runAwfTurn, runAwfTurnDry } from '../src/orchestrators/awf-turn-orchestrator.js';

async function runAwfTurnScript() {
  const args = process.argv.slice(2);
  let sessionId: string | undefined;
  let inputText: string | undefined;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--session' && args[i + 1]) {
      sessionId = args[i + 1];
      i++;
    } else if (args[i] === '--text' && args[i + 1]) {
      inputText = args[i + 1];
      i++;
    } else if (args[i] === '--dry') {
      dryRun = true;
    }
  }

  if (!sessionId || !inputText) {
    console.error('Usage: npm run awf:turn -- --session <sessionId> --text "<player input>" [--dry]');
    process.exit(1);
  }

  console.log(`[AWF Turn Script] Session: ${sessionId}`);
  console.log(`[AWF Turn Script] Input: ${inputText}`);
  console.log(`[AWF Turn Script] Mode: ${dryRun ? 'DRY RUN' : 'FULL RUN'}`);

  try {
    if (dryRun) {
      console.log('\n=== DRY RUN MODE ===');
      console.log('Running assemble → infer → validate (no acts applied)');
      
      const result = await runAwfTurnDry({ sessionId, inputText });
      
      console.log('\n=== BUNDLE INFO ===');
      console.log(`Bundle size: ${result.metrics.bundleSize} bytes`);
      console.log(`Estimated tokens: ${result.metrics.estimatedTokens}`);
      console.log(`Model latency: ${result.metrics.modelLatency}ms`);
      console.log(`Validation passed: ${result.metrics.validationPassed}`);
      console.log(`Retry used: ${result.metrics.retryUsed}`);
      
      console.log('\n=== AWF OUTPUT ===');
      console.log(`Scene: ${result.awf.scn}`);
      console.log(`Text: ${result.awf.txt}`);
      console.log(`Choices: ${result.awf.choices?.length || 0}`);
      console.log(`Acts: ${result.awf.acts?.length || 0}`);
      
      if (result.awf.choices && result.awf.choices.length > 0) {
        console.log('\n=== CHOICES ===');
        result.awf.choices.forEach((choice: any, index: number) => {
          console.log(`${index + 1}. ${choice.id}: ${choice.label}`);
        });
      }
      
      if (result.awf.acts && result.awf.acts.length > 0) {
        console.log('\n=== ACTS ===');
        result.awf.acts.forEach((act: any, index: number) => {
          console.log(`${index + 1}. ${act.type}: ${JSON.stringify(act.data)}`);
        });
      }
      
      console.log('\n✅ Dry run completed successfully');
      
    } else {
      console.log('\n=== FULL RUN MODE ===');
      console.log('Running complete AWF turn flow');
      
      const result = await runAwfTurn({ sessionId, inputText });
      
      console.log('\n=== TURN RESULT ===');
      console.log(`Text: ${result.txt}`);
      console.log(`Scene: ${result.meta.scn}`);
      console.log(`Choices: ${result.choices.length}`);
      
      if (result.choices.length > 0) {
        console.log('\n=== CHOICES ===');
        result.choices.forEach((choice, index) => {
          console.log(`${index + 1}. ${choice.id}: ${choice.label}`);
        });
      }
      
      console.log('\n✅ Full turn completed successfully');
    }

  } catch (error) {
    console.error('❌ AWF turn failed:', error);
    process.exit(1);
  }
}

runAwfTurnScript().catch(console.error);


