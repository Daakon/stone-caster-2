// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * Per-role LLM provider/model configuration.
 *
 * Roles: director (intent JSON), narrator (turn prose JSON), genesis (opening scene).
 * Providers: mock | openai | openrouter.
 *
 * Env, most specific wins (ROLE = DIRECTOR | NARRATOR | GENESIS):
 *   ROLE_LLM_PROVIDER, ROLE_LLM_MODEL   per-role override
 *   LLM_PROVIDER, LLM_MODEL             global default
 *   (auto)                              openai if OPENAI_API_KEY, else openrouter if OPENROUTER_API_KEY, else mock
 * ENABLE_MOCK_AI=true forces every role to mock (the dev/test kill switch).
 * A global LLM_MODEL is only applied to roles that did not override the provider,
 * so a role pinned to another provider never inherits a model id from the wrong one.
 */
import { isMockAiEnabled } from './ai-flags';

export type LlmProviderName = 'mock' | 'openai' | 'openrouter';
export type LlmRole = 'director' | 'narrator' | 'genesis';

export const LLM_ROLES: readonly LlmRole[] = ['director', 'narrator', 'genesis'];
export const LLM_PROVIDERS: readonly LlmProviderName[] = ['mock', 'openai', 'openrouter'];

export const DEFAULT_MODELS: Record<LlmProviderName, string> = {
  mock: 'mock',
  openai: 'gpt-4o-mini',
  openrouter: 'openrouter/free',
};

export interface LlmRoleConfig {
  role: LlmRole;
  provider: LlmProviderName;
  model: string;
  /** True when mock was only auto-selected because no provider or API key is configured (not requested). */
  unconfigured?: boolean;
}

type Env = Record<string, string | undefined>;

function clean(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

function parseProvider(value: string, source: string): LlmProviderName {
  const v = value.toLowerCase();
  if ((LLM_PROVIDERS as readonly string[]).includes(v)) return v as LlmProviderName;
  throw new Error(`Invalid ${source}="${value}". Expected one of: ${LLM_PROVIDERS.join(', ')}.`);
}

function autoProvider(env: Env): LlmProviderName {
  if (clean(env.OPENAI_API_KEY)) return 'openai';
  if (clean(env.OPENROUTER_API_KEY)) return 'openrouter';
  return 'mock';
}

export function resolveLlmRoleConfig(role: LlmRole, env: Env = process.env): LlmRoleConfig {
  if (isMockAiEnabled()) return { role, provider: 'mock', model: DEFAULT_MODELS.mock };

  const prefix = role.toUpperCase();
  const roleProvider = clean(env[`${prefix}_LLM_PROVIDER`]);
  const globalProvider = clean(env.LLM_PROVIDER);

  const provider = roleProvider
    ? parseProvider(roleProvider, `${prefix}_LLM_PROVIDER`)
    : globalProvider
      ? parseProvider(globalProvider, 'LLM_PROVIDER')
      : autoProvider(env);

  if (provider === 'mock') {
    return { role, provider, model: DEFAULT_MODELS.mock, unconfigured: !roleProvider && !globalProvider };
  }

  const model =
    clean(env[`${prefix}_LLM_MODEL`]) ??
    (roleProvider && roleProvider.toLowerCase() !== (globalProvider ?? autoProvider(env)) ? undefined : clean(env.LLM_MODEL)) ??
    DEFAULT_MODELS[provider];

  return { role, provider, model };
}

export function describeLlmConfig(env: Env = process.env): Record<LlmRole, { provider: LlmProviderName; model: string }> {
  const out = {} as Record<LlmRole, { provider: LlmProviderName; model: string }>;
  for (const role of LLM_ROLES) {
    const { provider, model } = resolveLlmRoleConfig(role, env);
    out[role] = { provider, model };
  }
  return out;
}
