// Phase 27: Autonomous Playtesting Bots and Fuzz Harness
// Scenario matrix runner and orchestration

import { z } from 'zod';
import { BotEngine, BotMode } from './bot-engine.js';
import { CoverageTracker } from './coverage.js';
import { OracleDetector } from './oracles.js';
import { createClient } from '@supabase/supabase-js';

// Scenario configuration
export const ScenarioSchema = z.object({
  world: z.string(),
  adventure: z.string(),
  locale: z.string(),
  experiment: z.string().optional(),
  variation: z.string().optional(),
  module_toggles: z.record(z.boolean()).optional(),
  rng_seed: z.string(),
  max_turns: z.number().default(80),
  timeout_ms: z.number().default(900000), // 15 minutes
});

export type Scenario = z.infer<typeof ScenarioSchema>;

// Run configuration
export const RunConfigSchema = z.object({
  scenarios: z.array(ScenarioSchema),
  parallel_shards: z.number().default(6),
  max_concurrent: z.number().default(3),
  artifact_output: z.boolean().default(true),
  resume_from_checkpoint: z.boolean().default(true),
});

export type RunConfig = z.infer<typeof RunConfigSchema>;

// Run result
export interface RunResult {
  run_id: string;
  scenario: Scenario;
  mode: BotMode;
  status: 'completed' | 'failed' | 'timeout' | 'cancelled';
  turns_completed: number;
  coverage: any;
  oracles: any;
  performance: any;
  artifacts: Array<{
    kind: 'json' | 'html' | 'png' | 'svg' | 'zip';
    path: string;
    bytes: number;
  }>;
  started_at: Date;
  finished_at: Date;
  duration_ms: number;
  pass: boolean;
}

// Scenario matrix generator
export class ScenarioMatrixGenerator {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  async generateMatrix(config: {
    worlds: string[];
    adventures: string[];
    locales: string[];
    experiments?: string[];
    variations?: string[];
    module_toggles?: Record<string, boolean[]>;
    seeds_per_scenario: number;
  }): Promise<Scenario[]> {
    const scenarios: Scenario[] = [];
    
    for (const world of config.worlds) {
      for (const adventure of config.adventures) {
        for (const locale of config.locales) {
          // Base scenario
          const baseScenario = {
            world,
            adventure,
            locale,
            rng_seed: '',
            max_turns: 80,
            timeout_ms: 900000
          };

          // Generate experiment variations
          const experiments = config.experiments || ['control'];
          for (const experiment of experiments) {
            const variations = config.variations || ['control'];
            for (const variation of variations) {
              // Generate module toggle combinations
              const moduleCombinations = this.generateModuleCombinations(
                config.module_toggles || {}
              );

              for (const moduleToggles of moduleCombinations) {
                // Generate multiple seeds for each scenario
                for (let seedIndex = 0; seedIndex < config.seeds_per_scenario; seedIndex++) {
                  const scenario: Scenario = {
                    ...baseScenario,
                    experiment,
                    variation,
                    module_toggles: moduleToggles,
                    rng_seed: this.generateSeed(world, adventure, locale, experiment, variation, seedIndex)
                  };
                  scenarios.push(scenario);
                }
              }
            }
          }
        }
      }
    }

    return scenarios;
  }

  private generateModuleCombinations(moduleToggles: Record<string, boolean[]>): Record<string, boolean>[] {
    const modules = Object.keys(moduleToggles);
    if (modules.length === 0) return [{}];

    const combinations: Record<string, boolean>[] = [];
    
    const generateCombinations = (index: number, current: Record<string, boolean>) => {
      if (index === modules.length) {
        combinations.push({ ...current });
        return;
      }

      const module = modules[index];
      const options = moduleToggles[module];
      
      for (const option of options) {
        current[module] = option;
        generateCombinations(index + 1, current);
      }
    };

    generateCombinations(0, {});
    return combinations;
  }

  private generateSeed(world: string, adventure: string, locale: string, experiment: string, variation: string, seedIndex: number): string {
    return `${world}:${adventure}:${locale}:${experiment}:${variation}:${seedIndex}`;
  }
}

// Fuzz runner orchestrator
export class FuzzRunner {
  private supabase: any;
  private coverageTracker: CoverageTracker;
  private oracleDetector: OracleDetector;
  private matrixGenerator: ScenarioMatrixGenerator;

