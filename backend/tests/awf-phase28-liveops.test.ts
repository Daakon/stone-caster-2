// Phase 28: LiveOps Remote Configuration System Tests
// Comprehensive test suite for LiveOps functionality

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        lte: vi.fn(() => ({
          or: vi.fn(() => ({
            order: vi.fn(() => ({
              data: [],
              error: null
            }))
          }))
        }))
      }))
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => ({
          data: { config_id: 'test-config', name: 'Test Config' },
          error: null
        }))
      }))
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { config_id: 'test-config', name: 'Test Config' },
            error: null
          }))
        }))
      }))
    }))
  })),
  auth: {
    getUser: vi.fn(() => ({
      data: { user: { id: 'test-user' } },
      error: null
    }))
  }
};

// Mock the modules
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}));

// Import the modules after mocking
import { 
  LiveOpsConfigSchema, 
  validateLiveOpsConfig, 
  checkConfigBounds,
  createDefaultLiveOpsConfig 
} from '../src/liveops/levers-schema';
import { LiveOpsConfigResolver, createLiveOpsConfigResolver } from '../src/liveops/config-resolver';
import { LiveOpsSafetyMechanisms, createLiveOpsSafetyMechanisms } from '../src/liveops/safety-mechanisms';
import { LiveOpsIntegration, createLiveOpsIntegration } from '../src/liveops/integration-points';

