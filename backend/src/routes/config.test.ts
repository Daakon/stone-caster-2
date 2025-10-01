import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import configRouter from './config.js';

interface MockConfigService {
  whenReady: ReturnType<typeof vi.fn>;
  refreshNow: ReturnType<typeof vi.fn>;
  getEtag: ReturnType<typeof vi.fn>;
  toPublicDTO: ReturnType<typeof vi.fn>;
}

let mockConfigService: MockConfigService;

vi.mock('../services/config.service.js', () => {
  const service = {
    whenReady: vi.fn(),
    refreshNow: vi.fn(),
    getEtag: vi.fn(),
    toPublicDTO: vi.fn(),
  } satisfies MockConfigService;
  return { configService: service };
});

const resolveMock = async () => {
  const module = await import('../services/config.service.js');
  // import may resolve to the real type; cast via unknown to satisfy the mock interface
  mockConfigService = module.configService as unknown as MockConfigService;
};

describe('Config API Routes', () => {
  let app: express.Application;

  beforeEach(async () => {
    await resolveMock();
    app = express();
    app.use('/api/config', configRouter);

    vi.clearAllMocks();
    mockConfigService.whenReady.mockResolvedValue(undefined);
    mockConfigService.refreshNow.mockResolvedValue(undefined);
  });

  it('returns configuration with caching headers', async () => {
    const mockEtag = 'abc123def456';
    const mockConfig = {
      etag: mockEtag,
      pricing: {
        turnCostDefault: 2,
        turnCostByWorld: {},
        conversionRates: { shard: 10, crystal: 100, relic: 500 },
      },
      features: [],
      ai: { promptSchemaVersion: '1.0.0' },
      app: { drifterEnabled: true },
    };

    mockConfigService.getEtag.mockReturnValue(mockEtag);
    mockConfigService.toPublicDTO.mockReturnValue(mockConfig);

    const response = await request(app).get('/api/config').expect(200);

    expect(mockConfigService.whenReady).toHaveBeenCalled();
    expect(response.headers['etag']).toBe(mockEtag);
    expect(response.headers['cache-control']).toBe('public, max-age=15');
    expect(response.body).toEqual(mockConfig);
  });

  it('returns 304 when the ETag matches', async () => {
    const mockEtag = 'abc123def456';

    mockConfigService.getEtag.mockReturnValue(mockEtag);

    const response = await request(app)
      .get('/api/config')
      .set('If-None-Match', mockEtag)
      .expect(304);

    expect(response.body).toEqual({});
    expect(mockConfigService.toPublicDTO).not.toHaveBeenCalled();
  });

  it('falls back to refresh when getEtag throws', async () => {
    mockConfigService.getEtag.mockImplementationOnce(() => {
      throw new Error('not ready');
    });
    mockConfigService.getEtag.mockReturnValueOnce('etag-after-refresh');
    mockConfigService.toPublicDTO.mockReturnValue({
      etag: 'etag-after-refresh',
      pricing: { turnCostDefault: 2, turnCostByWorld: {}, conversionRates: {} },
      features: [],
      ai: { promptSchemaVersion: '1.0.0' },
      app: { drifterEnabled: true },
    });

    await request(app).get('/api/config').expect(200);

    expect(mockConfigService.refreshNow).toHaveBeenCalled();
  });

  it('returns 500 when the service fails', async () => {
    mockConfigService.getEtag.mockImplementation(() => {
      throw new Error('failure');
    });
    mockConfigService.refreshNow.mockRejectedValue(new Error('failure'));

    const response = await request(app).get('/api/config').expect(500);

    expect(response.body).toEqual({
      error: 'Internal server error',
      message: 'Failed to load configuration',
    });
  });
});

