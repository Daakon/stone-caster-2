#!/usr/bin/env node
// Phase 27: Autonomous Playtesting Bots and Fuzz Harness
// Nightly broad matrix script with artifact uploads

import { createClient } from '@supabase/supabase-js';
import { FuzzRunner } from '../src/autoplay/fuzz-runner.js';
import { ScenarioMatrixGenerator } from '../src/autoplay/fuzz-runner.js';
import { BaselineManager } from '../src/autoplay/baselines.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Nightly configuration
const NIGHTLY_CONFIG = {
  worlds: [
    'world.forest_glade',
    'world.desert_oasis',
    'world.mountain_peaks'
  ],
  adventures: [
    'adventure.tutorial',
    'adventure.main_quest',
    'adventure.side_quests'
  ],
  locales: ['en_US', 'es_ES', 'fr_FR'],
  experiments: ['control', 'variation_a', 'variation_b'],
  variations: ['control', 'experimental'],
  module_toggles: {
    'party_system': [true, false],
    'economy_system': [true, false],
    'romance_system': [true, false],
    'mod_system': [true, false]
  },
  seeds_per_scenario: parseInt(process.env.AUTOPLAY_NIGHTLY_SEEDS || '12'),
  max_turns: parseInt(process.env.AUTOPLAY_MAX_TURNS || '80'),
  timeout_ms: parseInt(process.env.AUTOPLAY_TIMEOUT_MS || '900000'), // 15 minutes
  parallel_shards: parseInt(process.env.AUTOPLAY_PARALLEL_SHARDS || '6'),
  bot_modes: [
    'objective_seeker',
    'explorer', 
    'economy_grinder',
    'romance_tester',
    'risk_taker',
    'safety_max'
  ] as const
};

// Nightly thresholds
const NIGHTLY_THRESHOLDS = {
  min_coverage: 0.5, // 50% minimum coverage
  max_failure_rate: 0.1, // 10% maximum failure rate
  max_latency_p95: 15000, // 15 second P95 latency
  min_successful_runs: 0.8 // 80% of runs must succeed
};

async function runNightlyMatrix(): Promise<{
  success: boolean;
  results: any[];
  summary: {
    total_runs: number;
    passed_runs: number;
    failed_runs: number;
    coverage_avg: number;
    latency_p95: number;
    failure_rate: number;
    artifacts_generated: number;
    baselines_updated: number;
  };
  artifacts: string[];
}> {
  console.log('🌙 Starting nightly autoplay matrix...');
  console.log(`Configuration: ${JSON.stringify(NIGHTLY_CONFIG, null, 2)}`);

  const fuzzRunner = new FuzzRunner(supabase);
  const matrixGenerator = new ScenarioMatrixGenerator(supabase);
  const baselineManager = new BaselineManager(supabase);

  try {
    // Generate nightly scenarios
    const scenarios = await matrixGenerator.generateMatrix(NIGHTLY_CONFIG);
    console.log(`📊 Generated ${scenarios.length} nightly scenarios`);

    // Create run configuration
    const runConfig = {
      scenarios,
      parallel_shards: NIGHTLY_CONFIG.parallel_shards,
      max_concurrent: 4,
      artifact_output: true,
      resume_from_checkpoint: true
    };

    // Run nightly matrix
    const startTime = Date.now();
    const results = await fuzzRunner.runMatrix(runConfig);
    const duration = Date.now() - startTime;

    console.log(`⏱️  Nightly matrix completed in ${Math.round(duration / 1000)}s`);

    // Generate artifacts
    const artifacts = await generateNightlyArtifacts(results);
    console.log(`📁 Generated ${artifacts.length} artifacts`);

    // Update baselines
    const baselinesUpdated = await updateBaselines(results, baselineManager);
    console.log(`📊 Updated ${baselinesUpdated} baselines`);

    // Analyze results
    const analysis = analyzeNightlyResults(results);
    
    console.log('📈 Nightly matrix analysis:');
    console.log(`  Total runs: ${analysis.total_runs}`);
    console.log(`  Passed: ${analysis.passed_runs}`);
    console.log(`  Failed: ${analysis.failed_runs}`);
    console.log(`  Failure rate: ${(analysis.failure_rate * 100).toFixed(1)}%`);
    console.log(`  Average coverage: ${(analysis.coverage_avg * 100).toFixed(1)}%`);
    console.log(`  P95 latency: ${Math.round(analysis.latency_p95)}ms`);

    // Check if nightly matrix passed
    const success = checkNightlySuccess(analysis);

    if (success) {
      console.log('✅ Nightly matrix PASSED');
    } else {
      console.log('❌ Nightly matrix FAILED');
    }

    return {
      success,
      results,
      summary: {
        ...analysis,
        artifacts_generated: artifacts.length,
        baselines_updated: baselinesUpdated
      },
      artifacts
    };

  } catch (error) {
    console.error('💥 Nightly matrix failed with error:', error);
    return {
      success: false,
      results: [],
      summary: {
        total_runs: 0,
        passed_runs: 0,
        failed_runs: 1,
        coverage_avg: 0,
        latency_p95: 0,
        failure_rate: 1.0,
        artifacts_generated: 0,
        baselines_updated: 0
      },
      artifacts: []
    };
  }
}

