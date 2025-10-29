/**
 * HTTP client with active-only content enforcement
 * Automatically appends activeOnly=1 to catalog list endpoints
 */

import { apiGet, apiPost, apiPut, apiPatch, apiDelete, type AppError } from './api';
import { PUBLIC_API_MODE } from './env';

export interface ListParamsBase {
  q?: string;
}

export interface ListStoriesParams extends ListParamsBase {
  world?: string;
  kind?: 'scenario' | 'adventure';
  ruleset?: string;
  tags?: string[];
}

export interface ListNPCsParams extends ListParamsBase {
  world?: string;
}

/**
 * Builds URL with activeOnly=1 for catalog endpoints
 */
export function buildURL(path: string, params?: Record<string, any>): string {
  const url = new URL(path, window.location.origin);

  // Add activeOnly=1 for catalog list endpoints only (not detail endpoints) in public mode
  if (PUBLIC_API_MODE && path.includes('/catalog/') && !path.match(/\/catalog\/\w+\/[^/]+$/)) {
    url.searchParams.set('activeOnly', '1');
  }
  
  // Add other parameters
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          // Handle array parameters (e.g., tags)
          value.forEach(item => url.searchParams.append(key, String(item)));
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    });
  }
  
  return url.pathname + url.search;
}

// Re-export existing API methods for non-catalog endpoints
export { apiGet, apiPost, apiPut, apiPatch, apiDelete, type AppError };

// Catalog-specific methods with activeOnly=1 enforcement
export async function httpGet<T = unknown>(
  path: string,
  params?: Record<string, any>
): Promise<{ ok: true; data: T } | { ok: false; error: AppError }> {
  const url = buildURL(path, params);
  return apiGet<T>(url);
}

export async function httpPost<T = unknown>(
  path: string,
  body?: unknown,
  params?: Record<string, any>
): Promise<{ ok: true; data: T } | { ok: false; error: AppError }> {
  const url = buildURL(path, params);
  return apiPost<T>(url, body);
}

export async function httpPut<T = unknown>(
  path: string,
  body?: unknown,
  params?: Record<string, any>
): Promise<{ ok: true; data: T } | { ok: false; error: AppError }> {
  const url = buildURL(path, params);
  return apiPut<T>(url, body);
}

export async function httpPatch<T = unknown>(
  path: string,
  body?: unknown,
  params?: Record<string, any>
): Promise<{ ok: true; data: T } | { ok: false; error: AppError }> {
  const url = buildURL(path, params);
  return apiPatch<T>(url, body);
}

export async function httpDelete<T = unknown>(
  path: string,
  params?: Record<string, any>
): Promise<{ ok: true; data: T } | { ok: false; error: AppError }> {
  const url = buildURL(path, params);
  return apiDelete<T>(url);
}
