/**
 * AWF Simulation Runner CLI
 * Monte Carlo balance testing and encounter simulation
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { simulationRunner, SimulationConfig, SimulationResult } from '../src/sim/sim-runner.js';

interface CLIOptions {
  config: string;
  trials?: number;
  seed?: number;
  output?: string;
  format?: 'csv' | 'json';
  verbose?: boolean;
}

class SimulationCLI {
  private options: CLIOptions;

  constructor(options: CLIOptions) {
    this.options = {
      trials: 2000,
      seed: 1337,
      output: 'simulation-results',
      format: 'json',
      verbose: false,
      ...options,
    };
  }

  /**
   * Run simulation from config file
   */
  async runSimulation(): Promise<void> {
    try {
      // Load configuration
      const config = this.loadConfig(this.options.config);
      
      // Override config with CLI options
      if (this.options.trials) config.trials = this.options.trials;
      if (this.options.seed) config.seed = this.options.seed;

      console.log(`Running simulation: ${config.name}`);
      console.log(`Trials: ${config.trials}, Seed: ${config.seed}`);
      console.log(`Description: ${config.description}`);

      // Run simulation
      const startTime = Date.now();
      const result = await simulationRunner.runSimulation(config);
      const endTime = Date.now();

      console.log(`\nSimulation completed in ${endTime - startTime}ms`);
      console.log(`Success rate: ${(result.stats.successRate * 100).toFixed(2)}%`);
      console.log(`Average turns: ${result.stats.averageTurns.toFixed(2)}`);
      console.log(`Average resources:`);
      for (const [resourceId, value] of Object.entries(result.stats.averageResources)) {
        console.log(`  ${resourceId}: ${value.toFixed(2)}`);
      }

      // Export results
      await this.exportResults(result);

      console.log(`\nResults exported to: ${this.options.output}.${this.options.format}`);

    } catch (error) {
      console.error('Simulation failed:', error);
      process.exit(1);
    }
  }

  /**
   * Load configuration from file
   */
  private loadConfig(configPath: string): SimulationConfig {
    try {
      const configData = readFileSync(configPath, 'utf8');
      const config = JSON.parse(configData);
      
      // Validate required fields
      if (!config.name || !config.skills || !config.difficulty) {
        throw new Error('Invalid configuration: missing required fields');
      }

      return config;
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error}`);
    }
  }

  /**
   * Export results to file
   */
  private async exportResults(result: SimulationResult): Promise<void> {
    const outputPath = `${this.options.output}.${this.options.format}`;
    
    if (this.options.format === 'csv') {
      const csvData = simulationRunner.exportToCSV(result);
      writeFileSync(outputPath, csvData);
    } else {
      const jsonData = simulationRunner.exportToJSON(result);
      writeFileSync(outputPath, jsonData);
    }
  }
}

/**
 * CLI entry point
 */
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'encounter') {
    const configPath = args[1];
    if (!configPath) {
      console.error('Usage: npm run awf:sim:encounter <config-file> [options]');
      process.exit(1);
    }

    // Parse options
    const options: CLIOptions = { config: configPath };
    
    for (let i = 2; i < args.length; i += 2) {
      const flag = args[i];
      const value = args[i + 1];
      
      switch (flag) {
        case '--trials':
          options.trials = parseInt(value);
          break;
        case '--seed':
          options.seed = parseInt(value);
          break;
        case '--output':
          options.output = value;
          break;
        case '--format':
          options.format = value as 'csv' | 'json';
          break;
        case '--verbose':
          options.verbose = true;
          i--; // No value for this flag
          break;
      }
    }

    const cli = new SimulationCLI(options);
    cli.runSimulation().catch(error => {
      console.error('CLI error:', error);
      process.exit(1);
    });
  } else {
    console.log('Usage:');
    console.log('  npm run awf:sim:encounter <config-file> [options]');
    console.log('');
    console.log('Options:');
    console.log('  --trials <number>     Number of simulation trials (default: 2000)');
    console.log('  --seed <number>       Random seed for reproducibility (default: 1337)');
    console.log('  --output <path>       Output file path (default: simulation-results)');
    console.log('  --format <csv|json>  Output format (default: json)');
    console.log('  --verbose            Enable verbose output');
    console.log('');
    console.log('Example:');
    console.log('  npm run awf:sim:encounter sims/whispercross_wolves.json --trials 5000 --seed 1337 --csv');
    process.exit(1);
  }
}


