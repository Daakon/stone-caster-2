// [CHIMERA V3] Verification Script
/**
 * Verify MockLlmProvider Situational Tags
 * Dry-test to ensure new situational tags are present in JSON output
 */

import { MockLlmProvider } from '../src/services/runtime/llm.provider.js';
import { Mas1IntentSchema } from '@shared/types/chimera-runtime';

const provider = new MockLlmProvider();

console.log('=== MockLlmProvider Situational Tags Verification ===\n');

// Test 1: test_drunk_combat
console.log('Test 1: test_drunk_combat');
try {
  const intents1 = provider.generateMas1('test_drunk_combat');
  console.log(`✓ Generated ${intents1.length} intent(s)`);
  
  const intent1 = intents1[0];
  console.log(`  Trigger ID: ${intent1.trigger_id}`);
  console.log(`  Situational Tags: ${JSON.stringify(intent1.situational_tags)}`);
  
  if (intent1.situational_tags?.includes('INTOXICATED')) {
    console.log('  ✓ INTOXICATED tag present');
  } else {
    console.log('  ✗ INTOXICATED tag missing');
    process.exit(1);
  }
  
  // Validate against schema
  Mas1IntentSchema.parse(intent1);
  console.log('  ✓ Validates against Mas1IntentSchema\n');
} catch (error) {
  console.error('  ✗ Error:', error);
  process.exit(1);
}

// Test 2: test_protective_combat
console.log('Test 2: test_protective_combat');
try {
  const intents2 = provider.generateMas1('test_protective_combat');
  console.log(`✓ Generated ${intents2.length} intent(s)`);
  
  const intent2 = intents2[0];
  console.log(`  Trigger ID: ${intent2.trigger_id}`);
  console.log(`  Situational Tags: ${JSON.stringify(intent2.situational_tags)}`);
  
  if (intent2.situational_tags?.includes('PROTECTING_ALLY')) {
    console.log('  ✓ PROTECTING_ALLY tag present');
  } else {
    console.log('  ✗ PROTECTING_ALLY tag missing');
    process.exit(1);
  }
  
  // Validate against schema
  Mas1IntentSchema.parse(intent2);
  console.log('  ✓ Validates against Mas1IntentSchema\n');
} catch (error) {
  console.error('  ✗ Error:', error);
  process.exit(1);
}

// Test 3: JSON Output Verification
console.log('Test 3: JSON Output Verification');
try {
  const intents3 = provider.generateMas1('test_drunk_combat');
  const json = JSON.stringify(intents3[0]);
  const parsed = JSON.parse(json);
  
  if (parsed.situational_tags && Array.isArray(parsed.situational_tags)) {
    console.log('  ✓ situational_tags is an array in JSON output');
    console.log(`  ✓ Tags: ${JSON.stringify(parsed.situational_tags)}`);
  } else {
    console.log('  ✗ situational_tags missing or invalid in JSON');
    process.exit(1);
  }
} catch (error) {
  console.error('  ✗ Error:', error);
  process.exit(1);
}

console.log('\n=== All Tests Passed ===');
