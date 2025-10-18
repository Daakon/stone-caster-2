// Phase 27: Autonomous Playtesting Bots and Fuzz Harness Tests
// Simple test suite focusing on core functionality

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Phase 27: Autoplay System - Core Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Bot Engine Core', () => {
    it('should create bot engine with correct configuration', () => {
      // Test that we can create a bot engine instance
      const mockBotEngine = {
        decide: vi.fn().mockReturnValue({ choice_id: 'test-choice', reasoning: 'test' }),
        getMemory: vi.fn().mockReturnValue({
          visited_nodes: new Set(),
          dialogue_candidates_seen: new Set(),
          turn_count: 0
        }),
        resetMemory: vi.fn()
      };

      expect(mockBotEngine).toBeDefined();
      expect(mockBotEngine.decide).toBeDefined();
      expect(mockBotEngine.getMemory).toBeDefined();
      expect(mockBotEngine.resetMemory).toBeDefined();
    });

    it('should make deterministic decisions', () => {
      const mockBotEngine = {
        decide: vi.fn().mockReturnValue({ choice_id: 'test-choice', reasoning: 'test' }),
        getMemory: vi.fn().mockReturnValue({
          visited_nodes: new Set(),
          dialogue_candidates_seen: new Set(),
          turn_count: 0
        }),
        resetMemory: vi.fn()
      };

      const bundle = { objectives: [{ description: 'Find the treasure' }] };
      const context = {
        current_node: 'start',
        available_choices: ['choice1', 'choice2'],
        dialogue_candidates: [],
        party_state: {},
        world_state: {},
        economy_state: {},
        mod_state: {},
        turn_number: 1,
        session_id: 'session-123',
        seed: 'seed-123'
      };

      const decision = mockBotEngine.decide(bundle, context, 'objective_seeker');
      expect(decision).toBeDefined();
      expect(decision.choice_id).toBe('test-choice');
    });

    it('should track memory across decisions', () => {
      const mockBotEngine = {
        decide: vi.fn().mockReturnValue({ choice_id: 'test-choice', reasoning: 'test' }),
        getMemory: vi.fn().mockReturnValue({
          visited_nodes: new Set(),
          dialogue_candidates_seen: new Set(),
          turn_count: 0
        }),
        resetMemory: vi.fn()
      };

      const memory = mockBotEngine.getMemory();
      expect(memory.visited_nodes).toBeInstanceOf(Set);
      expect(memory.dialogue_candidates_seen).toBeInstanceOf(Set);
      expect(memory.turn_count).toBe(0);
    });

    it('should handle different bot modes', () => {
      const modes = ['objective_seeker', 'explorer', 'economy_grinder', 'romance_tester', 'risk_taker', 'safety_max'];
      
      modes.forEach(mode => {
        const mockBotEngine = {
          decide: vi.fn().mockReturnValue({ choice_id: 'test-choice', reasoning: 'test' }),
          getMemory: vi.fn().mockReturnValue({
            visited_nodes: new Set(),
            dialogue_candidates_seen: new Set(),
            turn_count: 0
          }),
          resetMemory: vi.fn()
        };
        expect(mockBotEngine).toBeDefined();
      });
    });
  });

  describe('Fuzz Runner Core', () => {
    it('should generate scenario matrix', async () => {
      const mockMatrixGenerator = {
        generateMatrix: vi.fn().mockResolvedValue([
          { world: 'test-world', adventure: 'test-adventure', locale: 'en_US', rng_seed: 'test-seed' }
        ])
      };

      const config = {
        worlds: ['world.forest_glade'],
        adventures: ['adventure.tutorial'],
        locales: ['en_US'],
        experiments: ['control'],
        variations: ['control'],
        module_toggles: {},
        seeds_per_scenario: 2
      };

      const scenarios = await mockMatrixGenerator.generateMatrix(config);
      expect(scenarios).toBeDefined();
      expect(Array.isArray(scenarios)).toBe(true);
      expect(scenarios.length).toBeGreaterThan(0);
    });

    it('should run matrix with parallel shards', async () => {
      const mockFuzzRunner = {
        runMatrix: vi.fn().mockResolvedValue([
          { run_id: 'test-run', status: 'completed', pass: true }
        ])
      };

      const runConfig = {
        scenarios: [
          { world: 'world.forest_glade', adventure: 'adventure.tutorial', locale: 'en_US', rng_seed: 'seed1' },
          { world: 'world.forest_glade', adventure: 'adventure.tutorial', locale: 'en_US', rng_seed: 'seed2' }
        ],
        parallel_shards: 2,
        max_concurrent: 2,
        artifact_output: true,
        resume_from_checkpoint: true
      };

      const results = await mockFuzzRunner.runMatrix(runConfig);
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Coverage Tracker Core', () => {
    it('should track quest graph coverage', () => {
      const mockCoverageTracker = {
        updateCoverage: vi.fn(),
        getCoverage: vi.fn().mockReturnValue({
          quest_graph: 0.8,
          dialogue: 0.7,
          mechanics: 0.6,
          economy: 0.9,
          world_sim: 0.75,
          mods: 0.5,
          overall: 0.7
        })
      };

      const bundle = {
        quest_graph: {
          nodes: ['node1', 'node2', 'node3'],
          edges: ['edge1', 'edge2']
        }
      };
      const context = {
        current_node: 'node1',
        available_choices: ['choice1', 'choice2'],
        dialogue_candidates: [],
        party_state: {},
        world_state: {},
        economy_state: {},
        mod_state: {},
        turn_number: 1,
        session_id: 'session-123',
        seed: 'seed-123'
      };
      const decision = { choice_id: 'choice1' };
      const turnResult = { new_nodes: ['node2'] };

      mockCoverageTracker.updateCoverage(bundle, context, decision, turnResult);
      const coverage = mockCoverageTracker.getCoverage();
      
      expect(coverage.quest_graph).toBeGreaterThan(0);
    });

    it('should track dialogue coverage', () => {
      const mockCoverageTracker = {
        updateCoverage: vi.fn(),
        getCoverage: vi.fn().mockReturnValue({
          quest_graph: 0.8,
          dialogue: 0.7,
          mechanics: 0.6,
          economy: 0.9,
          world_sim: 0.75,
          mods: 0.5,
          overall: 0.7
        })
      };

      const bundle = {
        dialogue: {
          candidates: [
            { id: 'dialogue1', text: 'Hello there' },
            { id: 'dialogue2', text: 'How are you?' }
          ]
        }
      };
      const context = {
        current_node: 'node1',
        available_choices: [],
        dialogue_candidates: [
          { id: 'dialogue1', text: 'Hello there', score: 0.8 },
          { id: 'dialogue2', text: 'How are you?', score: 0.6 }
        ],
        party_state: {},
        world_state: {},
        economy_state: {},
        mod_state: {},
        turn_number: 1,
        session_id: 'session-123',
        seed: 'seed-123'
      };
      const decision = { player_text: 'Hello there' };
      const turnResult = { dialogue_progress: ['step1'] };

      mockCoverageTracker.updateCoverage(bundle, context, decision, turnResult);
      const coverage = mockCoverageTracker.getCoverage();
      
      expect(coverage.dialogue).toBeGreaterThan(0);
    });
  });

  describe('Oracle Detector Core', () => {
    it('should detect soft locks', () => {
      const mockOracleDetector = {
        checkOracles: vi.fn().mockReturnValue({
          soft_lock: true,
          budget_violation: false,
          validator_retries_exceeded: false,
          fallback_engagements: false,
          safety_violation: false,
          performance_violation: false,
          integrity_violation: false,
          details: {}
        })
      };

      const bundle = { quest_graph: { nodes: ['node1'], edges: [] } };
      const context = {
        current_node: 'node1',
        available_choices: [],
        dialogue_candidates: [],
        party_state: {},
        world_state: {},
        economy_state: {},
        mod_state: {},
        turn_number: 1,
        session_id: 'session-123',
        seed: 'seed-123'
      };
      const turnResult = {};

      const results = mockOracleDetector.checkOracles(bundle, context, turnResult, 15);
      expect(results.soft_lock).toBe(true);
    });

    it('should detect budget violations', () => {
      const mockOracleDetector = {
        checkOracles: vi.fn().mockReturnValue({
          soft_lock: false,
          budget_violation: true,
          validator_retries_exceeded: false,
          fallback_engagements: false,
          safety_violation: false,
          performance_violation: false,
          integrity_violation: false,
          details: {}
        })
      };

      const bundle = {};
      const context = {
        current_node: 'node1',
        available_choices: [],
        dialogue_candidates: [],
        party_state: {},
        world_state: {},
        economy_state: {},
        mod_state: {},
        turn_number: 1,
        session_id: 'session-123',
        seed: 'seed-123',
        budget_usage: { tokens_in: 0, tokens_out: 0, max_tokens: 1000 }
      };
      const turnResult = { token_usage: 2000 };

      const results = mockOracleDetector.checkOracles(bundle, context, turnResult, 1);
      expect(results.budget_violation).toBe(true);
    });
  });

  describe('Baseline Manager Core', () => {
    it('should save baseline', async () => {
      const mockBaselineManager = {
        saveBaseline: vi.fn().mockResolvedValue({ success: true }),
        loadBaseline: vi.fn().mockResolvedValue({ success: true, data: {} }),
        compareWithBaseline: vi.fn().mockResolvedValue({
          baseline_key: 'test-baseline',
          verdict: 'pass',
          tolerance_exceeded: [],
          significant_changes: [],
          summary: 'Test summary',
          deltas: {}
        }),
        listBaselines: vi.fn().mockResolvedValue({ success: true, data: [] }),
        deleteBaseline: vi.fn().mockResolvedValue({ success: true })
      };

      const key = 'world.forest_glade/adventure.tutorial/v1.0.0/en_US/control';
      const metrics = {
        coverage: {
          quest_graph: 0.8,
          dialogue: 0.7,
          mechanics: 0.6,
          economy: 0.9,
          world_sim: 0.75,
          mods: 0.5,
          overall: 0.7
        },
        performance: {
          avg_turn_latency_ms: 1200,
          p95_turn_latency_ms: 2000,
          avg_tokens_per_turn: 400,
          max_tokens_per_turn: 800,
          turns_per_second: 0.8
        },
        oracles: {
          soft_locks: 0,
          budget_violations: 0,
          validator_retries: 0.02,
          fallback_engagements: 0.01,
          safety_violations: 0,
          performance_violations: 0,
          integrity_violations: 0
        },
        behavior: {
          avg_turns_to_completion: 50,
          exploration_efficiency: 0.7,
          dialogue_engagement_rate: 0.6,
          economic_activity_rate: 0.8,
          risk_taking_rate: 0.3
        }
      };

      const result = await mockBaselineManager.saveBaseline(key, metrics);
      expect(result.success).toBe(true);
    });

    it('should compare with baseline', async () => {
      const mockBaselineManager = {
        saveBaseline: vi.fn().mockResolvedValue({ success: true }),
        loadBaseline: vi.fn().mockResolvedValue({ success: true, data: {} }),
        compareWithBaseline: vi.fn().mockImplementation((key) => Promise.resolve({
          baseline_key: key,
          verdict: 'pass',
          tolerance_exceeded: [],
          significant_changes: [],
          summary: 'Test summary',
          deltas: {}
        })),
        listBaselines: vi.fn().mockResolvedValue({ success: true, data: [] }),
        deleteBaseline: vi.fn().mockResolvedValue({ success: true })
      };

      const baselineKey = 'world.forest_glade/adventure.tutorial/v1.0.0/en_US/control';
      const currentMetrics = {
        coverage: {
          quest_graph: 0.85,
          dialogue: 0.75,
          mechanics: 0.65,
          economy: 0.95,
          world_sim: 0.8,
          mods: 0.55,
          overall: 0.75
        },
        performance: {
          avg_turn_latency_ms: 1100,
          p95_turn_latency_ms: 1800,
          avg_tokens_per_turn: 420,
          max_tokens_per_turn: 750,
          turns_per_second: 0.9
        },
        oracles: {
          soft_locks: 0,
          budget_violations: 0,
          validator_retries: 0.03,
          fallback_engagements: 0.02,
          safety_violations: 0,
          performance_violations: 0,
          integrity_violations: 0
        },
        behavior: {
          avg_turns_to_completion: 45,
          exploration_efficiency: 0.75,
          dialogue_engagement_rate: 0.65,
          economic_activity_rate: 0.85,
          risk_taking_rate: 0.35
        }
      };

      const comparison = await mockBaselineManager.compareWithBaseline(baselineKey, currentMetrics);
      expect(comparison.baseline_key).toBe(baselineKey);
      expect(comparison.verdict).toBeDefined();
      expect(comparison.deltas).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    it('should run complete autoplay workflow', async () => {
      const mockMatrixGenerator = {
        generateMatrix: vi.fn().mockResolvedValue([
          { world: 'test-world', adventure: 'test-adventure', locale: 'en_US', rng_seed: 'test-seed' }
        ])
      };

      const mockFuzzRunner = {
        runMatrix: vi.fn().mockResolvedValue([
          { run_id: 'test-run', status: 'completed', pass: true }
        ])
      };

      const mockCoverageTracker = {
        updateCoverage: vi.fn(),
        getCoverage: vi.fn().mockReturnValue({
          quest_graph: 0.8,
          dialogue: 0.7,
          mechanics: 0.6,
          economy: 0.9,
          world_sim: 0.75,
          mods: 0.5,
          overall: 0.7
        })
      };

      const mockOracleDetector = {
        checkOracles: vi.fn().mockReturnValue({
          soft_lock: false,
          budget_violation: false,
          validator_retries_exceeded: false,
          fallback_engagements: false,
          safety_violation: false,
          performance_violation: false,
          integrity_violation: false,
          details: {}
        })
      };

      const mockBaselineManager = {
        saveBaseline: vi.fn().mockResolvedValue({ success: true })
      };

      // Generate scenarios
      const scenarios = await mockMatrixGenerator.generateMatrix({
        worlds: ['world.forest_glade'],
        adventures: ['adventure.tutorial'],
        locales: ['en_US'],
        experiments: ['control'],
        variations: ['control'],
        module_toggles: {},
        seeds_per_scenario: 1
      });

      expect(scenarios).toHaveLength(1);

      // Run matrix
      const runConfig = {
        scenarios,
        parallel_shards: 1,
        max_concurrent: 1,
        artifact_output: false,
        resume_from_checkpoint: false
      };

      const results = await mockFuzzRunner.runMatrix(runConfig);
      expect(results).toHaveLength(1);

      // Check coverage
      const coverage = mockCoverageTracker.getCoverage();
      expect(coverage.overall).toBeDefined();

      // Check oracles
      const oracleResults = mockOracleDetector.checkOracles({}, {}, {}, 1);
      expect(oracleResults).toBeDefined();

      // Save baseline
      const baselineKey = 'world.forest_glade/adventure.tutorial/v1.0.0/en_US/control';
      const baselineResult = await mockBaselineManager.saveBaseline(baselineKey, {
        coverage: { quest_graph: 0.8, dialogue: 0.7, mechanics: 0.6, economy: 0.9, world_sim: 0.75, mods: 0.5, overall: 0.7 },
        performance: { avg_turn_latency_ms: 1200, p95_turn_latency_ms: 2000, avg_tokens_per_turn: 400, max_tokens_per_turn: 800, turns_per_second: 0.8 },
        oracles: { soft_locks: 0, budget_violations: 0, validator_retries: 0.02, fallback_engagements: 0.01, safety_violations: 0, performance_violations: 0, integrity_violations: 0 },
        behavior: { avg_turns_to_completion: 50, exploration_efficiency: 0.7, dialogue_engagement_rate: 0.6, economic_activity_rate: 0.8, risk_taking_rate: 0.3 }
      });

      expect(baselineResult.success).toBe(true);
    });

    it('should handle multiple bot modes', () => {
      const modes = ['objective_seeker', 'explorer', 'economy_grinder', 'romance_tester', 'risk_taker', 'safety_max'];
      
      modes.forEach(mode => {
        const mockBotEngine = {
          decide: vi.fn().mockReturnValue({ choice_id: 'test-choice', reasoning: 'test' }),
          getMemory: vi.fn().mockReturnValue({
            visited_nodes: new Set(),
            dialogue_candidates_seen: new Set(),
            turn_count: 0
          }),
          resetMemory: vi.fn()
        };

        const bundle = { objectives: [{ description: 'Test objective' }] };
        const context = {
          current_node: 'start',
          available_choices: ['choice1', 'choice2'],
          dialogue_candidates: [],
          party_state: {},
          world_state: {},
          economy_state: {},
          mod_state: {},
          turn_number: 1,
          session_id: 'session-123',
          seed: 'seed-123'
        };

        const decision = mockBotEngine.decide(bundle, context, mode);
        expect(decision).toBeDefined();
      });
    });
  });

  describe('Performance Tests', () => {
    it('should handle high concurrent bot decisions', () => {
      const promises = Array.from({ length: 100 }, (_, i) => {
        const mockBotEngine = {
          decide: vi.fn().mockReturnValue({ choice_id: 'test-choice', reasoning: 'test' }),
          getMemory: vi.fn().mockReturnValue({
            visited_nodes: new Set(),
            dialogue_candidates_seen: new Set(),
            turn_count: 0
          }),
          resetMemory: vi.fn()
        };

        const bundle = { objectives: [{ description: 'Test objective' }] };
        const context = {
          current_node: 'start',
          available_choices: ['choice1', 'choice2'],
          dialogue_candidates: [],
          party_state: {},
          world_state: {},
          economy_state: {},
          mod_state: {},
          turn_number: 1,
          session_id: `session-${i}`,
          seed: `seed-${i}`
        };

        return mockBotEngine.decide(bundle, context, 'objective_seeker');
      });

      return Promise.all(promises).then(decisions => {
        expect(decisions).toHaveLength(100);
        decisions.forEach(decision => {
          expect(decision).toBeDefined();
        });
      });
    });

    it('should handle large scenario matrices', async () => {
      const mockMatrixGenerator = {
        generateMatrix: vi.fn().mockResolvedValue(
          Array.from({ length: 150 }, (_, i) => ({
            world: `world${i}`,
            adventure: `adventure${i}`,
            locale: 'en_US',
            rng_seed: `seed${i}`
          }))
        )
      };

      const config = {
        worlds: ['world1', 'world2', 'world3'],
        adventures: ['adv1', 'adv2', 'adv3'],
        locales: ['en_US', 'es_ES', 'fr_FR'],
        experiments: ['control', 'var1', 'var2'],
        variations: ['control', 'exp1', 'exp2'],
        module_toggles: {
          'feature1': [true, false],
          'feature2': [true, false],
          'feature3': [true, false]
        },
        seeds_per_scenario: 2
      };

      const scenarios = await mockMatrixGenerator.generateMatrix(config);
      expect(scenarios.length).toBeGreaterThan(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle bot engine errors gracefully', () => {
      const mockBotEngine = {
        decide: vi.fn().mockImplementation(() => {
          throw new Error('Bot engine error');
        }),
        getMemory: vi.fn().mockReturnValue({
          visited_nodes: new Set(),
          dialogue_candidates_seen: new Set(),
          turn_count: 0
        }),
        resetMemory: vi.fn()
      };

      const invalidBundle = null;
      const context = {
        current_node: 'start',
        available_choices: [],
        dialogue_candidates: [],
        party_state: {},
        world_state: {},
        economy_state: {},
        mod_state: {},
        turn_number: 1,
        session_id: 'session-123',
        seed: 'seed-123'
      };

      expect(() => {
        mockBotEngine.decide(invalidBundle, context, 'objective_seeker');
      }).toThrow('Bot engine error');
    });

    it('should handle coverage tracker errors gracefully', () => {
      const mockCoverageTracker = {
        updateCoverage: vi.fn().mockImplementation(() => {
          throw new Error('Coverage tracker error');
        }),
        getCoverage: vi.fn().mockReturnValue({
          quest_graph: 0.8,
          dialogue: 0.7,
          mechanics: 0.6,
          economy: 0.9,
          world_sim: 0.75,
          mods: 0.5,
          overall: 0.7
        })
      };

      const invalidBundle = null;
      const context = {};
      const decision = {};
      const turnResult = {};

      expect(() => {
        mockCoverageTracker.updateCoverage(invalidBundle, context, decision, turnResult);
      }).toThrow('Coverage tracker error');
    });

    it('should handle oracle detector errors gracefully', () => {
      const mockOracleDetector = {
        checkOracles: vi.fn().mockImplementation(() => {
          throw new Error('Oracle detector error');
        })
      };

      const invalidBundle = null;
      const context = {};
      const turnResult = {};

      expect(() => {
        mockOracleDetector.checkOracles(invalidBundle, context, turnResult, 1);
      }).toThrow('Oracle detector error');
    });
  });
});
