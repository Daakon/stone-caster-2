import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

type ConfigRow = { key: string; value: { value: unknown } };

type MockState = {
  pricingRows: ConfigRow[];
  aiRows: ConfigRow[];
  appRows: ConfigRow[];
  featureRows: { key: string; enabled: boolean; payload: unknown }[];
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

const createMockAdminClient = (overrides: Partial<MockState> = {}): MockClient => {
  const state: MockState = {
    pricingRows: overrides.pricingRows ?? pricingRows(),
    aiRows: overrides.aiRows ?? [],
    appRows: overrides.appRows ?? [],
    featureRows: overrides.featureRows ?? [],
    version: overrides.version ?? 1,
    errors: overrides.errors ?? {},
  };

  const client = {
    from(table: string) {
      return {
        select: () => {
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
};

function createSupabaseStub() {
  return {
    from(table: string) {
      return {
        select: () => {
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
let service: InstanceType<ConfigServiceClass>;
let client: MockClient;

beforeEach(async () => {
  vi.resetModules();
  createClientMock.mockImplementation(() => createSupabaseStub());
  applyEnv();
  vi.useFakeTimers();

  ({ ConfigServiceImpl } = await import('./config.service.js'));

  client = createMockAdminClient();
  service = new ConfigServiceImpl({
    env: { ...baseEnv },
    adminClient: client,
    pollIntervalMs: 1_000,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  });
  await service.whenReady();
});

afterEach(() => {
  service.destroy();
  clearEnv();
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe('ConfigServiceImpl hot reload', () => {
  it('reloads configuration when the meta version changes', async () => {
    client._state.version = 2;
    client._state.pricingRows = pricingRows(7);

    await vi.advanceTimersByTimeAsync(1_000);

    expect(service.getPricing().turnCostDefault).toBe(7);
    expect(service.getPricing().conversionRates.crystal).toBe(100);
  });

  it('continues polling when an error occurs', async () => {
    client._state.errors.config_meta = { message: 'poll error' };

    await vi.advanceTimersByTimeAsync(1_000);

    expect(service.getPricing().turnCostDefault).toBe(2);
  });

  it('supports manual refresh', async () => {
    client._state.version = 3;
    client._state.pricingRows = pricingRows(11);

    await service.refreshNow();

    expect(service.getPricing().turnCostDefault).toBe(11);
  });

  it('updates the cached ETag when configuration changes', async () => {
    const etag1 = service.getEtag();

    client._state.version = 4;
    client._state.pricingRows = pricingRows(20);

    await service.refreshNow();

    const etag2 = service.getEtag();
    expect(etag2).not.toBe(etag1);
  });
});

