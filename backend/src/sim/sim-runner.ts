/**
 * Monte Carlo Simulation Harness
 * Balance testing and encounter simulation
 */

import { skillCheckEngine, SkillCheckContext, SkillCheckResult } from '../mechanics/skill-checks.js';
import { conditionsEngine, StatusMap } from '../mechanics/conditions.js';
import { resourcesEngine, ResourceMap } from '../mechanics/resources.js';

export interface SimulationConfig {
  name: string;
  description: string;
  trials: number;
  seed: number;
  skills: {
    [skillId: string]: {
      baseline: number;
      modifiers: number[];
    };
  };
  difficulty: number;
  statusPresets: {
    [target: string]: {
      [conditionId: string]: {
        stacks: number;
        duration: number;
        potency?: number;
      };
    };
  };
  resources: {
    [resourceId: string]: number;
  };
  encounter: {
    maxTurns: number;
    winCondition: string;
    loseCondition: string;
  };
}

export interface SimulationResult {
  config: SimulationConfig;
  stats: {
    successRate: number;
    averageTurns: number;
    averageResources: Record<string, number>;
    conditionUptimes: Record<string, number>;
    skillCheckDistribution: Record<string, number>;
  };
  percentiles: {
    turns: {
      p50: number;
      p95: number;
    };
    resources: {
      [resourceId: string]: {
        p50: number;
        p95: number;
      };
    };
  };
  rawData: {
    trials: Array<{
      success: boolean;
      turns: number;
      resources: Record<string, number>;
      conditions: Record<string, number>;
      skillChecks: Record<string, number>;
    }>;
  };
}

export class SimulationRunner {
  private readonly defaultTrials: number;

  constructor() {
    this.defaultTrials = parseInt(process.env.AWF_SIM_DEFAULT_TRIALS || '2000');
  }

  /**
   * Run Monte Carlo simulation
   */
  async runSimulation(config: SimulationConfig): Promise<SimulationResult> {
    const results: SimulationResult['rawData']['trials'] = [];
    
    for (let trial = 0; trial < config.trials; trial++) {
      const trialResult = await this.runSingleTrial(config, trial);
      results.push(trialResult);
    }

    return this.analyzeResults(config, results);
  }

  /**
   * Run a single simulation trial
   */
  private async runSingleTrial(
    config: SimulationConfig,
    trialIndex: number
  ): Promise<SimulationResult['rawData']['trials'][0]> {
    const sessionId = `sim-${config.seed}-${trialIndex}`;
    const resources = { ...config.resources };
    const status: StatusMap = { ...config.statusPresets };
    const skillChecks: Record<string, number> = {};
    const conditions: Record<string, number> = {};
    
    let turns = 0;
    let success = false;
    let lose = false;

    while (turns < config.encounter.maxTurns && !success && !lose) {
      turns++;

      // Process status ticking
      const statusActions = conditionsEngine.tickStatuses(status);
      for (const action of statusActions) {
        if (action.type === 'TICK_STATUS') {
          conditions[action.key] = (conditions[action.key] || 0) + 1;
        }
      }

      // Process resource curves
      const resourceActions = resourcesEngine.processResourceCurves(resources);
      for (const action of resourceActions) {
        if (action.type === 'RESOURCE_DELTA') {
          resources[action.key] = Math.max(0, resources[action.key] + action.delta);
        }
      }

      // Run skill checks
      for (const [skillId, skillConfig] of Object.entries(config.skills)) {
        const checkContext: SkillCheckContext = {
          actor: 'player',
          skill: skillId,
          difficulty: config.difficulty,
          modifiers: skillConfig.modifiers,
          sessionId,
          turnId: turns,
          checkId: `${skillId}-${turns}`,
        };

        const result = skillCheckEngine.rollCheck(checkContext);
        skillChecks[skillId] = (skillChecks[skillId] || 0) + 1;

        // Check for success/failure based on outcome
        if (result.outcome === 'crit' || result.outcome === 'success') {
          success = true;
          break;
        } else if (result.outcome === 'critfail') {
          lose = true;
          break;
        }
      }

      // Check win/lose conditions
      if (this.checkWinCondition(config.encounter.winCondition, resources, status)) {
        success = true;
      } else if (this.checkLoseCondition(config.encounter.loseCondition, resources, status)) {
        lose = true;
      }
    }

    return {
      success,
      turns,
      resources: { ...resources },
      conditions: { ...conditions },
      skillChecks: { ...skillChecks },
    };
  }

