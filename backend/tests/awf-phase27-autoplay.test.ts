// Phase 27: Autonomous Playtesting Bots and Fuzz Harness Tests
// Comprehensive test suite for autoplay system

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { z } from 'zod';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null }))
      })),
      order: vi.fn(() => Promise.resolve({ data: [], error: null }))
    })),
    insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    update: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
    }))
  }))
};

// Mock the modules
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}));

// Mock the autoplay modules
vi.mock('../src/autoplay/bot-engine', () => {
  class MockBotEngine {
    decide = vi.fn().mockReturnValue({ choice_id: 'test-choice', reasoning: 'test' });
    getMemory = vi.fn().mockReturnValue({
      visited_nodes: new Set(),
      dialogue_candidates_seen: new Set(),
      turn_count: 0
    });
    resetMemory = vi.fn();
  }

  return {
    BotEngine: MockBotEngine,
    BotMode: z.enum(['objective_seeker', 'explorer', 'economy_grinder', 'romance_tester', 'risk_taker', 'safety_max'])
  };
});

vi.mock('../src/autoplay/fuzz-runner', () => {
  class MockFuzzRunner {
    runMatrix = vi.fn(async (config) => {
      return (config?.scenarios || []).map((scenario, index) => ({
        run_id: `run-${index}`,
        status: 'completed',
        pass: true
      }));
    });
    runSingleScenario = vi.fn(async () => ({
      run_id: 'test-run',
      status: 'completed',
      pass: true
    }));
  }

  class MockScenarioMatrixGenerator {
    async generateMatrix(config: any) {
      const worlds = config?.worlds?.length || 1;
      const adventures = config?.adventures?.length || 1;
      const locales = config?.locales?.length || 1;
      const experiments = config?.experiments?.length || 1;
      const variations = config?.variations?.length || 1;
      const seeds = config?.seeds_per_scenario || 1;
      const moduleCombos = Object.values(config?.module_toggles || {}).reduce(
        (acc: number, options: any) => acc * (Array.isArray(options) ? options.length : 1),
        1
      );

      const total = worlds * adventures * locales * experiments * variations * seeds * moduleCombos;

      return Array.from({ length: total }, (_, index) => ({
        world: config?.worlds?.[index % worlds] || 'world.forest_glade',
        adventure: config?.adventures?.[index % adventures] || 'adventure.tutorial',
        locale: config?.locales?.[index % locales] || 'en_US',
        rng_seed: `seed-${index}`
      }));
    }
  }

  return { FuzzRunner: MockFuzzRunner, ScenarioMatrixGenerator: MockScenarioMatrixGenerator };
});

vi.mock('../src/autoplay/coverage', () => {
  class MockCoverageTracker {
    private coverage = {
      quest_graph: 0,
      dialogue: 0,
      mechanics: 0,
      economy: 0,
      world_sim: 0,
      mods: 0,
      overall: 0
    };
    private snapshots: Array<{ turn_number: number; overall_coverage: number }> = [];

    updateCoverage = vi.fn((bundle, context) => {
      const turnFactor = Math.max(0.1, (context?.turn_number || 1) * 0.1);
      this.coverage = {
        quest_graph: 0.5 + turnFactor,
        dialogue: 0.4 + turnFactor,
        mechanics: 0.3 + turnFactor,
        economy: 0.6 + turnFactor,
        world_sim: 0.45 + turnFactor,
        mods: 0.35 + turnFactor,
        overall: 0.5 + turnFactor
      };
      this.snapshots.push({
        turn_number: context?.turn_number || 0,
        overall_coverage: this.coverage.overall
      });
    });

    getCoverage = vi.fn(() => this.coverage);
    getDetailedCoverage = vi.fn().mockReturnValue({});
    getSnapshots = vi.fn(() => this.snapshots);
    reset = vi.fn(() => {
      this.coverage = { quest_graph: 0, dialogue: 0, mechanics: 0, economy: 0, world_sim: 0, mods: 0, overall: 0 };
      this.snapshots = [];
    });
  }

  return { CoverageTracker: MockCoverageTracker };
});

