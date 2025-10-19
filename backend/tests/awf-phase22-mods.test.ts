/**
 * Phase 22: Mod System Tests
 * Comprehensive tests for mod packs, hooks, and procedural integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ModPacksService } from '../src/mods/packs-service';
import { HookBus, HOOK_TYPES } from '../src/mods/hook-bus';
import { DSLInterpreter } from '../src/mods/dsl-interpreter';
import { AssemblerModIntegration } from '../src/mods/assembler-integration';
import { OrchestratorModIntegration } from '../src/mods/orchestrator-integration';
import { ModLinterClass as ModLinter } from '../scripts/awf-lint-mods';

// Mock Supabase
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => ({ data: null, error: null })),
        order: vi.fn(() => ({ data: [], error: null })),
      })),
      order: vi.fn(() => ({ data: [], error: null })),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => ({ data: { id: 'test' }, error: null })),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({ data: null, error: null })),
    })),
    upsert: vi.fn(() => ({ data: null, error: null })),
  })),
};

// Mock configuration
const mockConfig = {
  mods_enabled: true,
  max_hooks_per_turn: 12,
  max_acts_per_turn: 6,
  max_namespace_tokens: 80,
  max_global_tokens: 200,
  max_eval_ms: 15,
  quarantine_threshold: 5,
  cert_required: true,
};

describe('Phase 22: Mod System', () => {
  let modPacksService: ModPacksService;
  let hookBus: HookBus;
  let dslInterpreter: DSLInterpreter;
  let assemblerIntegration: AssemblerModIntegration;
  let orchestratorIntegration: OrchestratorModIntegration;
  let modLinter: ModLinter;

  beforeEach(() => {
    modPacksService = new ModPacksService(mockSupabase);
    hookBus = new HookBus(modPacksService, mockConfig);
    dslInterpreter = new DSLInterpreter();
    assemblerIntegration = new AssemblerModIntegration(modPacksService, hookBus, mockConfig);
    orchestratorIntegration = new OrchestratorModIntegration(modPacksService, hookBus, assemblerIntegration, mockConfig);
    modLinter = new ModLinter();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('ModPacksService', () => {
    it('should install mod pack successfully', async () => {
      const result = await modPacksService.installModPack(
        Buffer.from('test'),
        'admin-user-id'
      );

      expect(result.success).toBe(true);
      expect(result.namespace).toBeDefined();
    });

    it('should enable mod pack when certified', async () => {
      // Mock certified mod pack
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({ data: { certified: true }, error: null })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({ data: null, error: null })),
        })),
      });

      const result = await modPacksService.enableModPack('test.namespace', 'admin-user-id');
      expect(result.success).toBe(true);
    });

    it('should disable mod pack', async () => {
      const result = await modPacksService.disableModPack('test.namespace', 'admin-user-id');
      expect(result.success).toBe(true);
    });

    it('should quarantine mod pack', async () => {
      const result = await modPacksService.quarantineModPack(
        'test.namespace',
        'Violation detected',
        { details: 'test' },
        'admin-user-id'
      );
      expect(result.success).toBe(true);
    });

    it('should certify mod pack', async () => {
      const result = await modPacksService.certifyModPack('test.namespace', 'admin-user-id');
      expect(result.success).toBe(true);
    });

    it('should get enabled mod packs', async () => {
      const packs = await modPacksService.getEnabledModPacks();
      expect(Array.isArray(packs)).toBe(true);
    });

    it('should get mod hooks for type', async () => {
      const hooks = await modPacksService.getModHooks('onTurnStart');
      expect(Array.isArray(hooks)).toBe(true);
    });

    it('should record metrics', async () => {
      await modPacksService.recordMetrics('test.namespace', 'test.hook', 'execution_ms', 100);
      // Should not throw
    });

    it('should validate mod pack', async () => {
      const result = await modPacksService.validateModPack('test.namespace');
      expect(result.valid).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe('HookBus', () => {
    it('should run hooks for turn start', async () => {
      const context = {
        session_id: 'test-session',
        turn_id: 1,
        hook_type: HOOK_TYPES.TURN_START,
        game_state: { test: 'data' },
        slices: { test: 'slice' },
        timestamp: Date.now(),
      };

      const results = await hookBus.runHooks(HOOK_TYPES.TURN_START, context);
      expect(Array.isArray(results)).toBe(true);
    });

    it('should run hooks for node enter', async () => {
      const context = {
        session_id: 'test-session',
        turn_id: 1,
        hook_type: HOOK_TYPES.NODE_ENTER,
        game_state: { test: 'data' },
        slices: { test: 'slice' },
        timestamp: Date.now(),
      };

      const results = await hookBus.runHooks(HOOK_TYPES.NODE_ENTER, context);
      expect(Array.isArray(results)).toBe(true);
    });

    it('should run hooks for weather change', async () => {
      const context = {
        session_id: 'test-session',
        turn_id: 1,
        hook_type: HOOK_TYPES.WEATHER_CHANGE,
        game_state: { test: 'data' },
        slices: { test: 'slice' },
        timestamp: Date.now(),
      };

      const results = await hookBus.runHooks(HOOK_TYPES.WEATHER_CHANGE, context);
      expect(Array.isArray(results)).toBe(true);
    });

    it('should get metrics', () => {
      const metrics = hookBus.getMetrics();
      expect(metrics instanceof Map).toBe(true);
    });

    it('should clear metrics', () => {
      hookBus.clearMetrics();
      // Should not throw
    });
  });

  describe('DSLInterpreter', () => {
    it('should evaluate guard expressions', async () => {
      const guard = {
        path: 'test.value',
        op: 'eq',
        val: 'expected',
      };

      const context = {
        session_id: 'test-session',
        turn_id: 1,
        game_state: { test: { value: 'expected' } },
        slices: {},
        timestamp: Date.now(),
      };

      const result = await dslInterpreter.evaluateGuard(guard, context);
      expect(result.passed).toBe(true);
    });

    it('should evaluate probability expressions', () => {
      const prob = 'seeded(0.5)';
      const context = {
        session_id: 'test-session',
        turn_id: 1,
        game_state: {},
        slices: {},
        timestamp: Date.now(),
      };

      const result = dslInterpreter.evaluateProbability(prob, context);
      expect(typeof result).toBe('number');
      expect(result >= 0 && result <= 1).toBe(true);
    });

    it('should generate seeded random numbers', () => {
      const seed = 'test-seed';
      const max = 1.0;
      const result = dslInterpreter.seededRandom(seed, max);
      expect(typeof result).toBe('number');
      expect(result >= 0 && result <= max).toBe(true);
    });

    it('should validate expressions', () => {
      const validExpr = 'seeded(0.5)';
      const invalidExpr = 'eval("dangerous")';

      const validResult = dslInterpreter.validateExpression(validExpr);
      const invalidResult = dslInterpreter.validateExpression(invalidExpr);

      expect(validResult.valid).toBe(true);
      expect(invalidResult.valid).toBe(false);
    });

    it('should calculate complexity score', () => {
      const simpleExpr = 'seeded(0.5)';
      const complexExpr = 'seeded(0.5) && (test > 0) || (other < 1)';

      const simpleScore = dslInterpreter.getComplexityScore(simpleExpr);
      const complexScore = dslInterpreter.getComplexityScore(complexExpr);

      expect(simpleScore).toBeLessThan(complexScore);
    });
  });

  describe('AssemblerModIntegration', () => {
    it('should process assemble hooks', async () => {
      const sessionId = 'test-session';
      const turnId = 1;
      const gameState = { test: 'data' };
      const baseSlices = { test: 'slice' };

      const result = await assemblerIntegration.processAssembleHooks(
        sessionId,
        turnId,
        gameState,
        baseSlices
      );

      expect(result.mod_ctx).toBeDefined();
      expect(typeof result.total_tokens).toBe('number');
      expect(Array.isArray(result.trimmed_namespaces)).toBe(true);
      expect(Array.isArray(result.violations)).toBe(true);
    });

    it('should validate slice requests', () => {
      const validRequests = [
        {
          namespace: 'test.namespace',
          slices: ['sim.weather', 'hot.objectives'],
          priority: 10,
        },
      ];

      const invalidRequests = [
        {
          namespace: 'invalid namespace',
          slices: ['invalid path'],
          priority: -1,
        },
      ];

      const validResult = assemblerIntegration.validateSliceRequests(validRequests);
      const invalidResult = assemblerIntegration.validateSliceRequests(invalidRequests);

      expect(validResult.valid).toBe(true);
      expect(invalidResult.valid).toBe(false);
    });

    it('should get mod context for bundle', () => {
      const modContext = {
        'test.namespace': {
          namespace: 'test.namespace',
          slices: [
            {
              namespace: 'test.namespace',
              path: 'sim.weather',
              data: { state: 'rain' },
              tokens: 10,
              priority: 10,
            },
          ],
          total_tokens: 10,
          trimmed: false,
        },
      };

      const bundleContext = assemblerIntegration.getModContextForBundle(modContext);
      expect(bundleContext).toBeDefined();
      expect(bundleContext['test.namespace']).toBeDefined();
    });
  });

  describe('OrchestratorModIntegration', () => {
    it('should run turn hooks', async () => {
      const context = {
        session_id: 'test-session',
        turn_id: 1,
        game_state: { test: 'data' },
        slices: { test: 'slice' },
        timestamp: Date.now(),
      };

      const result = await orchestratorIntegration.runTurnHooks(context);
      expect(result.turn_start).toBeDefined();
      expect(result.assemble).toBeDefined();
      expect(result.before_infer).toBeDefined();
      expect(result.after_infer).toBeDefined();
      expect(result.apply_acts).toBeDefined();
      expect(result.turn_end).toBeDefined();
      expect(typeof result.total_acts).toBe('number');
      expect(typeof result.total_tokens).toBe('number');
      expect(Array.isArray(result.violations)).toBe(true);
    });

    it('should run graph hooks', async () => {
      const context = {
        session_id: 'test-session',
        turn_id: 1,
        game_state: { test: 'data' },
        slices: { test: 'slice' },
        timestamp: Date.now(),
      };

      const enterActs = await orchestratorIntegration.runGraphHooks(context, 'node.forest', 'enter');
      const exitActs = await orchestratorIntegration.runGraphHooks(context, 'node.forest', 'exit');

      expect(Array.isArray(enterActs)).toBe(true);
      expect(Array.isArray(exitActs)).toBe(true);
    });

    it('should run world sim hooks', async () => {
      const context = {
        session_id: 'test-session',
        turn_id: 1,
        game_state: { test: 'data' },
        slices: { test: 'slice' },
        timestamp: Date.now(),
      };

      const weatherActs = await orchestratorIntegration.runWorldSimHooks(
        context,
        'weather_change',
        { state: 'rain' }
      );

      expect(Array.isArray(weatherActs)).toBe(true);
    });

    it('should run party hooks', async () => {
      const context = {
        session_id: 'test-session',
        turn_id: 1,
        game_state: { test: 'data' },
        slices: { test: 'slice' },
        timestamp: Date.now(),
      };

      const recruitActs = await orchestratorIntegration.runPartyHooks(
        context,
        'recruit',
        { name: 'Test Character' }
      );

      expect(Array.isArray(recruitActs)).toBe(true);
    });

    it('should run economy hooks', async () => {
      const context = {
        session_id: 'test-session',
        turn_id: 1,
        game_state: { test: 'data' },
        slices: { test: 'slice' },
        timestamp: Date.now(),
      };

      const lootActs = await orchestratorIntegration.runEconomyHooks(
        context,
        'loot_roll',
        { items: ['sword', 'potion'] }
      );

      expect(Array.isArray(lootActs)).toBe(true);
    });

    it('should process assemble hooks with mod context', async () => {
      const context = {
        session_id: 'test-session',
        turn_id: 1,
        game_state: { test: 'data' },
        slices: { test: 'slice' },
        timestamp: Date.now(),
      };

      const result = await orchestratorIntegration.processAssembleHooks(context, {});
      expect(result.mod_context).toBeDefined();
      expect(Array.isArray(result.acts)).toBe(true);
      expect(typeof result.total_tokens).toBe('number');
      expect(Array.isArray(result.trimmed_namespaces)).toBe(true);
    });

    it('should check if mod system is enabled', async () => {
      const enabled = await orchestratorIntegration.isModSystemEnabled();
      expect(typeof enabled).toBe('boolean');
    });

    it('should get mod system metrics', async () => {
      const metrics = await orchestratorIntegration.getModSystemMetrics();
      expect(metrics.enabled_packs).toBeDefined();
      expect(metrics.total_hooks).toBeDefined();
      expect(metrics.total_acts).toBeDefined();
      expect(metrics.total_tokens).toBeDefined();
      expect(metrics.violations).toBeDefined();
    });
  });

  describe('ModLinter', () => {
    it('should lint mod pack', async () => {
      const manifest = {
        namespace: 'test.namespace',
        version: '1.0.0',
        awf_core: '>=1.12.0',
        declares: {
          hooks: ['onTurnStart'],
          slices: ['sim.weather'],
        },
        permissions: {
          acts: ['RESOURCE_DELTA'],
          perTurnActsMax: 1,
          requiresCertification: true,
        },
      };

      const hooks = [
        {
          hook_id: 'test_hook',
          type: 'onTurnStart',
          guards: [
            { path: 'sim.weather.state', op: 'eq', val: 'rain' }
          ],
          prob: 'seeded(0.5)',
          effects: [
            { act: 'RESOURCE_DELTA', key: 'energy', delta: -1 }
          ],
        },
      ];

      const result = await modLinter.lintModPack('test.namespace', manifest, hooks);
      expect(result.namespace).toBe('test.namespace');
      expect(result.manifest).toBeDefined();
      expect(result.hooks).toBeDefined();
      expect(result.overall).toBeDefined();
    });

    it('should certify mod pack', async () => {
      const manifest = {
        namespace: 'test.namespace',
        version: '1.0.0',
        awf_core: '>=1.12.0',
        declares: {
          hooks: ['onTurnStart'],
          slices: ['sim.weather'],
        },
        permissions: {
          acts: ['RESOURCE_DELTA'],
          perTurnActsMax: 1,
          requiresCertification: true,
        },
      };

      const hooks = [
        {
          hook_id: 'test_hook',
          type: 'onTurnStart',
          guards: [
            { path: 'sim.weather.state', op: 'eq', val: 'rain' }
          ],
          prob: 'seeded(0.5)',
          effects: [
            { act: 'RESOURCE_DELTA', key: 'energy', delta: -1 }
          ],
        },
      ];

      const result = await modLinter.certifyModPack('test.namespace', manifest, hooks);
      expect(result.namespace).toBe('test.namespace');
      expect(typeof result.certified).toBe('boolean');
      expect(typeof result.score).toBe('number');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(typeof result.tests_passed).toBe('number');
      expect(typeof result.tests_total).toBe('number');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete mod workflow', async () => {
      // Install mod pack
      const installResult = await modPacksService.installModPack(
        Buffer.from('test'),
        'admin-user-id'
      );
      expect(installResult.success).toBe(true);

      // Enable mod pack
      const enableResult = await modPacksService.enableModPack(
        installResult.namespace!,
        'admin-user-id'
      );
      expect(enableResult.success).toBe(true);

      // Run turn hooks
      const context = {
        session_id: 'test-session',
        turn_id: 1,
        game_state: { test: 'data' },
        slices: { test: 'slice' },
        timestamp: Date.now(),
      };

      const turnResult = await orchestratorIntegration.runTurnHooks(context);
      expect(turnResult.total_acts).toBeDefined();
      expect(turnResult.total_tokens).toBeDefined();
    });

    it('should handle mod violations and quarantine', async () => {
      // Install mod pack
      const installResult = await modPacksService.installModPack(
        Buffer.from('test'),
        'admin-user-id'
      );
      expect(installResult.success).toBe(true);

      // Quarantine mod pack
      const quarantineResult = await modPacksService.quarantineModPack(
        installResult.namespace!,
        'Violation detected',
        { details: 'test' },
        'admin-user-id'
      );
      expect(quarantineResult.success).toBe(true);
    });

    it('should handle mod metrics and monitoring', async () => {
      // Record metrics
      await modPacksService.recordMetrics('test.namespace', 'test.hook', 'execution_ms', 100);
      await modPacksService.recordMetrics('test.namespace', 'test.hook', 'acts_emitted', 5);

      // Get metrics
      const metrics = await orchestratorIntegration.getModSystemMetrics();
      expect(metrics.enabled_packs).toBeDefined();
      expect(metrics.total_hooks).toBeDefined();
    });
  });

  describe('Performance Tests', () => {
    it('should execute hooks within time limits', async () => {
      const startTime = Date.now();
      
      const context = {
        session_id: 'test-session',
        turn_id: 1,
        hook_type: HOOK_TYPES.TURN_START,
        game_state: { test: 'data' },
        slices: { test: 'slice' },
        timestamp: Date.now(),
      };

      await hookBus.runHooks(HOOK_TYPES.TURN_START, context);
      
      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle token limits efficiently', async () => {
      const sessionId = 'test-session';
      const turnId = 1;
      const gameState = { test: 'data' };
      const baseSlices = { test: 'slice' };

      const result = await assemblerIntegration.processAssembleHooks(
        sessionId,
        turnId,
        gameState,
        baseSlices
      );

      expect(result.total_tokens).toBeLessThanOrEqual(mockConfig.max_global_tokens);
    });
  });
});
