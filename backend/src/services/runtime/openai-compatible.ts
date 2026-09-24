// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * OpenAI-compatible chat completion client.
 * Shared by the OpenAI and OpenRouter providers (OpenRouter exposes the same
 * /chat/completions wire format at https://openrouter.ai/api/v1).
 */
import { DEFAULT_MODELS, type LlmRoleConfig } from '../../config/llm-config';
import { recordLlmCall } from './llm-telemetry';

const DEFAULT_LLM_TIMEOUT_MS = 30_000;
/** Free routed models are slow and cold-start; give them longer than OpenAI's 30s. */
const OPENROUTER_TIMEOUT_MS = 90_000;

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch with an abort timeout and retries on transient failures
 * (timeout, network error, 429, 5xx). Non-transient HTTP errors (4xx) are
 * returned to the caller without retry.
 */
export async function fetchWithTimeoutRetry(
  url: string,
  init: RequestInit,
  options: { timeoutMs?: number; retries?: number; retryDelayMs?: number } = {}
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS;
  const retries = options.retries ?? 1;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      // Retry only transient HTTP failures
      if ((response.status === 429 || response.status >= 500) && attempt < retries) {
        lastError = new Error(`Transient HTTP ${response.status}`);
        if (options.retryDelayMs) await sleep(options.retryDelayMs * (attempt + 1));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      const isAbort = error instanceof Error && error.name === 'AbortError';
      if (attempt < retries) {
        console.warn(`[LLM Provider] ${isAbort ? 'Timeout' : 'Network error'} on attempt ${attempt + 1}, retrying...`);
        if (options.retryDelayMs) await sleep(options.retryDelayMs * (attempt + 1));
        continue;
      }
      if (isAbort) {
        throw new Error(`LLM request timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface ChatEndpoint {
  /** Pipeline role, for telemetry only */
  role?: string;
  label: string;
  url: string;
  apiKey: string;
  model: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  /** Extra attempts when the model answers with empty content or (JSON mode) unparseable text. Routed free models do both. */
  contentRetries?: number;
  /** Retry once without response_format when the upstream rejects it (routed/free models often do). */
  jsonModeFallback?: boolean;
}

function envTimeout(): number | undefined {
  const n = Number(process.env.LLM_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function openAiEndpoint(apiKey: string, model: string = DEFAULT_MODELS.openai): ChatEndpoint {
  return { label: 'OpenAI', url: OPENAI_URL, apiKey, model, timeoutMs: envTimeout() };
}

export function openRouterEndpoint(apiKey: string, model: string = DEFAULT_MODELS.openrouter): ChatEndpoint {
  return {
    label: 'OpenRouter',
    url: OPENROUTER_URL,
    apiKey,
    model,
    headers: {
      // Optional attribution headers recommended by OpenRouter
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:5183',
      'X-Title': process.env.OPENROUTER_APP_NAME || 'StoneCaster',
    },
    timeoutMs: envTimeout() ?? OPENROUTER_TIMEOUT_MS,
    retries: 2,
    retryDelayMs: 2_000,
    jsonModeFallback: true,
    contentRetries: 2,
  };
}

/** Endpoint for a resolved role config. Throws (naming the env var) when the key is missing. */
export function createChatEndpoint(config: Pick<LlmRoleConfig, 'provider' | 'model'> & { role?: string }): ChatEndpoint {
  if (config.provider === 'openai') {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OpenAI API key is not configured (OPENAI_API_KEY)');
    return { ...openAiEndpoint(key, config.model), role: config.role };
  }
  if (config.provider === 'openrouter') {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error('OpenRouter API key is not configured (OPENROUTER_API_KEY)');
    return { ...openRouterEndpoint(key, config.model), role: config.role };
  }
  throw new Error(`No chat endpoint for provider "${config.provider}"`);
}

export class EmptyContentError extends Error {}
export class InvalidJsonError extends Error {}

/** One chat completion; returns the assistant message content. */
export async function chatCompletion(
  ep: ChatEndpoint,
  system: string,
  user: string,
  opts: ChatOptions = {}
): Promise<string> {
  const send = (withJsonMode: boolean) => fetchWithTimeoutRetry(ep.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ep.apiKey}`,
      ...ep.headers,
    },
    body: JSON.stringify({
      model: ep.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: opts.temperature ?? 0.7,
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      ...(withJsonMode ? { response_format: { type: 'json_object' } } : {}),
      // OpenRouter: return actual cost in the usage block
      ...(ep.label === 'OpenRouter' ? { usage: { include: true } } : {}),
    }),
  }, { timeoutMs: ep.timeoutMs, retries: ep.retries, retryDelayMs: ep.retryDelayMs });

  const t0 = Date.now();
  let response = await send(!!opts.jsonMode);
  if (!response.ok && opts.jsonMode && ep.jsonModeFallback && [400, 404, 422].includes(response.status)) {
    console.warn(`[LLM Provider] ${ep.label} rejected response_format for ${ep.model} (HTTP ${response.status}); retrying without it`);
    response = await send(false);
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`${ep.label} API error: ${response.status} ${error}`);
  }

  const data = await response.json() as {
    choices?: Array<{ finish_reason?: string; message?: { content?: string | null; reasoning?: string | null } }>;
    error?: { code?: number | string; message?: string };
    model?: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number };
  };
  // One machine-readable line per call: grep '[LLM_CALL]' for latency/tokens/cost
  const record = {
    role: ep.role ?? 'unknown', provider: ep.label, requested: ep.model, served: data.model ?? ep.model,
    ms: Date.now() - t0, prompt: data.usage?.prompt_tokens ?? null, completion: data.usage?.completion_tokens ?? null,
    cost: data.usage?.cost ?? null, ok: !data.error && !!data.choices?.[0]?.message?.content,
  };
  console.log(`[LLM_CALL] ${JSON.stringify(record)}`);
  recordLlmCall(record);
  // Routers (openrouter/free) pick the real model per request; record which one answered
  if (data.model && data.model !== ep.model) {
    console.log(`[LLM Provider] ${ep.label} routed ${ep.model} -> ${data.model}`);
  }
  // OpenRouter can answer HTTP 200 with an error envelope (upstream failure / rate limit)
  if (data.error) {
    throw new Error(`${ep.label} API error: ${data.error.code ?? 'unknown'} ${data.error.message ?? JSON.stringify(data.error)}`);
  }
  const choice = data.choices?.[0];
  const content = choice?.message?.content;
  if (!content) {
    const why = `finish_reason=${choice?.finish_reason ?? 'n/a'}${choice?.message?.reasoning ? ', reasoning-only output' : ''}, model=${data.model ?? ep.model}`;
    throw new EmptyContentError(`No content in ${ep.label} response (${why})`);
  }
  return content;
}

/**
 * Parse model output as JSON. Tolerates the ```json fences and surrounding
 * prose that models without strict JSON mode (e.g. openrouter/free) emit.
 */
export function parseJsonContent<T>(content: string): T {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const unfenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    try {
      return JSON.parse(unfenced) as T;
    } catch {
      const first = unfenced.indexOf('{');
      const last = unfenced.lastIndexOf('}');
      if (first !== -1 && last > first) {
        try {
          return JSON.parse(unfenced.slice(first, last + 1)) as T;
        } catch { /* fall through */ }
      }
      throw new InvalidJsonError(`Model did not return valid JSON: ${trimmed.slice(0, 200)}`);
    }
  }
}