  constructor(supabase: any) {
    this.supabase = supabase;
    this.coverageTracker = new CoverageTracker();
    this.oracleDetector = new OracleDetector();
    this.matrixGenerator = new ScenarioMatrixGenerator(supabase);
  }

  async runMatrix(config: RunConfig): Promise<RunResult[]> {
    const results: RunResult[] = [];
    const botModes: BotMode[] = ['objective_seeker', 'explorer', 'economy_grinder', 'romance_tester', 'risk_taker', 'safety_max'];

    // Process scenarios in parallel shards
    const shards = this.createShards(config.scenarios, config.parallel_shards);
    
    for (const shard of shards) {
      const shardResults = await this.runShard(shard, botModes, config);
      results.push(...shardResults);
    }

    return results;
  }

  private createShards(scenarios: Scenario[], shardCount: number): Scenario[][] {
    const shards: Scenario[][] = Array.from({ length: shardCount }, () => []);
    
    scenarios.forEach((scenario, index) => {
      const shardIndex = index % shardCount;
      shards[shardIndex].push(scenario);
    });

    return shards;
  }

  private async runShard(scenarios: Scenario[], botModes: BotMode[], config: RunConfig): Promise<RunResult[]> {
    const results: RunResult[] = [];
    
    for (const scenario of scenarios) {
      for (const mode of botModes) {
        try {
          const result = await this.runSingleScenario(scenario, mode, config);
          results.push(result);
        } catch (error) {
          console.error(`Failed to run scenario ${scenario.world}/${scenario.adventure} with mode ${mode}:`, error);
          
          // Create failed result
          const failedResult: RunResult = {
            run_id: this.generateRunId(scenario, mode),
            scenario,
            mode,
            status: 'failed',
            turns_completed: 0,
            coverage: {},
            oracles: {},
            performance: {},
            artifacts: [],
            started_at: new Date(),
            finished_at: new Date(),
            duration_ms: 0,
            pass: false
          };
          results.push(failedResult);
        }
      }
    }

    return results;
  }

  private async runSingleScenario(scenario: Scenario, mode: BotMode, config: RunConfig): Promise<RunResult> {
    const runId = this.generateRunId(scenario, mode);
    const startedAt = new Date();
    
    // Check for existing checkpoint
    let checkpoint = null;
    if (config.resume_from_checkpoint) {
      checkpoint = await this.loadCheckpoint(runId);
    }

    // Initialize bot engine
    const botEngine = new BotEngine(
      runId,
      checkpoint?.turn || 0,
      mode,
      scenario.rng_seed
    );

    // Initialize coverage tracker
    const coverageTracker = new CoverageTracker();
    
    // Initialize oracle detector
    const oracleDetector = new OracleDetector();

    let turnCount = checkpoint?.turn || 0;
    let bundle = checkpoint?.bundle || await this.loadBundle(scenario);
    let context = checkpoint?.context || await this.buildContext(scenario, bundle);

    const maxTurns = scenario.max_turns;
    const timeoutMs = scenario.timeout_ms;
    const startTime = Date.now();

    try {
      while (turnCount < maxTurns) {
        // Check timeout
        if (Date.now() - startTime > timeoutMs) {
          throw new Error('Run timeout exceeded');
        }

        // Get bot decision
        const decision = botEngine.decide(bundle, context, mode);
        
        // Execute decision (simulate turn)
        const turnResult = await this.executeTurn(bundle, context, decision);
        
        // Update coverage
        coverageTracker.updateCoverage(bundle, context, decision, turnResult);
        
        // Check oracles
        const oracleResults = oracleDetector.checkOracles(bundle, context, turnResult, turnCount);
        
        // Update context for next turn
        context = await this.updateContext(context, turnResult);
        bundle = turnResult.updatedBundle || bundle;
        
        turnCount++;

        // Save checkpoint periodically
        if (turnCount % 10 === 0) {
          await this.saveCheckpoint(runId, {
            turn: turnCount,
            bundle,
            context,
            coverage: coverageTracker.getCoverage(),
            oracles: oracleDetector.getResults()
          });
        }

        // Check for early termination conditions
        if (oracleResults.soft_lock || oracleResults.budget_violation) {
          break;
        }
      }

      // Generate final coverage and oracle results
      const finalCoverage = coverageTracker.getCoverage();
      const finalOracles = oracleDetector.getResults();
      const performance = this.calculatePerformance(startedAt, turnCount);

      // Generate artifacts
      const artifacts = await this.generateArtifacts(runId, {
        scenario,
        mode,
        coverage: finalCoverage,
        oracles: finalOracles,
        performance,
        turns_completed: turnCount
      });

      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();

      const result: RunResult = {
        run_id: runId,
        scenario,
        mode,
        status: 'completed',
        turns_completed: turnCount,
        coverage: finalCoverage,
        oracles: finalOracles,
        performance,
        artifacts,
        started_at: startedAt,
        finished_at: finishedAt,
        duration_ms: durationMs,
        pass: this.evaluatePass(finalOracles, performance)
      };

      // Save result to database
      await this.saveRunResult(result);

      return result;

    } catch (error) {
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();

      return {
        run_id: runId,
        scenario,
        mode,
        status: 'failed',
        turns_completed: turnCount,
        coverage: coverageTracker.getCoverage(),
        oracles: oracleDetector.getResults(),
        performance: this.calculatePerformance(startedAt, turnCount),
        artifacts: [],
        started_at: startedAt,
        finished_at: finishedAt,
        duration_ms: durationMs,
        pass: false
      };
    }
  }

