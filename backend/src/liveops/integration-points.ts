// Phase 28: LiveOps Remote Configuration System
// Integration points for applying configs to game systems

import { LiveOpsConfig, LiveOpsConfigResolver, ResolverContext } from './config-resolver';

export interface LiveOpsContext {
  sessionId: string;
  worldId?: string;
  adventureId?: string;
  experimentId?: string;
  variation?: string;
  turnId: number;
}

export interface TokenBudget {
  maxInputTokens: number;
  maxOutputTokens: number;
  inputTokenMultiplier: number;
  outputTokenMultiplier: number;
  toolCallQuota: number;
  modMicroSliceCap: number;
  modelTierAllowlist: string[];
}

export interface PacingConfig {
  questPacingTempoMultiplier: number;
  questObjectiveHintFrequency: number;
  softLockHintFrequency: number;
  softLockMaxTurnsWithoutProgress: number;
  skillCheckDifficultyBias: number;
  skillCheckSuccessRateMultiplier: number;
  resourceRegenMultiplier: number;
  resourceDecayMultiplier: number;
  turnPacingMultiplier: number;
  turnTimeoutMultiplier: number;
}

export interface EconomyConfig {
  dropRateMultipliers: {
    common: number;
    uncommon: number;
    rare: number;
    epic: number;
    legendary: number;
  };
  vendorMarginMin: number;
  vendorMarginMax: number;
  vendorStockRefreshMultiplier: number;
  craftingQualityBias: number;
  craftingSuccessRateMultiplier: number;
  currencySinkDailyCap: number;
  currencySourceDailyCap: number;
  economicActivityMultiplier: number;
  tradeFrequencyMultiplier: number;
}

export interface WorldSimConfig {
  eventRateMultiplier: number;
  eventSeverityMultiplier: number;
  weatherVolatilityMultiplier: number;
  weatherFrontFrequencyMultiplier: number;
  regionDriftStepCap: number;
  regionDriftFrequencyMultiplier: number;
  worldStatePersistenceMultiplier: number;
  worldStateDecayMultiplier: number;
}

export interface DialogueConfig {
  candidateCap: number;
  candidateScoreThreshold: number;
  cooldownMultiplier: number;
  romanceCooldownTurns: number;
  romanceProgressionMultiplier: number;
  romanceConsentStrictness: 'strict' | 'moderate' | 'lenient';
  engagementMultiplier: number;
  depthMultiplier: number;
}

export interface PartyConfig {
  maxActiveMembers: number;
  delegateCheckRate: number;
  intentMixBias: {
    cooperative: number;
    competitive: number;
    neutral: number;
  };
  cohesionMultiplier: number;
  conflictMultiplier: number;
  memberSatisfactionMultiplier: number;
  memberLoyaltyMultiplier: number;
}

export interface ModuleGates {
  dialogue: 'off' | 'readonly' | 'full';
  worldsim: 'off' | 'readonly' | 'full';
  party: 'off' | 'readonly' | 'full';
  mods: 'off' | 'readonly' | 'full';
  tools: 'off' | 'readonly' | 'full';
  economyKernel: 'off' | 'readonly' | 'full';
}

export class LiveOpsIntegration {
  private resolver: LiveOpsConfigResolver;
  private shadowMode: boolean = false;

  constructor(resolver: LiveOpsConfigResolver, shadowMode: boolean = false) {
    this.resolver = resolver;
    this.shadowMode = shadowMode;
  }

  /**
   * Get effective config for a context
   */
  async getEffectiveConfig(context: LiveOpsContext): Promise<LiveOpsConfig> {
    const resolverContext: ResolverContext = {
      sessionId: context.sessionId,
      worldId: context.worldId,
      adventureId: context.adventureId,
      experimentId: context.experimentId,
      variation: context.variation
    };

    const resolved = await this.resolver.resolveEffectiveConfig(resolverContext);
    
    // Sample config for troubleshooting if not in shadow mode
    if (!this.shadowMode) {
      await this.resolver.sampleConfig(resolverContext, context.turnId);
    }

    return resolved.config;
  }

  /**
   * Apply token budget config to assembler
   */
  async applyTokenBudget(context: LiveOpsContext): Promise<TokenBudget> {
    if (!context.sessionId) {
      throw new Error('sessionId is required to resolve LiveOps config');
    }

    const config = await this.getEffectiveConfig(context);
    
    const tokenBudget: TokenBudget = {
      maxInputTokens: config.AWF_MAX_INPUT_TOKENS,
      maxOutputTokens: config.AWF_MAX_OUTPUT_TOKENS,
      inputTokenMultiplier: config.AWF_INPUT_TOKEN_MULTIPLIER,
      outputTokenMultiplier: config.AWF_OUTPUT_TOKEN_MULTIPLIER,
      toolCallQuota: config.AWF_TOOL_CALL_QUOTA,
      modMicroSliceCap: config.AWF_MOD_MICRO_SLICE_CAP,
      modelTierAllowlist: config.AWF_MODEL_TIER_ALLOWLIST
    };

    if (this.shadowMode) {
      console.log(`[SHADOW] Token budget would be:`, tokenBudget);
    }

    return tokenBudget;
  }

