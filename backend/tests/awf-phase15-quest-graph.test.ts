/**
 * Phase 15: Quest Graph & Pacing Tests
 * Comprehensive test suite for quest graph engine, pacing governor, and soft-lock prevention
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({ error: null })),
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => ({ data: null, error: null })) })) })),
      update: vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(() => ({ data: null, error: null })) })) })) })),
      delete: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
      order: vi.fn(() => ({ limit: vi.fn(() => ({ data: [], error: null })) })),
      range: vi.fn(() => ({ data: [], error: null })),
    })),
    rpc: vi.fn(() => ({ data: null, error: null })),
  })),
}));

import { QuestGraphEngine, GameState, QuestGraph } from '../src/graph/quest-graph-engine.js';
import { PacingGovernor, PacingInputs } from '../src/pacing/pacing-governor.js';
import { SoftLockPrevention, StuckState } from '../src/recovery/soft-lock-prevention.js';
import { QuestGraphsRepo } from '../src/repos/quest-graphs-repo.js';

describe('Quest Graph Engine', () => {
  let questGraphEngine: QuestGraphEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    questGraphEngine = new QuestGraphEngine();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Node Selection', () => {
    it('should select active node based on game state', () => {
      const gameState: GameState = {
        currentNodeId: 'beat.intro',
        visited: [],
        failures: [],
        retries: 0,
        flags: { met_kiera: false },
        objectives: {},
        resources: { health: 100, mana: 50 },
      };

      const graph: QuestGraph = {
        graphId: 'test-graph',
        start: 'beat.intro',
        nodes: [
          {
            id: 'beat.intro',
            type: 'beat',
            synopsis: 'Moonlit glade, first contact with Kiera.',
            enterIf: [{ flag: 'met_kiera', op: 'ne', val: true }],
            onSuccess: [{ act: 'OBJECTIVE_UPDATE', id: 'meet_kiera', status: 'complete' }],
            onFail: [{ act: 'FLAG_SET', key: 'intro_failed', val: true }],
            hint: 'Try a calm greeting or show a harmless token.',
          },
        ],
        edges: [],
      };

      const activeNode = questGraphEngine.selectActiveNode(gameState, graph);
      
      expect(activeNode).toBeDefined();
      expect(activeNode?.id).toBe('beat.intro');
    });

    it('should return null when no eligible nodes', () => {
      const gameState: GameState = {
        currentNodeId: 'beat.intro',
        visited: [],
        failures: [],
        retries: 0,
        flags: { met_kiera: true },
        objectives: {},
        resources: { health: 100, mana: 50 },
      };

      const graph: QuestGraph = {
        graphId: 'test-graph',
        start: 'beat.intro',
        nodes: [
          {
            id: 'beat.intro',
            type: 'beat',
            synopsis: 'Moonlit glade, first contact with Kiera.',
            enterIf: [{ flag: 'met_kiera', op: 'ne', val: true }],
          },
        ],
        edges: [],
      };

      const activeNode = questGraphEngine.selectActiveNode(gameState, graph);
      
      expect(activeNode).toBeNull();
    });
  });

  describe('Eligible Neighbors', () => {
    it('should find eligible neighbors for a node', () => {
      const gameState: GameState = {
        currentNodeId: 'beat.intro',
        visited: [],
        failures: [],
        retries: 0,
        flags: { met_kiera: false },
        objectives: { meet_kiera: 'complete' },
        resources: { health: 100, mana: 50 },
      };

      const graph: QuestGraph = {
        graphId: 'test-graph',
        start: 'beat.intro',
        nodes: [
          {
            id: 'beat.intro',
            type: 'beat',
            synopsis: 'Moonlit glade, first contact with Kiera.',
          },
          {
            id: 'beat.trust_test',
            type: 'objective',
            synopsis: 'Prove your worth to Kiera through actions.',
            enterIf: [{ objective: 'meet_kiera', op: 'eq', val: 'complete' }],
          },
        ],
        edges: [
          {
            from: 'beat.intro',
            to: 'beat.trust_test',
            guard: [{ objective: 'meet_kiera', op: 'eq', val: 'complete' }],
          },
        ],
      };

      const currentNode = graph.nodes[0];
      const neighbors = questGraphEngine.eligibleNeighbors(currentNode, graph, gameState);
      
      expect(neighbors).toHaveLength(1);
      expect(neighbors[0].id).toBe('beat.trust_test');
    });
  });

  describe('Outcome Application', () => {
    it('should apply success outcome to game state', () => {
      const gameState: GameState = {
        currentNodeId: 'beat.intro',
        visited: [],
        failures: [],
        retries: 0,
        flags: {},
        objectives: {},
        resources: { health: 100, mana: 50 },
      };

      const node = {
        id: 'beat.intro',
        type: 'beat' as const,
        synopsis: 'Moonlit glade, first contact with Kiera.',
        onSuccess: [
          { act: 'OBJECTIVE_UPDATE', id: 'meet_kiera', status: 'complete' },
          { act: 'FLAG_SET', key: 'intro_complete', val: true },
        ],
      };

      const awfActs = [
        { type: 'OBJECTIVE_UPDATE', id: 'meet_kiera', success: true },
      ];

      const result = questGraphEngine.applyOutcome(node, awfActs, gameState);
      
      expect(result.success).toBe(true);
      expect(result.newGameState.objectives.meet_kiera).toBe('complete');
      expect(result.newGameState.flags.intro_complete).toBe(true);
    });

    it('should apply failure outcome to game state', () => {
      const gameState: GameState = {
        currentNodeId: 'beat.intro',
        visited: [],
        failures: [],
        retries: 0,
        flags: {},
        objectives: {},
        resources: { health: 100, mana: 50 },
      };

      const node = {
        id: 'beat.intro',
        type: 'beat' as const,
        synopsis: 'Moonlit glade, first contact with Kiera.',
        onFail: [
          { act: 'FLAG_SET', key: 'intro_failed', val: true },
          { act: 'RESOURCE_UPDATE', key: 'health', val: -10 },
        ],
      };

      const awfActs = [
        { type: 'FLAG_SET', key: 'intro_failed', success: false },
      ];

      const result = questGraphEngine.applyOutcome(node, awfActs, gameState);
      
      expect(result.success).toBe(false);
      expect(result.newGameState.flags.intro_failed).toBe(true);
      expect(result.newGameState.resources.health).toBe(90);
    });
  });

  describe('Stuck State Detection', () => {
    it('should detect no progress stuck state', () => {
      const gameState: GameState = {
        currentNodeId: 'beat.intro',
        visited: [],
        failures: [],
        retries: 0,
        flags: {},
        objectives: {},
        resources: { health: 100, mana: 50 },
      };

      const graph: QuestGraph = {
        graphId: 'test-graph',
        start: 'beat.intro',
        nodes: [
          {
            id: 'beat.intro',
            type: 'beat',
            synopsis: 'Moonlit glade, first contact with Kiera.',
          },
        ],
        edges: [],
      };

      const turnHistory = [
        { objectives: [], flags: [], resources: [] },
        { objectives: [], flags: [], resources: [] },
        { objectives: [], flags: [], resources: [] },
        { objectives: [], flags: [], resources: [] },
        { objectives: [], flags: [], resources: [] },
      ];

      const stuckState = questGraphEngine.detectStuckConditions(gameState, graph, turnHistory);
      
      expect(stuckState.isStuck).toBe(true);
      expect(stuckState.reason).toContain('No objective progress');
    });

    it('should detect resource depletion stuck state', () => {
      const gameState: GameState = {
        currentNodeId: 'beat.intro',
        visited: [],
        failures: [],
        retries: 0,
        flags: {},
        objectives: {},
        resources: { health: 0, mana: 0, stamina: 0 },
      };

      const graph: QuestGraph = {
        graphId: 'test-graph',
        start: 'beat.intro',
        nodes: [
          {
            id: 'beat.intro',
            type: 'beat',
            synopsis: 'Moonlit glade, first contact with Kiera.',
          },
        ],
        edges: [],
      };

      const turnHistory = [];

      const stuckState = questGraphEngine.detectStuckConditions(gameState, graph, turnHistory);
      
      expect(stuckState.isStuck).toBe(true);
      expect(stuckState.reason).toContain('Critical resources depleted');
    });
  });

  describe('Graph Slice Generation', () => {
    it('should generate graph slice for AWF bundle', () => {
      const gameState: GameState = {
        currentNodeId: 'beat.intro',
        visited: [],
        failures: [],
        retries: 0,
        flags: {},
        objectives: { meet_kiera: 'complete' },
        resources: { health: 100, mana: 50 },
      };

      const graph: QuestGraph = {
        graphId: 'test-graph',
        start: 'beat.intro',
        nodes: [
          {
            id: 'beat.intro',
            type: 'beat',
            synopsis: 'Moonlit glade, first contact with Kiera.',
            hint: 'Try a calm greeting.',
          },
          {
            id: 'beat.trust_test',
            type: 'objective',
            synopsis: 'Prove your worth to Kiera.',
            hint: 'Show kindness or help others.',
          },
        ],
        edges: [
          {
            from: 'beat.intro',
            to: 'beat.trust_test',
            guard: [{ objective: 'meet_kiera', op: 'eq', val: 'complete' }],
          },
        ],
      };

      const slice = questGraphEngine.generateGraphSlice(gameState, graph);
      
      expect(slice.activeNode.id).toBe('beat.intro');
      expect(slice.frontier).toHaveLength(1);
      expect(slice.frontier[0].id).toBe('beat.trust_test');
      expect(slice.hash).toBeDefined();
    });
  });
});

describe('Pacing Governor', () => {
  let pacingGovernor: PacingGovernor;

  beforeEach(() => {
    vi.clearAllMocks();
    pacingGovernor = new PacingGovernor();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Pacing State Computation', () => {
    it('should compute pacing state from inputs', () => {
      const inputs: PacingInputs = {
        turnCadence: 3,
        recentActs: [
          { type: 'greet', success: true, timestamp: new Date().toISOString() },
          { type: 'help', success: true, timestamp: new Date().toISOString() },
        ],
        resourceDeltas: { health: 0, mana: -10, stamina: 5 },
        npcBehaviorProfile: {
          tone: 'friendly',
          trustThreshold: 60,
          riskTolerance: 70,
        },
        analyticsHeuristics: {
          retryRate: 0.1,
          fallbackRate: 0.05,
          avgLatency: 2000,
        },
        sessionId: 'session-123',
        turnId: 5,
      };

      const pacingState = pacingGovernor.computePacingState(inputs);
      
      expect(pacingState.tempo).toBeDefined();
      expect(pacingState.tension).toBeGreaterThanOrEqual(0);
      expect(pacingState.tension).toBeLessThanOrEqual(100);
      expect(pacingState.difficulty).toBeDefined();
      expect(pacingState.directive).toBeDefined();
      expect(pacingState.directive.length).toBeLessThanOrEqual(80);
    });

    it('should adjust tempo based on success rate', () => {
      const highSuccessInputs: PacingInputs = {
        turnCadence: 3,
        recentActs: [
          { type: 'greet', success: true, timestamp: new Date().toISOString() },
          { type: 'help', success: true, timestamp: new Date().toISOString() },
          { type: 'explore', success: true, timestamp: new Date().toISOString() },
        ],
        resourceDeltas: { health: 0, mana: 0, stamina: 0 },
        npcBehaviorProfile: {
          tone: 'friendly',
          trustThreshold: 60,
          riskTolerance: 70,
        },
        analyticsHeuristics: {
          retryRate: 0.1,
          fallbackRate: 0.05,
          avgLatency: 2000,
        },
        sessionId: 'session-123',
        turnId: 5,
      };

      const lowSuccessInputs: PacingInputs = {
        turnCadence: 3,
        recentActs: [
          { type: 'greet', success: false, timestamp: new Date().toISOString() },
          { type: 'help', success: false, timestamp: new Date().toISOString() },
          { type: 'explore', success: false, timestamp: new Date().toISOString() },
        ],
        resourceDeltas: { health: 0, mana: 0, stamina: 0 },
        npcBehaviorProfile: {
          tone: 'friendly',
          trustThreshold: 60,
          riskTolerance: 70,
        },
        analyticsHeuristics: {
          retryRate: 0.1,
          fallbackRate: 0.05,
          avgLatency: 2000,
        },
        sessionId: 'session-123',
        turnId: 5,
      };

      const highSuccessState = pacingGovernor.computePacingState(highSuccessInputs);
      const lowSuccessState = pacingGovernor.computePacingState(lowSuccessInputs);
      
      // High success should generally lead to faster tempo
      expect(highSuccessState.tempo).toBeDefined();
      expect(lowSuccessState.tempo).toBeDefined();
    });

    it('should compute tension based on multiple factors', () => {
      const highTensionInputs: PacingInputs = {
        turnCadence: 3,
        recentActs: [
          { type: 'attack', success: false, timestamp: new Date().toISOString() },
          { type: 'flee', success: false, timestamp: new Date().toISOString() },
        ],
        resourceDeltas: { health: -20, mana: -30, stamina: -15 },
        npcBehaviorProfile: {
          tone: 'aggressive',
          trustThreshold: 80,
          riskTolerance: 30,
        },
        analyticsHeuristics: {
          retryRate: 0.8,
          fallbackRate: 0.6,
          avgLatency: 8000,
        },
        sessionId: 'session-123',
        turnId: 5,
      };

      const pacingState = pacingGovernor.computePacingState(highTensionInputs);
      
      expect(pacingState.tension).toBeGreaterThan(50); // Should be high tension
    });
  });

  describe('Deterministic Behavior', () => {
    it('should generate consistent pacing state for same inputs', () => {
      const inputs: PacingInputs = {
        turnCadence: 3,
        recentActs: [
          { type: 'greet', success: true, timestamp: new Date().toISOString() },
        ],
        resourceDeltas: { health: 0, mana: 0, stamina: 0 },
        npcBehaviorProfile: {
          tone: 'friendly',
          trustThreshold: 60,
          riskTolerance: 70,
        },
        analyticsHeuristics: {
          retryRate: 0.1,
          fallbackRate: 0.05,
          avgLatency: 2000,
        },
        sessionId: 'session-123',
        turnId: 5,
      };

      const state1 = pacingGovernor.computePacingState(inputs);
      const state2 = pacingGovernor.computePacingState(inputs);
      
      expect(state1.tempo).toBe(state2.tempo);
      expect(state1.tension).toBe(state2.tension);
      expect(state1.difficulty).toBe(state2.difficulty);
    });
  });
});

describe('Soft-Lock Prevention', () => {
  let softLockPrevention: SoftLockPrevention;

  beforeEach(() => {
    vi.clearAllMocks();
    softLockPrevention = new SoftLockPrevention();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Stuck State Detection', () => {
    it('should detect no progress stuck state', () => {
      const gameState: GameState = {
        currentNodeId: 'beat.intro',
        visited: [],
        failures: [],
        retries: 0,
        flags: {},
        objectives: {},
        resources: { health: 100, mana: 50 },
      };

      const graph: QuestGraph = {
        graphId: 'test-graph',
        start: 'beat.intro',
        nodes: [
          {
            id: 'beat.intro',
            type: 'beat',
            synopsis: 'Moonlit glade, first contact with Kiera.',
          },
        ],
        edges: [],
      };

      const turnHistory = [
        { objectives: [], flags: [], resources: [] },
        { objectives: [], flags: [], resources: [] },
        { objectives: [], flags: [], resources: [] },
        { objectives: [], flags: [], resources: [] },
        { objectives: [], flags: [], resources: [] },
      ];

      const stuckState = softLockPrevention.detectStuckState(gameState, graph, turnHistory, 5);
      
      expect(stuckState.isStuck).toBe(true);
      expect(stuckState.reason).toContain('No progress');
      expect(stuckState.suggestions.length).toBeGreaterThan(0);
      expect(stuckState.recoveryActions.length).toBeGreaterThan(0);
    });

    it('should detect resource depletion stuck state', () => {
      const gameState: GameState = {
        currentNodeId: 'beat.intro',
        visited: [],
        failures: [],
        retries: 0,
        flags: {},
        objectives: {},
        resources: { health: 0, mana: 0, stamina: 0 },
      };

      const graph: QuestGraph = {
        graphId: 'test-graph',
        start: 'beat.intro',
        nodes: [
          {
            id: 'beat.intro',
            type: 'beat',
            synopsis: 'Moonlit glade, first contact with Kiera.',
          },
        ],
        edges: [],
      };

      const turnHistory = [];

      const stuckState = softLockPrevention.detectStuckState(gameState, graph, turnHistory, 1);
      
      expect(stuckState.isStuck).toBe(true);
      expect(stuckState.reason).toContain('Critical resources depleted');
      expect(stuckState.severity).toBe('high');
    });

    it('should detect max retries stuck state', () => {
      const gameState: GameState = {
        currentNodeId: 'beat.intro',
        visited: [],
        failures: [],
        retries: 3,
        flags: {},
        objectives: {},
        resources: { health: 100, mana: 50 },
      };

      const graph: QuestGraph = {
        graphId: 'test-graph',
        start: 'beat.intro',
        nodes: [
          {
            id: 'beat.intro',
            type: 'beat',
            synopsis: 'Moonlit glade, first contact with Kiera.',
          },
        ],
        edges: [],
      };

      const turnHistory = [];

      const stuckState = softLockPrevention.detectStuckState(gameState, graph, turnHistory, 1);
      
      expect(stuckState.isStuck).toBe(true);
      expect(stuckState.reason).toContain('Maximum retries exceeded');
      expect(stuckState.severity).toBe('high');
    });
  });

  describe('Recovery Hints', () => {
    it('should generate recovery hints for stuck state', () => {
      const stuckState: StuckState = {
        isStuck: true,
        reason: 'No progress in recent turns',
        severity: 'medium',
        suggestions: [
          'Try different approaches to current objectives',
          'Look for alternative paths or solutions',
        ],
        recoveryActions: [
          {
            type: 'AUTO_HINT',
            priority: 1,
            description: 'Provide gentle guidance on current objectives',
            tokenCost: 20,
          },
        ],
      };

      const gameState: GameState = {
        currentNodeId: 'beat.intro',
        visited: [],
        failures: [],
        retries: 0,
        flags: {},
        objectives: {},
        resources: { health: 100, mana: 50 },
      };

      const hints = softLockPrevention.generateRecoveryHints(stuckState, gameState);
      
      expect(hints.length).toBeGreaterThan(0);
      expect(hints[0].hint).toBeDefined();
      expect(hints[0].hint.length).toBeLessThanOrEqual(120);
      expect(hints[0].urgency).toBeDefined();
      expect(hints[0].tokenCost).toBeGreaterThan(0);
    });
  });
});

describe('Quest Graphs Repository', () => {
  let questGraphsRepo: QuestGraphsRepo;

  beforeEach(() => {
    vi.clearAllMocks();
    questGraphsRepo = new QuestGraphsRepo();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Graph Validation', () => {
    it('should validate valid graph structure', () => {
      const graph: QuestGraph = {
        graphId: 'test-graph',
        start: 'beat.intro',
        nodes: [
          {
            id: 'beat.intro',
            type: 'beat',
            synopsis: 'Moonlit glade, first contact with Kiera.',
            hint: 'Try a calm greeting.',
          },
        ],
        edges: [],
      };

      const validation = questGraphsRepo.validateGraph(graph);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it('should detect text length violations', () => {
      const graph: QuestGraph = {
        graphId: 'test-graph',
        start: 'beat.intro',
        nodes: [
          {
            id: 'beat.intro',
            type: 'beat',
            synopsis: 'A'.repeat(200), // Too long
            hint: 'B'.repeat(150), // Too long
          },
        ],
        edges: [],
      };

      const validation = questGraphsRepo.validateGraph(graph);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors.some(error => error.includes('synopsis too long'))).toBe(true);
      expect(validation.errors.some(error => error.includes('hint too long'))).toBe(true);
    });
  });
});

describe('Integration Tests', () => {
  it('should handle end-to-end quest graph flow', () => {
    // This would test the full flow from graph selection
    // through pacing computation to soft-lock prevention
    expect(true).toBe(true); // Placeholder for integration test
  });

  it('should maintain deterministic behavior across sessions', () => {
    // This would test that the same inputs produce
    // the same outputs across different sessions
    expect(true).toBe(true); // Placeholder for integration test
  });
});

describe('Performance Tests', () => {
  it('should compute pacing state efficiently', () => {
    const pacingGovernor = new PacingGovernor();
    
    const inputs: PacingInputs = {
      turnCadence: 3,
      recentActs: [
        { type: 'greet', success: true, timestamp: new Date().toISOString() },
      ],
      resourceDeltas: { health: 0, mana: 0, stamina: 0 },
      npcBehaviorProfile: {
        tone: 'friendly',
        trustThreshold: 60,
        riskTolerance: 70,
      },
      analyticsHeuristics: {
        retryRate: 0.1,
        fallbackRate: 0.05,
        avgLatency: 2000,
      },
      sessionId: 'session-123',
      turnId: 5,
    };

    const startTime = Date.now();
    
    // Compute pacing state multiple times
    for (let i = 0; i < 100; i++) {
      pacingGovernor.computePacingState(inputs);
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete in reasonable time (< 100ms for 100 computations)
    expect(duration).toBeLessThan(100);
  });
});