  private generateRunId(scenario: Scenario, mode: BotMode): string {
    const timestamp = Date.now();
    return `run_${scenario.world}_${scenario.adventure}_${mode}_${timestamp}`;
  }

  private async loadBundle(scenario: Scenario): Promise<any> {
    // Load AWF bundle for the scenario
    // This would integrate with the existing bundle loading system
    return {
      world: scenario.world,
      adventure: scenario.adventure,
      locale: scenario.locale,
      // ... other bundle data
    };
  }

  private async buildContext(scenario: Scenario, bundle: any): Promise<any> {
    // Build context for bot decision making
    return {
      current_node: bundle.start_node,
      available_choices: bundle.choices || [],
      dialogue_candidates: bundle.dialogue_candidates || [],
      party_state: bundle.party || {},
      world_state: bundle.world || {},
      economy_state: bundle.economy || {},
      mod_state: bundle.mods || {},
      turn_number: 0,
      session_id: this.generateRunId(scenario, 'objective_seeker'),
      seed: scenario.rng_seed
    };
  }

  private async executeTurn(bundle: any, context: any, decision: any): Promise<any> {
    // Simulate turn execution
    // This would integrate with the existing turn processing system
    return {
      success: true,
      updatedBundle: bundle,
      turnResult: {
        choices: context.available_choices,
        dialogue: context.dialogue_candidates,
        // ... other turn results
      }
    };
  }

  private async updateContext(context: any, turnResult: any): Promise<any> {
    // Update context for next turn
    return {
      ...context,
      turn_number: context.turn_number + 1,
      available_choices: turnResult.turnResult?.choices || context.available_choices,
      dialogue_candidates: turnResult.turnResult?.dialogue || context.dialogue_candidates
    };
  }

  private calculatePerformance(startedAt: Date, turnCount: number): any {
    const durationMs = Date.now() - startedAt.getTime();
    return {
      duration_ms,
      turns_per_second: turnCount / (durationMs / 1000),
      avg_turn_latency_ms: durationMs / turnCount
    };
  }

  private evaluatePass(oracles: any, performance: any): boolean {
    // Evaluate if the run passed all oracles
    return !oracles.soft_lock && 
           !oracles.budget_violation && 
           !oracles.safety_violation &&
           performance.avg_turn_latency_ms < 5000; // 5 second threshold
  }

  private async generateArtifacts(runId: string, data: any): Promise<Array<{ kind: string; path: string; bytes: number }>> {
    const artifacts: Array<{ kind: string; path: string; bytes: number }> = [];

    // Generate JSON report
    const jsonReport = JSON.stringify(data, null, 2);
    const jsonPath = `artifacts/${runId}/report.json`;
    artifacts.push({
      kind: 'json',
      path: jsonPath,
      bytes: Buffer.byteLength(jsonReport, 'utf8')
    });

    // Generate HTML summary
    const htmlSummary = this.generateHtmlSummary(data);
    const htmlPath = `artifacts/${runId}/summary.html`;
    artifacts.push({
      kind: 'html',
      path: htmlPath,
      bytes: Buffer.byteLength(htmlSummary, 'utf8')
    });

    // Generate coverage heatmap
    if (data.coverage) {
      const heatmapSvg = this.generateCoverageHeatmap(data.coverage);
      const svgPath = `artifacts/${runId}/coverage.svg`;
      artifacts.push({
        kind: 'svg',
        path: svgPath,
        bytes: Buffer.byteLength(heatmapSvg, 'utf8')
      });
    }

    return artifacts;
  }

