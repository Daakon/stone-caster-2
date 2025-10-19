import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
// @ts-ignore - glob module types
import { glob } from 'glob';

export interface PlaytestScenario {
  name: string;
  description: string;
  sessionSeed: number;
  turns: PlaytestTurn[];
  expectedMetrics?: {
    maxTokens?: number;
    maxActs?: number;
    maxChoices?: number;
    timeAdvanceCount?: number;
  };
}

export interface PlaytestTurn {
  input: string;
  expect?: {
    mustInclude?: string[];
    choicesAtMost?: number;
    acts?: {
      requireOne?: string[];
      forbid?: string[];
    };
    firstTurn?: boolean;
  };
}

export interface PlaytestResult {
  scenario: string;
  turn: number;
  input: string;
  success: boolean;
  metrics: {
    tokens: number;
    acts: number;
    choices: number;
    timeAdvance: boolean;
    latency: number;
  };
  issues: string[];
  awfOutput?: any;
}

export interface PlaytestReport {
  timestamp: string;
  mode: 'record' | 'verify';
  scenarios: string[];
  results: PlaytestResult[];
  summary: {
    totalScenarios: number;
    passedScenarios: number;
    failedScenarios: number;
    totalTurns: number;
    passedTurns: number;
    failedTurns: number;
    averageLatency: number;
    tokenUsage: {
      min: number;
      max: number;
      average: number;
    };
  };
}

export interface MockModelProvider {
  generateMockModelResponse(input: { system: string; awf_bundle: any }): Promise<{ raw: string; json?: any }>;
}

export class PlaytestHarness {
  public fixturesDir: string;
  public scenariosDir: string;
  private mode: 'record' | 'verify';
  private mockModel?: MockModelProvider;

  constructor(fixturesDir: string = './playtests/fixtures', scenariosDir: string = './playtests/scenarios') {
    this.fixturesDir = fixturesDir;
    this.scenariosDir = scenariosDir;
    this.mode = 'verify'; // Default to verify mode
  }

  setMode(mode: 'record' | 'verify'): void {
    this.mode = mode;
  }

  setMockModel(provider: MockModelProvider): void {
    this.mockModel = provider;
  }

  async runScenario(scenarioPath: string): Promise<PlaytestResult[]> {
    const scenario = this.loadScenario(scenarioPath);
    const results: PlaytestResult[] = [];
    
    console.log(`🎮 Running scenario: ${scenario.name}`);
    
    for (let i = 0; i < scenario.turns.length; i++) {
      const turn = scenario.turns[i];
      const result = await this.runTurn(scenario, i, turn);
      results.push(result);
      
      if (!result.success) {
        console.log(`❌ Turn ${i + 1} failed: ${result.issues.join(', ')}`);
        break; // Stop on first failure
      } else {
        console.log(`✅ Turn ${i + 1} passed`);
      }
    }
    
    return results;
  }

