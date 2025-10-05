import { vi } from 'vitest';

/**
 * Creates a comprehensive config service mock
 * This fixes import issues and provides consistent mocking across tests
 */
export function createConfigServiceMock() {
  const mockConfigService = {
    getFeatures: vi.fn().mockReturnValue({
      telemetry_enabled: true,
      guest_daily_regen: 1,
      turn_cost_default: 2,
    }),
    getPricing: vi.fn().mockReturnValue({
      turnCostDefault: 2,
      turnCostByWorld: {},
      conversionRates: {
        shard_to_casting: 10,
        crystal_to_casting: 5,
        relic_to_casting: 1,
      },
    }),
    getLimits: vi.fn().mockReturnValue({
      maxCharactersPerUser: 10,
      maxGamesPerUser: 5,
      maxTurnsPerGame: 1000,
    }),
    getPublicConfig: vi.fn().mockReturnValue({
      features: {
        telemetry_enabled: true,
        guest_daily_regen: 1,
        turn_cost_default: 2,
      },
      pricing: {
        turnCostDefault: 2,
        turnCostByWorld: {},
      },
      limits: {
        maxCharactersPerUser: 10,
        maxGamesPerUser: 5,
        maxTurnsPerGame: 1000,
      },
    }),
    reload: vi.fn().mockResolvedValue(undefined),
    getETag: vi.fn().mockReturnValue('mock-etag-123'),
  };

  return mockConfigService;
}

/**
 * Sets up the global config service mock for tests
 */
export function setupConfigServiceMock() {
  const mockConfigService = createConfigServiceMock();
  
  vi.mock('../services/config.service.js', () => ({
    configService: mockConfigService,
  }));

  return mockConfigService;
}