async function generateNightlyArtifacts(results: any[]): Promise<string[]> {
  const artifacts: string[] = [];
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const artifactsDir = `artifacts/nightly-${timestamp}`;

  try {
    mkdirSync(artifactsDir, { recursive: true });

    // Generate summary report
    const summaryReport = generateSummaryReport(results);
    const summaryPath = join(artifactsDir, 'summary.json');
    writeFileSync(summaryPath, JSON.stringify(summaryReport, null, 2));
    artifacts.push(summaryPath);

    // Generate coverage heatmap
    const coverageHeatmap = generateCoverageHeatmap(results);
    const heatmapPath = join(artifactsDir, 'coverage-heatmap.svg');
    writeFileSync(heatmapPath, coverageHeatmap);
    artifacts.push(heatmapPath);

    // Generate performance report
    const performanceReport = generatePerformanceReport(results);
    const performancePath = join(artifactsDir, 'performance.json');
    writeFileSync(performancePath, JSON.stringify(performanceReport, null, 2));
    artifacts.push(performancePath);

    // Generate failure analysis
    const failureAnalysis = generateFailureAnalysis(results);
    const failurePath = join(artifactsDir, 'failures.json');
    writeFileSync(failurePath, JSON.stringify(failureAnalysis, null, 2));
    artifacts.push(failurePath);

    // Generate HTML dashboard
    const htmlDashboard = generateHtmlDashboard(results, summaryReport);
    const dashboardPath = join(artifactsDir, 'dashboard.html');
    writeFileSync(dashboardPath, htmlDashboard);
    artifacts.push(dashboardPath);

    console.log(`📁 Artifacts saved to: ${artifactsDir}`);

  } catch (error) {
    console.error('Failed to generate artifacts:', error);
  }

  return artifacts;
}

