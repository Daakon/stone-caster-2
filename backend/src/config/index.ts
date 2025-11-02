import './load-env.js';
import { configService, configServiceReady } from '../services/config.service.js';

const env = configService.getEnv();

export const config = {
  port: env.port,
  nodeEnv: env.nodeEnv,
  supabase: {
    url: env.supabaseUrl,
    anonKey: env.supabaseAnonKey,
    serviceKey: env.supabaseServiceKey,
  },
  openai: {
    apiKey: env.openaiApiKey,
    model: env.primaryAiModel,
  },
  prompt: {
    modelDefault: env.promptModelDefault,
    tokenBudgetDefault: process.env.PROMPT_TOKEN_BUDGET_DEFAULT
      ? Number(process.env.PROMPT_TOKEN_BUDGET_DEFAULT)
      : 8000,
    budgetWarnPct: process.env.PROMPT_BUDGET_WARN_PCT
      ? Number(process.env.PROMPT_BUDGET_WARN_PCT)
      : 0.9,
  },
  cors: {
    origin: env.corsOrigin,
  },
  frontend: {
    url: env.frontendUrl,
  },
  api: {
    url: env.apiUrl,
  },
  features: {
    awfBundleOn: env.awfBundleOn,
  },
  debug: {
    routesEnabled: env.debugRoutesEnabled,
    routesToken: env.debugRoutesToken,
    responseEnabled: env.debugResponseEnabled,
    responseMaxChars: env.debugResponseMaxChars,
    includeAiRaw: env.debugResponseIncludeAiRaw,
  },
  testTx: {
    enabled: process.env.TEST_TX_ENABLED === 'true',
  },
  legacyPrompts: {
    enabled: env.legacyPromptsEnabled,
    sunset: env.legacyPromptsSunset || '2025-12-31',
  },
  promptTracing: {
    enabled: process.env.PROMPT_TRACING_ENABLED === 'true',
    maxSnippet: process.env.PROMPT_TRACING_MAX_SNIPPET 
      ? Number(process.env.PROMPT_TRACING_MAX_SNIPPET) 
      : 2000,
  },
  slo: {
    spawnP95Ms: process.env.SLO_SPAWN_P95_MS ? Number(process.env.SLO_SPAWN_P95_MS) : 600,
    turnP95Ms: process.env.SLO_TURN_P95_MS ? Number(process.env.SLO_TURN_P95_MS) : 200,
  },
};

export { configService, configServiceReady };
