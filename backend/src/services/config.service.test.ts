import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

type ConfigRow = { key: string; value: { value: unknown } };
type FeatureRow = { key: string; enabled: boolean; payload: unknown };

type MockState = {
  pricingRows: ConfigRow[];
  aiRows: ConfigRow[];
  appRows: ConfigRow[];
  featureRows: FeatureRow[];
  version: number;
  errors: Partial<Record<string, { message: string }>>;
};

type MockClient = SupabaseClient & { _state: MockState };

type ConfigServiceClass = typeof import('./config.service.js').ConfigServiceImpl;

const baseEnv = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_KEY: 'service-key',
  OPENAI_API_KEY: 'openai-key',
  PRIMARY_AI_MODEL: 'gpt-4',
  SESSION_SECRET: 'session-secret',
  PORT: '3000',
  NODE_ENV: 'test',
  CORS_ORIGIN: 'http://localhost:5173',
} satisfies NodeJS.ProcessEnv;

const applyEnv = () => {
  Object.entries(baseEnv).forEach(([key, value]) => {
    process.env[key] = value;
  });
};

const clearEnv = () => {
  Object.keys(baseEnv).forEach(key => {
    delete process.env[key];
  });
};

const pricingRows = (turnCostDefault = 2): ConfigRow[] => [
  { key: 'turn_cost_default', value: { value: turnCostDefault } },
  { key: 'turn_cost_by_world', value: { value: {} } },
  { key: 'guest_starter_casting_stones', value: { value: 15 } },
  { key: 'guest_daily_regen', value: { value: 0 } },
  { key: 'conversion_rates', value: { value: { shard: 10, crystal: 100, relic: 500 } } },
];

const aiRows = (): ConfigRow[] => [
  { key: 'active_model', value: { value: 'PRIMARY_AI_MODEL' } },
  { key: 'prompt_schema_version', value: { value: '1.0.0' } },
  { key: 'max_tokens_in', value: { value: 4096 } },
  { key: 'max_tokens_out', value: { value: 1024 } },
];

const appRows = (): ConfigRow[] => [
  { key: 'cookie_ttl_days', value: { value: 60 } },
  { key: 'idempotency_required', value: { value: true } },
  { key: 'allow_async_turn_fallback', value: { value: true } },
  { key: 'telemetry_sample_rate', value: { value: 1.0 } },
  { key: 'drifter_enabled', value: { value: true } },
];

const featureRows = (): FeatureRow[] => [
  { key: 'stones_show_guest_pill', enabled: true, payload: {} },
  { key: 'drifter_onboarding', enabled: true, payload: {} },
  { key: 'ws_push_enabled', enabled: false, payload: {} },
];

function createMockAdminClient(overrides: Partial<MockState> = {}): MockClient {
  const state: MockState = {
    pricingRows: overrides.pricingRows ?? pricingRows(),
    aiRows: overrides.aiRows ?? aiRows(),
    appRows: overrides.appRows ?? appRows(),
    featureRows: overrides.featureRows ?? featureRows(),
    version: overrides.version ?? 1,
    errors: overrides.errors ?? {},
  };

  const client = {
    from(table: string) {
      return {
  // _columns is unused in the mock implementation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  select: (_columns?: string) => {
          if (table === 'config_meta') {
            return {
              single: async () => ({
                data: state.errors.config_meta ? null : { version: state.version },
                error: state.errors.config_meta ?? null,
              }),
            };
          }

          const dataMap: Record<string, unknown> = {
            pricing_config: state.pricingRows,
            ai_config: state.aiRows,
            app_config: state.appRows,
            feature_flags: state.featureRows,
          };

          return Promise.resolve({
            data: dataMap[table] ?? [],
            error: state.errors[table] ?? null,
          });
        },
      };
    },
    _state: state,
  } as unknown as MockClient;

  return client;
}

function createSupabaseStub() {
  return {
    from(table: string) {
      return {
  // _columns is unused in the mock implementation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  select: (_columns?: string) => {
          if (table === 'config_meta') {
            return {
              single: async () => ({ data: { version: 1 }, error: null }),
            };
          }
          return Promise.resolve({ data: [], error: null });
        },
      };
    },
  };
}

const createClientMock = vi.fn(() => createSupabaseStub());

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

let ConfigServiceImpl: ConfigServiceClass;
let service: InstanceType<ConfigServiceClass> | null = null;
let client: MockClient;

