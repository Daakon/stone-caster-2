import { vi } from 'vitest';

// Mock the config service to avoid database dependencies in tests
vi.mock('./services/config.service.js', () => ({
  configService: {
    getEnv: () => ({
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
    }),
    getPricing: () => ({
      turnCostDefault: 1,
      turnCostByWorld: {},
      guestStarterCastingStones: 10,
      guestDailyRegen: 5,
      conversionRates: { shard: 1, crystal: 10, relic: 100 },
    }),
    getAi: () => ({
      activeModel: 'gpt-4',
      promptSchemaVersion: '1.0.0',
      maxTokensIn: 4000,
      maxTokensOut: 1000,
    }),
    getApp: () => ({
      cookieTtlDays: 30,
      idempotencyRequired: false,
      allowAsyncTurnFallback: true,
      telemetrySampleRate: 0.1,
      drifterEnabled: false,
    }),
    getFeatures: () => [],
    toPublicDTO: () => ({
      etag: 'test-etag',
      pricing: {
        turnCostDefault: 1,
        turnCostByWorld: {},
        conversionRates: { shard: 1, crystal: 10, relic: 100 },
      },
      features: [],
      ai: {
        promptSchemaVersion: '1.0.0',
      },
      app: {
        drifterEnabled: false,
      },
    }),
    refreshNow: vi.fn().mockResolvedValue(undefined),
    whenReady: vi.fn().mockResolvedValue(undefined),
  },
  configServiceReady: Promise.resolve(),
}));

// Mock Supabase admin client
vi.mock('./services/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

// Mock Supabase client for auth
const mockSupabaseAuth = {
  getUser: vi.fn(),
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  signOut: vi.fn(),
  exchangeCodeForSession: vi.fn(),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: mockSupabaseAuth,
  })),
}));

// Make mock available globally for tests
(global as any).mockSupabaseAuth = mockSupabaseAuth;
