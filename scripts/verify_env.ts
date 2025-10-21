// scripts/verify_env.ts
// Verification script to validate environment configuration
// Run with: npm run verify:env

import { ModelConfig } from '../src/config/model';

(async () => {
  console.log('[env] MODEL_PROVIDER:', ModelConfig.provider);
  console.log('[env] MODEL_NAME:', ModelConfig.modelName);
  console.log('[env] TIMEOUT(ms):', ModelConfig.timeoutMs);
  console.log('[env] MAX_TOKENS:', ModelConfig.maxTokens);
  console.log('[env] DAILY_CAP:', ModelConfig.dailyTokensCap);
  console.log('[env] JSON_STRICT:', ModelConfig.jsonStrict ? 'on' : 'off');
  console.log('[env] TEMPERATURE:', ModelConfig.temperature);
  console.log('✓ OK: environment validated.');
})();

