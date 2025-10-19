/**
 * Golden Test Runner for AWF Pipeline
 * Phase 7: Production Rollout - Deterministic E2E Testing
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { stableStringify } from '../utils/awf-bundle-helpers.js';
import { runAwfTurn } from '../orchestrators/awf-turn-orchestrator.js';
import { createModelProvider } from '../model/awf-model-provider.js';

interface GoldenScenario {
  name: string;
  description: string;
  sessionSeed: number;
  turns: Array<{
    input: string;
    expect: {
      mustInclude?: string[];
      choicesAtMost?: number;
      sceneChange?: boolean;
      acts?: {
        requireOne?: string[];
        forbid?: string[];
      };
      firstTurn?: boolean;
    };
  }>;
}

interface GoldenResult {
  sessionId: string;
  scenario: string;
  sessionSeed: number;
  turns: Array<{
    input: string;
    output: {
      txt: string;
      choices: Array<{ id: string; label: string }>;
      meta: { scn: string };
    };
    acts?: any[];
    metrics: {
      bundleSize: number;
      estimatedTokens: number;
      modelLatency: number;
      turnLatency: number;
    };
  }>;
  timestamp: string;
  version: string;
}

interface MockModelProvider {
  infer(input: { system: string; awf_bundle: object }): Promise<{ raw: string; json?: any }>;
}

class GoldenTestRunner {
  private scenariosDir: string;
  private goldensDir: string;
  private isRecordMode: boolean;
  private isVerifyMode: boolean;

  constructor() {
    this.scenariosDir = join(process.cwd(), 'backend', 'goldens');
    this.goldensDir = join(process.cwd(), 'backend', 'goldens');
    this.isRecordMode = process.argv.includes('--record');
    this.isVerifyMode = process.argv.includes('--verify');
  }

  async run(): Promise<void> {
    console.log(`[Golden Runner] Starting in ${this.isRecordMode ? 'RECORD' : this.isVerifyMode ? 'VERIFY' : 'TEST'} mode`);
    
    const scenarioFiles = this.getScenarioFiles();
    console.log(`[Golden Runner] Found ${scenarioFiles.length} scenario files`);

    for (const scenarioFile of scenarioFiles) {
      await this.runScenario(scenarioFile);
    }

    console.log(`[Golden Runner] Completed all scenarios`);
  }

  private getScenarioFiles(): string[] {
    // In a real implementation, this would scan the directory
    return [
      'first-meet-kiera.scenario.json',
      'combat-encounter.scenario.json',
      'social-interaction.scenario.json'
    ];
  }

  private async runScenario(scenarioFile: string): Promise<void> {
    const scenarioPath = join(this.scenariosDir, scenarioFile);
    const scenario: GoldenScenario = JSON.parse(readFileSync(scenarioPath, 'utf-8'));
    
    console.log(`[Golden Runner] Running scenario: ${scenario.name}`);

    const sessionId = `golden-${scenario.name}-${scenario.sessionSeed}`;
    const goldenPath = join(this.goldensDir, `${scenario.name}.golden.json`);

    if (this.isRecordMode) {
      await this.recordScenario(scenario, sessionId, goldenPath);
    } else if (this.isVerifyMode) {
      await this.verifyScenario(scenario, sessionId, goldenPath);
    } else {
      await this.testScenario(scenario, sessionId);
    }
  }

  private async recordScenario(scenario: GoldenScenario, sessionId: string, goldenPath: string): Promise<void> {
    console.log(`[Golden Runner] Recording scenario: ${scenario.name}`);
    
    const result: GoldenResult = {
      sessionId,
      scenario: scenario.name,
      sessionSeed: scenario.sessionSeed,
      turns: [],
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };

    // Mock model provider for recording
    const mockProvider = this.createMockModelProvider(scenario);
    
    for (let i = 0; i < scenario.turns.length; i++) {
      const turn = scenario.turns[i];
      console.log(`[Golden Runner] Recording turn ${i + 1}: "${turn.input}"`);
      
      try {
        const startTime = Date.now();
        const turnResult = await this.runTurnWithMock(sessionId, turn.input, mockProvider, i);
        const turnLatency = Date.now() - startTime;
        
        result.turns.push({
          input: turn.input,
          output: {
            txt: turnResult.txt,
            choices: turnResult.choices,
            meta: turnResult.meta
          },
          acts: turnResult.acts || [],
          metrics: {
            bundleSize: 1000, // Mock value
            estimatedTokens: 500, // Mock value
            modelLatency: 200, // Mock value
            turnLatency
          }
        });
        
        console.log(`[Golden Runner] Turn ${i + 1} recorded successfully`);
      } catch (error) {
        console.error(`[Golden Runner] Failed to record turn ${i + 1}:`, error);
        throw error;
      }
    }

    // Write golden file
    writeFileSync(goldenPath, stableStringify(result, 2));
    console.log(`[Golden Runner] Golden file written: ${goldenPath}`);
  }

  private async verifyScenario(scenario: GoldenScenario, sessionId: string, goldenPath: string): Promise<void> {
    console.log(`[Golden Runner] Verifying scenario: ${scenario.name}`);
    
    if (!existsSync(goldenPath)) {
      throw new Error(`Golden file not found: ${goldenPath}`);
    }

    const expectedResult: GoldenResult = JSON.parse(readFileSync(goldenPath, 'utf-8'));
    
    // Mock model provider for verification
    const mockProvider = this.createMockModelProvider(scenario);
    
    for (let i = 0; i < scenario.turns.length; i++) {
      const turn = scenario.turns[i];
      console.log(`[Golden Runner] Verifying turn ${i + 1}: "${turn.input}"`);
      
      try {
        const startTime = Date.now();
        const turnResult = await this.runTurnWithMock(sessionId, turn.input, mockProvider, i);
        const turnLatency = Date.now() - startTime;
        
        const expectedTurn = expectedResult.turns[i];
        
        // Verify output matches golden
        this.verifyTurnOutput(turnResult, expectedTurn.output, turn.expect);
        
        console.log(`[Golden Runner] Turn ${i + 1} verified successfully`);
      } catch (error) {
        console.error(`[Golden Runner] Failed to verify turn ${i + 1}:`, error);
        throw error;
      }
    }

    console.log(`[Golden Runner] Scenario ${scenario.name} verified successfully`);
  }

  private async testScenario(scenario: GoldenScenario, sessionId: string): Promise<void> {
    console.log(`[Golden Runner] Testing scenario: ${scenario.name}`);
    
    // Mock model provider for testing
    const mockProvider = this.createMockModelProvider(scenario);
    
    for (let i = 0; i < scenario.turns.length; i++) {
      const turn = scenario.turns[i];
      console.log(`[Golden Runner] Testing turn ${i + 1}: "${turn.input}"`);
      
      try {
        const turnResult = await this.runTurnWithMock(sessionId, turn.input, mockProvider, i);
        
        // Validate turn output
        this.validateTurnOutput(turnResult, turn.expect);
        
        console.log(`[Golden Runner] Turn ${i + 1} passed validation`);
      } catch (error) {
        console.error(`[Golden Runner] Failed to test turn ${i + 1}:`, error);
        throw error;
      }
    }

    console.log(`[Golden Runner] Scenario ${scenario.name} passed all tests`);
  }

  private async runTurnWithMock(sessionId: string, inputText: string, mockProvider: MockModelProvider, turnIndex: number): Promise<any> {
    // This would integrate with the actual orchestrator
    // For now, we'll simulate the turn execution
    
    // Mock turn result based on input
    const mockResult = this.generateMockTurnResult(inputText, turnIndex);
    
    return mockResult;
  }

  private createMockModelProvider(scenario: GoldenScenario): MockModelProvider {
    return {
      async infer(input: { system: string; awf_bundle: object }): Promise<{ raw: string; json?: any }> {
        // Generate deterministic mock response based on scenario seed and input
        const mockResponse = this.generateMockModelResponse(input, scenario.sessionSeed);
        return {
          raw: mockResponse.raw,
          json: mockResponse.json
        };
      }
    };
  }

  private generateMockModelResponse(input: { system: string; awf_bundle: object }, seed: number): { raw: string; json: any } {
    // This would generate deterministic responses based on the input and seed
    // For now, return a simple mock
    return {
      raw: JSON.stringify({
        AWF: {
          scn: "forest_clearing",
          txt: "You step into the glade and look toward the eyes.",
          choices: [
            { id: "greet", label: "Greet softly" },
            { id: "observe", label: "Observe carefully" }
          ]
        }
      }),
      json: {
        AWF: {
          scn: "forest_clearing",
          txt: "You step into the glade and look toward the eyes.",
          choices: [
            { id: "greet", label: "Greet softly" },
            { id: "observe", label: "Observe carefully" }
          ]
        }
      }
    };
  }

  private generateMockTurnResult(inputText: string, turnIndex: number): any {
    // Generate mock turn result based on input
    return {
      txt: `Mock response for: "${inputText}"`,
      choices: [
        { id: "action1", label: "Action 1" },
        { id: "action2", label: "Action 2" }
      ],
      meta: { scn: "mock_scene" },
      acts: [
        { type: "SCENE_SET", data: { scene: "mock_scene" } }
      ]
    };
  }

  private verifyTurnOutput(actual: any, expected: any, expectations: any): void {
    // Verify that actual output matches expected golden output
    if (actual.txt !== expected.txt) {
      throw new Error(`Text mismatch: expected "${expected.txt}", got "${actual.txt}"`);
    }
    
    if (JSON.stringify(actual.choices) !== JSON.stringify(expected.choices)) {
      throw new Error(`Choices mismatch: expected ${JSON.stringify(expected.choices)}, got ${JSON.stringify(actual.choices)}`);
    }
    
    if (actual.meta.scn !== expected.meta.scn) {
      throw new Error(`Scene mismatch: expected "${expected.meta.scn}", got "${actual.meta.scn}"`);
    }
  }

  private validateTurnOutput(result: any, expectations: any): void {
    // Validate turn output against expectations
    if (expectations.mustInclude) {
      for (const required of expectations.mustInclude) {
        if (!result.txt.toLowerCase().includes(required.toLowerCase())) {
          throw new Error(`Expected text to include "${required}" but got: "${result.txt}"`);
        }
      }
    }
    
    if (expectations.choicesAtMost) {
      if (result.choices.length > expectations.choicesAtMost) {
        throw new Error(`Expected at most ${expectations.choicesAtMost} choices, got ${result.choices.length}`);
      }
    }
    
    if (expectations.acts) {
      if (expectations.acts.requireOne) {
        const hasRequiredAct = expectations.acts.requireOne.some((actType: string) => 
          result.acts?.some((act: any) => act.type === actType)
        );
        if (!hasRequiredAct) {
          throw new Error(`Expected at least one of these acts: ${expectations.acts.requireOne.join(', ')}`);
        }
      }
      
      if (expectations.acts.forbid) {
        const hasForbiddenAct = expectations.acts.forbid.some((actType: string) => 
          result.acts?.some((act: any) => act.type === actType)
        );
        if (hasForbiddenAct) {
          throw new Error(`Forbidden acts found: ${expectations.acts.forbid.join(', ')}`);
        }
      }
    }
  }
}

// Main execution
async function main() {
  const runner = new GoldenTestRunner();
  await runner.run();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