  /**
   * Apply pacing config to pacing governor
   */
  async applyPacingConfig(context: LiveOpsContext): Promise<PacingConfig> {
    const config = await this.getEffectiveConfig(context);
    
    const pacingConfig: PacingConfig = {
      questPacingTempoMultiplier: config.QUEST_PACING_TEMPO_MULTIPLIER,
      questObjectiveHintFrequency: config.QUEST_OBJECTIVE_HINT_FREQUENCY,
      softLockHintFrequency: config.SOFT_LOCK_HINT_FREQUENCY,
      softLockMaxTurnsWithoutProgress: config.SOFT_LOCK_MAX_TURNS_WITHOUT_PROGRESS,
      skillCheckDifficultyBias: config.SKILL_CHECK_DIFFICULTY_BIAS,
      skillCheckSuccessRateMultiplier: config.SKILL_CHECK_SUCCESS_RATE_MULTIPLIER,
      resourceRegenMultiplier: config.RESOURCE_REGEN_MULTIPLIER,
      resourceDecayMultiplier: config.RESOURCE_DECAY_MULTIPLIER,
      turnPacingMultiplier: config.TURN_PACING_MULTIPLIER,
      turnTimeoutMultiplier: config.TURN_TIMEOUT_MULTIPLIER
    };

    if (this.shadowMode) {
      console.log(`[SHADOW] Pacing config would be:`, pacingConfig);
    }

    return pacingConfig;
  }

  /**
   * Apply economy config to economy engine
   */
  async applyEconomyConfig(context: LiveOpsContext): Promise<EconomyConfig> {
    const config = await this.getEffectiveConfig(context);
    
    const economyConfig: EconomyConfig = {
      dropRateMultipliers: {
        common: config.DROP_RATE_COMMON_MULTIPLIER,
        uncommon: config.DROP_RATE_UNCOMMON_MULTIPLIER,
        rare: config.DROP_RATE_RARE_MULTIPLIER,
        epic: config.DROP_RATE_EPIC_MULTIPLIER,
        legendary: config.DROP_RATE_LEGENDARY_MULTIPLIER
      },
      vendorMarginMin: config.VENDOR_MARGIN_MIN,
      vendorMarginMax: config.VENDOR_MARGIN_MAX,
      vendorStockRefreshMultiplier: config.VENDOR_STOCK_REFRESH_MULTIPLIER,
      craftingQualityBias: config.CRAFTING_QUALITY_BIAS,
      craftingSuccessRateMultiplier: config.CRAFTING_SUCCESS_RATE_MULTIPLIER,
      currencySinkDailyCap: config.CURRENCY_SINK_DAILY_CAP,
      currencySourceDailyCap: config.CURRENCY_SOURCE_DAILY_CAP,
      economicActivityMultiplier: config.ECONOMIC_ACTIVITY_MULTIPLIER,
      tradeFrequencyMultiplier: config.TRADE_FREQUENCY_MULTIPLIER
    };

    if (this.shadowMode) {
      console.log(`[SHADOW] Economy config would be:`, economyConfig);
    }

    return economyConfig;
  }

  /**
   * Apply world simulation config to world sim engine
   */
  async applyWorldSimConfig(context: LiveOpsContext): Promise<WorldSimConfig> {
    const config = await this.getEffectiveConfig(context);
    
    const worldSimConfig: WorldSimConfig = {
      eventRateMultiplier: config.WORLD_EVENT_RATE_MULTIPLIER,
      eventSeverityMultiplier: config.WORLD_EVENT_SEVERITY_MULTIPLIER,
      weatherVolatilityMultiplier: config.WEATHER_VOLATILITY_MULTIPLIER,
      weatherFrontFrequencyMultiplier: config.WEATHER_FRONT_FREQUENCY_MULTIPLIER,
      regionDriftStepCap: config.REGION_DRIFT_STEP_CAP,
      regionDriftFrequencyMultiplier: config.REGION_DRIFT_FREQUENCY_MULTIPLIER,
      worldStatePersistenceMultiplier: config.WORLD_STATE_PERSISTENCE_MULTIPLIER,
      worldStateDecayMultiplier: config.WORLD_STATE_DECAY_MULTIPLIER
    };

    if (this.shadowMode) {
      console.log(`[SHADOW] World sim config would be:`, worldSimConfig);
    }

    return worldSimConfig;
  }

  /**
   * Apply dialogue config to dialogue engine
   */
  async applyDialogueConfig(context: LiveOpsContext): Promise<DialogueConfig> {
    const config = await this.getEffectiveConfig(context);
    
    const dialogueConfig: DialogueConfig = {
      candidateCap: config.DIALOGUE_CANDIDATE_CAP,
      candidateScoreThreshold: config.DIALOGUE_CANDIDATE_SCORE_THRESHOLD,
      cooldownMultiplier: config.DIALOGUE_COOLDOWN_MULTIPLIER,
      romanceCooldownTurns: config.ROMANCE_COOLDOWN_TURNS,
      romanceProgressionMultiplier: config.ROMANCE_PROGRESSION_MULTIPLIER,
      romanceConsentStrictness: config.ROMANCE_CONSENT_STRICTNESS,
      engagementMultiplier: config.DIALOGUE_ENGAGEMENT_MULTIPLIER,
      depthMultiplier: config.DIALOGUE_DEPTH_MULTIPLIER
    };

    if (this.shadowMode) {
      console.log(`[SHADOW] Dialogue config would be:`, dialogueConfig);
    }

    return dialogueConfig;
  }

