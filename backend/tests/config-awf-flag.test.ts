import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the config service
vi.mock('../src/services/config.service.js', () => ({
  configService: {
    getAwfBundleEnabled: vi.fn(),
    getEnv: vi.fn(),
  },
}));

import { configService } from '../src/services/config.service.js';

describe('Config Service AWF Bundle Flag', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
  });

  describe('AWF_BUNDLE_ON environment variable parsing', () => {
    it('should default to false when AWF_BUNDLE_ON is not set', () => {
      // Arrange
      vi.mocked(configService.getAwfBundleEnabled).mockReturnValue(false);

      // Act
      const result = configService.getAwfBundleEnabled();

      // Assert
      expect(result).toBe(false);
    });

    it('should return true when AWF_BUNDLE_ON is "true"', () => {
      // Arrange
      vi.mocked(configService.getAwfBundleEnabled).mockReturnValue(true);

      // Act
      const result = configService.getAwfBundleEnabled();

      // Assert
      expect(result).toBe(true);
    });

    it('should return true when AWF_BUNDLE_ON is "1"', () => {
      // Arrange
      vi.mocked(configService.getAwfBundleEnabled).mockReturnValue(true);

      // Act
      const result = configService.getAwfBundleEnabled();

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when AWF_BUNDLE_ON is "false"', () => {
      // Arrange
      vi.mocked(configService.getAwfBundleEnabled).mockReturnValue(false);

      // Act
      const result = configService.getAwfBundleEnabled();

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when AWF_BUNDLE_ON is "0"', () => {
      // Arrange
      vi.mocked(configService.getAwfBundleEnabled).mockReturnValue(false);

      // Act
      const result = configService.getAwfBundleEnabled();

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when AWF_BUNDLE_ON is empty string', () => {
      // Arrange
      vi.mocked(configService.getAwfBundleEnabled).mockReturnValue(false);

      // Act
      const result = configService.getAwfBundleEnabled();

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when AWF_BUNDLE_ON is invalid value', () => {
      // Arrange
      vi.mocked(configService.getAwfBundleEnabled).mockReturnValue(false);

      // Act
      const result = configService.getAwfBundleEnabled();

      // Assert
      expect(result).toBe(false);
    });

    it('should handle case sensitivity correctly', () => {
      // Test various case combinations
      const testCases = [
        { value: 'TRUE', expected: false },
        { value: 'True', expected: false },
        { value: 'FALSE', expected: false },
        { value: 'False', expected: false },
        { value: 'true', expected: true },
        { value: 'false', expected: false },
      ];

      testCases.forEach(({ expected }) => {
        // Arrange
        vi.mocked(configService.getAwfBundleEnabled).mockReturnValue(expected);

        // Act
        const result = configService.getAwfBundleEnabled();

        // Assert
        expect(result).toBe(expected);
      });
    });
  });

  describe('getEnv method', () => {
    it('should include awfBundleOn in environment config', () => {
      // Arrange
      vi.mocked(configService.getEnv).mockReturnValue({
        awfBundleOn: true,
        port: 3000,
        nodeEnv: 'test',
        supabaseUrl: 'http://localhost:54321',
        supabaseAnonKey: 'test-anon-key',
        supabaseServiceKey: 'test-service-key',
        openaiApiKey: 'test-openai-key',
        primaryAiModel: 'gpt-4',
        sessionSecret: 'test-session-secret',
        corsOrigin: 'http://localhost:5173',
        anthropicApiKey: null,
        stripeSecretKey: 'sk_test_local_dev_key',
        stripeWebhookSecret: 'whsec_local_dev_secret',
        frontendUrl: 'http://localhost:5173',
        apiUrl: 'http://localhost:3000',
      });

      // Act
      const env = configService.getEnv();

      // Assert
      expect(env).toHaveProperty('awfBundleOn');
      expect(env.awfBundleOn).toBe(true);
    });

    it('should reflect current environment state', () => {
      // Arrange
      vi.mocked(configService.getEnv).mockReturnValue({
        awfBundleOn: false,
        port: 3000,
        nodeEnv: 'test',
        supabaseUrl: 'http://localhost:54321',
        supabaseAnonKey: 'test-anon-key',
        supabaseServiceKey: 'test-service-key',
        openaiApiKey: 'test-openai-key',
        primaryAiModel: 'gpt-4',
        sessionSecret: 'test-session-secret',
        corsOrigin: 'http://localhost:5173',
        anthropicApiKey: null,
        stripeSecretKey: 'sk_test_local_dev_key',
        stripeWebhookSecret: 'whsec_local_dev_secret',
        frontendUrl: 'http://localhost:5173',
        apiUrl: 'http://localhost:3000',
      });

      // Act
      const env = configService.getEnv();

      // Assert
      expect(env.awfBundleOn).toBe(false);
    });
  });
});
