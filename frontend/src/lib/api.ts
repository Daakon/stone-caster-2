import { type AppError, toAppError } from './errors';
import { supabase } from './supabase';

const BASE = (import.meta.env.VITE_API_BASE_URL ?? 'https://stonecaster-api.fly.dev').replace(
  /\/+$/,
  '',
);

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: true; data: T } | { ok: false; error: AppError }> {
  const url = `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(init.headers || {});

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Attach Supabase session token
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  } catch (error) {
    console.warn('Failed to get auth token:', error);
  }

  try {
    const resp = await fetch(url, { ...init, headers });
    const text = await resp.text();

    let json: any;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!resp.ok) {
      // Handle structured error responses
      if (json && json.error && typeof json.error === 'object') {
        const error = json.error as AppError;
        return { ok: false, error };
      }

      // Handle legacy error responses
      if (json && json.message) {
        const error = toAppError(
          resp.status,
          json.message,
          resp.status === 404
            ? 'not_found'
            : resp.status === 403
              ? 'forbidden'
              : resp.status === 401
                ? 'unauthorized'
                : resp.status === 422
                  ? 'validation_failed'
                  : 'http_error',
        );
        return { ok: false, error };
      }

      // Handle HTML/text error responses (like 404 pages)
      const error = toAppError(
        resp.status,
        resp.statusText || 'Request failed',
        resp.status === 404
          ? 'not_found'
          : resp.status === 403
            ? 'forbidden'
            : resp.status === 401
              ? 'unauthorized'
              : resp.status === 422
                ? 'validation_failed'
                : 'http_error',
      );
      return { ok: false, error };
    }

    return { ok: true, data: (json?.data ?? json ?? null) as T };
  } catch (e: any) {
    const error = toAppError(0, e?.message || 'Network error', 'network_error');
    return { ok: false, error };
  }
}

// Convenience methods
export async function apiGet<T = unknown>(
  path: string,
): Promise<{ ok: true; data: T } | { ok: false; error: AppError }> {
  return apiFetch<T>(path, { method: 'GET' });
}

export async function apiPost<T = unknown>(
  path: string,
  body?: unknown,
): Promise<{ ok: true; data: T } | { ok: false; error: AppError }> {
  return apiFetch<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function apiPut<T = unknown>(
  path: string,
  body?: unknown,
): Promise<{ ok: true; data: T } | { ok: false; error: AppError }> {
  return apiFetch<T>(path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function apiPatch<T = unknown>(
  path: string,
  body?: unknown,
): Promise<{ ok: true; data: T } | { ok: false; error: AppError }> {
  return apiFetch<T>(path, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function apiDelete<T = unknown>(
  path: string,
): Promise<{ ok: true; data: T } | { ok: false; error: AppError }> {
  return apiFetch<T>(path, { method: 'DELETE' });
}