describe('Phase 28: LiveOps Remote Configuration System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('LiveOps Schema Validation', () => {
    it('should validate default config', () => {
      const defaultConfig = createDefaultLiveOpsConfig();
      const validation = validateLiveOpsConfig(defaultConfig);
      
      expect(validation.success).toBe(true);
      expect(validation.data).toBeDefined();
    });

    it('should validate token bounds', () => {
      const config = {
        AWF_MAX_INPUT_TOKENS: 5000,
        AWF_MAX_OUTPUT_TOKENS: 2500,
        AWF_INPUT_TOKEN_MULTIPLIER: 1.2,
        AWF_OUTPUT_TOKEN_MULTIPLIER: 0.8
      };

      const validation = validateLiveOpsConfig(config);
      expect(validation.success).toBe(true);
    });

    it('should reject invalid token bounds', () => {
      const config = {
        AWF_MAX_INPUT_TOKENS: 500, // Too low
        AWF_MAX_OUTPUT_TOKENS: 15000 // Too high
      };

      const validation = validateLiveOpsConfig(config);
      expect(validation.success).toBe(false);
    });

    it('should validate percentage bounds', () => {
      const config = {
        QUEST_PACING_TEMPO_MULTIPLIER: 0.5,
        SOFT_LOCK_HINT_FREQUENCY: 0.1,
        RESOURCE_REGEN_MULTIPLIER: 1.2
      };

      const validation = validateLiveOpsConfig(config);
      expect(validation.success).toBe(true);
    });

    it('should reject invalid percentage bounds', () => {
      const config = {
        QUEST_PACING_TEMPO_MULTIPLIER: 1.5, // Too high
        SOFT_LOCK_HINT_FREQUENCY: -0.1 // Negative
      };

      const validation = validateLiveOpsConfig(config);
      expect(validation.success).toBe(false);
    });

    it('should validate economy bounds', () => {
      const config = {
        DROP_RATE_COMMON_MULTIPLIER: 1.5,
        DROP_RATE_LEGENDARY_MULTIPLIER: 2.0,
        VENDOR_MARGIN_MIN: 0.1,
        VENDOR_MARGIN_MAX: 0.3
      };

      const validation = validateLiveOpsConfig(config);
      expect(validation.success).toBe(true);
    });

    it('should validate world sim bounds', () => {
      const config = {
        WORLD_EVENT_RATE_MULTIPLIER: 1.2,
        WEATHER_VOLATILITY_MULTIPLIER: 0.8,
        REGION_DRIFT_STEP_CAP: 5
      };

      const validation = validateLiveOpsConfig(config);
      expect(validation.success).toBe(true);
    });

    it('should validate dialogue bounds', () => {
      const config = {
        DIALOGUE_CANDIDATE_CAP: 8,
        ROMANCE_COOLDOWN_TURNS: 15,
        DIALOGUE_ENGAGEMENT_MULTIPLIER: 1.1
      };

      const validation = validateLiveOpsConfig(config);
      expect(validation.success).toBe(true);
    });

    it('should validate party bounds', () => {
      const config = {
        PARTY_MAX_ACTIVE_MEMBERS: 6,
        PARTY_DELEGATE_CHECK_RATE: 0.15,
        PARTY_INTENT_MIX_BIAS: {
          COOPERATIVE: 0.4,
          COMPETITIVE: 0.3,
          NEUTRAL: 0.3
        }
      };

      const validation = validateLiveOpsConfig(config);
      expect(validation.success).toBe(true);
    });

    it('should validate module gates', () => {
      const config = {
        DIALOGUE_GATE: 'full',
        WORLDSIM_GATE: 'readonly',
        PARTY_GATE: 'off',
        MODS_GATE: 'full',
        TOOLS_GATE: 'readonly',
        ECONOMY_KERNEL_GATE: 'full'
      };

      const validation = validateLiveOpsConfig(config);
      expect(validation.success).toBe(true);
    });
  });

  describe('Config Resolver', () => {
    let resolver: LiveOpsConfigResolver;

    beforeEach(() => {
      resolver = createLiveOpsConfigResolver('http://localhost', 'test-key');
    });

    it('should create resolver instance', () => {
      expect(resolver).toBeDefined();
      expect(resolver.getCacheStats).toBeDefined();
    });

    it('should resolve effective config for global scope', async () => {
      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial',
        experimentId: 'exp-1',
        variation: 'control'
      };

      const resolved = await resolver.resolveEffectiveConfig(context);
      
      expect(resolved).toBeDefined();
      expect(resolved.config).toBeDefined();
      expect(resolved.explain).toBeDefined();
      expect(resolved.cacheKey).toBeDefined();
      expect(resolved.resolvedAt).toBeDefined();
    });

    it('should generate deterministic cache key', () => {
      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial'
      };

      const cacheKey = resolver['generateCacheKey'](context);
      expect(cacheKey).toBe('liveops:test-session:world.forest_glade:adventure.tutorial::');
    });

    it('should determine scope correctly', () => {
      const context1 = { sessionId: 'test', variation: 'control' };
      const scope1 = resolver['determineScope'](context1);
      expect(scope1).toBe('session');

      const context2 = { sessionId: 'test', experimentId: 'exp-1' };
      const scope2 = resolver['determineScope'](context2);
      expect(scope2).toBe('experiment');

      const context3 = { sessionId: 'test', adventureId: 'adv-1' };
      const scope3 = resolver['determineScope'](context3);
      expect(scope3).toBe('adventure');

      const context4 = { sessionId: 'test', worldId: 'world-1' };
      const scope4 = resolver['determineScope'](context4);
      expect(scope4).toBe('world');

      const context5 = { sessionId: 'test' };
      const scope5 = resolver['determineScope'](context5);
      expect(scope5).toBe('global');
    });

    it('should validate config bounds', () => {
      const validConfig = {
        AWF_MAX_INPUT_TOKENS: 5000,
        AWF_MAX_OUTPUT_TOKENS: 2500,
        QUEST_PACING_TEMPO_MULTIPLIER: 1.2
      };

      const boundsCheck = resolver.validateConfigBounds(validConfig);
      expect(boundsCheck.valid).toBe(true);
      expect(boundsCheck.violations).toHaveLength(0);
    });

    it('should detect bounds violations', () => {
      const invalidConfig = {
        AWF_MAX_INPUT_TOKENS: 500, // Too low
        AWF_MAX_OUTPUT_TOKENS: 15000, // Too high
        QUEST_PACING_TEMPO_MULTIPLIER: 1.5 // Too high
      };

      const boundsCheck = resolver.validateConfigBounds(invalidConfig);
      expect(boundsCheck.valid).toBe(false);
      expect(boundsCheck.violations.length).toBeGreaterThan(0);
    });

    it('should clear cache', () => {
      resolver.clearAllCache();
      const stats = resolver.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('Safety Mechanisms', () => {
    let safety: LiveOpsSafetyMechanisms;
    let resolver: LiveOpsConfigResolver;

    beforeEach(() => {
      resolver = createLiveOpsConfigResolver('http://localhost', 'test-key');
      safety = createLiveOpsSafetyMechanisms(resolver);
    });

    it('should create safety mechanisms instance', () => {
      expect(safety).toBeDefined();
      expect(safety.validateConfig).toBeDefined();
      expect(safety.estimateImpact).toBeDefined();
    });

    it('should validate config against safety bounds', () => {
      const config = {
        AWF_MAX_INPUT_TOKENS: 5000,
        AWF_MAX_OUTPUT_TOKENS: 2500,
        QUEST_PACING_TEMPO_MULTIPLIER: 1.2
      };

      const validation = safety.validateConfig(config);
      expect(validation.valid).toBe(true);
      expect(validation.violations).toHaveLength(0);
    });

    it('should detect safety violations', () => {
      const config = {
        AWF_MAX_INPUT_TOKENS: 500, // Too low
        AWF_MAX_OUTPUT_TOKENS: 15000, // Too high
        QUEST_PACING_TEMPO_MULTIPLIER: 5.0 // Too high
      };

      const validation = safety.validateConfig(config);
      expect(validation.valid).toBe(false);
      expect(validation.violations.length).toBeGreaterThan(0);
    });

    it('should estimate impact for valid config', async () => {
      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial'
      };

      const proposedConfig = {
        AWF_INPUT_TOKEN_MULTIPLIER: 1.2,
        QUEST_PACING_TEMPO_MULTIPLIER: 1.1
      };

      const result = await safety.estimateImpact(context, proposedConfig, 50);
      
      expect(result.success).toBe(true);
      expect(result.impact).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect critical issues in impact estimation', async () => {
      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial'
      };

      const proposedConfig = {
        AWF_MAX_INPUT_TOKENS: 500, // Too low
        AWF_MAX_OUTPUT_TOKENS: 15000 // Too high
      };

      const result = await safety.estimateImpact(context, proposedConfig, 50);
      
      expect(result.success).toBe(false);
      expect(result.criticalIssues.length).toBeGreaterThan(0);
    });

    it('should get safety bounds for specific field', () => {
      const bounds = safety.getBounds('AWF_MAX_INPUT_TOKENS');
      expect(bounds).toBeDefined();
      expect(bounds?.min).toBe(1000);
      expect(bounds?.max).toBe(12000);
      expect(bounds?.critical).toBe(true);
    });

    it('should get all safety bounds', () => {
      const allBounds = safety.getAllBounds();
      expect(allBounds.size).toBeGreaterThan(0);
      expect(allBounds.has('AWF_MAX_INPUT_TOKENS')).toBe(true);
    });
  });

  describe('Integration Points', () => {
    let integration: LiveOpsIntegration;
    let resolver: LiveOpsConfigResolver;

    beforeEach(() => {
      resolver = createLiveOpsConfigResolver('http://localhost', 'test-key');
      integration = createLiveOpsIntegration(resolver, false);
    });

    it('should create integration instance', () => {
      expect(integration).toBeDefined();
      expect(integration.applyTokenBudget).toBeDefined();
      expect(integration.applyPacingConfig).toBeDefined();
      expect(integration.applyEconomyConfig).toBeDefined();
    });

    it('should apply token budget config', async () => {
      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial',
        turnId: 1
      };

      const tokenBudget = await integration.applyTokenBudget(context);
      
      expect(tokenBudget).toBeDefined();
      expect(tokenBudget.maxInputTokens).toBeDefined();
      expect(tokenBudget.maxOutputTokens).toBeDefined();
      expect(tokenBudget.inputTokenMultiplier).toBeDefined();
      expect(tokenBudget.outputTokenMultiplier).toBeDefined();
    });

    it('should apply pacing config', async () => {
      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial',
        turnId: 1
      };

      const pacingConfig = await integration.applyPacingConfig(context);
      
      expect(pacingConfig).toBeDefined();
      expect(pacingConfig.questPacingTempoMultiplier).toBeDefined();
      expect(pacingConfig.softLockHintFrequency).toBeDefined();
      expect(pacingConfig.skillCheckDifficultyBias).toBeDefined();
    });

    it('should apply economy config', async () => {
      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial',
        turnId: 1
      };

      const economyConfig = await integration.applyEconomyConfig(context);
      
      expect(economyConfig).toBeDefined();
      expect(economyConfig.dropRateMultipliers).toBeDefined();
      expect(economyConfig.vendorMarginMin).toBeDefined();
      expect(economyConfig.vendorMarginMax).toBeDefined();
    });

    it('should apply world sim config', async () => {
      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial',
        turnId: 1
      };

      const worldSimConfig = await integration.applyWorldSimConfig(context);
      
      expect(worldSimConfig).toBeDefined();
      expect(worldSimConfig.eventRateMultiplier).toBeDefined();
      expect(worldSimConfig.weatherVolatilityMultiplier).toBeDefined();
      expect(worldSimConfig.regionDriftStepCap).toBeDefined();
    });

    it('should apply dialogue config', async () => {
      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial',
        turnId: 1
      };

      const dialogueConfig = await integration.applyDialogueConfig(context);
      
      expect(dialogueConfig).toBeDefined();
      expect(dialogueConfig.candidateCap).toBeDefined();
      expect(dialogueConfig.cooldownMultiplier).toBeDefined();
      expect(dialogueConfig.romanceCooldownTurns).toBeDefined();
    });

    it('should apply party config', async () => {
      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial',
        turnId: 1
      };

      const partyConfig = await integration.applyPartyConfig(context);
      
      expect(partyConfig).toBeDefined();
      expect(partyConfig.maxActiveMembers).toBeDefined();
      expect(partyConfig.delegateCheckRate).toBeDefined();
      expect(partyConfig.intentMixBias).toBeDefined();
    });

    it('should apply module gates', async () => {
      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial',
        turnId: 1
      };

      const moduleGates = await integration.applyModuleGates(context);
      
      expect(moduleGates).toBeDefined();
      expect(moduleGates.dialogue).toBeDefined();
      expect(moduleGates.worldsim).toBeDefined();
      expect(moduleGates.party).toBeDefined();
    });

    it('should check if module is enabled', async () => {
      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial',
        turnId: 1
      };

      const isEnabled = await integration.isModuleEnabled(context, 'dialogue');
      expect(typeof isEnabled).toBe('boolean');
    });

    it('should check if module is readonly', async () => {
      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial',
        turnId: 1
      };

      const isReadonly = await integration.isModuleReadonly(context, 'dialogue');
      expect(typeof isReadonly).toBe('boolean');
    });

    it('should apply all configs at once', async () => {
      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial',
        turnId: 1
      };

      const allConfigs = await integration.applyAllConfigs(context);
      
      expect(allConfigs).toBeDefined();
      expect(allConfigs.tokenBudget).toBeDefined();
      expect(allConfigs.pacing).toBeDefined();
      expect(allConfigs.economy).toBeDefined();
      expect(allConfigs.worldSim).toBeDefined();
      expect(allConfigs.dialogue).toBeDefined();
      expect(allConfigs.party).toBeDefined();
      expect(allConfigs.moduleGates).toBeDefined();
    });

    it('should handle shadow mode', () => {
      expect(integration.isShadowMode()).toBe(false);
      
      integration.setShadowMode(true);
      expect(integration.isShadowMode()).toBe(true);
      
      integration.setShadowMode(false);
      expect(integration.isShadowMode()).toBe(false);
    });

    it('should get config explanation', async () => {
      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial',
        turnId: 1
      };

      const explanation = await integration.getConfigExplanation(context);
      
      expect(explanation).toBeDefined();
      expect(explanation.config).toBeDefined();
      expect(explanation.explain).toBeDefined();
      expect(explanation.cacheKey).toBeDefined();
      expect(explanation.resolvedAt).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete LiveOps workflow', async () => {
      const resolver = createLiveOpsConfigResolver('http://localhost', 'test-key');
      const safety = createLiveOpsSafetyMechanisms(resolver);
      const integration = createLiveOpsIntegration(resolver, false);

      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial',
        turnId: 1
      };

      // Test config resolution
      const resolved = await resolver.resolveEffectiveConfig(context);
      expect(resolved).toBeDefined();

      // Test safety validation
      const validation = safety.validateConfig(resolved.config);
      expect(validation.valid).toBe(true);

      // Test impact estimation
      const impact = await safety.estimateImpact(context, { QUEST_PACING_TEMPO_MULTIPLIER: 1.2 }, 50);
      expect(impact.success).toBe(true);

      // Test integration
      const allConfigs = await integration.applyAllConfigs(context);
      expect(allConfigs).toBeDefined();
    });

    it('should handle shadow mode evaluation', async () => {
      const resolver = createLiveOpsConfigResolver('http://localhost', 'test-key');
      const integration = createLiveOpsIntegration(resolver, true); // Shadow mode

      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial',
        turnId: 1
      };

      // Should not throw errors in shadow mode
      const tokenBudget = await integration.applyTokenBudget(context);
      expect(tokenBudget).toBeDefined();
    });

    it('should handle error cases gracefully', async () => {
      const resolver = createLiveOpsConfigResolver('http://localhost', 'test-key');
      const safety = createLiveOpsSafetyMechanisms(resolver);

      // Test with invalid context
      const invalidContext = {
        sessionId: '',
        worldId: undefined,
        adventureId: undefined,
        turnId: -1
      };

      // Should handle gracefully
      const result = await safety.estimateImpact(invalidContext, {}, 50);
      expect(result.success).toBe(false);
    });
  });

  describe('Performance Tests', () => {
    it('should handle high concurrent config resolution', async () => {
      const resolver = createLiveOpsConfigResolver('http://localhost', 'test-key');
      
      const promises = Array.from({ length: 100 }, (_, i) => {
        const context = {
          sessionId: `session-${i}`,
          worldId: `world-${i}`,
          adventureId: `adventure-${i}`,
          turnId: i
        };
        return resolver.resolveEffectiveConfig(context);
      });

      const results = await Promise.all(promises);
      expect(results).toHaveLength(100);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.config).toBeDefined();
      });
    });

    it('should handle cache performance', () => {
      const resolver = createLiveOpsConfigResolver('http://localhost', 'test-key');
      
      // Test cache operations
      resolver.clearAllCache();
      const stats = resolver.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.ttl).toBe(60000);
    });
  });

  describe('Error Handling', () => {
    it('should handle resolver errors gracefully', async () => {
      const resolver = createLiveOpsConfigResolver('http://localhost', 'test-key');
      
      // Mock Supabase error
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            lte: vi.fn(() => ({
              or: vi.fn(() => ({
                order: vi.fn(() => ({
                  data: null,
                  error: { message: 'Database error' }
                }))
              }))
            }))
          }))
        }))
      }));

      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial'
      };

      await expect(resolver.resolveEffectiveConfig(context)).rejects.toThrow();
    });

    it('should handle safety mechanism errors gracefully', async () => {
      const resolver = createLiveOpsConfigResolver('http://localhost', 'test-key');
      const safety = createLiveOpsSafetyMechanisms(resolver);

      // Test with invalid config
      const invalidConfig = {
        AWF_MAX_INPUT_TOKENS: 'invalid' // Wrong type
      };

      const validation = safety.validateConfig(invalidConfig as any);
      expect(validation.valid).toBe(false);
    });

    it('should handle integration errors gracefully', async () => {
      const resolver = createLiveOpsConfigResolver('http://localhost', 'test-key');
      const integration = createLiveOpsIntegration(resolver, false);

      // Test with invalid context
      const invalidContext = {
        sessionId: null as any,
        worldId: undefined,
        adventureId: undefined,
        turnId: 'invalid' as any
      };

      // Should handle gracefully
      await expect(integration.applyTokenBudget(invalidContext)).rejects.toThrow();
    });
  });
});
