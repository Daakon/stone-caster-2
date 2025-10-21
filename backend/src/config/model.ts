import 'dotenv/config';
function req(name: string): string {
  const v = process.env[name];
  if (!v || v === '__REPLACE_ME__') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

const provider = process.env.MODEL_PROVIDER ?? 'gemini';
if (provider !== 'gemini') {
  throw new Error(`Only 'gemini' is supported in this build. Got MODEL_PROVIDER=${provider}`);
}

export const ModelConfig = Object.freeze({
  provider: 'gemini' as const,
  modelName: process.env.MODEL_NAME ?? 'gemini-1.5-pro',
  apiKey: req('GEMINI_API_KEY'),
  jsonStrict: process.env.MODEL_JSON_STRICT === '1',
  timeoutMs: Number(process.env.MODEL_TIMEOUT_MS ?? 30000),
  maxTokens: Number(process.env.MODEL_MAX_TOKENS ?? 800),
  temperature: Number(process.env.MODEL_TEMPERATURE ?? 0.7),
  dailyTokensCap: Number(process.env.CHAT_DAILY_TOKENS_CAP ?? 50000),
});