  /**
   * Analyze simulation results
   */
  private analyzeResults(
    config: SimulationConfig,
    results: SimulationResult['rawData']['trials']
  ): SimulationResult {
    const successfulTrials = results.filter(r => r.success);
    const successRate = successfulTrials.length / results.length;

    // Calculate average turns
    const averageTurns = results.reduce((sum, r) => sum + r.turns, 0) / results.length;

    // Calculate average resources
    const averageResources: Record<string, number> = {};
    for (const resourceId of Object.keys(config.resources)) {
      const total = results.reduce((sum, r) => sum + (r.resources[resourceId] || 0), 0);
      averageResources[resourceId] = total / results.length;
    }

    // Calculate condition uptimes
    const conditionUptimes: Record<string, number> = {};
    for (const [conditionId, count] of Object.entries(
      results.reduce((acc, r) => {
        for (const [key, value] of Object.entries(r.conditions)) {
          acc[key] = (acc[key] || 0) + value;
        }
        return acc;
      }, {} as Record<string, number>)
    )) {
      conditionUptimes[conditionId] = count / results.length;
    }

    // Calculate skill check distribution
    const skillCheckDistribution: Record<string, number> = {};
    for (const [skillId, count] of Object.entries(
      results.reduce((acc, r) => {
        for (const [key, value] of Object.entries(r.skillChecks)) {
          acc[key] = (acc[key] || 0) + value;
        }
        return acc;
      }, {} as Record<string, number>)
    )) {
      skillCheckDistribution[skillId] = count / results.length;
    }

    // Calculate percentiles
    const turns = results.map(r => r.turns).sort((a, b) => a - b);
    const percentiles = {
      turns: {
        p50: this.percentile(turns, 50),
        p95: this.percentile(turns, 95),
      },
      resources: {} as Record<string, { p50: number; p95: number }>,
    };

    for (const resourceId of Object.keys(config.resources)) {
      const values = results.map(r => r.resources[resourceId] || 0).sort((a, b) => a - b);
      percentiles.resources[resourceId] = {
        p50: this.percentile(values, 50),
        p95: this.percentile(values, 95),
      };
    }

    return {
      config,
      stats: {
        successRate,
        averageTurns,
        averageResources,
        conditionUptimes,
        skillCheckDistribution,
      },
      percentiles,
      rawData: { trials: results },
    };
  }

  /**
   * Check win condition
   */
  private checkWinCondition(
    condition: string,
    resources: ResourceMap,
    status: StatusMap
  ): boolean {
    // Simple win condition parsing
    if (condition.includes('hp > 0')) {
      return (resources.hp || 0) > 0;
    }
    if (condition.includes('mana > 50')) {
      return (resources.mana || 0) > 50;
    }
    return false;
  }

  /**
   * Check lose condition
   */
  private checkLoseCondition(
    condition: string,
    resources: ResourceMap,
    status: StatusMap
  ): boolean {
    // Simple lose condition parsing
    if (condition.includes('hp <= 0')) {
      return (resources.hp || 0) <= 0;
    }
    if (condition.includes('stress >= 100')) {
      return (resources.stress || 0) >= 100;
    }
    return false;
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedArray: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;
    
    if (upper >= sortedArray.length) return sortedArray[sortedArray.length - 1];
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  /**
   * Export results to CSV
   */
  exportToCSV(result: SimulationResult): string {
    const lines: string[] = [];
    
    // Header
    lines.push('Trial,Success,Turns,HP,Energy,Mana,Stress,SkillChecks,Conditions');
    
    // Data
    for (let i = 0; i < result.rawData.trials.length; i++) {
      const trial = result.rawData.trials[i];
      const skillCheckCount = Object.values(trial.skillChecks).reduce((sum, count) => sum + count, 0);
      const conditionCount = Object.values(trial.conditions).reduce((sum, count) => sum + count, 0);
      
      lines.push([
        i + 1,
        trial.success ? 1 : 0,
        trial.turns,
        trial.resources.hp || 0,
        trial.resources.energy || 0,
        trial.resources.mana || 0,
        trial.resources.stress || 0,
        skillCheckCount,
        conditionCount,
      ].join(','));
    }
    
    return lines.join('\n');
  }

  /**
   * Export results to JSON
   */
  exportToJSON(result: SimulationResult): string {
    return JSON.stringify(result, null, 2);
  }
}

// Singleton instance
export const simulationRunner = new SimulationRunner();


