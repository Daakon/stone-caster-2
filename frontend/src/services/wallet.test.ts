import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the API module
const mockApiGet = vi.fn();
vi.mock('../lib/api', () => ({
  apiGet: mockApiGet,
  getWallet: vi.fn().mockImplementation(async () => {
    return mockApiGet('/api/stones/wallet');
  })
}));

import { getWallet } from '../lib/api';

describe('Wallet Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch wallet data successfully', async () => {
    const mockWalletData = {
      shard: 10,
      crystal: 5,
      relic: 2,
      dailyRegen: 1,
      lastRegenAt: '2024-01-01T00:00:00Z'
    };

    mockApiGet.mockResolvedValue({
      ok: true,
      data: mockWalletData
    });

    const result = await getWallet();

    expect(mockApiGet).toHaveBeenCalledWith('/api/stones/wallet');
    expect(result).toEqual({
      ok: true,
      data: mockWalletData
    });
  });

  it('should handle wallet fetch errors', async () => {
    const mockError = {
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch wallet',
      http: 500
    };

    mockApiGet.mockResolvedValue({
      ok: false,
      error: mockError
    });

    const result = await getWallet();

    expect(mockApiGet).toHaveBeenCalledWith('/api/stones/wallet');
    expect(result).toEqual({
      ok: false,
      error: mockError
    });
  });

  it('should handle network errors', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error'));

    const result = await getWallet();

    expect(mockApiGet).toHaveBeenCalledWith('/api/stones/wallet');
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Network error',
        http: 0
      }
    });
  });
});
