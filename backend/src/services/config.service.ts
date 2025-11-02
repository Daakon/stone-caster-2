import '../config/load-env.js';
import { createHash } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface PricingConfig {
  turnCostDefault: number;
  turnCostByWorld: Record<string, number>;
  guestStarterCastingStones: number;
  guestDailyRegen: number;
  conversionRates: { shard: number; crystal: number; relic: number };
}

export interface AiRuntimeConfig {
  activeModel: string;
  promptSchemaVersion: string;
  maxTokensIn: number;
  maxTokensOut: number;
  requirePromptApproval: boolean;
}

export interface AppRuntimeConfig {
  cookieTtlDays: number;
  idempotencyRequired: boolean;
  allowAsyncTurnFallback: boolean;
  telemetrySampleRate: number;
  drifterEnabled: boolean;
}

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  payload: Record<string, unknown>;
}

export interface PublicConfigDTO {
  etag: string;
  pricing: Pick<PricingConfig, 'turnCostDefault' | 'turnCostByWorld' | 'conversionRates'>;
  features: FeatureFlag[];
  ai: Pick<AiRuntimeConfig, 'promptSchemaVersion'>;
  app: Pick<AppRuntimeConfig, 'drifterEnabled'>;
}

export interface ConfigService {
  getEtag(): string;
  getPricing(): PricingConfig;
  getAi(): AiRuntimeConfig;
  getApp(): AppRuntimeConfig;
  getFeatures(): FeatureFlag[];
  toPublicDTO(): PublicConfigDTO;
  refreshNow(): Promise<void>;
}

interface EnvConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceKey: string;
  openaiApiKey: string;
  primaryAiModel: string;
  promptModelDefault: string; // PROMPT_MODEL_DEFAULT
  sessionSecret: string;
  nodeEnv: string;
  port: number;
  corsOrigin: string;
  anthropicApiKey: string | null;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  frontendUrl: string;
  apiUrl: string;
  awfBundleOn: boolean;
  debugRoutesEnabled: boolean; // DEBUG_ROUTES_ENABLED
  debugRoutesToken: string | null; // DEBUG_ROUTES_TOKEN
  legacyPromptsEnabled: boolean; // LEGACY_PROMPTS_ENABLED
  legacyPromptsSunset: string | null; // LEGACY_PROMPTS_SUNSET (ISO date string)
  debugResponseEnabled: boolean; // DEBUG_RESPONSE_ENABLED
  debugResponseMaxChars: number; // DEBUG_RESPONSE_MAX_CHARS
  debugResponseIncludeAiRaw: boolean; // DEBUG_RESPONSE_INCLUDE_AI_RAW (default false)
}

interface ConfigSnapshot {
  pricing: PricingConfig;
  ai: AiRuntimeConfig;
  app: AppRuntimeConfig;
  features: FeatureFlag[];
  meta: { version: number };
}

type Logger = Pick<typeof console, 'info' | 'warn' | 'error' | 'debug'>;

interface ConfigServiceOptions {
  env?: NodeJS.ProcessEnv;
  adminClient?: SupabaseClient;
  pollIntervalMs?: number;
  logger?: Logger;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
}

type ConfigRow = { key: string; value: { value: unknown } };
type FeatureRow = { key: string; enabled: unknown; payload: unknown };
type ConfigMetaRow = { version?: unknown };

const DEFAULT_POLL_INTERVAL_MS = 15_000;

class ConfigServiceImpl implements ConfigService {
  private readonly logger: Logger;
  private readonly pollIntervalMs: number;
  private readonly setIntervalFn: typeof setInterval;
  private readonly clearIntervalFn: typeof clearInterval;
  private readonly adminClient: SupabaseClient;

  private env: EnvConfig;
  private config: ConfigSnapshot | null = null;
  private etag = '';
  private lastVersion = 0;
  private pollTimer: NodeJS.Timeout | null = null;
  private loadingPromise: Promise<void> | null = null;
  private readyPromise: Promise<void>;

