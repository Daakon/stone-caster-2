/**
 * Feature Toggle Configuration
 * 
 * Centralized feature flags for enabling/disabling new features.
 * Can be controlled via environment variables or hardcoded for development.
 */

/**
 * Feature flag for Chimera V2 system
 * 
 * When enabled:
 * - Routes to new Chimera components (Studio, Entity Editor, etc.)
 * - Shows new UI elements and workflows
 * 
 * When disabled:
 * - Uses legacy components and routes
 * - Maintains backward compatibility
 */
export const isChimeraEnabled: boolean =
  import.meta.env.VITE_CHIMERA_ENABLED === 'true' ||
  import.meta.env.VITE_CHIMERA_ENABLED === '1' ||
  // Default to true for development
  import.meta.env.DEV ||
  true; // Hardcoded to true for now

/**
 * Feature flags object for easy access
 */
export const features = {
  chimera: isChimeraEnabled,
} as const;

