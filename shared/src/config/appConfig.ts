/**
 * Environment-aware application configuration
 * Validates required env vars and provides safe access to base URLs
 * 
 * Supports both frontend (Vite/Vite import.meta.env) and backend (Node process.env) runtimes
 */

export interface AppConfig {
  webBaseUrl: string;
  apiBaseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  nodeEnv: string;
  isProduction: boolean;
}

/**
 * Runtime detection helper
 */
function isNodeRuntime(): boolean {
  return typeof process !== 'undefined' && typeof process.env !== 'undefined';
}

function isViteRuntime(): boolean {
  return typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined';
}

/**
 * Get environment variable from appropriate runtime
 */
function getEnvVar(key: string): string | undefined {
  if (isNodeRuntime()) {
    return process.env[key];
  }
  if (isViteRuntime()) {
    // Vite env vars are prefixed with VITE_
    const viteKey = key.startsWith('VITE_') ? key : `VITE_${key}`;
    // Access import.meta.env - Vite replaces these at build time
    // Type assertion needed because TypeScript doesn't know about all VITE_* vars
    const env = import.meta.env as Record<string, string | undefined>;
    const value = env[viteKey];
    // Return as string if it exists and is truthy, undefined otherwise
    return value && typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
  }
  throw new Error(`Unable to determine runtime environment`);
}

/**
 * Validate URL format
 */
function validateUrl(url: string, name: string, allowLocalhost: boolean): void {
  try {
    const parsed = new URL(url);
    if (!allowLocalhost && parsed.hostname === 'localhost') {
      throw new Error(`${name} must not be localhost in production`);
    }
    if (parsed.protocol !== 'https:' && !allowLocalhost) {
      throw new Error(`${name} must use https:// in production`);
    }
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`${name} is not a valid URL: ${url}`);
    }
    throw error;
  }
}

/**
 * Load and validate configuration
 */
export function loadAppConfig(): AppConfig {
  const nodeEnv = isNodeRuntime() 
    ? (process.env.NODE_ENV || 'development')
    : (import.meta.env.MODE || 'development');
  
  const isProduction = nodeEnv === 'production';

  // Frontend reads from VITE_* vars, backend from regular vars
  const webBaseUrlKey = isViteRuntime() ? 'VITE_WEB_BASE_URL' : 'WEB_BASE_URL';
  const apiBaseUrlKey = isViteRuntime() ? 'VITE_API_BASE_URL' : 'API_BASE_URL';
  const supabaseUrlKey = isViteRuntime() ? 'VITE_SUPABASE_URL' : 'SUPABASE_URL';
  const supabaseAnonKeyKey = isViteRuntime() ? 'VITE_SUPABASE_ANON_KEY' : 'SUPABASE_ANON_KEY';

  // Get env vars - try getEnvVar first, then direct access for Vite
  let webBaseUrl = getEnvVar(webBaseUrlKey);
  let apiBaseUrl = getEnvVar(apiBaseUrlKey);
  let supabaseUrl = getEnvVar(supabaseUrlKey);
  let supabaseAnonKey = getEnvVar(supabaseAnonKeyKey);
  
  // For Vite runtime, also try direct import.meta.env access as fallback
  // (getEnvVar might not work if Vite hasn't processed the .env file yet)
  if (isViteRuntime()) {
    const env = import.meta.env as Record<string, string | undefined>;
    if (!webBaseUrl) webBaseUrl = env.VITE_WEB_BASE_URL;
    if (!apiBaseUrl) apiBaseUrl = env.VITE_API_BASE_URL;
    if (!supabaseUrl) supabaseUrl = env.VITE_SUPABASE_URL;
    if (!supabaseAnonKey) {
      supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
    }
  }
  
  // Provide development defaults if not in production
  if (!isProduction) {
    // Try to infer webBaseUrl from window.location if in browser
    if (!webBaseUrl && typeof window !== 'undefined' && window.location) {
      webBaseUrl = `${window.location.protocol}//${window.location.host}`;
    } else if (!webBaseUrl) {
      webBaseUrl = 'http://localhost:5173';
    }
    
    if (!apiBaseUrl) {
      apiBaseUrl = 'http://localhost:3000';
    }
    
    // Only warn if still missing after all fallbacks
    if (!supabaseUrl) {
      console.warn(
        `[appConfig] ${supabaseUrlKey} not set. OAuth will not work.\n` +
        `Please create a .env file in the frontend directory with:\n` +
        `${supabaseUrlKey}=https://<your-project-ref>.supabase.co\n` +
        `Note: Restart the Vite dev server after adding .env variables.`
      );
      supabaseUrl = 'https://placeholder.supabase.co';
    }
    if (!supabaseAnonKey) {
      console.warn(
        `[appConfig] ${supabaseAnonKeyKey} not set. OAuth will not work.\n` +
        `Please create a .env file in the frontend directory with:\n` +
        `${supabaseAnonKeyKey}=<your-anon-key>\n` +
        `Note: Restart the Vite dev server after adding .env variables.`
      );
      supabaseAnonKey = 'placeholder-anon-key';
    }
  }
  
  // Debug: Log what we found (only in development)
  if (!isProduction && isViteRuntime()) {
    console.debug('[appConfig] Environment check:', {
      webBaseUrlKey,
      webBaseUrl: webBaseUrl || '(not set)',
      apiBaseUrlKey,
      apiBaseUrl: apiBaseUrl || '(not set)',
      supabaseUrlKey,
      supabaseUrl: supabaseUrl && supabaseUrl !== 'https://placeholder.supabase.co' ? '***set***' : '(not set)',
      supabaseAnonKeyKey,
      supabaseAnonKey: supabaseAnonKey && supabaseAnonKey !== 'placeholder-anon-key' ? '***set***' : '(not set)',
    });
  }

  // Validate required vars (strict in production)
  const missing: string[] = [];
  if (!webBaseUrl) missing.push(webBaseUrlKey);
  if (!apiBaseUrl) missing.push(apiBaseUrlKey);
  if (!supabaseUrl) missing.push(supabaseUrlKey);
  if (!supabaseAnonKey) missing.push(supabaseAnonKeyKey);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Please set these in your .env file or environment configuration.\n` +
      `For development, you can use defaults, but Supabase vars are still required.`
    );
  }

  // Validate URLs
  validateUrl(webBaseUrl, webBaseUrlKey, !isProduction);
  validateUrl(apiBaseUrl, apiBaseUrlKey, !isProduction);
  validateUrl(supabaseUrl, supabaseUrlKey, !isProduction);

  return {
    webBaseUrl,
    apiBaseUrl,
    supabaseUrl,
    supabaseAnonKey,
    nodeEnv,
    isProduction,
  };
}

/**
 * Get web base URL helper
 */
export function getWebBaseUrl(): string {
  const config = loadAppConfig();
  return config.webBaseUrl;
}

/**
 * Get API base URL helper
 */
export function getApiBaseUrl(): string {
  const config = loadAppConfig();
  return config.apiBaseUrl;
}

// Export singleton instance
let configInstance: AppConfig | null = null;

export function getAppConfig(): AppConfig {
  if (!configInstance) {
    configInstance = loadAppConfig();
  }
  return configInstance;
}

