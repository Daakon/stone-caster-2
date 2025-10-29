import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export type FilterValue = string | string[] | undefined;

export interface UseURLFiltersOptions {
  debounceMs?: number;
}

export interface UseURLFiltersReturn<T extends Record<string, FilterValue>> {
  filters: T;
  updateFilters: (patch: Partial<T>) => void;
  reset: () => void;
}

/**
 * Hook for managing URL-based filters with debounced search support
 * 
 * @param defaults - Default filter values
 * @param options - Configuration options including debounce timing
 * @returns Object with current filters, update function, and reset function
 */
export function useURLFilters<T extends Record<string, FilterValue>>(
  defaults: T,
  options: UseURLFiltersOptions = {}
): UseURLFiltersReturn<T> {
  const { debounceMs = 300 } = options;
  const location = useLocation();
  const navigate = useNavigate();
  
  // Parse URL search params into filter object
  const parseURLParams = useCallback((): T => {
    const searchParams = new URLSearchParams(location.search);
    const parsed: Partial<T> = {};
    
    for (const [key, defaultValue] of Object.entries(defaults)) {
      const urlValue = searchParams.getAll(key);
      
      if (urlValue.length === 0) {
        parsed[key as keyof T] = defaultValue;
      } else if (urlValue.length === 1) {
        parsed[key as keyof T] = urlValue[0] as T[keyof T];
      } else {
        // Multiple values for array fields
        parsed[key as keyof T] = urlValue as T[keyof T];
      }
    }
    
    return { ...defaults, ...parsed } as T;
  }, [location.search, defaults]);
  
  // Initialize filters from URL
  const [filters, setFilters] = useState<T>(parseURLParams);
  
  // Debounce timer for search queries
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Update URL with new filter values
  const updateURL = useCallback((newFilters: T) => {
    const searchParams = new URLSearchParams();
    
    for (const [key, value] of Object.entries(newFilters)) {
      if (value === undefined || value === '') {
        continue;
      }
      
      if (Array.isArray(value)) {
        // Sort and deduplicate arrays for stable query keys
        const sortedUnique = [...new Set(value)].sort();
        sortedUnique.forEach(item => {
          if (item && item.trim()) {
            searchParams.append(key, item.trim());
          }
        });
      } else if (value && value.trim()) {
        searchParams.set(key, value.trim());
      }
    }
    
    const newSearch = searchParams.toString();
    const newURL = `${location.pathname}${newSearch ? `?${newSearch}` : ''}`;
    
    if (newURL !== location.pathname + location.search) {
      navigate(newURL, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);
  
  // Update filters with optional debouncing for search queries
  const updateFilters = useCallback((patch: Partial<T>) => {
    const newFilters = { ...filters, ...patch };
    setFilters(newFilters);
    
    // Check if this is a search query update that needs debouncing
    const hasSearchUpdate = 'q' in patch && patch.q !== filters.q;
    
    if (hasSearchUpdate && debounceMs > 0) {
      // Clear existing timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      
      // Set new debounced timer
      const timer = setTimeout(() => {
        updateURL(newFilters);
      }, debounceMs);
      
      setDebounceTimer(timer);
    } else {
      // Update immediately for non-search changes
      updateURL(newFilters);
    }
  }, [filters, debounceMs, debounceTimer, updateURL]);
  
  // Reset filters to defaults
  const reset = useCallback(() => {
    setFilters(defaults);
    updateURL(defaults);
  }, [defaults, updateURL]);
  
  // Update filters when URL changes (e.g., browser back/forward)
  useEffect(() => {
    const newFilters = parseURLParams();
    setFilters(newFilters);
  }, [parseURLParams]);
  
  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);
  
  return {
    filters,
    updateFilters,
    reset
  };
}
