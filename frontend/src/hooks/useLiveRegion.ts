/**
 * useLiveRegion hook
 * Provides aria-live region for screen reader announcements
 */

import { useRef, useCallback } from 'react';

export function useLiveRegion() {
  const regionRef = useRef<HTMLDivElement>(null);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (regionRef.current) {
      regionRef.current.setAttribute('aria-live', priority);
      regionRef.current.textContent = message;
      
      // Clear after announcement
      setTimeout(() => {
        if (regionRef.current) {
          regionRef.current.textContent = '';
        }
      }, 1000);
    }
  }, []);

  return {
    announce,
    props: {
      ref: regionRef,
      role: 'status',
      'aria-live': 'polite',
      'aria-atomic': 'true',
      className: 'sr-only',
    } as const,
  };
}