  async runAllScenarios(): Promise<PlaytestReport> {
    const allResults: PlaytestResult[] = [];
    const scenarioNames: string[] = [];
    
    console.log('Looking for scenarios in:', this.scenariosDir);
    
    // Use fs.readdirSync instead of glob for simplicity
    const fs = require('fs');
    const path = require('path');
    
    let files: string[] = [];
    try {
      const entries = fs.readdirSync(this.scenariosDir, { recursive: true });
      files = entries
        .filter((entry: any) => typeof entry === 'string' && entry.endsWith('.json'))
        .map((entry: string) => path.join(this.scenariosDir, entry));
    } catch (error) {
      console.warn('Error reading scenarios directory:', error);
      return { 
        timestamp: new Date().toISOString(),
        mode: this.mode,
        scenarios: [],
        results: [], 
        summary: { totalScenarios: 0, passedScenarios: 0, failedScenarios: 0, totalTurns: 0, passedTurns: 0, failedTurns: 0, averageLatency: 0, tokenUsage: { min: 0, max: 0, average: 0 } } 
      };
    }
    
    console.log('Found scenario files:', files);
    
    if (files.length === 0) {
      console.warn('No scenario files found');
      return { 
        timestamp: new Date().toISOString(),
        mode: this.mode,
        scenarios: [],
        results: [], 
        summary: { totalScenarios: 0, passedScenarios: 0, failedScenarios: 0, totalTurns: 0, passedTurns: 0, failedTurns: 0, averageLatency: 0, tokenUsage: { min: 0, max: 0, average: 0 } } 
      };
    }
    
    console.log(`🔍 Found ${files.length} scenarios`);
    
    for (const scenarioFile of files) {
      const scenarioName = scenarioFile.replace(this.scenariosDir, '').replace(/^\//, '');
      scenarioNames.push(scenarioName);
      
      try {
        const results = await this.runScenario(scenarioFile);
        allResults.push(...results);
      } catch (error) {
        console.error(`❌ Failed to run scenario ${scenarioName}:`, error);
        allResults.push({
          scenario: scenarioName,
          turn: 0,
          input: '',
          success: false,
          metrics: { tokens: 0, acts: 0, choices: 0, timeAdvance: false, latency: 0 },
          issues: [`Scenario failed to load: ${error instanceof Error ? error.message : String(error)}`]
        });
      }
    }
    
    return this.generateReport(allResults, scenarioNames);
  }

  private loadScenario(scenarioPath: string): PlaytestScenario {
    try {
      const content = readFileSync(scenarioPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load scenario ${scenarioPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async runTurn(scenario: PlaytestScenario, turnIndex: number, turn: PlaytestTurn): Promise<PlaytestResult> {
    const startTime = Date.now();
    const issues: string[] = [];
    
    try {
      // Simulate AWF bundle assembly (would use real assembler in production)
      const awfBundle = this.assembleMockBundle(scenario, turnIndex, turn.input);
      
      // Simulate model call
      const modelResponse = await this.callModel(awfBundle);
      
      // Simulate validation
      const validationResult = this.validateAwfOutput(modelResponse);
      
      if (!validationResult.valid) {
        issues.push(`Validation failed: ${validationResult.errors.join(', ')}`);
      }
      
      // Extract metrics
      const metrics = this.extractMetrics(modelResponse, turnIndex);
      
      // Check expectations
      this.checkExpectations(turn, modelResponse, turnIndex, issues);
      
      // Check scenario-level expectations
      if (scenario.expectedMetrics) {
        this.checkScenarioMetrics(scenario.expectedMetrics, metrics, issues);
      }
      
      const success = issues.length === 0;
      const latency = Date.now() - startTime;
      
      return {
        scenario: scenario.name,
        turn: turnIndex,
        input: turn.input,
        success,
        metrics: { ...metrics, latency },
        issues,
        awfOutput: modelResponse
      };
      
    } catch (error) {
      return {
        scenario: scenario.name,
        turn: turnIndex,
        input: turn.input,
        success: false,
        metrics: { tokens: 0, acts: 0, choices: 0, timeAdvance: false, latency: Date.now() - startTime },
        issues: [`Turn execution failed: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  private assembleMockBundle(scenario: PlaytestScenario, turnIndex: number, input: string): any {
    // Mock bundle assembly - in production, this would use the real assembler
    return {
      contract: {
        acts: { allowed: ['SCENE_SET', 'TIME_ADVANCE', 'RELATION_DELTA'] },
        txt: { policy: 'Write in second person, present tense' }
      },
      world: {
        id: 'mystika',
        name: 'Mystika',
        timeworld: { bands: [{ id: 'dawn', ticks: 1 }, { id: 'day', ticks: 2 }] }
      },
      adventure: {
        id: 'whispercross',
        name: 'Whispercross',
        scenes: [{ id: 'forest_meet', name: 'Forest Meeting' }]
      },
      session: {
        id: `test-${scenario.sessionSeed}`,
        turn: turnIndex,
        input
      }
    };
  }

  private async callModel(awfBundle: any): Promise<any> {
    if (this.mode === 'record') {
      // In record mode, call real model and save output
      const response = await this.callRealModel(awfBundle);
      this.saveFixture(awfBundle, response);
      return response;
    } else {
      // In verify mode, load recorded fixture
      return this.loadFixture(awfBundle);
    }
  }

  private async callRealModel(awfBundle: any): Promise<any> {
    if (this.mockModel) {
      return await this.mockModel.generateMockModelResponse({
        system: 'You are a game master...',
        awf_bundle: awfBundle
      });
    }
    
    // Mock response for testing
    return {
      AWF: {
        scn: 'forest_meet',
        txt: `You step into the glade and look toward the eyes. The forest seems to hold its breath.`,
        choices: [
          { id: 'greet', label: 'Greet softly' },
          { id: 'approach', label: 'Approach cautiously' }
        ],
        acts: [
          { mode: 'SCENE_SET', key: 'current_scene', value: 'forest_meet' },
          { mode: 'TIME_ADVANCE', key: 'time', value: 1 }
        ]
      }
    };
  }

  private saveFixture(awfBundle: any, response: any): void {
    const fixturePath = this.getFixturePath(awfBundle);
    const fixtureDir = dirname(fixturePath);
    
    if (!existsSync(fixtureDir)) {
      mkdirSync(fixtureDir, { recursive: true });
    }
    
    writeFileSync(fixturePath, JSON.stringify(response, null, 2));
  }

  private loadFixture(awfBundle: any): any {
    const fixturePath = this.getFixturePath(awfBundle);
    
    if (!existsSync(fixturePath)) {
      throw new Error(`Fixture not found: ${fixturePath}. Run in record mode first.`);
    }
    
    return JSON.parse(readFileSync(fixturePath, 'utf-8'));
  }

  private getFixturePath(awfBundle: any): string {
    const sessionId = awfBundle.session?.id || 'unknown';
    const turn = awfBundle.session?.turn || 0;
    return join(this.fixturesDir, `${sessionId}_turn_${turn}.json`);
  }

  private validateAwfOutput(response: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!response.AWF) {
      errors.push('Missing AWF object');
    } else {
      const awf = response.AWF;
      
      if (!awf.scn) errors.push('Missing scn field');
      if (!awf.txt) errors.push('Missing txt field');
      
      if (awf.choices && awf.choices.length > 5) {
        errors.push('Too many choices (max 5)');
      }
      
      if (awf.acts && awf.acts.length > 8) {
        errors.push('Too many acts (max 8)');
      }
    }
    
    return { valid: errors.length === 0, errors };
  }

  private extractMetrics(response: any, turnIndex: number): { tokens: number; acts: number; choices: number; timeAdvance: boolean } {
    const awf = response.AWF || {};
    
    // Estimate tokens (rough calculation)
    const text = awf.txt || '';
    const tokens = Math.ceil(text.length / 4); // Rough estimate
    
    const acts = awf.acts?.length || 0;
    const choices = awf.choices?.length || 0;
    const timeAdvance = awf.acts?.some((act: any) => act.mode === 'TIME_ADVANCE') || false;
    
    return { tokens, acts, choices, timeAdvance };
  }

  private checkExpectations(turn: PlaytestTurn, response: any, turnIndex: number, issues: string[]): void {
    if (!turn.expect) return;
    
    const awf = response.AWF || {};
    const expect = turn.expect;
    
    // Check mustInclude
    if (expect.mustInclude) {
      const text = awf.txt || '';
      for (const required of expect.mustInclude) {
        if (!text.toLowerCase().includes(required.toLowerCase())) {
          issues.push(`Missing required text: "${required}"`);
        }
      }
    }
    
    // Check choicesAtMost
    if (expect.choicesAtMost !== undefined) {
      const choices = awf.choices?.length || 0;
      if (choices > expect.choicesAtMost) {
        issues.push(`Too many choices: ${choices} > ${expect.choicesAtMost}`);
      }
    }
    
    // Check acts requirements
    if (expect.acts) {
      const acts = awf.acts || [];
      
      if (expect.acts.requireOne) {
        const hasRequired = expect.acts.requireOne.some(required => 
          acts.some((act: any) => act.mode === required)
        );
        if (!hasRequired) {
          issues.push(`Missing required act: ${expect.acts.requireOne.join(' or ')}`);
        }
      }
      
      if (expect.acts.forbid) {
        const hasForbidden = expect.acts.forbid.some(forbidden => 
          acts.some((act: any) => act.mode === forbidden)
        );
        if (hasForbidden) {
          issues.push(`Contains forbidden act: ${expect.acts.forbid.join(' or ')}`);
        }
      }
    }
    
    // Check first turn rules
    if (expect.firstTurn) {
      const acts = awf.acts || [];
      const hasTimeAdvance = acts.some((act: any) => act.mode === 'TIME_ADVANCE');
      if (hasTimeAdvance) {
        issues.push('First turn should not have TIME_ADVANCE');
      }
    } else if (turnIndex > 0) {
      // Subsequent turns should have exactly one TIME_ADVANCE
      const acts = awf.acts || [];
      const timeAdvanceActs = acts.filter((act: any) => act.mode === 'TIME_ADVANCE');
      if (timeAdvanceActs.length !== 1) {
        issues.push(`Should have exactly one TIME_ADVANCE, found ${timeAdvanceActs.length}`);
      }
    }
  }

  private checkScenarioMetrics(expected: any, actual: any, issues: string[]): void {
    if (expected.maxTokens && actual.tokens > expected.maxTokens) {
      issues.push(`Token usage exceeds limit: ${actual.tokens} > ${expected.maxTokens}`);
    }
    
    if (expected.maxActs && actual.acts > expected.maxActs) {
      issues.push(`Act count exceeds limit: ${actual.acts} > ${expected.maxActs}`);
    }
    
    if (expected.maxChoices && actual.choices > expected.maxChoices) {
      issues.push(`Choice count exceeds limit: ${actual.choices} > ${expected.maxChoices}`);
    }
    
    if (expected.timeAdvanceCount !== undefined) {
      // This would need to be tracked across all turns
      // For now, just check the current turn
      if (expected.timeAdvanceCount === 0 && actual.timeAdvance) {
        issues.push('Unexpected TIME_ADVANCE found');
      }
    }
  }

  generateReport(results: PlaytestResult[], scenarioNames: string[]): PlaytestReport {
    const scenarios = [...new Set(results.map(r => r.scenario))];
    const passedScenarios = scenarios.filter(scenario => 
      results.filter(r => r.scenario === scenario).every(r => r.success)
    );
    const failedScenarios = scenarios.filter(scenario => !passedScenarios.includes(scenario));
    
    const totalTurns = results.length;
    const passedTurns = results.filter(r => r.success).length;
    const failedTurns = totalTurns - passedTurns;
    
    const latencies = results.map(r => r.metrics.latency);
    const averageLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    
    const tokens = results.map(r => r.metrics.tokens);
    const tokenUsage = {
      min: Math.min(...tokens),
      max: Math.max(...tokens),
      average: tokens.length > 0 ? tokens.reduce((a, b) => a + b, 0) / tokens.length : 0
    };
    
    return {
      timestamp: new Date().toISOString(),
      mode: this.mode,
      scenarios: scenarioNames,
      results,
      summary: {
        totalScenarios: scenarios.length,
        passedScenarios: passedScenarios.length,
        failedScenarios: failedScenarios.length,
        totalTurns,
        passedTurns,
        failedTurns,
        averageLatency,
        tokenUsage
      }
    };
  }

  printReport(report: PlaytestReport): void {
    console.log('\n🎮 Playtest Report');
    console.log('='.repeat(50));
    console.log(`Mode: ${report.mode}`);
    console.log(`Scenarios: ${report.summary.passedScenarios}/${report.summary.totalScenarios} passed`);
    console.log(`Turns: ${report.summary.passedTurns}/${report.summary.totalTurns} passed`);
    console.log(`Average Latency: ${report.summary.averageLatency.toFixed(2)}ms`);
    console.log(`Token Usage: ${report.summary.tokenUsage.average.toFixed(0)} avg (${report.summary.tokenUsage.min}-${report.summary.tokenUsage.max})`);
    
    if (report.summary.failedTurns > 0) {
      console.log('\n❌ Failed Turns:');
      const failedResults = report.results.filter(r => !r.success);
      for (const result of failedResults) {
        console.log(`  ${result.scenario} Turn ${result.turn + 1}: ${result.issues.join(', ')}`);
      }
    }
  }

  saveReport(report: PlaytestReport, outputPath: string): void {
    const dir = dirname(outputPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`📄 Report saved to: ${outputPath}`);
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const scenarioIndex = args.indexOf('--scenario');
  const allIndex = args.indexOf('--all');
  const recordIndex = args.indexOf('--record');
  const verifyIndex = args.indexOf('--verify');
  const outputIndex = args.indexOf('--output');

  if (allIndex === -1 && scenarioIndex === -1) {
    console.error('Usage: yarn awf:playtest:record --scenario <file> | yarn awf:playtest:verify --all [--output <file>]');
    process.exit(1);
  }

  const harness = new PlaytestHarness();
  
  if (recordIndex !== -1) {
    harness.setMode('record');
  } else if (verifyIndex !== -1) {
    harness.setMode('verify');
  }

  const outputPath = outputIndex !== -1 ? args[outputIndex + 1] : undefined;

  if (scenarioIndex !== -1) {
    const scenarioPath = args[scenarioIndex + 1];
    harness.runScenario(scenarioPath).then(results => {
      const report = harness.generateReport(results, [scenarioPath]);
      harness.printReport(report);
      
      if (outputPath) {
        harness.saveReport(report, outputPath);
      }
    });
  } else if (allIndex !== -1) {
    harness.runAllScenarios().then(report => {
      harness.printReport(report);
      
      if (outputPath) {
        harness.saveReport(report, outputPath);
      }
      
      process.exit(report.summary.failedTurns > 0 ? 1 : 0);
    });
  }
}
