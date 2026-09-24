import { describe, it, expect, afterEach, vi } from 'vitest';
import { resolveLlmRoleConfig, describeLlmConfig } from './llm-config';
import { chatCompletion, openRouterEndpoint, parseJsonContent } from '../services/runtime/openai-compatible';
import { OpenRouterLlmProvider } from '../services/runtime/llm.provider';

const noMock = { ENABLE_MOCK_AI: undefined, USE_MOCK_LLM: undefined };

describe('resolveLlmRoleConfig', () => {
  afterEach(() => { delete process.env.ENABLE_MOCK_AI; });

  it('ENABLE_MOCK_AI forces every role to mock', () => {
    process.env.ENABLE_MOCK_AI = 'true';
    const cfg = describeLlmConfig({ LLM_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'k' });
    expect(Object.values(cfg).every((c) => c.provider === 'mock')).toBe(true);
  });

  it('global provider applies to all roles with provider default model', () => {
    const cfg = describeLlmConfig({ ...noMock, LLM_PROVIDER: 'openrouter' });
    expect(cfg.director).toEqual({ provider: 'openrouter', model: 'openrouter/free' });
    expect(cfg.narrator.provider).toBe('openrouter');
    expect(cfg.genesis.provider).toBe('openrouter');
  });

  it('configures provider and model per role independently', () => {
    const env = {
      ...noMock,
      LLM_PROVIDER: 'openrouter',
      DIRECTOR_LLM_PROVIDER: 'openai', DIRECTOR_LLM_MODEL: 'gpt-4o-mini',
      NARRATOR_LLM_MODEL: 'openrouter/some-model:free',
      GENESIS_LLM_PROVIDER: 'mock',
    };
    expect(resolveLlmRoleConfig('director', env)).toMatchObject({ provider: 'openai', model: 'gpt-4o-mini' });
    expect(resolveLlmRoleConfig('narrator', env)).toMatchObject({ provider: 'openrouter', model: 'openrouter/some-model:free' });
    expect(resolveLlmRoleConfig('genesis', env)).toMatchObject({ provider: 'mock' });
  });

  it('a global LLM_MODEL is not inherited by a role pinned to a different provider', () => {
    const env = { ...noMock, LLM_PROVIDER: 'openrouter', LLM_MODEL: 'x/y:free', DIRECTOR_LLM_PROVIDER: 'openai' };
    expect(resolveLlmRoleConfig('director', env).model).toBe('gpt-4o-mini');
    expect(resolveLlmRoleConfig('narrator', env).model).toBe('x/y:free');
  });

  it('auto-selects from available keys and flags an unconfigured mock', () => {
    expect(resolveLlmRoleConfig('director', { ...noMock, OPENAI_API_KEY: 'a' }).provider).toBe('openai');
    expect(resolveLlmRoleConfig('director', { ...noMock, OPENROUTER_API_KEY: 'b' }).provider).toBe('openrouter');
    expect(resolveLlmRoleConfig('director', { ...noMock })).toMatchObject({ provider: 'mock', unconfigured: true });
  });

  it('rejects an unknown provider', () => {
    expect(() => resolveLlmRoleConfig('director', { ...noMock, DIRECTOR_LLM_PROVIDER: 'bard' })).toThrow(/DIRECTOR_LLM_PROVIDER/);
  });
});

describe('OpenRouter client', () => {
  afterEach(() => vi.restoreAllMocks());

  it('posts to the OpenRouter OpenAI-compatible endpoint with bearer auth and json mode', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{"a":1}' } }] }) });
    vi.stubGlobal('fetch', fetchMock);
    const out = await chatCompletion(openRouterEndpoint('sk-or-test', 'openrouter/free'), 'sys', 'user', { jsonMode: true });
    expect(out).toBe('{"a":1}');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer sk-or-test');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('openrouter/free');
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('retries without response_format when the routed model rejects it', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'response_format unsupported' })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }) });
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OpenRouterLlmProvider('sk-or-test');
    await expect(provider.generateJson('sys', 'user')).resolves.toEqual({ ok: true });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).response_format).toBeUndefined();
  });

  it('surfaces a 200-with-error envelope as an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ error: { code: 429, message: 'rate limited upstream' } }) }));
    await expect(chatCompletion(openRouterEndpoint('k', 'm'), 's', 'u')).rejects.toThrow(/429/);
  });

  it('throws naming OPENROUTER_API_KEY when the key is missing', async () => {
    delete process.env.OPENROUTER_API_KEY;
    await expect(new OpenRouterLlmProvider().generateJson('s', 'u')).rejects.toThrow(/OPENROUTER_API_KEY/);
  });
});

describe('parseJsonContent', () => {
  it('handles fenced and prose-wrapped JSON', () => {
    expect(parseJsonContent('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonContent('Sure! Here you go:\n{"a":{"b":2}}\nHope that helps')).toEqual({ a: { b: 2 } });
    expect(() => parseJsonContent('no json here')).toThrow(/valid JSON/);
  });
});
