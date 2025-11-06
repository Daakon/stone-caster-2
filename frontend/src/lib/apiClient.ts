/**
 * In-flight request deduplication client
 * Prevents duplicate network calls for identical requests
 */

import { apiFetch, type AppError } from './api';

interface RequestOptions {
  params?: Record<string, any>;
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

interface InFlightRequest {
  promise: Promise<{ ok: true; data: any } | { ok: false; error: AppError }>;
  abortController: AbortController;
}

// Map of in-flight requests: cacheKey -> request
const inFlightRequests = new Map<string, InFlightRequest>();

/**
 * Normalize cache key from method, url, and params/body
 */
function normalizeCacheKey(
  method: string,
  url: string,
  params?: Record<string, any>,
  body?: unknown
): string {
  const parts = [method.toUpperCase(), url];
  
  // Sort and stringify params for consistent keys
  if (params) {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {} as Record<string, any>);
    parts.push(JSON.stringify(sortedParams));
  }
  
  // Stringify body if present
  if (body) {
    parts.push(JSON.stringify(body));
  }
  
  return parts.join('|');
}

/**
 * Request with in-flight deduplication
 */
export async function request<T = unknown>(
  method: string,
  url: string,
  options: RequestOptions = {}
): Promise<{ ok: true; data: T } | { ok: false; error: AppError }> {
  const { params, body, signal, headers } = options;
  
  // Create cache key
  const cacheKey = normalizeCacheKey(method, url, params, body);
  
  // Check if request is already in flight
  const existing = inFlightRequests.get(cacheKey);
  if (existing) {
    // If external signal is provided and aborted, don't return existing
    if (signal?.aborted) {
      existing.abortController.abort();
      inFlightRequests.delete(cacheKey);
    } else {
      // Return existing promise
      return existing.promise as Promise<{ ok: true; data: T } | { ok: false; error: AppError }>;
    }
  }
  
  // Create new abort controller
  const abortController = new AbortController();
  
  // Combine signals if external signal provided
  const combinedSignal = signal
    ? (() => {
        const controller = new AbortController();
        const onAbort = () => controller.abort();
        signal.addEventListener('abort', onAbort);
        abortController.signal.addEventListener('abort', onAbort);
        return controller.signal;
      })()
    : abortController.signal;
  
  // Create request promise
  const promise = (async () => {
    try {
      return await apiFetch<T>(url, {
        method,
        body: body ? JSON.stringify(body) : undefined,
        headers,
        signal: combinedSignal,
      });
    } finally {
      // Clean up when request completes
      inFlightRequests.delete(cacheKey);
    }
  })();
  
  // Store in-flight request
  inFlightRequests.set(cacheKey, {
    promise,
    abortController,
  });
  
  return promise;
}

/**
 * Convenience methods
 */
export const apiClient = {
  get: <T = unknown>(url: string, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('GET', url, options),
  
  post: <T = unknown>(url: string, options?: RequestOptions) =>
    request<T>('POST', url, options),
  
  put: <T = unknown>(url: string, options?: RequestOptions) =>
    request<T>('PUT', url, options),
  
  patch: <T = unknown>(url: string, options?: RequestOptions) =>
    request<T>('PATCH', url, options),
  
  delete: <T = unknown>(url: string, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('DELETE', url, options),
};

