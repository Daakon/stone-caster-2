#!/usr/bin/env node
// Phase 27: Autonomous Playtesting Bots and Fuzz Harness
// Smoke test script for CI integration

import { createClient } from '@supabase/supabase-js';
import { FuzzRunner } from '../src/autoplay/fuzz-runner.js';
import { ScenarioMatrixGenerator } from '../src/autoplay/fuzz-runner.js';
import { BaselineManager } from '../src/autoplay/baselines.js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Smoke test configuration
const SMOKE_CONFIG = {
  worlds: ['world.forest_glade'],
  adventures: ['adventure.tutorial'],
  locales: ['en_US'],
  experiments: ['control'],
  variations: ['control'],
  seeds_per_scenario: parseInt(process.env.AUTOPLAY_SMOKE_SEEDS || '2'),
  max_turns: parseInt(process.env.AUTOPLAY_MAX_TURNS || '40'),
  timeout_ms: parseInt(process.env.AUTOPLAY_TIMEOUT_MS || '300000'), // 5 minutes
  parallel_shards: parseInt(process.env.AUTOPLAY_PARALLEL_SHARDS || '2'),
  bot_modes: ['objective_seeker', 'explorer'] as const
};

// Success thresholds for smoke tests
const SMOKE_THRESHOLDS = {
  min_coverage: 0.3, // 30% minimum coverage
  max_failures: 1, // Maximum 1 failure allowed
  max_latency_ms: 10000, // 10 second max latency
  min_turns: 10 // Minimum 10 turns completed
};

async function runSmokeTests(): Promise<{
  success: boolean;
  results: any[];
  summary: {
    total_runs: number;
    passed_runs: number;
    failed_runs: number;
    coverage_avg: number;
    latency_avg: number;
    failures: string[];
  };
}> {
  console.log('🚀 Starting autoplay smoke tests...');
  console.log(`Configuration: ${JSON.stringify(SMOKE_CONFIG, null, 2)}`);

  const fuzzRunner = new FuzzRunner(supabase);
  const matrixGenerator = new ScenarioMatrixGenerator(supabase);
  const baselineManager = new BaselineManager(supabase);

  try {
    // Generate smoke test scenarios
    const scenarios = await matrixGenerator.generateMatrix(SMOKE_CONFIG);
    console.log(`📊 Generated ${scenarios.length} smoke test scenarios`);

    // Create run configuration
    const runConfig = {
      scenarios,
      parallel_shards: SMOKE_CONFIG.parallel_shards,
      max_concurrent: 2,
      artifact_output: false, // Skip artifacts for smoke tests
      resume_from_checkpoint: false
    };

    // Run smoke tests
    const startTime = Date.now();
    const results = await fuzzRunner.runMatrix(runConfig);
    const duration = Date.now() - startTime;

    console.log(`⏱️  Smoke tests completed in ${Math.round(duration / 1000)}s`);

    // Analyze results
    const analysis = analyzeSmokeResults(results);
    
    console.log('📈 Smoke test analysis:');
    console.log(`  Total runs: ${analysis.total_runs}`);
    console.log(`  Passed: ${analysis.passed_runs}`);
    console.log(`  Failed: ${analysis.failed_runs}`);
    console.log(`  Average coverage: ${(analysis.coverage_avg * 100).toFixed(1)}%`);
    console.log(`  Average latency: ${Math.round(analysis.latency_avg)}ms`);

    if (analysis.failures.length > 0) {
      console.log('❌ Failures detected:');
      analysis.failures.forEach(failure => console.log(`  - ${failure}`));
    }

    // Check if smoke tests passed
    const success = checkSmokeSuccess(analysis);

    if (success) {
      console.log('✅ Smoke tests PASSED');
    } else {
      console.log('❌ Smoke tests FAILED');
    }

    return {
      success,
      results,
      summary: analysis
    };

  } catch (error) {
    console.error('💥 Smoke tests failed with error:', error);
    return {
      success: false,
      results: [],
      summary: {
        total_runs: 0,
        passed_runs: 0,
        failed_runs: 1,
        coverage_avg: 0,
        latency_avg: 0,
        failures: [`Smoke test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      }
    };
  }
}

function analyzeSmokeResults(results: any[]): {
  total_runs: number;
  passed_runs: number;
  failed_runs: number;
  coverage_avg: number;
  latency_avg: number;
  failures: string[];
} {
  const totalRuns = results.length;
  const passedRuns = results.filter(r => r.pass).length;
  const failedRuns = totalRuns - passedRuns;

  // Calculate average coverage
  const coverageSum = results.reduce((sum, r) => {
    const coverage = r.coverage?.overall || 0;
    return sum + coverage;
  }, 0);
  const coverageAvg = totalRuns > 0 ? coverageSum / totalRuns : 0;

  // Calculate average latency
  const latencySum = results.reduce((sum, r) => {
    const latency = r.performance?.avg_turn_latency_ms || 0;
    return sum + latency;
  }, 0);
  const latencyAvg = totalRuns > 0 ? latencySum / totalRuns : 0;

  // Collect failures
  const failures: string[] = [];
  results.forEach(result => {
    if (!result.pass) {
      failures.push(`${result.scenario?.world}/${result.scenario?.adventure} (${result.mode}): ${result.status}`);
    }
    
    // Check coverage threshold
    const coverage = result.coverage?.overall || 0;
    if (coverage < SMOKE_THRESHOLDS.min_coverage) {
      failures.push(`Low coverage: ${(coverage * 100).toFixed(1)}% < ${(SMOKE_THRESHOLDS.min_coverage * 100)}%`);
    }
    
    // Check latency threshold
    const latency = result.performance?.avg_turn_latency_ms || 0;
    if (latency > SMOKE_THRESHOLDS.max_latency_ms) {
      failures.push(`High latency: ${latency}ms > ${SMOKE_THRESHOLDS.max_latency_ms}ms`);
    }
    
    // Check minimum turns
    if (result.turns_completed < SMOKE_THRESHOLDS.min_turns) {
      failures.push(`Insufficient turns: ${result.turns_completed} < ${SMOKE_THRESHOLDS.min_turns}`);
    }
  });

  return {
    total_runs: totalRuns,
    passed_runs: passedRuns,
    failed_runs: failedRuns,
    coverage_avg: coverageAvg,
    latency_avg: latencyAvg,
    failures
  };
}

function checkSmokeSuccess(analysis: any): boolean {
  // Check failure count threshold
  if (analysis.failed_runs > SMOKE_THRESHOLDS.max_failures) {
    return false;
  }

  // Check coverage threshold
  if (analysis.coverage_avg < SMOKE_THRESHOLDS.min_coverage) {
    return false;
  }

  // Check latency threshold
  if (analysis.latency_avg > SMOKE_THRESHOLDS.max_latency_ms) {
    return false;
  }

  // Check for critical failures
  const criticalFailures = analysis.failures.filter((failure: string) => 
    failure.includes('soft_lock') || 
    failure.includes('budget_violation') || 
    failure.includes('safety_violation')
  );

  if (criticalFailures.length > 0) {
    return false;
  }

  return true;
}

// Main execution
async function main() {
  try {
    const result = await runSmokeTests();
    
    if (result.success) {
      console.log('🎉 All smoke tests passed!');
      process.exit(0);
    } else {
      console.log('💥 Smoke tests failed!');
      console.log('Summary:', JSON.stringify(result.summary, null, 2));
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 Smoke test script failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { runSmokeTests, SMOKE_CONFIG, SMOKE_THRESHOLDS };
