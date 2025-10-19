import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AwfLinter } from '../src/authoring/awf-lint.js';
import { SchemaVersionManager } from '../src/schema/versioning.js';
import { SemverDiff } from '../src/schema/semver-diff.js';
import { PlaytestHarness } from '../src/playtest/harness.js';
import { PublishGate } from '../src/admin/publish-gate.js';
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

describe('Phase 9: Content Operations Hardening', () => {
  const testDir = './test-temp';
  
  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });
  
  afterEach(() => {
    // Clean up test files
    try {
      if (existsSync(testDir)) {
        const fs = require('fs');
        const path = require('path');
        const files = fs.readdirSync(testDir);
        for (const file of files) {
          fs.unlinkSync(join(testDir, file));
        }
        fs.rmdirSync(testDir);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Authoring Linter', () => {
    it('should catch schema validation errors', async () => {
      const linter = new AwfLinter();
      
      // Create a test document with missing required fields
      const invalidDoc = {
        // Missing contract field
        world: { id: 'test' }
      };
      
      const testFile = join(testDir, 'invalid-core.json');
      writeFileSync(testFile, JSON.stringify(invalidDoc, null, 2));
      
      const result = linter.lintDocument(invalidDoc, 'core/contract/test.json');
      
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some(issue => issue.rule === 'schema_validation')).toBe(true);
    });

    it('should catch tone policy violations', async () => {
      const linter = new AwfLinter();
      
      // Create a test document with tone violations
      const invalidDoc = {
        contract: {
          txt: {
            policy: 'This is a single sentence.' // Too few sentences
          },
          choices: [
            { id: 'choice1', label: 'This is a very long choice label that exceeds the 48 character limit and should trigger a violation' }
          ]
        }
      };
      
      const testFile = join(testDir, 'tone-violations.json');
      writeFileSync(testFile, JSON.stringify(invalidDoc, null, 2));
      
      const result = linter.lintDocument(invalidDoc, testFile);
      
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some(issue => issue.rule === 'tone_policy')).toBe(true);
    });

    it('should catch acts budget issues', async () => {
      const linter = new AwfLinter();
      
      // Create a test document with acts budget issues
      const invalidDoc = {
        contract: {
          acts: {
            allowed: ['SCENE_SET'], // Only one allowed act
            exemplars: {
              'SCENE_SET': 'Set the scene',
              'TIME_ADVANCE': 'Advance time' // Unused exemplar
            }
          }
        }
      };
      
      const testFile = join(testDir, 'acts-budget.json');
      writeFileSync(testFile, JSON.stringify(invalidDoc, null, 2));
      
      const result = linter.lintDocument(invalidDoc, testFile);
      
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some(issue => issue.rule === 'acts_budget')).toBe(true);
    });

    it('should catch first-turn rule violations', async () => {
      const linter = new AwfLinter();
      
      // Create a start document without no_time_advance rule
      const invalidDoc = {
        adventure_start: {
          // Missing rules.no_time_advance
          narrative: 'You begin your adventure...'
        }
      };
      
      const testFile = join(testDir, 'start-violations.json');
      writeFileSync(testFile, JSON.stringify(invalidDoc, null, 2));
      
      const result = linter.lintDocument(invalidDoc, 'start/test.json');
      
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some(issue => issue.rule === 'first_turn_rules')).toBe(true);
    });

    it('should catch stable ID violations', async () => {
      const linter = new AwfLinter();
      
      // Create a world document with invalid IDs
      const invalidDoc = {
        world: {
          places: [
            { id: 'Invalid ID', name: 'Test Place' }, // Contains space
            { id: 'UPPERCASE', name: 'Another Place' } // Contains uppercase
          ]
        }
      };
      
      const testFile = join(testDir, 'id-violations.json');
      writeFileSync(testFile, JSON.stringify(invalidDoc, null, 2));
      
      const result = linter.lintDocument(invalidDoc, testFile);
      
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some(issue => issue.rule === 'stable_ids')).toBe(true);
    });

    it('should catch time bands violations', async () => {
      const linter = new AwfLinter();
      
      // Create a world document with insufficient time bands
      const invalidDoc = {
        world: {
          timeworld: {
            bands: [
              { id: 'dawn', ticks: 1 },
              { id: 'day', ticks: 2 }
              // Only 2 bands, need at least 4
            ]
          }
        }
      };
      
      const testFile = join(testDir, 'time-bands.json');
      writeFileSync(testFile, JSON.stringify(invalidDoc, null, 2));
      
      const result = linter.lintDocument(invalidDoc, 'worlds/test.json');
      
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some(issue => issue.rule === 'time_bands')).toBe(true);
    });

    it('should pass valid documents', async () => {
      const linter = new AwfLinter();
      
      // Create a valid document
      const validDoc = {
        contract: {
          acts: { allowed: ['SCENE_SET', 'TIME_ADVANCE'] },
          txt: { policy: 'Write in second person. Use present tense. Keep it engaging.' },
          choices: [
            { id: 'choice1', label: 'Short choice' },
            { id: 'choice2', label: 'Another choice' }
          ]
        }
      };
      
      const testFile = join(testDir, 'valid-doc.json');
      writeFileSync(testFile, JSON.stringify(validDoc, null, 2));
      
      const result = linter.lintDocument(validDoc, testFile);
      
      expect(result.issues.length).toBe(0);
    });
  });

  describe('Schema Versioning', () => {
    it('should migrate documents between versions', async () => {
      const manager = new SchemaVersionManager();
      
      const mockDoc = {
        id: 'test-contract',
        type: 'core' as const,
        currentVersion: '4.0.0',
        content: {
          contract: {
            beats: {
              policy: 'Some policy text'
            },
            output: {
              budget: {
                // Missing max_acts
              }
            }
          }
        },
        ready_for_publish: false
      };
      
      const result = await manager.migrateDoc(mockDoc, '4.0.0', '5.0.0', { write: false, backup: false });
      
      console.log('Migration result:', result);
      expect(result.success).toBe(true);
      expect(result.migratedDoc.contract.beats.rules).toBe('Some policy text');
      expect(result.migratedDoc.contract.beats.policy).toBeUndefined();
      expect(result.migratedDoc.contract.output.budget.max_acts).toBe(8);
    });

    it('should handle migration failures gracefully', async () => {
      const manager = new SchemaVersionManager();
      
      const mockDoc = {
        id: 'test-doc',
        type: 'core' as const,
        currentVersion: '1.0.0',
        content: {},
        ready_for_publish: false
      };
      
      const result = await manager.migrateDoc(mockDoc, '1.0.0', '2.0.0', { write: false, backup: false });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No migration path found');
    });

    it('should generate changelog entries', async () => {
      const manager = new SchemaVersionManager();
      
      const mockDoc = {
        id: 'test-contract',
        type: 'core' as const,
        currentVersion: '4.0.0',
        content: { contract: { beats: { policy: 'test' } } },
        ready_for_publish: false
      };
      
      const result = await manager.migrateDoc(mockDoc, '4.0.0', '5.0.0', { write: false, backup: false });
      
      expect(result.success).toBe(true);
      expect(result.changelog).toContain('Migration from 4.0.0 to 5.0.0');
      expect(result.changelog).toContain('Rename beats.policy to beats.rules');
    });
  });

  describe('Semantic Diff', () => {
    it('should detect added fields', () => {
      const oldDoc = { name: 'Test', value: 42 };
      const newDoc = { name: 'Test', value: 42, newField: 'added' };
      
      const diff = SemverDiff.diff(oldDoc, newDoc);
      
      expect(diff.summary.added).toBe(1);
      expect(diff.changes.some(c => c.type === 'added' && c.path === 'newField')).toBe(true);
    });

    it('should detect removed fields', () => {
      const oldDoc = { name: 'Test', value: 42, oldField: 'removed' };
      const newDoc = { name: 'Test', value: 42 };
      
      const diff = SemverDiff.diff(oldDoc, newDoc);
      
      expect(diff.summary.removed).toBe(1);
      expect(diff.changes.some(c => c.type === 'removed' && c.path === 'oldField')).toBe(true);
    });

    it('should detect modified fields', () => {
      const oldDoc = { name: 'Test', value: 42 };
      const newDoc = { name: 'Test', value: 100 };
      
      const diff = SemverDiff.diff(oldDoc, newDoc);
      
      expect(diff.summary.modified).toBe(1);
      expect(diff.changes.some(c => c.type === 'modified' && c.path === 'value')).toBe(true);
    });

    it('should detect breaking changes', () => {
      const oldDoc = { contract: { acts: ['SCENE_SET'] } };
      const newDoc = { contract: { acts: 'SCENE_SET' } }; // Changed from array to string
      
      const diff = SemverDiff.diff(oldDoc, newDoc);
      
      expect(diff.breaking).toBe(true);
    });

    it('should generate markdown report', () => {
      const oldDoc = { name: 'Test', value: 42 };
      const newDoc = { name: 'Test', value: 100, newField: 'added' };
      
      const diff = SemverDiff.diff(oldDoc, newDoc);
      const report = SemverDiff.generateMarkdownReport(diff);
      
      expect(report).toContain('# Schema Diff Report');
      expect(report).toContain('**Summary:**');
      expect(report).toContain('### ➕ Added (1)');
    });
  });

  describe('Playtest Harness', () => {
    it('should run scenarios in verify mode', async () => {
      const harness = new PlaytestHarness('./test-temp/fixtures', './test-temp/scenarios');
      harness.setMode('verify');
      
      // Create a test scenario
      const scenario = {
        name: 'test-scenario',
        description: 'Test scenario',
        sessionSeed: 12345,
        turns: [
          {
            input: 'I look around',
            expect: {
              mustInclude: ['look'],
              choicesAtMost: 5
            }
          }
        ]
      };
      
      const scenarioFile = join(testDir, 'test-scenario.json');
      writeFileSync(scenarioFile, JSON.stringify(scenario, null, 2));
      
      // Mock the fixture for verify mode
      const fixtureDir = join(testDir, 'fixtures');
      if (!existsSync(fixtureDir)) {
        mkdirSync(fixtureDir, { recursive: true });
      }
      
      const mockResponse = {
        AWF: {
          scn: 'test_scene',
          txt: 'You look around and see...',
          choices: [
            { id: 'choice1', label: 'Continue' }
          ],
          acts: [
            { mode: 'SCENE_SET', key: 'current_scene', value: 'test_scene' }
          ]
        }
      };
      
      const fixtureFile = join(fixtureDir, 'test-12345_turn_0.json');
      writeFileSync(fixtureFile, JSON.stringify(mockResponse, null, 2));
      
      const results = await harness.runScenario(scenarioFile);
      
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });

    it('should detect expectation violations', async () => {
      const harness = new PlaytestHarness('./test-temp/fixtures', './test-temp/scenarios');
      harness.setMode('verify');
      
      const scenario = {
        name: 'violation-test',
        description: 'Test expectation violations',
        sessionSeed: 54321,
        turns: [
          {
            input: 'I look around',
            expect: {
              mustInclude: ['missing_text'], // This should not be found
              choicesAtMost: 1
            }
          }
        ]
      };
      
      const scenarioFile = join(testDir, 'violation-scenario.json');
      writeFileSync(scenarioFile, JSON.stringify(scenario, null, 2));
      
      // Create fixture with content that doesn't match expectations
      const fixtureDir = join(testDir, 'fixtures');
      if (!existsSync(fixtureDir)) {
        mkdirSync(fixtureDir, { recursive: true });
      }
      
      const mockResponse = {
        AWF: {
          scn: 'test_scene',
          txt: 'You look around and see something else', // Doesn't contain 'missing_text'
          choices: [
            { id: 'choice1', label: 'Continue' },
            { id: 'choice2', label: 'Another choice' } // Too many choices
          ],
          acts: []
        }
      };
      
      const fixtureFile = join(fixtureDir, 'test-54321_turn_0.json');
      writeFileSync(fixtureFile, JSON.stringify(mockResponse, null, 2));
      
      const results = await harness.runScenario(scenarioFile);
      
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].issues.length).toBeGreaterThan(0);
    });

    it('should generate playtest report', async () => {
      const harness = new PlaytestHarness('./test-temp/fixtures', './test-temp/scenarios');
      harness.setMode('verify');
      
      // Create multiple test scenarios
      const scenarios = [
        {
          name: 'scenario1',
          description: 'First scenario',
          sessionSeed: 11111,
          turns: [{ input: 'test1' }]
        },
        {
          name: 'scenario2',
          description: 'Second scenario',
          sessionSeed: 22222,
          turns: [{ input: 'test2' }]
        }
      ];
      
      for (let i = 0; i < scenarios.length; i++) {
        const scenarioFile = join(testDir, `scenario${i + 1}.json`);
        writeFileSync(scenarioFile, JSON.stringify(scenarios[i], null, 2));
        
        // Create corresponding fixtures
        const fixtureDir = join(testDir, 'fixtures');
        if (!existsSync(fixtureDir)) {
          mkdirSync(fixtureDir, { recursive: true });
        }
        
        const mockResponse = {
          AWF: {
            scn: 'test_scene',
            txt: 'Test response',
            choices: [],
            acts: []
          }
        };
        
        const fixtureFile = join(fixtureDir, `test-${scenarios[i].sessionSeed}_turn_0.json`);
        writeFileSync(fixtureFile, JSON.stringify(mockResponse, null, 2));
      }
      
      // Create test scenario files with proper format
      const scenario1 = {
        name: 'test-scenario-1',
        sessionSeed: 12345,
        turns: [
          {
            input: 'I look around the test area',
            expect: {
              mustInclude: ['test'],
              choicesAtMost: 3
            }
          }
        ]
      };
      
      const scenario2 = {
        name: 'test-scenario-2', 
        sessionSeed: 67890,
        turns: [
          {
            input: 'I examine the test environment',
            expect: {
              mustInclude: ['test'],
              choicesAtMost: 3
            }
          }
        ]
      };
      
      // Create fixture files for the scenarios (AWF format)
      const fixture1 = {
        AWF: {
          scn: 'test-scene-1',
          txt: 'You are in a test area. Everything looks test-like.',
          choices: [
            { id: 'choice1', label: 'Test option 1' },
            { id: 'choice2', label: 'Test option 2' }
          ],
          acts: []
        }
      };
      
      const fixture2 = {
        AWF: {
          scn: 'test-scene-2', 
          txt: 'You examine the test environment. It appears to be a test.',
          choices: [
            { id: 'choice1', label: 'Test option 1' },
            { id: 'choice2', label: 'Test option 2' }
          ],
          acts: []
        }
      };
      
      // Create fixtures directory and files
      const fixturesDir = join(harness.fixturesDir);
      if (!existsSync(fixturesDir)) {
        mkdirSync(fixturesDir, { recursive: true });
      }
      
      writeFileSync(join(fixturesDir, 'test-12345_turn_0.json'), JSON.stringify(fixture1, null, 2));
      writeFileSync(join(fixturesDir, 'test-67890_turn_0.json'), JSON.stringify(fixture2, null, 2));
      
      // Clean up any existing scenario files first
      if (existsSync(harness.scenariosDir)) {
        const fs = require('fs');
        const files = fs.readdirSync(harness.scenariosDir, { recursive: true });
        for (const file of files) {
          if (typeof file === 'string' && file.endsWith('.json')) {
            const filePath = join(harness.scenariosDir, file);
            if (existsSync(filePath)) {
              unlinkSync(filePath);
            }
          }
        }
      }
      
      // Ensure scenarios directory exists
      if (!existsSync(harness.scenariosDir)) {
        mkdirSync(harness.scenariosDir, { recursive: true });
      }
      
      const scenario1Path = join(harness.scenariosDir, 'scenario1.json');
      const scenario2Path = join(harness.scenariosDir, 'scenario2.json');
      
      writeFileSync(scenario1Path, JSON.stringify(scenario1, null, 2));
      writeFileSync(scenario2Path, JSON.stringify(scenario2, null, 2));
      
      // Debug: Check if files exist
      console.log('Scenario 1 exists:', existsSync(scenario1Path));
      console.log('Scenario 2 exists:', existsSync(scenario2Path));
      console.log('Scenarios dir:', harness.scenariosDir);
      
      // List files in scenarios directory
      const fs = require('fs');
      const files = fs.readdirSync(harness.scenariosDir, { recursive: true });
      console.log('Files in scenarios dir:', files);
      
      const report = await harness.runAllScenarios();
      
      expect(report.summary.totalScenarios).toBe(2);
      expect(report.summary.passedScenarios).toBe(2);
      expect(report.summary.totalTurns).toBe(2);
      expect(report.summary.passedTurns).toBe(2);
    });
  });

  describe('Publish Gate', () => {
    it('should check publish readiness with lint and playtest', async () => {
      const gate = new PublishGate();
      
      // Create mock lint report (passing)
      const lintReport = {
        timestamp: new Date().toISOString(),
        summary: {
          totalErrors: 0,
          totalWarnings: 2
        }
      };
      
      const lintFile = join(testDir, 'lint-report.json');
      writeFileSync(lintFile, JSON.stringify(lintReport, null, 2));
      
      // Create mock playtest report (passing)
      const playtestReport = {
        timestamp: new Date().toISOString(),
        summary: {
          failedScenarios: 0,
          failedTurns: 0,
          averageLatency: 5000,
          tokenUsage: { average: 3000 }
        }
      };
      
      const playtestFile = join(testDir, 'playtest-report.json');
      writeFileSync(playtestFile, JSON.stringify(playtestReport, null, 2));
      
      const check = await gate.checkPublishReadiness(
        'test-doc',
        'adventure',
        '1.0.0',
        lintFile,
        playtestFile
      );
      
      expect(check.checks.lintPassed).toBe(true);
      expect(check.checks.playtestPassed).toBe(true);
      expect(check.readyForPublish).toBe(true);
    });

    it('should reject documents with lint errors', async () => {
      const gate = new PublishGate();
      
      // Create mock lint report (failing)
      const lintReport = {
        timestamp: new Date().toISOString(),
        summary: {
          totalErrors: 3,
          totalWarnings: 1
        }
      };
      
      const lintFile = join(testDir, 'failing-lint-report.json');
      writeFileSync(lintFile, JSON.stringify(lintReport, null, 2));
      
      const check = await gate.checkPublishReadiness(
        'failing-doc',
        'world',
        '1.0.0',
        lintFile
      );
      
      expect(check.checks.lintPassed).toBe(false);
      expect(check.readyForPublish).toBe(false);
    });

    it('should reject documents with playtest failures', async () => {
      const gate = new PublishGate();
      
      // Create mock playtest report (failing)
      const playtestReport = {
        timestamp: new Date().toISOString(),
        summary: {
          failedScenarios: 1,
          failedTurns: 2,
          averageLatency: 10000, // Exceeds threshold
          tokenUsage: { average: 7000 } // Exceeds threshold
        }
      };
      
      const playtestFile = join(testDir, 'failing-playtest-report.json');
      writeFileSync(playtestFile, JSON.stringify(playtestReport, null, 2));
      
      const check = await gate.checkPublishReadiness(
        'failing-doc',
        'adventure',
        '1.0.0',
        undefined,
        playtestFile
      );
      
      expect(check.checks.playtestPassed).toBe(false);
      expect(check.readyForPublish).toBe(false);
    });

    it('should allow setting publish ready when checks pass', async () => {
      const gate = new PublishGate();
      
      // First check readiness
      const check = await gate.checkPublishReadiness('test-doc', 'core', '1.0.0');
      check.checks.lintPassed = true;
      check.checks.playtestPassed = true;
      check.readyForPublish = true;
      
      // Set publish ready
      const result = await gate.setPublishReady('test-doc', 'core', true, 'admin');
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('marked as ready');
    });

    it('should reject setting publish ready when checks fail', async () => {
      const gate = new PublishGate();
      
      // Check readiness (failing)
      const check = await gate.checkPublishReadiness('failing-doc', 'world', '1.0.0');
      check.checks.lintPassed = false;
      check.checks.playtestPassed = false;
      check.readyForPublish = false;
      
      // Try to set publish ready
      const result = await gate.setPublishReady('failing-doc', 'world', true, 'admin');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('not ready for publish');
    });

    it('should generate publish gate report', () => {
      const gate = new PublishGate();
      
      // Add some mock checks
      gate.checkPublishReadiness('doc1', 'core', '1.0.0');
      gate.checkPublishReadiness('doc2', 'world', '1.0.0');
      
      const report = gate.generateReport();
      
      expect(report.checks).toHaveLength(2);
      expect(report.summary.total).toBe(2);
      expect(report.timestamp).toBeDefined();
    });
  });
});