  /**
   * Apply party config to party management
   */
  async applyPartyConfig(context: LiveOpsContext): Promise<PartyConfig> {
    const config = await this.getEffectiveConfig(context);
    
    const partyConfig: PartyConfig = {
      maxActiveMembers: config.PARTY_MAX_ACTIVE_MEMBERS,
      delegateCheckRate: config.PARTY_DELEGATE_CHECK_RATE,
      intentMixBias: {
        cooperative: config.PARTY_INTENT_MIX_BIAS.COOPERATIVE,
        competitive: config.PARTY_INTENT_MIX_BIAS.COMPETITIVE,
        neutral: config.PARTY_INTENT_MIX_BIAS.NEUTRAL
      },
      cohesionMultiplier: config.PARTY_COHESION_MULTIPLIER,
      conflictMultiplier: config.PARTY_CONFLICT_MULTIPLIER,
      memberSatisfactionMultiplier: config.PARTY_MEMBER_SATISFACTION_MULTIPLIER,
      memberLoyaltyMultiplier: config.PARTY_MEMBER_LOYALTY_MULTIPLIER
    };

    if (this.shadowMode) {
      console.log(`[SHADOW] Party config would be:`, partyConfig);
    }

    return partyConfig;
  }

  /**
   * Apply module gates to system
   */
  async applyModuleGates(context: LiveOpsContext): Promise<ModuleGates> {
    const config = await this.getEffectiveConfig(context);
    
    const moduleGates: ModuleGates = {
      dialogue: config.DIALOGUE_GATE,
      worldsim: config.WORLDSIM_GATE,
      party: config.PARTY_GATE,
      mods: config.MODS_GATE,
      tools: config.TOOLS_GATE,
      economyKernel: config.ECONOMY_KERNEL_GATE
    };

    if (this.shadowMode) {
      console.log(`[SHADOW] Module gates would be:`, moduleGates);
    }

    return moduleGates;
  }

  /**
   * Check if a module is enabled
   */
  async isModuleEnabled(context: LiveOpsContext, module: keyof ModuleGates): Promise<boolean> {
    const gates = await this.applyModuleGates(context);
    return gates[module] === 'full';
  }

  /**
   * Check if a module is readonly
   */
  async isModuleReadonly(context: LiveOpsContext, module: keyof ModuleGates): Promise<boolean> {
    const gates = await this.applyModuleGates(context);
    return gates[module] === 'readonly';
  }

  /**
   * Apply all configs at once
   */
  async applyAllConfigs(context: LiveOpsContext): Promise<{
    tokenBudget: TokenBudget;
    pacing: PacingConfig;
    economy: EconomyConfig;
    worldSim: WorldSimConfig;
    dialogue: DialogueConfig;
    party: PartyConfig;
    moduleGates: ModuleGates;
  }> {
    const [
      tokenBudget,
      pacing,
      economy,
      worldSim,
      dialogue,
      party,
      moduleGates
    ] = await Promise.all([
      this.applyTokenBudget(context),
      this.applyPacingConfig(context),
      this.applyEconomyConfig(context),
      this.applyWorldSimConfig(context),
      this.applyDialogueConfig(context),
      this.applyPartyConfig(context),
      this.applyModuleGates(context)
    ]);

    return {
      tokenBudget,
      pacing,
      economy,
      worldSim,
      dialogue,
      party,
      moduleGates
    };
  }

  /**
   * Set shadow mode
   */
  setShadowMode(enabled: boolean): void {
    this.shadowMode = enabled;
  }

  /**
   * Check if shadow mode is enabled
   */
  isShadowMode(): boolean {
    return this.shadowMode;
  }

  /**
   * Get config explanation for debugging
   */
  async getConfigExplanation(context: LiveOpsContext): Promise<{
    config: LiveOpsConfig;
    explain: any;
    cacheKey: string;
    resolvedAt: Date;
  }> {
    const resolverContext: ResolverContext = {
      sessionId: context.sessionId,
      worldId: context.worldId,
      adventureId: context.adventureId,
      experimentId: context.experimentId,
      variation: context.variation
    };

    const resolved = await this.resolver.resolveEffectiveConfig(resolverContext);
    
    return {
      config: resolved.config,
      explain: resolved.explain,
      cacheKey: resolved.cacheKey,
      resolvedAt: resolved.resolvedAt
    };
  }
}

// Factory function
export function createLiveOpsIntegration(
  resolver: LiveOpsConfigResolver,
  shadowMode: boolean = false
): LiveOpsIntegration {
  return new LiveOpsIntegration(resolver, shadowMode);
}