  constructor(options: ConfigServiceOptions = {}) {
    this.logger = options.logger ?? console;
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.setIntervalFn = options.setIntervalFn ?? setInterval;
    this.clearIntervalFn = options.clearIntervalFn ?? clearInterval;

    this.env = this.loadEnv(options.env);
    this.adminClient = options.adminClient ?? createClient(
      this.env.supabaseUrl,
      this.env.supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    this.readyPromise = this.loadConfig();
    this.startPolling();
  }

  public getEtag(): string {
    this.requireConfig();
    return this.etag;
  }

  public getPricing(): PricingConfig {
    const snapshot = this.requireConfig();
    return {
      turnCostDefault: snapshot.pricing.turnCostDefault,
      turnCostByWorld: { ...snapshot.pricing.turnCostByWorld },
      guestStarterCastingStones: snapshot.pricing.guestStarterCastingStones,
      guestDailyRegen: snapshot.pricing.guestDailyRegen,
      conversionRates: { ...snapshot.pricing.conversionRates },
    };
  }

  public getAi(): AiRuntimeConfig {
    const snapshot = this.requireConfig();
    return { ...snapshot.ai };
  }

  public getApp(): AppRuntimeConfig {
    const snapshot = this.requireConfig();
    return { ...snapshot.app };
  }

  public getFeatures(): FeatureFlag[] {
    const snapshot = this.requireConfig();
    return snapshot.features.map(flag => ({
      key: flag.key,
      enabled: flag.enabled,
      payload: { ...flag.payload },
    }));
  }

  public toPublicDTO(): PublicConfigDTO {
    const snapshot = this.requireConfig();
    return {
      etag: this.etag,
      pricing: {
        turnCostDefault: snapshot.pricing.turnCostDefault,
        turnCostByWorld: { ...snapshot.pricing.turnCostByWorld },
        conversionRates: { ...snapshot.pricing.conversionRates },
      },
      features: snapshot.features.map(flag => ({
        key: flag.key,
        enabled: flag.enabled,
        payload: { ...flag.payload },
      })),
      ai: { promptSchemaVersion: snapshot.ai.promptSchemaVersion },
      app: { drifterEnabled: snapshot.app.drifterEnabled },
    };
  }

  public async refreshNow(): Promise<void> {
    return this.loadConfig();
  }

  public getEnv(): EnvConfig {
    return { ...this.env };
  }

  public getAwfBundleEnabled(): boolean {
    return this.env.awfBundleOn;
  }

  public whenReady(): Promise<void> {
    return this.readyPromise;
  }

  public destroy(): void {
    if (this.pollTimer) {
      this.clearIntervalFn(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private requireConfig(): ConfigSnapshot {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }
    return this.config;
  }

  private loadEnv(envSource?: NodeJS.ProcessEnv): EnvConfig {
    const source = envSource ?? process.env;
    const serviceKey = source.SUPABASE_SERVICE_KEY ?? source.SUPABASE_SERVICE_ROLE_KEY;
    
    // Use PROD_ prefixed variables for production, fallback to regular variables for development
    const supabaseUrl = source.PROD_SUPABASE_URL || source.SUPABASE_URL || 'http://localhost:54321';
    const supabaseAnonKey = source.PROD_SUPABASE_ANON_KEY || source.SUPABASE_ANON_KEY || 'anon-local';
    const supabaseServiceKey = source.PROD_SUPABASE_SERVICE_KEY || serviceKey || 'service-local';
    const openaiApiKey = source.OPENAI_API_KEY || 'openai-local';
    const primaryAiModel = source.PRIMARY_AI_MODEL || 'gpt-4';
    const promptModelDefault = source.PROMPT_MODEL_DEFAULT || 'gpt-4o-mini';
    const sessionSecret = source.SESSION_SECRET || 'dev-session-secret';
    const debugRoutesEnabled = source.DEBUG_ROUTES_ENABLED === 'true';
    const debugRoutesToken = source.DEBUG_ROUTES_TOKEN || null;
    const legacyPromptsEnabled = source.LEGACY_PROMPTS_ENABLED === 'true';
    const legacyPromptsSunset = source.LEGACY_PROMPTS_SUNSET || null;
    const debugResponseEnabled = source.DEBUG_RESPONSE_ENABLED === 'true';
    const debugResponseMaxChars = Number.parseInt(source.DEBUG_RESPONSE_MAX_CHARS ?? '50000', 10);
    const debugResponseIncludeAiRaw = source.DEBUG_RESPONSE_INCLUDE_AI_RAW === 'true';
    
    // Only throw error for truly required variables in production
    if (source.NODE_ENV === 'production') {
      const required: Array<[string, string | undefined]> = [
        ['SUPABASE_URL', supabaseUrl],
        ['SUPABASE_SERVICE_KEY', supabaseServiceKey],
        ['SUPABASE_ANON_KEY', supabaseAnonKey],
        ['OPENAI_API_KEY', openaiApiKey],
        ['PRIMARY_AI_MODEL', primaryAiModel],
        ['SESSION_SECRET', sessionSecret],
      ];
      const missing = required.filter(([, value]) => !value || value.includes('-local')).map(([key]) => key);
      if (missing.length > 0) {
        throw new Error(`Missing required environment variables in production: ${missing.join(', ')}`);
      }
    }

    const port = Number.parseInt(source.PORT ?? '3000', 10);
    if (!Number.isFinite(port) || port <= 0) {
      throw new Error(`Invalid PORT value: ${source.PORT}`);
    }

    return {
      supabaseUrl,
      supabaseAnonKey,
      supabaseServiceKey,
      openaiApiKey,
      primaryAiModel,
      promptModelDefault,
      sessionSecret,
      nodeEnv: source.NODE_ENV ?? 'development',
      port,
      corsOrigin: source.CORS_ORIGIN ?? 'http://localhost:5173',
      anthropicApiKey: source.ANTHROPIC_API_KEY ?? null,
      stripeSecretKey: source.STRIPE_SECRET_KEY || 'sk_test_local_dev_key',
      stripeWebhookSecret: source.STRIPE_WEBHOOK_SECRET || 'whsec_local_dev_secret',
      frontendUrl: source.FRONTEND_URL ?? 'http://localhost:5173',
      apiUrl: source.API_URL ?? 'http://localhost:3000',
      awfBundleOn: source.AWF_BUNDLE_ON === 'true' || source.AWF_BUNDLE_ON === '1',
      debugRoutesEnabled,
      debugRoutesToken,
      legacyPromptsEnabled,
      legacyPromptsSunset,
      debugResponseEnabled,
      debugResponseMaxChars,
      debugResponseIncludeAiRaw,
    };
  }

  private loadConfig(): Promise<void> {
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    const loadOperation = (async () => {
      try {
        const [pricingRes, aiRes, appRes, featuresRes, metaRes] = await Promise.all([
          this.adminClient.from('pricing_config').select('*'),
          this.adminClient.from('ai_config').select('*'),
          this.adminClient.from('app_config').select('*'),
          this.adminClient.from('feature_flags').select('*'),
          this.adminClient.from('config_meta').select('version').single(),
        ]);

        this.assertNoError('pricing_config', pricingRes.error);
        this.assertNoError('ai_config', aiRes.error);
        this.assertNoError('app_config', appRes.error);
        this.assertNoError('feature_flags', featuresRes.error);
        this.assertNoError('config_meta', metaRes.error);

        const pricing = this.buildPricingConfig((pricingRes.data ?? []) as ConfigRow[]);
        const ai = this.buildAiConfig((aiRes.data ?? []) as ConfigRow[]);
        const app = this.buildAppConfig((appRes.data ?? []) as ConfigRow[]);
        const features = this.buildFeatureFlags((featuresRes.data ?? []) as FeatureRow[]);

        const meta = (metaRes.data ?? {}) as ConfigMetaRow;
        const version = this.parseNumber(meta.version);
        if (version === null) {
          throw new Error('Invalid configuration version');
        }

        const snapshot: ConfigSnapshot = {
          pricing,
          ai,
          app,
          features,
          meta: { version },
        };

        this.config = snapshot;
        this.lastVersion = version;
        this.etag = this.computeEtag(snapshot);
        
        this.logger.info('[config] Configuration loaded successfully from Supabase');
      } catch (error) {
        // If Supabase is not available (e.g., local development), use default configuration
        if (this.isSupabaseUnavailable(error)) {
          this.logger.warn('[config] Supabase unavailable, using default configuration for local development');
          this.loadDefaultConfig();
        } else {
          throw error;
        }
      }
    })();

    this.loadingPromise = loadOperation
      .catch(error => {
        this.logger.error('[config] Failed to load configuration', error);
        throw new Error('Failed to load configuration');
      })
      .finally(() => {
        this.loadingPromise = null;
      });

    this.readyPromise = this.loadingPromise;
    return this.loadingPromise;
  }

  private startPolling(): void {
    if (this.pollIntervalMs <= 0) {
      return;
    }

    this.pollTimer = this.setIntervalFn(async () => {
      try {
        const { data, error } = await this.adminClient
          .from('config_meta')
          .select('version')
          .single();

        if (error) {
          // If Supabase is unavailable, don't spam error logs
          if (this.isSupabaseUnavailable(error)) {
            this.logger.debug('[config] Supabase unavailable during polling, skipping');
            return;
          }
          this.logger.error('[config] Failed to poll configuration version', error);
          return;
        }

        const version = this.parseNumber((data as ConfigMetaRow | null)?.version);
        if (version === null) {
          this.logger.warn('[config] Received invalid configuration version during polling');
          return;
        }

        if (!this.config || version !== this.lastVersion) {
          if (this.config) {
            this.logger.info(`[config] Detected configuration version change ${this.lastVersion} -> ${version}`);
          }
          await this.loadConfig();
        }
      } catch (error) {
        // If Supabase is unavailable, don't spam error logs
        if (this.isSupabaseUnavailable(error)) {
          this.logger.debug('[config] Supabase unavailable during polling, skipping');
          return;
        }
        this.logger.error('[config] Error while polling configuration', error);
      }
    }, this.pollIntervalMs);
  }

  private buildPricingConfig(rows: ConfigRow[]): PricingConfig {
    return {
      turnCostDefault: this.getConfigValue(rows, 'turn_cost_default', value => this.parseNumber(value), 2),
      turnCostByWorld: this.getConfigValue(rows, 'turn_cost_by_world', value => this.parseNumberRecord(value), {}),
      guestStarterCastingStones: this.getConfigValue(rows, 'guest_starter_casting_stones', value => this.parseNumber(value), 15),
      guestDailyRegen: this.getConfigValue(rows, 'guest_daily_regen', value => this.parseNumber(value), 0),
      conversionRates: this.getConfigValue(rows, 'conversion_rates', value => this.parseConversionRates(value), {
        shard: 10,
        crystal: 100,
        relic: 500,
      }),
    };
  }

  private buildAiConfig(rows: ConfigRow[]): AiRuntimeConfig {
    const storedModel = this.getConfigValue(rows, 'active_model', value => this.parseString(value), this.env.primaryAiModel);
    const activeModel = storedModel === 'PRIMARY_AI_MODEL' ? this.env.primaryAiModel : storedModel;

    return {
      activeModel,
      promptSchemaVersion: this.getConfigValue(rows, 'prompt_schema_version', value => this.parseString(value), '1.0.0'),
      maxTokensIn: this.getConfigValue(rows, 'max_tokens_in', value => this.parseNumber(value), 4096),
      maxTokensOut: this.getConfigValue(rows, 'max_tokens_out', value => this.parseNumber(value), 1024),
      requirePromptApproval: this.getConfigValue(rows, 'require_prompt_approval', value => this.parseBoolean(value), true),
    };
  }

  private buildAppConfig(rows: ConfigRow[]): AppRuntimeConfig {
    return {
      cookieTtlDays: this.getConfigValue(rows, 'cookie_ttl_days', value => this.parseNumber(value), 60),
      idempotencyRequired: this.getConfigValue(rows, 'idempotency_required', value => this.parseBoolean(value), true),
      allowAsyncTurnFallback: this.getConfigValue(rows, 'allow_async_turn_fallback', value => this.parseBoolean(value), true),
      telemetrySampleRate: this.getConfigValue(rows, 'telemetry_sample_rate', value => this.parseNumber(value), 1.0),
      drifterEnabled: this.getConfigValue(rows, 'drifter_enabled', value => this.parseBoolean(value), true),
    };
  }

  private buildFeatureFlags(rows: FeatureRow[]): FeatureFlag[] {
    return rows
      .map(row => ({
        key: String(row.key),
        enabled: Boolean(row.enabled),
        payload: this.parseRecord(row.payload) ?? {},
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }

  private getConfigValue<T>(rows: ConfigRow[], key: string, parser: (value: unknown) => T | null, defaultValue: T): T {
    const entry = rows.find(row => row.key === key);
    if (!entry) {
      this.logger.warn(`[config] Missing key '${key}', using default`);
      return defaultValue;
    }

    try {
      const parsed = parser(entry.value?.value);
      if (parsed === null) {
        this.logger.warn(`[config] Invalid value for key '${key}', using default`);
        return defaultValue;
      }
      return parsed;
    } catch (error) {
      this.logger.warn(`[config] Failed to parse key '${key}', using default`, error as Error);
      return defaultValue;
    }
  }

  private parseNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  }

  private parseBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true') return true;
      if (lower === 'false') return false;
    }
    return null;
  }

  private parseString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
  }

  private parseRecord(value: unknown): Record<string, unknown> | null {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return { ...(value as Record<string, unknown>) };
    }
    return null;
  }

  private parseNumberRecord(value: unknown): Record<string, number> | null {
    const record = this.parseRecord(value);
    if (!record) {
      return null;
    }

    const result: Record<string, number> = {};
    for (const [key, raw] of Object.entries(record)) {
      const parsed = this.parseNumber(raw);
      if (parsed !== null) {
        result[key] = parsed;
      }
    }
    return result;
  }

  private parseConversionRates(value: unknown): { shard: number; crystal: number; relic: number } | null {
    const record = this.parseRecord(value);
    if (!record) {
      return null;
    }

    const shard = this.parseNumber(record.shard);
    const crystal = this.parseNumber(record.crystal);
    const relic = this.parseNumber(record.relic);

    if (shard === null || crystal === null || relic === null) {
      return null;
    }

    return { shard, crystal, relic };
  }

  private computeEtag(snapshot: ConfigSnapshot): string {
    const normalized = this.sortValue({
      pricing: snapshot.pricing,
      ai: snapshot.ai,
      app: snapshot.app,
      features: snapshot.features,
      version: snapshot.meta.version,
    });

    return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  }

  private sortValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map(item => this.sortValue(item));
    }

    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>)
        .map(([key, val]) => [key, this.sortValue(val)] as const)
        .sort(([a], [b]) => a.localeCompare(b));

      return entries.reduce<Record<string, unknown>>((acc, [key, val]) => {
        acc[key] = val;
        return acc;
      }, {});
    }

    return value;
  }

  private assertNoError(context: string, error: unknown): void {
    if (error) {
      throw new Error(`Failed to load ${context}: ${(error as { message?: string }).message ?? 'unknown error'}`);
    }
  }

  private isSupabaseUnavailable(error: unknown): boolean {
    const errorMessage = (error as Error)?.message?.toLowerCase() || '';
    return (
      errorMessage.includes('fetch failed') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('enotfound')
    );
  }

  private loadDefaultConfig(): void {
    const defaultSnapshot: ConfigSnapshot = {
      pricing: {
        turnCostDefault: 2,
        turnCostByWorld: {},
        guestStarterCastingStones: 15,
        guestDailyRegen: 0,
        conversionRates: {
          shard: 10,
          crystal: 100,
          relic: 500,
        },
      },
      ai: {
        activeModel: this.env.primaryAiModel,
        promptSchemaVersion: '1.0.0',
        maxTokensIn: 4096,
        maxTokensOut: 1024,
        requirePromptApproval: true,
      },
      app: {
        cookieTtlDays: 60,
        idempotencyRequired: true,
        allowAsyncTurnFallback: true,
        telemetrySampleRate: 1.0,
        drifterEnabled: true,
      },
      features: [],
      meta: { version: 1 },
    };

    this.config = defaultSnapshot;
    this.lastVersion = 1;
    this.etag = this.computeEtag(defaultSnapshot);
  }
}

export const configService = new ConfigServiceImpl();
export const configServiceReady = configService.whenReady();

export { ConfigServiceImpl };


