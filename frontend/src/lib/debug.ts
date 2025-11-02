import { useState, useEffect } from 'react';
import { useAppRoles } from '@/admin/routeGuard';

/**
 * Hook for managing debug response preferences
 * Defaults to ON for admins when VITE_DEBUG_UI_ENABLED is true
 */
export function useDebugResponses() {
  const { isAdmin, loading } = useAppRoles();
  const uiEnabled = import.meta.env.VITE_DEBUG_UI_ENABLED === 'true';
  const storageKey = 'sc.debugResponses';

  const [enabled, setEnabled] = useState<boolean>(() => {
    if (!uiEnabled || !isAdmin || loading) return false;

    const saved = localStorage.getItem(storageKey);
    return saved ? saved === 'on' : true; // default ON for admins
  });

  useEffect(() => {
    if (!uiEnabled || !isAdmin || loading) {
      setEnabled(false);
      return;
    }

    const saved = localStorage.getItem(storageKey);
    const shouldBeEnabled = saved ? saved === 'on' : true;
    setEnabled(shouldBeEnabled);
  }, [isAdmin, loading, uiEnabled]);

  // Debounce localStorage writes (250ms)
  useEffect(() => {
    if (!uiEnabled || !isAdmin || loading) return;

    const timeoutId = setTimeout(() => {
      localStorage.setItem(storageKey, enabled ? 'on' : 'off');
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [enabled, uiEnabled, isAdmin, loading, storageKey]);

  return {
    enabled,
    setEnabled,
    visible: uiEnabled && isAdmin && !loading,
  };
}

/**
 * Client-side redaction utility (belt-and-suspenders)
 * Mirrors backend redaction logic
 */
export function redactSensitiveClient(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveClient(item));
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  const redacted: any = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Check if this key should be redacted
    if (
      lowerKey.includes('apikey') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('token') ||
      lowerKey.includes('password') ||
      lowerKey.includes('authorization') ||
      lowerKey.includes('bearer') ||
      lowerKey.includes('cookie')
    ) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitiveClient(value);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

