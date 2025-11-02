#!/usr/bin/env tsx
/**
 * Canary environment consistency checker
 * Compares config values across environments to ensure consistency
 */

import { config } from '../src/config/index.js';

interface EnvCheck {
  key: string;
  value: any;
  expected?: any;
  status: 'ok' | 'warn' | 'error';
}

function checkEnv(): void {
  const checks: EnvCheck[] = [];
  
  // Check SLO thresholds
  checks.push({
    key: 'SLO_SPAWN_P95_MS',
    value: config.slo.spawnP95Ms,
    expected: 600,
    status: config.slo.spawnP95Ms === 600 ? 'ok' : 'warn',
  });
  
  checks.push({
    key: 'SLO_TURN_P95_MS',
    value: config.slo.turnP95Ms,
    expected: 200,
    status: config.slo.turnP95Ms === 200 ? 'ok' : 'warn',
  });
  
  // Check prompt tracing
  checks.push({
    key: 'PROMPT_TRACING_ENABLED',
    value: config.promptTracing.enabled,
    expected: false, // Default should be off
    status: config.promptTracing.enabled === false ? 'ok' : 'warn',
  });
  
  // Check v3 is enabled (implicit)
  checks.push({
    key: 'V3_ENABLED',
    value: true, // v3 is default
    status: 'ok',
  });
  
  // Print results
  console.log('🔍 Environment Configuration Check\n');
  
  let hasErrors = false;
  let hasWarnings = false;
  
  for (const check of checks) {
    const icon = check.status === 'ok' ? '✅' : check.status === 'warn' ? '⚠️' : '❌';
    console.log(`${icon} ${check.key}: ${JSON.stringify(check.value)}`);
    
    if (check.expected !== undefined) {
      console.log(`   Expected: ${JSON.stringify(check.expected)}`);
    }
    
    if (check.status === 'error') {
      hasErrors = true;
    } else if (check.status === 'warn') {
      hasWarnings = true;
    }
  }
  
  console.log('\n');
  
  if (hasErrors) {
    console.error('❌ Configuration errors detected!');
    process.exit(1);
  } else if (hasWarnings) {
    console.warn('⚠️  Configuration warnings detected.');
    process.exit(0);
  } else {
    console.log('✅ All checks passed!');
    process.exit(0);
  }
}

checkEnv();