function generateSummaryReport(results: any[]): any {
  const totalRuns = results.length;
  const passedRuns = results.filter(r => r.pass).length;
  const failedRuns = totalRuns - passedRuns;

  const coverageSum = results.reduce((sum, r) => {
    const coverage = r.coverage?.overall || 0;
    return sum + coverage;
  }, 0);
  const coverageAvg = totalRuns > 0 ? coverageSum / totalRuns : 0;

  const latencySum = results.reduce((sum, r) => {
    const latency = r.performance?.avg_turn_latency_ms || 0;
    return sum + latency;
  }, 0);
  const latencyAvg = totalRuns > 0 ? latencySum / totalRuns : 0;

  // Group by scenario
  const scenarioGroups = results.reduce((groups, result) => {
    const key = `${result.scenario?.world}/${result.scenario?.adventure}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(result);
    return groups;
  }, {} as Record<string, any[]>);

  // Group by bot mode
  const modeGroups = results.reduce((groups, result) => {
    const mode = result.mode;
    if (!groups[mode]) groups[mode] = [];
    groups[mode].push(result);
    return groups;
  }, {} as Record<string, any[]>);

  return {
    timestamp: new Date().toISOString(),
    total_runs: totalRuns,
    passed_runs: passedRuns,
    failed_runs: failedRuns,
    failure_rate: totalRuns > 0 ? failedRuns / totalRuns : 0,
    coverage_avg: coverageAvg,
    latency_avg: latencyAvg,
    scenario_breakdown: Object.entries(scenarioGroups).map(([scenario, runs]) => ({
      scenario,
      total_runs: runs.length,
      passed_runs: runs.filter(r => r.pass).length,
      coverage_avg: runs.reduce((sum, r) => sum + (r.coverage?.overall || 0), 0) / runs.length
    })),
    mode_breakdown: Object.entries(modeGroups).map(([mode, runs]) => ({
      mode,
      total_runs: runs.length,
      passed_runs: runs.filter(r => r.pass).length,
      coverage_avg: runs.reduce((sum, r) => sum + (r.coverage?.overall || 0), 0) / runs.length
    }))
  };
}

function generateCoverageHeatmap(results: any[]): string {
  // Group results by scenario and mode
  const heatmapData = results.reduce((data, result) => {
    const scenario = `${result.scenario?.world}/${result.scenario?.adventure}`;
    const mode = result.mode;
    const coverage = result.coverage?.overall || 0;
    
    if (!data[scenario]) data[scenario] = {};
    data[scenario][mode] = coverage;
    
    return data;
  }, {} as Record<string, Record<string, number>>);

  const scenarios = Object.keys(heatmapData);
  const modes = ['objective_seeker', 'explorer', 'economy_grinder', 'romance_tester', 'risk_taker', 'safety_max'];
  
  let svg = `<svg width="800" height="${scenarios.length * 40 + 100}" xmlns="http://www.w3.org/2000/svg">`;
  
  // Header
  svg += `<text x="10" y="20" font-family="Arial" font-size="14" font-weight="bold">Coverage Heatmap</text>`;
  
  // Mode headers
  modes.forEach((mode, i) => {
    svg += `<text x="${150 + i * 100}" y="40" font-family="Arial" font-size="10" text-anchor="middle">${mode.replace('_', ' ')}</text>`;
  });
  
  // Heatmap cells
  scenarios.forEach((scenario, row) => {
    const y = 60 + row * 30;
    
    // Scenario label
    svg += `<text x="10" y="${y + 15}" font-family="Arial" font-size="10">${scenario}</text>`;
    
    modes.forEach((mode, col) => {
      const x = 150 + col * 100;
      const coverage = heatmapData[scenario]?.[mode] || 0;
      const color = coverage > 0.8 ? '#4CAF50' : coverage > 0.6 ? '#FFC107' : coverage > 0.4 ? '#FF9800' : '#F44336';
      
      svg += `<rect x="${x - 40}" y="${y - 10}" width="80" height="20" fill="${color}" stroke="#000" stroke-width="1"/>`;
      svg += `<text x="${x}" y="${y + 5}" font-family="Arial" font-size="8" text-anchor="middle" fill="white">${(coverage * 100).toFixed(0)}%</text>`;
    });
  });
  
  svg += '</svg>';
  return svg;
}

function generatePerformanceReport(results: any[]): any {
  const latencies = results.map(r => r.performance?.avg_turn_latency_ms || 0).filter(l => l > 0);
  const tokens = results.map(r => r.performance?.avg_tokens_per_turn || 0).filter(t => t > 0);
  
  latencies.sort((a, b) => a - b);
  tokens.sort((a, b) => a - b);
  
  return {
    latency: {
      min: latencies[0] || 0,
      max: latencies[latencies.length - 1] || 0,
      p50: latencies[Math.floor(latencies.length * 0.5)] || 0,
      p95: latencies[Math.floor(latencies.length * 0.95)] || 0,
      p99: latencies[Math.floor(latencies.length * 0.99)] || 0,
      avg: latencies.reduce((sum, l) => sum + l, 0) / latencies.length || 0
    },
    tokens: {
      min: tokens[0] || 0,
      max: tokens[tokens.length - 1] || 0,
      p50: tokens[Math.floor(tokens.length * 0.5)] || 0,
      p95: tokens[Math.floor(tokens.length * 0.95)] || 0,
      p99: tokens[Math.floor(tokens.length * 0.99)] || 0,
      avg: tokens.reduce((sum, t) => sum + t, 0) / tokens.length || 0
    }
  };
}

function generateFailureAnalysis(results: any[]): any {
  const failures = results.filter(r => !r.pass);
  
  const failureTypes = failures.reduce((types, failure) => {
    const oracles = failure.oracles || {};
    Object.entries(oracles).forEach(([oracle, failed]) => {
      if (failed) {
        types[oracle] = (types[oracle] || 0) + 1;
      }
    });
    return types;
  }, {} as Record<string, number>);
  
  return {
    total_failures: failures.length,
    failure_rate: results.length > 0 ? failures.length / results.length : 0,
    failure_types: failureTypes,
    failed_scenarios: failures.map(f => ({
      scenario: `${f.scenario?.world}/${f.scenario?.adventure}`,
      mode: f.mode,
      status: f.status,
      turns_completed: f.turns_completed,
      oracles: f.oracles
    }))
  };
}

function generateHtmlDashboard(results: any[], summary: any): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Nightly Autoplay Matrix Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric { display: inline-block; margin: 10px; padding: 15px; background: #ecf0f1; border-radius: 5px; text-align: center; }
        .metric-value { font-size: 24px; font-weight: bold; color: #2c3e50; }
        .metric-label { font-size: 12px; color: #7f8c8d; text-transform: uppercase; }
        .pass { color: #27ae60; }
        .fail { color: #e74c3c; }
        .warning { color: #f39c12; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f8f9fa; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌙 Nightly Autoplay Matrix Report</h1>
            <p>Generated: ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="card">
            <h2>📊 Summary</h2>
            <div class="metric">
                <div class="metric-value">${summary.total_runs}</div>
                <div class="metric-label">Total Runs</div>
            </div>
            <div class="metric">
                <div class="metric-value pass">${summary.passed_runs}</div>
                <div class="metric-label">Passed</div>
            </div>
            <div class="metric">
                <div class="metric-value fail">${summary.failed_runs}</div>
                <div class="metric-label">Failed</div>
            </div>
            <div class="metric">
                <div class="metric-value">${(summary.failure_rate * 100).toFixed(1)}%</div>
                <div class="metric-label">Failure Rate</div>
            </div>
            <div class="metric">
                <div class="metric-value">${(summary.coverage_avg * 100).toFixed(1)}%</div>
                <div class="metric-label">Avg Coverage</div>
            </div>
        </div>
        
        <div class="card">
            <h2>🎯 Scenario Breakdown</h2>
            <table>
                <thead>
                    <tr>
                        <th>Scenario</th>
                        <th>Total Runs</th>
                        <th>Passed</th>
                        <th>Coverage</th>
                    </tr>
                </thead>
                <tbody>
                    ${summary.scenario_breakdown.map((s: any) => `
                        <tr>
                            <td>${s.scenario}</td>
                            <td>${s.total_runs}</td>
                            <td class="${s.passed_runs === s.total_runs ? 'pass' : 'fail'}">${s.passed_runs}/${s.total_runs}</td>
                            <td>${(s.coverage_avg * 100).toFixed(1)}%</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div class="card">
            <h2>🤖 Bot Mode Breakdown</h2>
            <table>
                <thead>
                    <tr>
                        <th>Mode</th>
                        <th>Total Runs</th>
                        <th>Passed</th>
                        <th>Coverage</th>
                    </tr>
                </thead>
                <tbody>
                    ${summary.mode_breakdown.map((m: any) => `
                        <tr>
                            <td>${m.mode.replace('_', ' ')}</td>
                            <td>${m.total_runs}</td>
                            <td class="${m.passed_runs === m.total_runs ? 'pass' : 'fail'}">${m.passed_runs}/${m.total_runs}</td>
                            <td>${(m.coverage_avg * 100).toFixed(1)}%</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </div>
</body>
</html>`;
}

async function updateBaselines(results: any[], baselineManager: BaselineManager): Promise<number> {
  let updated = 0;
  
  // Group results by scenario for baseline updates
  const scenarioGroups = results.reduce((groups, result) => {
    const key = `${result.scenario?.world}/${result.scenario?.adventure}/v1.0.0/${result.scenario?.locale}/${result.scenario?.variation || 'control'}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(result);
    return groups;
  }, {} as Record<string, any[]>);

  for (const [baselineKey, runs] of Object.entries(scenarioGroups)) {
    if (runs.length === 0) continue;

    // Calculate aggregated metrics
    const metrics = calculateAggregatedMetrics(runs);
    
    // Save baseline
    const result = await baselineManager.saveBaseline(baselineKey, metrics);
    if (result.success) {
      updated++;
    }
  }

  return updated;
}

function calculateAggregatedMetrics(runs: any[]): any {
  const passedRuns = runs.filter(r => r.pass);
  
  return {
    coverage: {
      quest_graph: passedRuns.reduce((sum, r) => sum + (r.coverage?.quest_graph || 0), 0) / Math.max(passedRuns.length, 1),
      dialogue: passedRuns.reduce((sum, r) => sum + (r.coverage?.dialogue || 0), 0) / Math.max(passedRuns.length, 1),
      mechanics: passedRuns.reduce((sum, r) => sum + (r.coverage?.mechanics || 0), 0) / Math.max(passedRuns.length, 1),
      economy: passedRuns.reduce((sum, r) => sum + (r.coverage?.economy || 0), 0) / Math.max(passedRuns.length, 1),
      world_sim: passedRuns.reduce((sum, r) => sum + (r.coverage?.world_sim || 0), 0) / Math.max(passedRuns.length, 1),
      mods: passedRuns.reduce((sum, r) => sum + (r.coverage?.mods || 0), 0) / Math.max(passedRuns.length, 1),
      overall: passedRuns.reduce((sum, r) => sum + (r.coverage?.overall || 0), 0) / Math.max(passedRuns.length, 1)
    },
    performance: {
      avg_turn_latency_ms: passedRuns.reduce((sum, r) => sum + (r.performance?.avg_turn_latency_ms || 0), 0) / Math.max(passedRuns.length, 1),
      p95_turn_latency_ms: calculateP95(passedRuns.map(r => r.performance?.avg_turn_latency_ms || 0)),
      avg_tokens_per_turn: passedRuns.reduce((sum, r) => sum + (r.performance?.avg_tokens_per_turn || 0), 0) / Math.max(passedRuns.length, 1),
      max_tokens_per_turn: Math.max(...passedRuns.map(r => r.performance?.max_tokens_per_turn || 0)),
      turns_per_second: passedRuns.reduce((sum, r) => sum + (r.performance?.turns_per_second || 0), 0) / Math.max(passedRuns.length, 1)
    },
    oracles: {
      soft_locks: runs.filter(r => r.oracles?.soft_lock).length,
      budget_violations: runs.filter(r => r.oracles?.budget_violation).length,
      validator_retries: runs.reduce((sum, r) => sum + (r.oracles?.validator_retries || 0), 0),
      fallback_engagements: runs.filter(r => r.oracles?.fallback_engagements).length,
      safety_violations: runs.filter(r => r.oracles?.safety_violation).length,
      performance_violations: runs.filter(r => r.oracles?.performance_violation).length,
      integrity_violations: runs.filter(r => r.oracles?.integrity_violation).length
    },
    behavior: {
      avg_turns_to_completion: passedRuns.reduce((sum, r) => sum + (r.turns_completed || 0), 0) / Math.max(passedRuns.length, 1),
      exploration_efficiency: passedRuns.reduce((sum, r) => sum + (r.coverage?.overall || 0), 0) / Math.max(passedRuns.length, 1),
      dialogue_engagement_rate: passedRuns.reduce((sum, r) => sum + (r.coverage?.dialogue || 0), 0) / Math.max(passedRuns.length, 1),
      economic_activity_rate: passedRuns.reduce((sum, r) => sum + (r.coverage?.economy || 0), 0) / Math.max(passedRuns.length, 1),
      risk_taking_rate: runs.filter(r => r.mode === 'risk_taker').length / Math.max(runs.length, 1)
    }
  };
}

function calculateP95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.sort((a, b) => a - b);
  const index = Math.floor(sorted.length * 0.95);
  return sorted[index] || 0;
}

function analyzeNightlyResults(results: any[]): {
  total_runs: number;
  passed_runs: number;
  failed_runs: number;
  coverage_avg: number;
  latency_p95: number;
  failure_rate: number;
} {
  const totalRuns = results.length;
  const passedRuns = results.filter(r => r.pass).length;
  const failedRuns = totalRuns - passedRuns;

  const coverageSum = results.reduce((sum, r) => {
    const coverage = r.coverage?.overall || 0;
    return sum + coverage;
  }, 0);
  const coverageAvg = totalRuns > 0 ? coverageSum / totalRuns : 0;

  const latencies = results.map(r => r.performance?.avg_turn_latency_ms || 0).filter(l => l > 0);
  const latencyP95 = calculateP95(latencies);

  return {
    total_runs: totalRuns,
    passed_runs: passedRuns,
    failed_runs: failedRuns,
    coverage_avg: coverageAvg,
    latency_p95: latencyP95,
    failure_rate: totalRuns > 0 ? failedRuns / totalRuns : 0
  };
}

function checkNightlySuccess(analysis: any): boolean {
  // Check failure rate threshold
  if (analysis.failure_rate > NIGHTLY_THRESHOLDS.max_failure_rate) {
    return false;
  }

  // Check coverage threshold
  if (analysis.coverage_avg < NIGHTLY_THRESHOLDS.min_coverage) {
    return false;
  }

  // Check P95 latency threshold
  if (analysis.latency_p95 > NIGHTLY_THRESHOLDS.max_latency_p95) {
    return false;
  }

  // Check minimum successful runs
  const successRate = analysis.passed_runs / analysis.total_runs;
  if (successRate < NIGHTLY_THRESHOLDS.min_successful_runs) {
    return false;
  }

  return true;
}

// Main execution
async function main() {
  try {
    const result = await runNightlyMatrix();
    
    if (result.success) {
      console.log('🎉 Nightly matrix passed!');
      console.log(`📁 Generated ${result.artifacts.length} artifacts`);
      process.exit(0);
    } else {
      console.log('💥 Nightly matrix failed!');
      console.log('Summary:', JSON.stringify(result.summary, null, 2));
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 Nightly matrix script failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { runNightlyMatrix, NIGHTLY_CONFIG, NIGHTLY_THRESHOLDS };
