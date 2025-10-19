#!/usr/bin/env tsx

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { applyActs } from '../src/interpreters/apply-acts.js';
import { AwfResponse } from '../src/types/awf-acts.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyActsScript() {
  const args = process.argv.slice(2);
  let sessionId: string | undefined;
  let awfFilePath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--session' && args[i + 1]) {
      sessionId = args[i + 1];
      i++;
    } else if (args[i] === '--awf-file' && args[i + 1]) {
      awfFilePath = args[i + 1];
      i++;
    }
  }

  if (!sessionId || !awfFilePath) {
    console.error('Usage: npm run awf:apply -- --session <sessionId> --awf-file <path>');
    process.exit(1);
  }

  console.log(`[AWF Apply] Loading AWF from: ${awfFilePath}`);
  console.log(`[AWF Apply] Session ID: ${sessionId}`);

  try {
    // Load AWF JSON file
    const awfContent = readFileSync(awfFilePath, 'utf-8');
    const awf: AwfResponse = JSON.parse(awfContent);

    console.log(`[AWF Apply] AWF loaded with ${awf.acts?.length || 0} acts`);

    // Apply acts
    const result = await applyActs({ sessionId, awf }, supabase);

    console.log('\n=== ACT APPLICATION SUMMARY ===');
    console.log('✅ Acts applied successfully');
    console.log(`📊 Relations changed: ${result.summary.relChanges.length}`);
    console.log(`📊 Objectives updated: ${result.summary.objectives.length}`);
    console.log(`📊 Flags set: ${result.summary.flags.length}`);
    console.log(`📊 Resources changed: ${result.summary.resources.length}`);
    console.log(`📊 Memory entries added: ${result.summary.memory.added}`);
    console.log(`📊 Memory entries pinned: ${result.summary.memory.pinned}`);
    console.log(`📊 Memory entries trimmed: ${result.summary.memory.trimmed}`);
    console.log(`⚠️  Violations: ${result.summary.violations.length}`);

    if (result.summary.scene) {
      console.log(`🎭 Scene set to: ${result.summary.scene}`);
    }

    if (result.summary.time) {
      console.log(`⏰ Time advanced: ${result.summary.time.added} ticks`);
      console.log(`⏰ From: ${result.summary.time.prev.band} (${result.summary.time.prev.ticks} ticks)`);
      console.log(`⏰ To: ${result.summary.time.next.band} (${result.summary.time.next.ticks} ticks)`);
    }

    // Show current hot state
    console.log('\n=== CURRENT HOT STATE ===');
    console.log('Scene:', result.newState.hot.scene || 'Not set');
    console.log('Time:', result.newState.hot.time || 'Not set');
    
    if (result.newState.hot.relations) {
      console.log('Relations:', Object.entries(result.newState.hot.relations as Record<string, number>));
    }
    
    if (result.newState.hot.objectives) {
      console.log('Objectives:', (result.newState.hot.objectives as any[]).map(obj => 
        `${obj.id}: ${obj.status}${obj.progress ? ` (${obj.progress}%)` : ''}`
      ));
    }

    // Show warm memory
    console.log('\n=== WARM MEMORY ===');
    console.log(`Episodic entries: ${result.newState.warm.episodic.length}`);
    console.log(`Pins: ${result.newState.warm.pins.length}`);

    if (result.summary.violations.length > 0) {
      console.log('\n=== VIOLATIONS ===');
      result.summary.violations.forEach(violation => {
        console.log(`⚠️  ${violation}`);
      });
    }

    console.log('\n✅ Act application completed successfully');

  } catch (error) {
    console.error('❌ Act application failed:', error);
    process.exit(1);
  }
}

applyActsScript().catch(console.error);


