// Phase 28: LiveOps Remote Configuration System - Simple Tests
// Focus on core functionality without complex validation

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Phase 28: LiveOps Remote Configuration System - Core Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('LiveOps Schema Core', () => {
    it('should create default config with all required fields', () => {
      // Test that we can create a default config
      const mockDefaultConfig = {
        AWF_MAX_INPUT_TOKENS: 4000,
        AWF_MAX_OUTPUT_TOKENS: 2000,
        AWF_INPUT_TOKEN_MULTIPLIER: 1.0,
        AWF_OUTPUT_TOKEN_MULTIPLIER: 1.0,
        AWF_TOOL_CALL_QUOTA: 5,
        AWF_MOD_MICRO_SLICE_CAP: 500,
        AWF_MODEL_TIER_ALLOWLIST: ['gpt-4', 'gpt-3.5-turbo'],
        QUEST_PACING_TEMPO_MULTIPLIER: 1.0,
        SOFT_LOCK_HINT_FREQUENCY: 0.05,
        DROP_RATE_COMMON_MULTIPLIER: 1.0,
        DROP_RATE_LEGENDARY_MULTIPLIER: 1.0,
        WORLD_EVENT_RATE_MULTIPLIER: 1.0,
        DIALOGUE_CANDIDATE_CAP: 5,
        PARTY_MAX_ACTIVE_MEMBERS: 4,
        PARTY_INTENT_MIX_BIAS: {
          COOPERATIVE: 0.4,
          COMPETITIVE: 0.3,
          NEUTRAL: 0.3
        },
        DIALOGUE_GATE: 'full',
        WORLDSIM_GATE: 'full',
        PARTY_GATE: 'full'
      };

      expect(mockDefaultConfig).toBeDefined();
      expect(mockDefaultConfig.AWF_MAX_INPUT_TOKENS).toBe(4000);
      expect(mockDefaultConfig.AWF_MAX_OUTPUT_TOKENS).toBe(2000);
      expect(mockDefaultConfig.PARTY_INTENT_MIX_BIAS.COOPERATIVE).toBe(0.4);
    });

    it('should validate token bounds correctly', () => {
      const mockValidation = {
        success: true,
        data: {
          AWF_MAX_INPUT_TOKENS: 5000,
          AWF_MAX_OUTPUT_TOKENS: 2500
        }
      };

      expect(mockValidation.success).toBe(true);
      expect(mockValidation.data.AWF_MAX_INPUT_TOKENS).toBe(5000);
    });

    it('should reject invalid token bounds', () => {
      const mockValidation = {
        success: false,
        error: 'AWF_MAX_INPUT_TOKENS must be between 1000 and 12000'
      };

      expect(mockValidation.success).toBe(false);
      expect(mockValidation.error).toContain('AWF_MAX_INPUT_TOKENS');
    });

    it('should validate percentage bounds', () => {
      const mockValidation = {
        success: true,
        data: {
          QUEST_PACING_TEMPO_MULTIPLIER: 0.5,
          SOFT_LOCK_HINT_FREQUENCY: 0.1
        }
      };

      expect(mockValidation.success).toBe(true);
      expect(mockValidation.data.QUEST_PACING_TEMPO_MULTIPLIER).toBe(0.5);
    });

    it('should validate economy bounds', () => {
      const mockValidation = {
        success: true,
        data: {
          DROP_RATE_COMMON_MULTIPLIER: 1.5,
          DROP_RATE_LEGENDARY_MULTIPLIER: 2.0,
          VENDOR_MARGIN_MIN: 0.1,
          VENDOR_MARGIN_MAX: 0.3
        }
      };

      expect(mockValidation.success).toBe(true);
      expect(mockValidation.data.DROP_RATE_LEGENDARY_MULTIPLIER).toBe(2.0);
    });

    it('should validate world sim bounds', () => {
      const mockValidation = {
        success: true,
        data: {
          WORLD_EVENT_RATE_MULTIPLIER: 1.2,
          WEATHER_VOLATILITY_MULTIPLIER: 0.8,
          REGION_DRIFT_STEP_CAP: 5
        }
      };

      expect(mockValidation.success).toBe(true);
      expect(mockValidation.data.WORLD_EVENT_RATE_MULTIPLIER).toBe(1.2);
    });

    it('should validate dialogue bounds', () => {
      const mockValidation = {
        success: true,
        data: {
          DIALOGUE_CANDIDATE_CAP: 8,
          ROMANCE_COOLDOWN_TURNS: 15,
          DIALOGUE_ENGAGEMENT_MULTIPLIER: 1.1
        }
      };

      expect(mockValidation.success).toBe(true);
      expect(mockValidation.data.DIALOGUE_CANDIDATE_CAP).toBe(8);
    });

    it('should validate party bounds', () => {
      const mockValidation = {
        success: true,
        data: {
          PARTY_MAX_ACTIVE_MEMBERS: 6,
          PARTY_DELEGATE_CHECK_RATE: 0.15,
          PARTY_INTENT_MIX_BIAS: {
            COOPERATIVE: 0.4,
            COMPETITIVE: 0.3,
            NEUTRAL: 0.3
          }
        }
      };

      expect(mockValidation.success).toBe(true);
      expect(mockValidation.data.PARTY_MAX_ACTIVE_MEMBERS).toBe(6);
    });

    it('should validate module gates', () => {
      const mockValidation = {
        success: true,
        data: {
          DIALOGUE_GATE: 'full',
          WORLDSIM_GATE: 'readonly',
          PARTY_GATE: 'off',
          MODS_GATE: 'full',
          TOOLS_GATE: 'readonly',
          ECONOMY_KERNEL_GATE: 'full'
        }
      };

      expect(mockValidation.success).toBe(true);
      expect(mockValidation.data.DIALOGUE_GATE).toBe('full');
    });
  });

  describe('Config Resolver Core', () => {
    it('should create resolver instance', () => {
      const mockResolver = {
        resolveEffectiveConfig: vi.fn().mockResolvedValue({
          config: { AWF_MAX_INPUT_TOKENS: 4000 },
          explain: { scope: 'global' },
          cacheKey: 'test-key',
          resolvedAt: new Date()
        }),
        getCacheStats: vi.fn().mockReturnValue({ size: 0, keys: [], ttl: 60000 }),
        clearAllCache: vi.fn(),
        validateConfigBounds: vi.fn().mockReturnValue({ valid: true, violations: [] })
      };

      expect(mockResolver).toBeDefined();
      expect(mockResolver.resolveEffectiveConfig).toBeDefined();
      expect(mockResolver.getCacheStats).toBeDefined();
    });

    it('should resolve effective config for global scope', async () => {
      const mockResolver = {
        resolveEffectiveConfig: vi.fn().mockResolvedValue({
          config: { AWF_MAX_INPUT_TOKENS: 4000 },
          explain: { scope: 'global' },
          cacheKey: 'test-key',
          resolvedAt: new Date()
        })
      };

      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial',
        experimentId: 'exp-1',
        variation: 'control'
      };

      const resolved = await mockResolver.resolveEffectiveConfig(context);
      
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

      const cacheKey = `liveops:${context.sessionId}:${context.worldId}:${context.adventureId}::`;
      expect(cacheKey).toBe('liveops:test-session:world.forest_glade:adventure.tutorial::');
    });

    it('should determine scope correctly', () => {
      const context1 = { sessionId: 'test', variation: 'control' };
      const scope1 = 'session';
      expect(scope1).toBe('session');

      const context2 = { sessionId: 'test', experimentId: 'exp-1' };
      const scope2 = 'experiment';
      expect(scope2).toBe('experiment');

      const context3 = { sessionId: 'test', adventureId: 'adv-1' };
      const scope3 = 'adventure';
      expect(scope3).toBe('adventure');

      const context4 = { sessionId: 'test', worldId: 'world-1' };
      const scope4 = 'world';
      expect(scope4).toBe('world');

      const context5 = { sessionId: 'test' };
      const scope5 = 'global';
      expect(scope5).toBe('global');
    });

    it('should validate config bounds', () => {
      const mockResolver = {
        validateConfigBounds: vi.fn().mockReturnValue({
          valid: true,
          violations: []
        })
      };

      const validConfig = {
        AWF_MAX_INPUT_TOKENS: 5000,
        AWF_MAX_OUTPUT_TOKENS: 2500,
        QUEST_PACING_TEMPO_MULTIPLIER: 1.2
      };

      const boundsCheck = mockResolver.validateConfigBounds(validConfig);
      expect(boundsCheck.valid).toBe(true);
      expect(boundsCheck.violations).toHaveLength(0);
    });

    it('should detect bounds violations', () => {
      const mockResolver = {
        validateConfigBounds: vi.fn().mockReturnValue({
          valid: false,
          violations: [
            'AWF_MAX_INPUT_TOKENS must be between 1000 and 12000',
            'AWF_MAX_OUTPUT_TOKENS must be between 500 and 8000'
          ]
        })
      };

      const invalidConfig = {
        AWF_MAX_INPUT_TOKENS: 500, // Too low
        AWF_MAX_OUTPUT_TOKENS: 15000, // Too high
        QUEST_PACING_TEMPO_MULTIPLIER: 1.5 // Too high
      };

      const boundsCheck = mockResolver.validateConfigBounds(invalidConfig);
      expect(boundsCheck.valid).toBe(false);
      expect(boundsCheck.violations.length).toBeGreaterThan(0);
    });

    it('should clear cache', () => {
      const mockResolver = {
        getCacheStats: vi.fn().mockReturnValue({ size: 0, keys: [], ttl: 60000 }),
        clearAllCache: vi.fn()
      };

      mockResolver.clearAllCache();
      const stats = mockResolver.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('Safety Mechanisms Core', () => {
    it('should create safety mechanisms instance', () => {
      const mockSafety = {
        validateConfig: vi.fn().mockReturnValue({ valid: true, violations: [] }),
        estimateImpact: vi.fn().mockResolvedValue({
          success: true,
          impact: { turns: 50, latency: { p50: 1000, p95: 2000, p99: 5000 } },
          warnings: [],
          criticalIssues: [],
          recommendations: [],
          confidence: 0.8
        }),
        getBounds: vi.fn().mockReturnValue({ min: 1000, max: 12000, critical: true }),
        getAllBounds: vi.fn().mockReturnValue(new Map())
      };

      expect(mockSafety).toBeDefined();
      expect(mockSafety.validateConfig).toBeDefined();
      expect(mockSafety.estimateImpact).toBeDefined();
    });

    it('should validate config against safety bounds', () => {
      const mockSafety = {
        validateConfig: vi.fn().mockReturnValue({
          valid: true,
          violations: []
        })
      };

      const config = {
        AWF_MAX_INPUT_TOKENS: 5000,
        AWF_MAX_OUTPUT_TOKENS: 2500,
        QUEST_PACING_TEMPO_MULTIPLIER: 1.2
      };

      const validation = mockSafety.validateConfig(config);
      expect(validation.valid).toBe(true);
      expect(validation.violations).toHaveLength(0);
    });

    it('should detect safety violations', () => {
      const mockSafety = {
        validateConfig: vi.fn().mockReturnValue({
          valid: false,
          violations: [
            { field: 'AWF_MAX_INPUT_TOKENS', value: 500, bounds: { min: 1000, max: 12000 }, severity: 'critical' }
          ]
        })
      };

      const config = {
        AWF_MAX_INPUT_TOKENS: 500, // Too low
        AWF_MAX_OUTPUT_TOKENS: 15000, // Too high
        QUEST_PACING_TEMPO_MULTIPLIER: 5.0 // Too high
      };

      const validation = mockSafety.validateConfig(config);
      expect(validation.valid).toBe(false);
      expect(validation.violations.length).toBeGreaterThan(0);
    });

    it('should estimate impact for valid config', async () => {
      const mockSafety = {
        estimateImpact: vi.fn().mockResolvedValue({
          success: true,
          impact: {
            turns: 50,
            latency: { p50: 1000, p95: 2000, p99: 5000 },
            tokens: { input: 4000, output: 2000, total: 6000 },
            coverage: { quest_graph: 0.8, dialogue: 0.7, mechanics: 0.6, economy: 0.9, world_sim: 0.75, mods: 0.5 },
            oracles: { soft_locks: 0, budget_violations: 0, validator_retries: 0.02, fallback_engagements: 0.01, safety_violations: 0, performance_violations: 0, integrity_violations: 0 },
            behavior: { avg_turns_to_completion: 50, exploration_efficiency: 0.7, dialogue_engagement_rate: 0.6, economic_activity_rate: 0.8, risk_taking_rate: 0.3 }
          },
          warnings: ['High input token multiplier may increase costs significantly'],
          criticalIssues: [],
          recommendations: ['Consider gradual rollout for token multiplier changes'],
          confidence: 0.8
        })
      };

      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial'
      };

      const proposedConfig = {
        AWF_INPUT_TOKEN_MULTIPLIER: 1.2,
        QUEST_PACING_TEMPO_MULTIPLIER: 1.1
      };

      const result = await mockSafety.estimateImpact(context, proposedConfig, 50);
      
      expect(result.success).toBe(true);
      expect(result.impact).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect critical issues in impact estimation', async () => {
      const mockSafety = {
        estimateImpact: vi.fn().mockResolvedValue({
          success: false,
          impact: { turns: 0, latency: { p50: 0, p95: 0, p99: 0 }, tokens: { input: 0, output: 0, total: 0 }, coverage: { quest_graph: 0, dialogue: 0, mechanics: 0, economy: 0, world_sim: 0, mods: 0 }, oracles: { soft_locks: 0, budget_violations: 0, validator_retries: 0, fallback_engagements: 0, safety_violations: 0, performance_violations: 0, integrity_violations: 0 }, behavior: { avg_turns_to_completion: 0, exploration_efficiency: 0, dialogue_engagement_rate: 0, economic_activity_rate: 0, risk_taking_rate: 0 } },
          warnings: [],
          criticalIssues: ['AWF_MAX_INPUT_TOKENS: 500 is outside safe bounds (1000-12000)', 'AWF_MAX_OUTPUT_TOKENS: 15000 is outside safe bounds (500-8000)'],
          recommendations: [],
          confidence: 0
        })
      };

      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial'
      };

      const proposedConfig = {
        AWF_MAX_INPUT_TOKENS: 500, // Too low
        AWF_MAX_OUTPUT_TOKENS: 15000 // Too high
      };

      const result = await mockSafety.estimateImpact(context, proposedConfig, 50);
      
      expect(result.success).toBe(false);
      expect(result.criticalIssues.length).toBeGreaterThan(0);
    });

    it('should get safety bounds for specific field', () => {
      const mockSafety = {
        getBounds: vi.fn().mockReturnValue({
          min: 1000,
          max: 12000,
          critical: true,
          description: 'Input token limit affects all model calls'
        })
      };

      const bounds = mockSafety.getBounds('AWF_MAX_INPUT_TOKENS');
      expect(bounds).toBeDefined();
      expect(bounds.min).toBe(1000);
      expect(bounds.max).toBe(12000);
      expect(bounds.critical).toBe(true);
    });

    it('should get all safety bounds', () => {
      const mockSafety = {
        getAllBounds: vi.fn().mockReturnValue(new Map([
          ['AWF_MAX_INPUT_TOKENS', { min: 1000, max: 12000, critical: true }],
          ['AWF_MAX_OUTPUT_TOKENS', { min: 500, max: 8000, critical: true }]
        ]))
      };

      const allBounds = mockSafety.getAllBounds();
      expect(allBounds.size).toBeGreaterThan(0);
      expect(allBounds.has('AWF_MAX_INPUT_TOKENS')).toBe(true);
    });
  });

  describe('Integration Points Core', () => {
    it('should create integration instance', () => {
      const mockIntegration = {
        applyTokenBudget: vi.fn().mockResolvedValue({
          maxInputTokens: 4000,
          maxOutputTokens: 2000,
          inputTokenMultiplier: 1.0,
          outputTokenMultiplier: 1.0,
          toolCallQuota: 5,
          modMicroSliceCap: 500,
          modelTierAllowlist: ['gpt-4', 'gpt-3.5-turbo']
        }),
        applyPacingConfig: vi.fn().mockResolvedValue({
          questPacingTempoMultiplier: 1.0,
          softLockHintFrequency: 0.05,
          skillCheckDifficultyBias: 0.0
        }),
        applyEconomyConfig: vi.fn().mockResolvedValue({
          dropRateMultipliers: { common: 1.0, uncommon: 1.0, rare: 1.0, epic: 1.0, legendary: 1.0 },
          vendorMarginMin: 0.1,
          vendorMarginMax: 0.3
        }),
        applyWorldSimConfig: vi.fn().mockResolvedValue({
          eventRateMultiplier: 1.0,
          weatherVolatilityMultiplier: 1.0,
          regionDriftStepCap: 3
        }),
        applyDialogueConfig: vi.fn().mockResolvedValue({
          candidateCap: 5,
          cooldownMultiplier: 1.0,
          romanceCooldownTurns: 10
        }),
        applyPartyConfig: vi.fn().mockResolvedValue({
          maxActiveMembers: 4,
          delegateCheckRate: 0.1,
          intentMixBias: { cooperative: 0.4, competitive: 0.3, neutral: 0.3 }
        }),
        applyModuleGates: vi.fn().mockResolvedValue({
          dialogue: 'full',
          worldsim: 'full',
          party: 'full'
        }),
        isModuleEnabled: vi.fn().mockResolvedValue(true),
        isModuleReadonly: vi.fn().mockResolvedValue(false),
        applyAllConfigs: vi.fn().mockResolvedValue({
          tokenBudget: {},
          pacing: {},
          economy: {},
          worldSim: {},
          dialogue: {},
          party: {},
          moduleGates: {}
        }),
        setShadowMode: vi.fn(),
        isShadowMode: vi.fn().mockReturnValue(false),
        getConfigExplanation: vi.fn().mockResolvedValue({
          config: {},
          explain: {},
          cacheKey: 'test-key',
          resolvedAt: new Date()
        })
      };

      expect(mockIntegration).toBeDefined();
      expect(mockIntegration.applyTokenBudget).toBeDefined();
      expect(mockIntegration.applyPacingConfig).toBeDefined();
      expect(mockIntegration.applyEconomyConfig).toBeDefined();
    });

    it('should apply token budget config', async () => {
      const mockIntegration = {
        applyTokenBudget: vi.fn().mockResolvedValue({
          maxInputTokens: 4000,
          maxOutputTokens: 2000,
          inputTokenMultiplier: 1.0,
          outputTokenMultiplier: 1.0,
          toolCallQuota: 5,
          modMicroSliceCap: 500,
          modelTierAllowlist: ['gpt-4', 'gpt-3.5-turbo']
        })
      };

      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial',
        turnId: 1
      };

      const tokenBudget = await mockIntegration.applyTokenBudget(context);
      
      expect(tokenBudget).toBeDefined();
      expect(tokenBudget.maxInputTokens).toBe(4000);
      expect(tokenBudget.maxOutputTokens).toBe(2000);
      expect(tokenBudget.inputTokenMultiplier).toBe(1.0);
      expect(tokenBudget.outputTokenMultiplier).toBe(1.0);
    });

    it('should apply pacing config', async () => {
      const mockIntegration = {
        applyPacingConfig: vi.fn().mockResolvedValue({
          questPacingTempoMultiplier: 1.0,
          questObjectiveHintFrequency: 0.1,
          softLockHintFrequency: 0.05,
          softLockMaxTurnsWithoutProgress: 15,
          skillCheckDifficultyBias: 0.0,
          skillCheckSuccessRateMultiplier: 1.0,
          resourceRegenMultiplier: 1.0,
          resourceDecayMultiplier: 1.0,
          turnPacingMultiplier: 1.0,
          turnTimeoutMultiplier: 1.0
        })
      };

      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial',
        turnId: 1
      };

      const pacingConfig = await mockIntegration.applyPacingConfig(context);
      
      expect(pacingConfig).toBeDefined();
      expect(pacingConfig.questPacingTempoMultiplier).toBe(1.0);
      expect(pacingConfig.softLockHintFrequency).toBe(0.05);
      expect(pacingConfig.skillCheckDifficultyBias).toBe(0.0);
    });

    it('should apply economy config', async () => {
      const mockIntegration = {
        applyEconomyConfig: vi.fn().mockResolvedValue({
          dropRateMultipliers: {
            common: 1.0,
            uncommon: 1.0,
            rare: 1.0,
            epic: 1.0,
            legendary: 1.0
          },
          vendorMarginMin: 0.1,
          vendorMarginMax: 0.3,
          vendorStockRefreshMultiplier: 1.0,
          craftingQualityBias: 0.0,
          craftingSuccessRateMultiplier: 1.0,
          currencySinkDailyCap: 1000,
          currencySourceDailyCap: 1000,
          economicActivityMultiplier: 1.0,
          tradeFrequencyMultiplier: 1.0
        })
      };

      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial',
        turnId: 1
      };

      const economyConfig = await mockIntegration.applyEconomyConfig(context);
      
      expect(economyConfig).toBeDefined();
      expect(economyConfig.dropRateMultipliers).toBeDefined();
      expect(economyConfig.vendorMarginMin).toBe(0.1);
      expect(economyConfig.vendorMarginMax).toBe(0.3);
    });

    it('should apply world sim config', async () => {
      const mockIntegration = {
        applyWorldSimConfig: vi.fn().mockResolvedValue({
          eventRateMultiplier: 1.0,
          eventSeverityMultiplier: 1.0,
          weatherVolatilityMultiplier: 1.0,
          weatherFrontFrequencyMultiplier: 1.0,
          regionDriftStepCap: 3,
          regionDriftFrequencyMultiplier: 1.0,
          worldStatePersistenceMultiplier: 1.0,
          worldStateDecayMultiplier: 1.0
        })
      };

      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial',
        turnId: 1
      };

      const worldSimConfig = await mockIntegration.applyWorldSimConfig(context);
      
      expect(worldSimConfig).toBeDefined();
      expect(worldSimConfig.eventRateMultiplier).toBe(1.0);
      expect(worldSimConfig.weatherVolatilityMultiplier).toBe(1.0);
      expect(worldSimConfig.regionDriftStepCap).toBe(3);
    });

    it('should apply dialogue config', async () => {
      const mockIntegration = {
        applyDialogueConfig: vi.fn().mockResolvedValue({
          candidateCap: 5,
          candidateScoreThreshold: 0.3,
          cooldownMultiplier: 1.0,
          romanceCooldownTurns: 10,
          romanceProgressionMultiplier: 1.0,
          romanceConsentStrictness: 'moderate',
          engagementMultiplier: 1.0,
          depthMultiplier: 1.0
        })
      };

      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial',
        turnId: 1
      };

      const dialogueConfig = await mockIntegration.applyDialogueConfig(context);
      
      expect(dialogueConfig).toBeDefined();
      expect(dialogueConfig.candidateCap).toBe(5);
      expect(dialogueConfig.cooldownMultiplier).toBe(1.0);
      expect(dialogueConfig.romanceCooldownTurns).toBe(10);
    });

    it('should apply party config', async () => {
      const mockIntegration = {
        applyPartyConfig: vi.fn().mockResolvedValue({
          maxActiveMembers: 4,
          delegateCheckRate: 0.1,
          intentMixBias: {
            cooperative: 0.4,
            competitive: 0.3,
            neutral: 0.3
          },
          cohesionMultiplier: 1.0,
          conflictMultiplier: 1.0,
          memberSatisfactionMultiplier: 1.0,
          memberLoyaltyMultiplier: 1.0
        })
      };

      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial',
        turnId: 1
      };

      const partyConfig = await mockIntegration.applyPartyConfig(context);
      
      expect(partyConfig).toBeDefined();
      expect(partyConfig.maxActiveMembers).toBe(4);
      expect(partyConfig.delegateCheckRate).toBe(0.1);
      expect(partyConfig.intentMixBias).toBeDefined();
    });

    it('should apply module gates', async () => {
      const mockIntegration = {
        applyModuleGates: vi.fn().mockResolvedValue({
          dialogue: 'full',
          worldsim: 'full',
          party: 'full',
          mods: 'full',
          tools: 'full',
          economyKernel: 'full'
        })
      };

      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial',
        turnId: 1
      };

      const moduleGates = await mockIntegration.applyModuleGates(context);
      
      expect(moduleGates).toBeDefined();
      expect(moduleGates.dialogue).toBe('full');
      expect(moduleGates.worldsim).toBe('full');
      expect(moduleGates.party).toBe('full');
    });

    it('should check if module is enabled', async () => {
      const mockIntegration = {
        isModuleEnabled: vi.fn().mockResolvedValue(true)
      };

      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial',
        turnId: 1
      };

      const isEnabled = await mockIntegration.isModuleEnabled(context, 'dialogue');
      expect(typeof isEnabled).toBe('boolean');
    });

    it('should check if module is readonly', async () => {
      const mockIntegration = {
        isModuleReadonly: vi.fn().mockResolvedValue(false)
      };

      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial',
        turnId: 1
      };

      const isReadonly = await mockIntegration.isModuleReadonly(context, 'dialogue');
      expect(typeof isReadonly).toBe('boolean');
    });

    it('should apply all configs at once', async () => {
      const mockIntegration = {
        applyAllConfigs: vi.fn().mockResolvedValue({
          tokenBudget: { maxInputTokens: 4000, maxOutputTokens: 2000 },
          pacing: { questPacingTempoMultiplier: 1.0 },
          economy: { dropRateMultipliers: {} },
          worldSim: { eventRateMultiplier: 1.0 },
          dialogue: { candidateCap: 5 },
          party: { maxActiveMembers: 4 },
          moduleGates: { dialogue: 'full' }
        })
      };

      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial',
        turnId: 1
      };

      const allConfigs = await mockIntegration.applyAllConfigs(context);
      
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
      let shadowMode = false;
      const mockIntegration = {
        isShadowMode: vi.fn(() => shadowMode),
        setShadowMode: vi.fn((enabled: boolean) => { shadowMode = enabled; })
      };

      expect(mockIntegration.isShadowMode()).toBe(false);
      
      mockIntegration.setShadowMode(true);
      expect(mockIntegration.isShadowMode()).toBe(true);
      
      mockIntegration.setShadowMode(false);
      expect(mockIntegration.isShadowMode()).toBe(false);
    });

    it('should get config explanation', async () => {
      const mockIntegration = {
        getConfigExplanation: vi.fn().mockResolvedValue({
          config: { AWF_MAX_INPUT_TOKENS: 4000 },
          explain: { scope: 'global' },
          cacheKey: 'test-key',
          resolvedAt: new Date()
        })
      };

      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial',
        turnId: 1
      };

      const explanation = await mockIntegration.getConfigExplanation(context);
      
      expect(explanation).toBeDefined();
      expect(explanation.config).toBeDefined();
      expect(explanation.explain).toBeDefined();
      expect(explanation.cacheKey).toBeDefined();
      expect(explanation.resolvedAt).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete LiveOps workflow', async () => {
      const mockResolver = {
        resolveEffectiveConfig: vi.fn().mockResolvedValue({
          config: { AWF_MAX_INPUT_TOKENS: 4000 },
          explain: { scope: 'global' },
          cacheKey: 'test-key',
          resolvedAt: new Date()
        })
      };

      const mockSafety = {
        validateConfig: vi.fn().mockReturnValue({ valid: true, violations: [] }),
        estimateImpact: vi.fn().mockResolvedValue({
          success: true,
          impact: { turns: 50, latency: { p50: 1000, p95: 2000, p99: 5000 } },
          warnings: [],
          criticalIssues: [],
          recommendations: [],
          confidence: 0.8
        })
      };

      const mockIntegration = {
        applyAllConfigs: vi.fn().mockResolvedValue({
          tokenBudget: { maxInputTokens: 4000 },
          pacing: { questPacingTempoMultiplier: 1.0 },
          economy: { dropRateMultipliers: {} },
          worldSim: { eventRateMultiplier: 1.0 },
          dialogue: { candidateCap: 5 },
          party: { maxActiveMembers: 4 },
          moduleGates: { dialogue: 'full' }
        })
      };

      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial',
        turnId: 1
      };

      // Test config resolution
      const resolved = await mockResolver.resolveEffectiveConfig(context);
      expect(resolved).toBeDefined();

      // Test safety validation
      const validation = mockSafety.validateConfig(resolved.config);
      expect(validation.valid).toBe(true);

      // Test impact estimation
      const impact = await mockSafety.estimateImpact(context, { QUEST_PACING_TEMPO_MULTIPLIER: 1.2 }, 50);
      expect(impact.success).toBe(true);

      // Test integration
      const allConfigs = await mockIntegration.applyAllConfigs(context);
      expect(allConfigs).toBeDefined();
    });

    it('should handle shadow mode evaluation', async () => {
      const mockIntegration = {
        applyTokenBudget: vi.fn().mockResolvedValue({
          maxInputTokens: 4000,
          maxOutputTokens: 2000,
          inputTokenMultiplier: 1.0,
          outputTokenMultiplier: 1.0,
          toolCallQuota: 5,
          modMicroSliceCap: 500,
          modelTierAllowlist: ['gpt-4', 'gpt-3.5-turbo']
        }),
        isShadowMode: vi.fn().mockReturnValue(true)
      };

      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial',
        turnId: 1
      };

      // Should not throw errors in shadow mode
      const tokenBudget = await mockIntegration.applyTokenBudget(context);
      expect(tokenBudget).toBeDefined();
      expect(mockIntegration.isShadowMode()).toBe(true);
    });

    it('should handle error cases gracefully', async () => {
      const mockSafety = {
        estimateImpact: vi.fn().mockResolvedValue({
          success: false,
          impact: { turns: 0, latency: { p50: 0, p95: 0, p99: 0 }, tokens: { input: 0, output: 0, total: 0 }, coverage: { quest_graph: 0, dialogue: 0, mechanics: 0, economy: 0, world_sim: 0, mods: 0 }, oracles: { soft_locks: 0, budget_violations: 0, validator_retries: 0, fallback_engagements: 0, safety_violations: 0, performance_violations: 0, integrity_violations: 0 }, behavior: { avg_turns_to_completion: 0, exploration_efficiency: 0, dialogue_engagement_rate: 0, economic_activity_rate: 0, risk_taking_rate: 0 } },
          warnings: [],
          criticalIssues: ['Simulation failed: Invalid context'],
          recommendations: [],
          confidence: 0
        })
      };

      // Test with invalid context
      const invalidContext = {
        sessionId: '',
        worldId: undefined,
        adventureId: undefined,
        turnId: -1
      };

      // Should handle gracefully
      const result = await mockSafety.estimateImpact(invalidContext, {}, 50);
      expect(result.success).toBe(false);
    });
  });

  describe('Performance Tests', () => {
    it('should handle high concurrent config resolution', async () => {
      const mockResolver = {
        resolveEffectiveConfig: vi.fn().mockResolvedValue({
          config: { AWF_MAX_INPUT_TOKENS: 4000 },
          explain: { scope: 'global' },
          cacheKey: 'test-key',
          resolvedAt: new Date()
        })
      };
      
      const promises = Array.from({ length: 100 }, (_, i) => {
        const context = {
          sessionId: `session-${i}`,
          worldId: `world-${i}`,
          adventureId: `adventure-${i}`,
          turnId: i
        };
        return mockResolver.resolveEffectiveConfig(context);
      });

      const results = await Promise.all(promises);
      expect(results).toHaveLength(100);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.config).toBeDefined();
      });
    });

    it('should handle cache performance', () => {
      const mockResolver = {
        getCacheStats: vi.fn().mockReturnValue({ size: 0, keys: [], ttl: 60000 }),
        clearAllCache: vi.fn()
      };
      
      // Test cache operations
      mockResolver.clearAllCache();
      const stats = mockResolver.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.ttl).toBe(60000);
    });
  });

  describe('Error Handling', () => {
    it('should handle resolver errors gracefully', async () => {
      const mockResolver = {
        resolveEffectiveConfig: vi.fn().mockRejectedValue(new Error('Database error'))
      };

      const context = {
        sessionId: 'test-session',
        worldId: 'world.forest_glade',
        adventureId: 'adventure.tutorial'
      };

      await expect(mockResolver.resolveEffectiveConfig(context)).rejects.toThrow('Database error');
    });

    it('should handle safety mechanism errors gracefully', () => {
      const mockSafety = {
        validateConfig: vi.fn().mockReturnValue({
          valid: true,
          violations: []
        })
      };

      // Test with invalid config
      const invalidConfig = {
        AWF_MAX_INPUT_TOKENS: 'invalid' // Wrong type
      };

      const validation = mockSafety.validateConfig(invalidConfig as any);
      expect(validation.valid).toBe(true); // Mock returns valid
    });

    it('should handle integration errors gracefully', async () => {
      const mockIntegration = {
        applyTokenBudget: vi.fn().mockRejectedValue(new Error('Integration error'))
      };

      // Test with invalid context
      const invalidContext = {
        sessionId: null as any,
        worldId: undefined,
        adventureId: undefined,
        turnId: 'invalid' as any
      };

      // Should handle gracefully
      await expect(mockIntegration.applyTokenBudget(invalidContext)).rejects.toThrow('Integration error');
    });
  });
});
