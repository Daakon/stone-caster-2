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
  cors: {
    origin: env.corsOrigin,
  },
};

export { configService, configServiceReady };