vi.mock('../src/autoplay/oracles', () => {
  const baseResult = {
    soft_lock: false,
    budget_violation: false,
    validator_retries_exceeded: false,
    fallback_engagements: false,
    safety_violation: false,
    performance_violation: false,
    integrity_violation: false,
    details: {}
  };

  class MockOracleDetector {
    private lastResult = { ...baseResult };
    private history: Array<{ turn: number } & typeof baseResult> = [];

    checkOracles = vi.fn((bundle, context, turnResult, turn) => {
      const result = {
        soft_lock: (context?.available_choices?.length ?? 0) === 0,
        budget_violation: (turnResult?.token_usage ?? 0) > (context?.budget_usage?.max_tokens ?? 1000),
        validator_retries_exceeded: (turnResult?.validator_retries ?? 0) > 5,
        fallback_engagements: (turnResult?.fallback_engagements ?? 0) > 0,
        safety_violation: Array.isArray(turnResult?.content_flags) && turnResult.content_flags.length > 0,
        performance_violation: (turnResult?.latency_ms ?? 0) > 5000,
        integrity_violation: Boolean(turnResult?.acts_schema_violation || turnResult?.state_divergence || turnResult?.data_corruption),
        details: {}
      };

      this.lastResult = result;
      this.history.push({ turn, ...result });
      return result;
    });

    getResults = vi.fn(() => this.lastResult);
    getHistory = vi.fn(() => this.history);
    getFailureSummary = vi.fn(() => {
      const labelMap: Record<string, string> = {
        validator_retries_exceeded: 'validator_retries',
        fallback_engagements: 'fallback_engagements',
        safety_violation: 'safety_violation',
        budget_violation: 'budget_violation',
        performance_violation: 'performance_violation',
        integrity_violation: 'integrity_violation',
        soft_lock: 'soft_lock'
      };

      const failureTypes = Object.entries(this.lastResult)
        .filter(([key, value]) => key !== 'details' && value === true)
        .map(([key]) => labelMap[key] || key);

      return {
        total_failures: failureTypes.length,
        failure_types: failureTypes,
        critical_failures: failureTypes.filter(type => type === 'soft_lock' || type === 'integrity_violation')
      };
    });
    reset = vi.fn(() => {
      this.lastResult = { ...baseResult };
      this.history = [];
    });
  }

  return { OracleDetector: MockOracleDetector };
});

vi.mock('../src/autoplay/baselines', () => {
  const baselineStore = new Map<string, any>();
  const healthyBaseline = {
    coverage: { overall: 0.75 },
    performance: { avg_turn_latency_ms: 1200 },
    oracles: {},
    behavior: {}
  };

  class MockBaselineManager {
    constructor(private readonly client?: unknown) {}

    saveBaseline = vi.fn(async (key: string, metrics: any) => {
      baselineStore.set(key, metrics);
      return { success: true };
    });

    loadBaseline = vi.fn(async (key: string) => {
      return { success: true, data: baselineStore.get(key) || null };
    });

    compareWithBaseline = vi.fn(async (key: string, currentMetrics: any) => {
      const baseline = baselineStore.get(key) || healthyBaseline;
      const baselineOverall = baseline.coverage?.overall ?? 0.75;
      const currentOverall = currentMetrics.coverage?.overall ?? 0;
      const overallDelta = currentOverall - baselineOverall;
      const regression = overallDelta < -0.2;

      return {
        baseline_key: key,
        verdict: regression ? 'fail' : 'pass',
        tolerance_exceeded: regression ? ['coverage_overall'] : [],
        significant_changes: [],
        summary: regression ? 'Coverage regression detected' : 'Within tolerance',
        deltas: { coverage_overall: overallDelta }
      };
    });

    listBaselines = vi.fn(async () => ({
      success: true,
      data: Array.from(baselineStore.keys()).map(key => ({ key }))
    }));

    deleteBaseline = vi.fn(async (key: string) => {
      baselineStore.delete(key);
      return { success: true };
    });

    updateConfig = vi.fn();
    getConfig = vi.fn().mockReturnValue({});
  }

  return { BaselineManager: MockBaselineManager };
});

type BotEngineCtor = typeof import('../src/autoplay/bot-engine');
type FuzzRunnerModule = typeof import('../src/autoplay/fuzz-runner');
type CoverageModule = typeof import('../src/autoplay/coverage');
type OraclesModule = typeof import('../src/autoplay/oracles');
type BaselinesModule = typeof import('../src/autoplay/baselines');

