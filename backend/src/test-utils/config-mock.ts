import { vi } from 'vitest';

export interface ConfigServiceMockOptions {
  env?: Record<string, unknown>;
  pricing?: {
    turnCostDefault?: number;
    turnCostByWorld?: Record<string, number>;
    guestStarterCastingStones?: number;
    guestDailyRegen?: number;
    conversionRates?: { shard: number; crystal: number; relic: number };
  };
  ai?: {
    activeModel?: string;
    promptSchemaVersion?: string;
    maxTokensIn?: number;
    maxTokensOut?: number;
    requirePromptApproval?: boolean;
  };
  app?: {
    cookieTtlDays?: number;
    idempotencyRequired?: boolean;
    allowAsyncTurnFallback?: boolean;
    telemetrySampleRate?: number;
    drifterEnabled?: boolean;
  };
  features?: Array<{ key: string; enabled: boolean; payload?: Record<string, unknown> }>;
}

export interface ConfigServiceMockBundle {
  mockConfigService: ReturnType<typeof createConfigServiceMockInternal>;
  state: ReturnType<typeof buildMockState>;
}

function buildMockState(overrides: ConfigServiceMockOptions | undefined) {
  return {
    env: {
      supabaseUrl: 'https://test.supabase.co',
      supabaseAnonKey: 'test-anon-key',
      supabaseServiceKey: 'test-service-key',
      openaiApiKey: 'test-openai-key',
      primaryAiModel: 'gpt-4',
      sessionSecret: 'test-session-secret',
      nodeEnv: 'test',
      port: 3000,
      corsOrigin: 'http://localhost:5173',
      anthropicApiKey: null,
      stripeSecretKey: 'sk_test_key',
      stripeWebhookSecret: 'whsec_test_secret',
      frontendUrl: 'http://localhost:5173',
      apiUrl: 'http://localhost:3000',
      ...(overrides?.env ?? {}),
    },
    pricing: {
      turnCostDefault: 1,
      turnCostByWorld: {},
      guestStarterCastingStones: 10,
      guestDailyRegen: 5,
      conversionRates: { shard: 1, crystal: 10, relic: 100 },
      ...(overrides?.pricing ?? {}),
    },
    ai: {
      activeModel: 'gpt-4',
      promptSchemaVersion: '1.0.0',
      maxTokensIn: 4000,
      maxTokensOut: 1000,
      requirePromptApproval: true,
      ...(overrides?.ai ?? {}),
    },
    app: {
      cookieTtlDays: 30,
      idempotencyRequired: false,
      allowAsyncTurnFallback: true,
      telemetrySampleRate: 0.25,
      drifterEnabled: false,
      ...(overrides?.app ?? {}),
    },
    features: overrides?.features ?? [
      { key: 'telemetry_enabled', enabled: true, payload: {} },
      { key: 'publishing_wizard', enabled: false, payload: {} },
    ],
  };
}

function createConfigServiceMockInternal(state: ReturnType<typeof buildMockState>) {
  return {
    getEnv: vi.fn(() => state.env),
    getPricing: vi.fn(() => state.pricing),
    getAi: vi.fn(() => state.ai),
    getApp: vi.fn(() => state.app),
    getFeatures: vi.fn(() => state.features),
    toPublicDTO: vi.fn(() => ({
      etag: 'test-etag',
      pricing: {
        turnCostDefault: state.pricing.turnCostDefault,
        turnCostByWorld: state.pricing.turnCostByWorld,
        conversionRates: state.pricing.conversionRates,
      },
      features: state.features,
      ai: {
        promptSchemaVersion: state.ai.promptSchemaVersion,
      },
      app: {
        drifterEnabled: state.app.drifterEnabled,
      },
    })),
    refreshNow: vi.fn().mockResolvedValue(undefined),
    whenReady: vi.fn().mockResolvedValue(undefined),
    getEtag: vi.fn().mockReturnValue('test-etag'),
  };
}

/**
 * Creates a comprehensive config service mock plus snapshot state.
 */
export function createConfigServiceMock(options?: ConfigServiceMockOptions): ConfigServiceMockBundle {
  const state = buildMockState(options);
  const mockConfigService = createConfigServiceMockInternal(state);

  return { mockConfigService, state };
}

/**
 * Sets up the global config service mock for Vitest.
 */
export function installConfigServiceMock(options?: ConfigServiceMockOptions) {
  const { mockConfigService, state } = createConfigServiceMock(options);

  vi.mock('../services/config.service.js', () => ({
    configService: mockConfigService,
    configServiceReady: Promise.resolve(),
  }));

  return { mockConfigService, state };
}