beforeEach(async () => {
  vi.resetModules();
  createClientMock.mockImplementation(() => createSupabaseStub());
  applyEnv();

  ({ ConfigServiceImpl } = await import('./config.service.js'));
});

afterEach(() => {
  service?.destroy();
  service = null;
  clearEnv();
  vi.resetAllMocks();
});

describe('ConfigServiceImpl', () => {
  it('loads environment variables from the provided source', async () => {
    client = createMockAdminClient();
    service = new ConfigServiceImpl({ env: { ...baseEnv }, adminClient: client, pollIntervalMs: 0 });

    await service.whenReady();
    const env = service.getEnv();

    expect(env.supabaseUrl).toBe(baseEnv.SUPABASE_URL);
    expect(env.supabaseAnonKey).toBe(baseEnv.SUPABASE_ANON_KEY);
    expect(env.supabaseServiceKey).toBe(baseEnv.SUPABASE_SERVICE_KEY);
    expect(env.primaryAiModel).toBe(baseEnv.PRIMARY_AI_MODEL);
    expect(env.corsOrigin).toBe(baseEnv.CORS_ORIGIN);
  });

  it('throws when required environment variables are missing', () => {
    client = createMockAdminClient();
    const env = { ...baseEnv, SUPABASE_URL: undefined, NODE_ENV: 'production' } as NodeJS.ProcessEnv;

    expect(() => {
      service = new ConfigServiceImpl({ env, adminClient: client, pollIntervalMs: 0 });
    }).toThrow('Missing required environment variables in production: SUPABASE_URL');
  });

  it('loads configuration values with correct typing', async () => {
    client = createMockAdminClient();
    service = new ConfigServiceImpl({ env: { ...baseEnv }, adminClient: client, pollIntervalMs: 0 });

    await service.whenReady();
    const pricing = service.getPricing();
    const ai = service.getAi();
    const app = service.getApp();
    const features = service.getFeatures();

    expect(pricing.turnCostDefault).toBe(2);
    expect(pricing.conversionRates.crystal).toBe(100);
    expect(ai.activeModel).toBe(baseEnv.PRIMARY_AI_MODEL);
    expect(app.telemetrySampleRate).toBe(1);
    expect(features).toHaveLength(3);
  });

  it('returns a public DTO without sensitive fields', async () => {
    client = createMockAdminClient();
    service = new ConfigServiceImpl({ env: { ...baseEnv }, adminClient: client, pollIntervalMs: 0 });

    await service.whenReady();
    const dto = service.toPublicDTO();

    expect(dto.ai).toEqual({ promptSchemaVersion: '1.0.0' });
    expect(dto.app).toEqual({ drifterEnabled: true });
    expect(dto.pricing.turnCostDefault).toBe(2);
    expect(dto.pricing).not.toHaveProperty('guestStarterCastingStones');
    expect(JSON.stringify(dto)).not.toContain('activeModel');
    expect(JSON.stringify(dto)).not.toContain('telemetrySampleRate');
  });

  it('falls back to defaults when values are missing', async () => {
    client = createMockAdminClient({
      pricingRows: pricingRows().filter(row => row.key !== 'turn_cost_default'),
    });
    service = new ConfigServiceImpl({ env: { ...baseEnv }, adminClient: client, pollIntervalMs: 0 });

    await service.whenReady();
    expect(service.getPricing().turnCostDefault).toBe(2);
  });

  it('updates cached values and ETag on refresh', async () => {
    client = createMockAdminClient();
    service = new ConfigServiceImpl({ env: { ...baseEnv }, adminClient: client, pollIntervalMs: 0 });

    await service.whenReady();
    const initialEtag = service.getEtag();

    client._state.version = 2;
    client._state.pricingRows = pricingRows().map(row =>
      row.key === 'turn_cost_default'
        ? { ...row, value: { value: 10 } }
        : row,
    );

    await service.refreshNow();

    expect(service.getPricing().turnCostDefault).toBe(10);
    expect(service.getEtag()).not.toBe(initialEtag);
  });

  it('propagates errors when configuration cannot be loaded', async () => {
    client = createMockAdminClient({
      errors: {
        pricing_config: { message: 'db error' },
      },
    });
    service = new ConfigServiceImpl({ env: { ...baseEnv }, adminClient: client, pollIntervalMs: 0 });

  await expect(service!.whenReady()).rejects.toThrow('Failed to load configuration');
  expect(() => service!.getPricing()).toThrow('Configuration not loaded');
  });
});