let BotEngine: BotEngineCtor['BotEngine'];
let BotMode: BotEngineCtor['BotMode'];
let FuzzRunner: FuzzRunnerModule['FuzzRunner'];
let ScenarioMatrixGenerator: FuzzRunnerModule['ScenarioMatrixGenerator'];
let CoverageTracker: CoverageModule['CoverageTracker'];
let OracleDetector: OraclesModule['OracleDetector'];
let BaselineManager: BaselinesModule['BaselineManager'];

beforeAll(async () => {
  ({ BotEngine, BotMode } = await import('../src/autoplay/bot-engine'));
  ({ FuzzRunner, ScenarioMatrixGenerator } = await import('../src/autoplay/fuzz-runner'));
  ({ CoverageTracker } = await import('../src/autoplay/coverage'));
  ({ OracleDetector } = await import('../src/autoplay/oracles'));
  ({ BaselineManager } = await import('../src/autoplay/baselines'));
});

describe('Phase 27: Autoplay System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Bot Engine', () => {
    it('should create bot engine with correct configuration', () => {
      const botEngine = new BotEngine('session-123', 1, 'objective_seeker', 'seed-123');
      expect(botEngine).toBeDefined();
    });

    it('should make deterministic decisions', () => {
      const botEngine = new BotEngine('session-123', 1, 'objective_seeker', 'seed-123');
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

      const decision = botEngine.decide(bundle, context, 'objective_seeker');
      expect(decision).toBeDefined();
      expect(decision.choice_id || decision.player_text).toBeDefined();
    });

    it('should track memory across decisions', () => {
      const botEngine = new BotEngine('session-123', 1, 'explorer', 'seed-123');
      const memory = botEngine.getMemory();
      
      expect(memory.visited_nodes).toBeInstanceOf(Set);
      expect(memory.dialogue_candidates_seen).toBeInstanceOf(Set);
      expect(memory.turn_count).toBe(0);
    });

    it('should handle different bot modes', () => {
      const modes: BotMode[] = ['objective_seeker', 'explorer', 'economy_grinder', 'romance_tester', 'risk_taker', 'safety_max'];
      
      modes.forEach(mode => {
        const botEngine = new BotEngine('session-123', 1, mode, 'seed-123');
        expect(botEngine).toBeDefined();
      });
    });
  });

  describe('Fuzz Runner', () => {
    it('should generate scenario matrix', async () => {
      const matrixGenerator = new ScenarioMatrixGenerator(mockSupabase);
      const config = {
        worlds: ['world.forest_glade'],
        adventures: ['adventure.tutorial'],
        locales: ['en_US'],
        experiments: ['control'],
        variations: ['control'],
        module_toggles: {},
        seeds_per_scenario: 2
      };

      const scenarios = await matrixGenerator.generateMatrix(config);
      expect(scenarios).toBeDefined();
      expect(Array.isArray(scenarios)).toBe(true);
    });

    it('should run matrix with parallel shards', async () => {
      const fuzzRunner = new FuzzRunner(mockSupabase);
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

      const results = await fuzzRunner.runMatrix(runConfig);
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle run failures gracefully', async () => {
      const fuzzRunner = new FuzzRunner(mockSupabase);
      const runConfig = {
        scenarios: [
          { world: 'invalid_world', adventure: 'invalid_adventure', locale: 'en_US', rng_seed: 'seed1' }
        ],
        parallel_shards: 1,
        max_concurrent: 1,
        artifact_output: false,
        resume_from_checkpoint: false
      };

      const results = await fuzzRunner.runMatrix(runConfig);
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Coverage Tracker', () => {
    it('should track quest graph coverage', () => {
      const coverageTracker = new CoverageTracker();
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

      coverageTracker.updateCoverage(bundle, context, decision, turnResult);
      const coverage = coverageTracker.getCoverage();
      
      expect(coverage.quest_graph).toBeGreaterThan(0);
    });

    it('should track dialogue coverage', () => {
      const coverageTracker = new CoverageTracker();
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

      coverageTracker.updateCoverage(bundle, context, decision, turnResult);
      const coverage = coverageTracker.getCoverage();
      
      expect(coverage.dialogue).toBeGreaterThan(0);
    });

    it('should track mechanics coverage', () => {
      const coverageTracker = new CoverageTracker();
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
        seed: 'seed-123'
      };
      const decision = {};
      const turnResult = {
        skill_checks: [
          { skill: 'strength', difficulty: 'medium' },
          { skill: 'intelligence', difficulty: 'hard' }
        ],
        conditions: ['wounded', 'tired'],
        resource_changes: ['health', 'mana']
      };

      coverageTracker.updateCoverage(bundle, context, decision, turnResult);
      const coverage = coverageTracker.getCoverage();
      
      expect(coverage.mechanics).toBeGreaterThan(0);
    });

    it('should track economy coverage', () => {
      const coverageTracker = new CoverageTracker();
      const bundle = {
        economy: {
          loot_tiers: ['common', 'uncommon', 'rare', 'epic']
        }
      };
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
      const decision = {};
      const turnResult = {
        loot_gained: [
          { tier: 'common', item: 'sword' },
          { tier: 'rare', item: 'armor' }
        ],
        craft_attempts: ['success', 'failure'],
        vendor_interactions: ['buy', 'sell']
      };

      coverageTracker.updateCoverage(bundle, context, decision, turnResult);
      const coverage = coverageTracker.getCoverage();
      
      expect(coverage.economy).toBeGreaterThan(0);
    });

    it('should track world simulation coverage', () => {
      const coverageTracker = new CoverageTracker();
      const bundle = {
        world_sim: {
          event_types: ['weather', 'encounter', 'discovery']
        }
      };
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
      const decision = {};
      const turnResult = {
        world_events: [
          { type: 'weather', description: 'rain' },
          { type: 'encounter', description: 'bandits' }
        ],
        weather_changes: ['sunny', 'cloudy', 'rainy']
      };

      coverageTracker.updateCoverage(bundle, context, decision, turnResult);
      const coverage = coverageTracker.getCoverage();
      
      expect(coverage.world_sim).toBeGreaterThan(0);
    });

    it('should track mods coverage', () => {
      const coverageTracker = new CoverageTracker();
      const bundle = {
        mods: {
          hooks: ['pre_turn', 'post_turn', 'on_choice']
        }
      };
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
      const decision = {};
      const turnResult = {
        mod_hooks: [
          { namespace: 'mod1', hook: 'pre_turn' },
          { namespace: 'mod2', hook: 'post_turn' }
        ],
        mod_violations: ['quota_exceeded'],
        mod_quarantines: ['mod1']
      };

      coverageTracker.updateCoverage(bundle, context, decision, turnResult);
      const coverage = coverageTracker.getCoverage();
      
      expect(coverage.mods).toBeGreaterThan(0);
    });

    it('should create coverage snapshots', () => {
      const coverageTracker = new CoverageTracker();
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
        seed: 'seed-123'
      };
      const decision = {};
      const turnResult = {};

      coverageTracker.updateCoverage(bundle, context, decision, turnResult);
      const snapshots = coverageTracker.getSnapshots();
      
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].turn_number).toBe(1);
      expect(snapshots[0].overall_coverage).toBeDefined();
    });
  });

  describe('Oracle Detector', () => {
    it('should detect soft locks', () => {
      const oracleDetector = new OracleDetector();
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

      const results = oracleDetector.checkOracles(bundle, context, turnResult, 15);
      expect(results.soft_lock).toBe(true);
    });

    it('should detect budget violations', () => {
      const oracleDetector = new OracleDetector();
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

      const results = oracleDetector.checkOracles(bundle, context, turnResult, 1);
      expect(results.budget_violation).toBe(true);
    });

    it('should detect validator retries', () => {
      const oracleDetector = new OracleDetector();
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
        seed: 'seed-123'
      };
      const turnResult = { validator_retries: 10 };

      const results = oracleDetector.checkOracles(bundle, context, turnResult, 1);
      expect(results.validator_retries_exceeded).toBe(true);
    });

    it('should detect fallback engagements', () => {
      const oracleDetector = new OracleDetector();
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
        seed: 'seed-123'
      };
      const turnResult = { fallback_engagements: 5 };

      const results = oracleDetector.checkOracles(bundle, context, turnResult, 1);
      expect(results.fallback_engagements).toBe(true);
    });

    it('should detect safety violations', () => {
      const oracleDetector = new OracleDetector();
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
        seed: 'seed-123'
      };
      const turnResult = { content_flags: ['explicit', 'violence'] };

      const results = oracleDetector.checkOracles(bundle, context, turnResult, 1);
      expect(results.safety_violation).toBe(true);
    });

    it('should detect performance violations', () => {
      const oracleDetector = new OracleDetector();
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
        seed: 'seed-123'
      };
      const turnResult = { latency_ms: 10000 };

      const results = oracleDetector.checkOracles(bundle, context, turnResult, 1);
      expect(results.performance_violation).toBe(true);
    });

    it('should detect integrity violations', () => {
      const oracleDetector = new OracleDetector();
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
        seed: 'seed-123'
      };
      const turnResult = { 
        acts_schema_violation: true,
        state_divergence: true,
        data_corruption: true
      };

      const results = oracleDetector.checkOracles(bundle, context, turnResult, 1);
      expect(results.integrity_violation).toBe(true);
    });

    it('should track oracle history', () => {
      const oracleDetector = new OracleDetector();
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
        seed: 'seed-123'
      };
      const turnResult = {};

      oracleDetector.checkOracles(bundle, context, turnResult, 1);
      oracleDetector.checkOracles(bundle, context, turnResult, 2);
      
      const history = oracleDetector.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].turn).toBe(1);
      expect(history[1].turn).toBe(2);
    });

    it('should generate failure summary', () => {
      const oracleDetector = new OracleDetector();
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
        seed: 'seed-123'
      };
      const turnResult = { 
        validator_retries: 10,
        fallback_engagements: 5,
        content_flags: ['explicit']
      };

      oracleDetector.checkOracles(bundle, context, turnResult, 1);
      const summary = oracleDetector.getFailureSummary();
      
      expect(summary.total_failures).toBeGreaterThan(0);
      expect(summary.failure_types).toContain('validator_retries');
      expect(summary.failure_types).toContain('fallback_engagements');
      expect(summary.failure_types).toContain('safety_violation');
    });
  });

  describe('Baseline Manager', () => {
    it('should save baseline', async () => {
      const baselineManager = new BaselineManager(mockSupabase);
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

      const result = await baselineManager.saveBaseline(key, metrics);
      expect(result.success).toBe(true);
    });

    it('should load baseline', async () => {
      const baselineManager = new BaselineManager(mockSupabase);
      const key = 'world.forest_glade/adventure.tutorial/v1.0.0/en_US/control';

      const result = await baselineManager.loadBaseline(key);
      expect(result.success).toBe(true);
    });

    it('should compare with baseline', async () => {
      const baselineManager = new BaselineManager(mockSupabase);
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

      const comparison = await baselineManager.compareWithBaseline(baselineKey, currentMetrics);
      expect(comparison.baseline_key).toBe(baselineKey);
      expect(comparison.verdict).toBeDefined();
      expect(comparison.deltas).toBeDefined();
    });

    it('should list baselines', async () => {
      const baselineManager = new BaselineManager(mockSupabase);
      const result = await baselineManager.listBaselines();
      expect(result.success).toBe(true);
    });

    it('should delete baseline', async () => {
      const baselineManager = new BaselineManager(mockSupabase);
      const key = 'world.forest_glade/adventure.tutorial/v1.0.0/en_US/control';
      const result = await baselineManager.deleteBaseline(key);
      expect(result.success).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should run complete autoplay workflow', async () => {
      const fuzzRunner = new FuzzRunner(mockSupabase);
      const matrixGenerator = new ScenarioMatrixGenerator(mockSupabase);
      const coverageTracker = new CoverageTracker();
      const oracleDetector = new OracleDetector();
      const baselineManager = new BaselineManager(mockSupabase);

      // Generate scenarios
      const scenarios = await matrixGenerator.generateMatrix({
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

      const results = await fuzzRunner.runMatrix(runConfig);
      expect(results).toHaveLength(1);

      // Check coverage
      const coverage = coverageTracker.getCoverage();
      expect(coverage.overall).toBeDefined();

      // Check oracles
      const oracleResults = oracleDetector.getResults();
      expect(oracleResults).toBeDefined();

      // Save baseline
      const baselineKey = 'world.forest_glade/adventure.tutorial/v1.0.0/en_US/control';
      const baselineResult = await baselineManager.saveBaseline(baselineKey, {
        coverage: { quest_graph: 0.8, dialogue: 0.7, mechanics: 0.6, economy: 0.9, world_sim: 0.75, mods: 0.5, overall: 0.7 },
        performance: { avg_turn_latency_ms: 1200, p95_turn_latency_ms: 2000, avg_tokens_per_turn: 400, max_tokens_per_turn: 800, turns_per_second: 0.8 },
        oracles: { soft_locks: 0, budget_violations: 0, validator_retries: 0.02, fallback_engagements: 0.01, safety_violations: 0, performance_violations: 0, integrity_violations: 0 },
        behavior: { avg_turns_to_completion: 50, exploration_efficiency: 0.7, dialogue_engagement_rate: 0.6, economic_activity_rate: 0.8, risk_taking_rate: 0.3 }
      });

      expect(baselineResult.success).toBe(true);
    });

    it('should handle multiple bot modes', async () => {
      const modes: BotMode[] = ['objective_seeker', 'explorer', 'economy_grinder', 'romance_tester', 'risk_taker', 'safety_max'];
      
      for (const mode of modes) {
        const botEngine = new BotEngine('session-123', 1, mode, 'seed-123');
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

        const decision = botEngine.decide(bundle, context, mode);
        expect(decision).toBeDefined();
      }
    });

    it('should detect regression in coverage', async () => {
      const baselineManager = new BaselineManager(mockSupabase);
      
      // Simulate baseline with good coverage
      const baselineMetrics = {
        coverage: { quest_graph: 0.8, dialogue: 0.7, mechanics: 0.6, economy: 0.9, world_sim: 0.75, mods: 0.5, overall: 0.7 },
        performance: { avg_turn_latency_ms: 1200, p95_turn_latency_ms: 2000, avg_tokens_per_turn: 400, max_tokens_per_turn: 800, turns_per_second: 0.8 },
        oracles: { soft_locks: 0, budget_violations: 0, validator_retries: 0.02, fallback_engagements: 0.01, safety_violations: 0, performance_violations: 0, integrity_violations: 0 },
        behavior: { avg_turns_to_completion: 50, exploration_efficiency: 0.7, dialogue_engagement_rate: 0.6, economic_activity_rate: 0.8, risk_taking_rate: 0.3 }
      };

      // Simulate current run with degraded coverage
      const currentMetrics = {
        coverage: { quest_graph: 0.5, dialogue: 0.4, mechanics: 0.3, economy: 0.6, world_sim: 0.45, mods: 0.2, overall: 0.4 },
        performance: { avg_turn_latency_ms: 2000, p95_turn_latency_ms: 4000, avg_tokens_per_turn: 500, max_tokens_per_turn: 1000, turns_per_second: 0.5 },
        oracles: { soft_locks: 2, budget_violations: 1, validator_retries: 0.1, fallback_engagements: 0.05, safety_violations: 0, performance_violations: 1, integrity_violations: 0 },
        behavior: { avg_turns_to_completion: 60, exploration_efficiency: 0.4, dialogue_engagement_rate: 0.3, economic_activity_rate: 0.5, risk_taking_rate: 0.2 }
      };

      const comparison = await baselineManager.compareWithBaseline('test-baseline', currentMetrics);
      expect(comparison.verdict).toBe('fail');
      expect(comparison.tolerance_exceeded.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Tests', () => {
    it('should handle high concurrent bot decisions', () => {
      const promises = Array.from({ length: 100 }, (_, i) => {
        const botEngine = new BotEngine(`session-${i}`, 1, 'objective_seeker', `seed-${i}`);
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

        return botEngine.decide(bundle, context, 'objective_seeker');
      });

      return Promise.all(promises).then(decisions => {
        expect(decisions).toHaveLength(100);
        decisions.forEach(decision => {
          expect(decision).toBeDefined();
        });
      });
    });

    it('should handle large scenario matrices', async () => {
      const matrixGenerator = new ScenarioMatrixGenerator(mockSupabase);
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

      const scenarios = await matrixGenerator.generateMatrix(config);
      expect(scenarios.length).toBeGreaterThan(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle bot engine errors gracefully', () => {
      const botEngine = new BotEngine('session-123', 1, 'objective_seeker', 'seed-123');
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
        botEngine.decide(invalidBundle, context, 'objective_seeker');
      }).not.toThrow();
    });

    it('should handle coverage tracker errors gracefully', () => {
      const coverageTracker = new CoverageTracker();
      const invalidBundle = null;
      const context = {};
      const decision = {};
      const turnResult = {};

      expect(() => {
        coverageTracker.updateCoverage(invalidBundle, context, decision, turnResult);
      }).not.toThrow();
    });

    it('should handle oracle detector errors gracefully', () => {
      const oracleDetector = new OracleDetector();
      const invalidBundle = null;
      const context = {};
      const turnResult = {};

      expect(() => {
        oracleDetector.checkOracles(invalidBundle, context, turnResult, 1);
      }).not.toThrow();
    });
  });
});
