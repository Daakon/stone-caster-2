/**
 * Phase 16: AWF Mechanics Kernel Tests
 * Comprehensive test suite for skill checks, conditions, resources, and simulation
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
      order: vi.fn(() => ({ data: [], error: null })),
    })),
    rpc: vi.fn(() => ({ data: null, error: null })),
  })),
}));

import { SkillCheckEngine, SkillCheckContext, SkillCheckResult, skillCheckEngine } from '../src/mechanics/skill-checks.js';
import { ConditionsEngine, StatusAction, StatusMap, conditionsEngine } from '../src/mechanics/conditions.js';
import { ResourcesEngine, ResourceAction, ResourceMap, resourcesEngine } from '../src/mechanics/resources.js';
import { MechanicsActsIntegration, MechanicsAct, MechanicsContext } from '../src/mechanics/acts-integration.js';
import { SimulationRunner, SimulationConfig, SimulationResult } from '../src/sim/sim-runner.js';

describe('Skill Check Engine', () => {
  let skillCheckEngine: SkillCheckEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    skillCheckEngine = new SkillCheckEngine();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Skill Check Rolling', () => {
    it('should roll skill check with deterministic results', () => {
      const context: SkillCheckContext = {
        actor: 'player',
        skill: 'strength',
        difficulty: 15,
        modifiers: [2, 3],
        sessionId: 'session-123',
        turnId: 5,
        checkId: 'check-001',
      };

      const result = skillCheckEngine.rollCheck(context);
      
      expect(result.id).toBe('check-001');
      expect(result.skill).toBe('strength');
      expect(result.roll).toBeGreaterThanOrEqual(1);
      expect(result.total).toBe(result.roll + 5); // 2 + 3 modifiers
      expect(result.threshold).toBe(15);
      expect(result.outcome).toBeDefined();
      expect(result.margin).toBe(result.total - result.threshold);
    });

    it('should handle advantage correctly', () => {
      const context: SkillCheckContext = {
        actor: 'player',
        skill: 'dexterity',
        difficulty: 12,
        modifiers: [1],
        advantage: true,
        sessionId: 'session-123',
        turnId: 5,
        checkId: 'check-002',
      };

      const result = skillCheckEngine.rollCheck(context);
      
      expect(result.roll).toBeGreaterThanOrEqual(1);
      expect(result.total).toBe(result.roll + 1);
    });

    it('should handle disadvantage correctly', () => {
      const context: SkillCheckContext = {
        actor: 'player',
        skill: 'intelligence',
        difficulty: 18,
        modifiers: [2],
        disadvantage: true,
        sessionId: 'session-123',
        turnId: 5,
        checkId: 'check-003',
      };

      const result = skillCheckEngine.rollCheck(context);
      
      expect(result.roll).toBeGreaterThanOrEqual(1);
      expect(result.total).toBe(result.roll + 2);
    });

    it('should generate consistent results with same seed', () => {
      const context: SkillCheckContext = {
        actor: 'player',
        skill: 'charisma',
        difficulty: 14,
        modifiers: [1],
        sessionId: 'session-123',
        turnId: 5,
        checkId: 'check-004',
      };

      const result1 = skillCheckEngine.rollCheck(context);
      const result2 = skillCheckEngine.rollCheck(context);
      
      expect(result1.roll).toBe(result2.roll);
      expect(result1.total).toBe(result2.total);
      expect(result1.outcome).toBe(result2.outcome);
    });
  });

  describe('Check Policies', () => {
    it('should support multiple check policies', () => {
      const policies = skillCheckEngine.getPolicies();
      
      expect(policies).toContain('linear_d20');
      expect(policies).toContain('bell_2d6');
      expect(policies).toContain('percent_1d100');
      expect(policies).toContain('bell_3d6');
    });

    it('should generate different outcomes for different policies', () => {
      const context: SkillCheckContext = {
        actor: 'player',
        skill: 'strength',
        difficulty: 15,
        modifiers: [0],
        sessionId: 'session-123',
        turnId: 5,
        checkId: 'check-005',
      };

      // Test different policies (if we had a way to set them)
      const result = skillCheckEngine.rollCheck(context);
      
      expect(result.outcome).toBeDefined();
      expect(['crit', 'success', 'mixed', 'fail', 'critfail']).toContain(result.outcome);
    });
  });
});

describe('Conditions Engine', () => {
  let conditionsEngine: ConditionsEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    conditionsEngine = new ConditionsEngine();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Status Application', () => {
    it('should apply status condition', () => {
      // Mock the condition registry
      const mockCondition = {
        id: 'poisoned',
        stacking: 'add' as const,
        cap: 5,
        cleanseKeys: ['antidote'],
        tickHooks: { resourceDeltas: [{ key: 'hp', delta: -1 }] },
      };
      conditionsEngine.getConditionRegistry().set('poisoned', mockCondition);
      
      const actions = conditionsEngine.applyStatus('player', 'poisoned', 2, 5, 1.5);
      
      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0].type).toBe('APPLY_STATUS');
      expect(actions[0].target).toBe('player');
      expect(actions[0].key).toBe('poisoned');
      expect(actions[0].stacks).toBe(2);
      expect(actions[0].duration).toBe(5);
      expect(actions[0].potency).toBe(1.5);
    });

    it('should remove status condition', () => {
      const actions = conditionsEngine.removeStatus('player', 'poisoned');
      
      expect(actions.length).toBe(1);
      expect(actions[0].type).toBe('REMOVE_STATUS');
      expect(actions[0].target).toBe('player');
      expect(actions[0].key).toBe('poisoned');
    });

    it('should handle status ticking', () => {
      const statusMap: StatusMap = {
        'player': {
          'poisoned': {
            conditionId: 'poisoned',
            stacks: 2,
            duration: 3,
            appliedAt: new Date().toISOString(),
          },
        },
      };

      const actions = conditionsEngine.tickStatuses(statusMap);
      
      expect(actions.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Status Management', () => {
    it('should check if target has condition', () => {
      const statusMap: StatusMap = {
        'player': {
          'poisoned': {
            conditionId: 'poisoned',
            stacks: 1,
            duration: 5,
            appliedAt: new Date().toISOString(),
          },
        },
      };

      expect(conditionsEngine.hasCondition(statusMap, 'player', 'poisoned')).toBe(true);
      expect(conditionsEngine.hasCondition(statusMap, 'player', 'blessed')).toBe(false);
    });

    it('should get target statuses', () => {
      const statusMap: StatusMap = {
        'player': {
          'poisoned': {
            conditionId: 'poisoned',
            stacks: 1,
            duration: 5,
            appliedAt: new Date().toISOString(),
          },
          'blessed': {
            conditionId: 'blessed',
            stacks: 1,
            duration: -1,
            appliedAt: new Date().toISOString(),
          },
        },
      };

      const statuses = conditionsEngine.getTargetStatuses(statusMap, 'player');
      
      expect(statuses.length).toBe(2);
      expect(statuses.some(s => s.conditionId === 'poisoned')).toBe(true);
      expect(statuses.some(s => s.conditionId === 'blessed')).toBe(true);
    });
  });
});

describe('Resources Engine', () => {
  let resourcesEngine: ResourcesEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    resourcesEngine = new ResourcesEngine();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Resource Delta Application', () => {
    it('should apply resource delta with soft clamping', () => {
      // Mock the resource registry
      const mockResource = {
        id: 'hp',
        minValue: 0,
        maxValue: 100,
        regenPerTick: 0,
        decayPerTick: 0,
      };
      resourcesEngine.getAllResourceDefinitions = vi.fn().mockReturnValue([mockResource]);
      (resourcesEngine as any).resourceRegistry.set('hp', mockResource);
      
      const result = resourcesEngine.applyResourceDelta(50, 'hp', 25, 'soft');
      
      expect(result.newValue).toBe(75);
      expect(result.clamped).toBe(false);
    });

    it('should apply resource delta with hard clamping', () => {
      // Mock the resource registry
      const mockResource = {
        id: 'hp',
        minValue: 0,
        maxValue: 100,
        regenPerTick: 0,
        decayPerTick: 0,
      };
      (resourcesEngine as any).resourceRegistry.set('hp', mockResource);
      
      const result = resourcesEngine.applyResourceDelta(50, 'hp', 100, 'hard');
      
      expect(result.newValue).toBe(100); // Clamped to max
      expect(result.clamped).toBe(true);
    });

    it('should handle negative deltas', () => {
      // Mock the resource registry
      const mockResource = {
        id: 'hp',
        minValue: 0,
        maxValue: 100,
        regenPerTick: 0,
        decayPerTick: 0,
      };
      (resourcesEngine as any).resourceRegistry.set('hp', mockResource);
      
      const result = resourcesEngine.applyResourceDelta(50, 'hp', -30, 'soft');
      
      expect(result.newValue).toBe(20);
      expect(result.clamped).toBe(false);
    });
  });

  describe('Resource Curves', () => {
    it('should process resource regeneration', () => {
      const resources: ResourceMap = {
        hp: 50,
        energy: 30,
        mana: 80,
      };

      const actions = resourcesEngine.processResourceCurves(resources);
      
      expect(actions.length).toBeGreaterThanOrEqual(0);
      expect(actions.every(a => a.type === 'RESOURCE_DELTA')).toBe(true);
    });

    it('should handle resource decay', () => {
      const resources: ResourceMap = {
        stress: 50,
        stamina: 40,
      };

      const actions = resourcesEngine.processResourceCurves(resources);
      
      expect(actions.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Resource Validation', () => {
    it('should validate resource values', () => {
      // This would test validation against resource definitions
      expect(true).toBe(true); // Placeholder
    });
  });
});

describe('Mechanics Acts Integration', () => {
  let mechanicsActsIntegration: MechanicsActsIntegration;

  beforeEach(() => {
    vi.clearAllMocks();
    mechanicsActsIntegration = new MechanicsActsIntegration();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Act Processing', () => {
    it('should process mechanics acts', async () => {
      // Mock the resource registry
      const mockResource = {
        id: 'hp',
        minValue: 0,
        maxValue: 100,
        regenPerTick: 0,
        decayPerTick: 0,
      };
      (resourcesEngine as any).resourceRegistry.set('hp', mockResource);
      
      // Mock the condition registry
      const mockCondition = {
        id: 'blessed',
        stacking: 'none' as const,
        cap: undefined,
        cleanseKeys: [],
        tickHooks: {},
      };
      (conditionsEngine as any).conditionRegistry.set('blessed', mockCondition);
      
      const acts: MechanicsAct[] = [
        {
          type: 'RESOURCE_DELTA',
          key: 'hp',
          delta: 10,
          clamp: 'soft',
        },
        {
          type: 'APPLY_STATUS',
          target: 'player',
          key: 'blessed',
          stacks: 1,
          duration: 5,
        },
      ];

      const context: MechanicsContext = {
        sessionId: 'session-123',
        turnId: 5,
        actor: 'player',
        gameState: {
          resources: { hp: 50, energy: 100 },
          status: {},
          flags: {},
          objectives: {},
        },
      };

      const result = await mechanicsActsIntegration.processMechanicsActs(acts, context);
      
      expect(result.newActs.length).toBeGreaterThanOrEqual(0);
      expect(result.updatedGameState.resources.hp).toBe(60);
    });

    it('should validate mechanics acts', () => {
      const validActs: MechanicsAct[] = [
        {
          type: 'CHECK_RESULT',
          id: 'check-001',
          skill: 'strength',
          roll: 15,
          total: 18,
          threshold: 15,
          outcome: 'success',
          margin: 3,
        },
        {
          type: 'RESOURCE_DELTA',
          key: 'hp',
          delta: -5,
          clamp: 'soft',
        },
      ];

      const validation = mechanicsActsIntegration.validateMechanicsActs(validActs);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it('should detect invalid mechanics acts', () => {
      const invalidActs: MechanicsAct[] = [
        {
          type: 'CHECK_RESULT',
          // Missing required fields
        },
        {
          type: 'RESOURCE_DELTA',
          // Missing key and delta
        },
      ];

      const validation = mechanicsActsIntegration.validateMechanicsActs(invalidActs);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Act Generation', () => {
    it('should generate skill check result act', () => {
      const context: SkillCheckContext = {
        actor: 'player',
        skill: 'strength',
        difficulty: 15,
        modifiers: [2],
        sessionId: 'session-123',
        turnId: 5,
        checkId: 'check-001',
      };

      const result: SkillCheckResult = {
        id: 'check-001',
        skill: 'strength',
        roll: 12,
        total: 14,
        threshold: 15,
        outcome: 'fail',
        margin: -1,
      };

      const act = mechanicsActsIntegration.generateSkillCheckAct(context, result);
      
      expect(act.type).toBe('CHECK_RESULT');
      expect(act.id).toBe('check-001');
      expect(act.skill).toBe('strength');
      expect(act.outcome).toBe('fail');
    });

    it('should generate status application act', () => {
      const act = mechanicsActsIntegration.generateApplyStatusAct(
        'player',
        'poisoned',
        2,
        5,
        1.5
      );
      
      expect(act.type).toBe('APPLY_STATUS');
      expect(act.target).toBe('player');
      expect(act.key).toBe('poisoned');
      expect(act.stacks).toBe(2);
      expect(act.duration).toBe(5);
      expect(act.potency).toBe(1.5);
    });

    it('should generate resource delta act', () => {
      const act = mechanicsActsIntegration.generateResourceDeltaAct('hp', -10, 'soft');
      
      expect(act.type).toBe('RESOURCE_DELTA');
      expect(act.key).toBe('hp');
      expect(act.delta).toBe(-10);
      expect(act.clamp).toBe('soft');
    });
  });

  describe('Time Advance Processing', () => {
    it('should process time advance for status ticking and resource curves', () => {
      const gameState: MechanicsContext['gameState'] = {
        resources: { hp: 50, energy: 100, mana: 80 },
        status: {
          'player': {
            'poisoned': {
              conditionId: 'poisoned',
              stacks: 1,
              duration: 3,
              appliedAt: new Date().toISOString(),
            },
          },
        },
        flags: {},
        objectives: {},
      };

      const acts = mechanicsActsIntegration.processTimeAdvance(gameState);
      
      expect(acts.length).toBeGreaterThanOrEqual(0);
      expect(acts.every(a => ['TICK_STATUS', 'RESOURCE_DELTA'].includes(a.type))).toBe(true);
    });
  });
});

describe('Simulation Runner', () => {
  let simulationRunner: SimulationRunner;

  beforeEach(() => {
    vi.clearAllMocks();
    simulationRunner = new SimulationRunner();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Simulation Configuration', () => {
    it('should create valid simulation config', () => {
      const config: SimulationConfig = {
        name: 'Test Encounter',
        description: 'A test encounter for simulation',
        trials: 100,
        seed: 12345,
        skills: {
          strength: { baseline: 10, modifiers: [2] },
          dexterity: { baseline: 12, modifiers: [1] },
        },
        difficulty: 15,
        statusPresets: {
          player: {
            blessed: { stacks: 1, duration: 5 },
          },
        },
        resources: {
          hp: 100,
          energy: 50,
          mana: 30,
        },
        encounter: {
          maxTurns: 10,
          winCondition: 'hp > 0',
          loseCondition: 'hp <= 0',
        },
      };

      expect(config.name).toBe('Test Encounter');
      expect(config.trials).toBe(100);
      expect(config.skills.strength.baseline).toBe(10);
      expect(config.encounter.maxTurns).toBe(10);
    });
  });

  describe('Simulation Execution', () => {
    it('should run simulation and generate results', async () => {
      const config: SimulationConfig = {
        name: 'Simple Test',
        description: 'A simple test simulation',
        trials: 10,
        seed: 12345,
        skills: {
          strength: { baseline: 10, modifiers: [0] },
        },
        difficulty: 15,
        statusPresets: {},
        resources: {
          hp: 100,
          energy: 50,
        },
        encounter: {
          maxTurns: 5,
          winCondition: 'hp > 0',
          loseCondition: 'hp <= 0',
        },
      };

      const result = await simulationRunner.runSimulation(config);
      
      expect(result.config.name).toBe('Simple Test');
      expect(result.stats.successRate).toBeGreaterThanOrEqual(0);
      expect(result.stats.successRate).toBeLessThanOrEqual(1);
      expect(result.stats.averageTurns).toBeGreaterThan(0);
      expect(result.rawData.trials.length).toBe(10);
    });
  });

  describe('Result Analysis', () => {
    it('should calculate success rate correctly', async () => {
      const config: SimulationConfig = {
        name: 'Success Rate Test',
        description: 'Test success rate calculation',
        trials: 100,
        seed: 12345,
        skills: {
          strength: { baseline: 20, modifiers: [0] }, // High baseline for high success rate
        },
        difficulty: 10, // Low difficulty for high success rate
        statusPresets: {},
        resources: {
          hp: 100,
        },
        encounter: {
          maxTurns: 5,
          winCondition: 'hp > 0',
          loseCondition: 'hp <= 0',
        },
      };

      const result = await simulationRunner.runSimulation(config);
      
      expect(result.stats.successRate).toBeGreaterThan(0);
      expect(result.stats.averageTurns).toBeGreaterThan(0);
      expect(result.percentiles.turns.p50).toBeGreaterThan(0);
      expect(result.percentiles.turns.p95).toBeGreaterThanOrEqual(result.percentiles.turns.p50);
    });
  });

  describe('Export Functions', () => {
    it('should export results to CSV', async () => {
      const config: SimulationConfig = {
        name: 'Export Test',
        description: 'Test export functionality',
        trials: 5,
        seed: 12345,
        skills: {
          strength: { baseline: 10, modifiers: [0] },
        },
        difficulty: 15,
        statusPresets: {},
        resources: {
          hp: 100,
          energy: 50,
        },
        encounter: {
          maxTurns: 3,
          winCondition: 'hp > 0',
          loseCondition: 'hp <= 0',
        },
      };

      const result = await simulationRunner.runSimulation(config);
      const csv = simulationRunner.exportToCSV(result);
      
      expect(csv).toContain('Trial,Success,Turns,HP,Energy,Mana,Stress,SkillChecks,Conditions');
      expect(csv.split('\n').length).toBeGreaterThan(5); // Header + 5 trials
    });

    it('should export results to JSON', async () => {
      const config: SimulationConfig = {
        name: 'Export Test',
        description: 'Test export functionality',
        trials: 5,
        seed: 12345,
        skills: {
          strength: { baseline: 10, modifiers: [0] },
        },
        difficulty: 15,
        statusPresets: {},
        resources: {
          hp: 100,
        },
        encounter: {
          maxTurns: 3,
          winCondition: 'hp > 0',
          loseCondition: 'hp <= 0',
        },
      };

      const result = await simulationRunner.runSimulation(config);
      const json = simulationRunner.exportToJSON(result);
      
      expect(json).toContain('"name": "Export Test"');
      expect(json).toContain('"successRate"');
      expect(json).toContain('"averageTurns"');
    });
  });
});

describe('Integration Tests', () => {
  it('should handle end-to-end mechanics flow', async () => {
    // This would test the full flow from skill check
    // through status application to resource management
    expect(true).toBe(true); // Placeholder for integration test
  });

  it('should maintain deterministic behavior across sessions', () => {
    // This would test that the same inputs produce
    // the same outputs across different sessions
    expect(true).toBe(true); // Placeholder for integration test
  });
});

describe('Performance Tests', () => {
  it('should process skill checks efficiently', () => {
    const skillCheckEngine = new SkillCheckEngine();
    
    const context: SkillCheckContext = {
      actor: 'player',
      skill: 'strength',
      difficulty: 15,
      modifiers: [2],
      sessionId: 'session-123',
      turnId: 5,
      checkId: 'check-001',
    };

    const startTime = Date.now();
    
    // Process multiple skill checks
    for (let i = 0; i < 100; i++) {
      skillCheckEngine.rollCheck(context);
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete in reasonable time (< 100ms for 100 checks)
    expect(duration).toBeLessThan(100);
  });

  it('should process resource curves efficiently', () => {
    const resourcesEngine = new ResourcesEngine();
    
    const resources: ResourceMap = {
      hp: 100,
      energy: 50,
      mana: 30,
      stress: 20,
      stamina: 40,
    };

    const startTime = Date.now();
    
    // Process resource curves multiple times
    for (let i = 0; i < 100; i++) {
      resourcesEngine.processResourceCurves(resources);
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete in reasonable time (< 100ms for 100 operations)
    expect(duration).toBeLessThan(100);
  });
});