  private generateHtmlSummary(data: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Autoplay Run Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f0f0; padding: 10px; border-radius: 5px; }
        .section { margin: 20px 0; }
        .metric { display: inline-block; margin: 10px; padding: 10px; background: #e8f4f8; border-radius: 3px; }
        .pass { color: green; font-weight: bold; }
        .fail { color: red; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Autoplay Run Report</h1>
        <p><strong>Run ID:</strong> ${data.scenario?.world}/${data.scenario?.adventure}</p>
        <p><strong>Mode:</strong> ${data.mode}</p>
        <p><strong>Turns:</strong> ${data.turns_completed}</p>
    </div>
    
    <div class="section">
        <h2>Coverage Metrics</h2>
        ${Object.entries(data.coverage || {}).map(([key, value]) => 
          `<div class="metric"><strong>${key}:</strong> ${(value as number * 100).toFixed(1)}%</div>`
        ).join('')}
    </div>
    
    <div class="section">
        <h2>Oracle Results</h2>
        ${Object.entries(data.oracles || {}).map(([key, value]) => 
          `<div class="metric ${value ? 'fail' : 'pass'}"><strong>${key}:</strong> ${value ? 'FAIL' : 'PASS'}</div>`
        ).join('')}
    </div>
    
    <div class="section">
        <h2>Performance</h2>
        <div class="metric"><strong>Duration:</strong> ${data.performance?.duration_ms}ms</div>
        <div class="metric"><strong>Avg Turn Latency:</strong> ${data.performance?.avg_turn_latency_ms}ms</div>
    </div>
</body>
</html>`;
  }

  private generateCoverageHeatmap(coverage: any): string {
    // Generate SVG heatmap for coverage visualization
    const entries = Object.entries(coverage);
    const width = 400;
    const height = entries.length * 30;
    
    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
    
    entries.forEach(([key, value], index) => {
      const percentage = (value as number) * 100;
      const color = percentage > 80 ? '#4CAF50' : percentage > 60 ? '#FFC107' : '#F44336';
      const barWidth = (percentage / 100) * (width - 150);
      
      svg += `
        <rect x="150" y="${index * 30 + 5}" width="${barWidth}" height="20" fill="${color}"/>
        <text x="10" y="${index * 30 + 20}" font-family="Arial" font-size="12">${key}</text>
        <text x="${barWidth + 160}" y="${index * 30 + 20}" font-family="Arial" font-size="12">${percentage.toFixed(1)}%</text>
      `;
    });
    
    svg += '</svg>';
    return svg;
  }

  private async saveCheckpoint(runId: string, checkpoint: any): Promise<void> {
    // Save checkpoint to database or file system
    // Implementation would depend on storage strategy
  }

  private async loadCheckpoint(runId: string): Promise<any> {
    // Load checkpoint from database or file system
    return null;
  }

  private async saveRunResult(result: RunResult): Promise<void> {
    const { data, error } = await this.supabase
      .from('autoplay_runs')
      .insert({
        id: result.run_id,
        scenario: result.scenario,
        seed: result.scenario.rng_seed,
        mode: result.mode,
        status: result.status,
        started_at: result.started_at.toISOString(),
        finished_at: result.finished_at.toISOString(),
        metrics: {
          coverage: result.coverage,
          oracles: result.oracles,
          performance: result.performance
        },
        pass: result.pass
      });

    if (error) {
      console.error('Failed to save run result:', error);
    }

    // Save artifacts
    for (const artifact of result.artifacts) {
      await this.supabase
        .from('autoplay_artifacts')
        .insert({
          run_id: result.run_id,
          kind: artifact.kind,
          path: artifact.path,
          bytes: artifact.bytes
        });
    }
  }
}
