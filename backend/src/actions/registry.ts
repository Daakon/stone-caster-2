/**
 * Action Registry
 * Central registry for validating and routing actions to reducers
 */

import { z, type ZodSchema } from 'zod';

export interface ActionRegistration {
  type: string;
  schema: ZodSchema;
  owner: string; // module.state_slice or 'core'
  applyFn: (state: any, payload: any, storyId?: string) => any | Promise<any>;
}

class ActionRegistry {
  private registry: Map<string, ActionRegistration> = new Map();
  private ownerModules: Map<string, Set<string>> = new Map(); // owner -> set of module IDs

  /**
   * Register an action type with its schema and reducer
   */
  register(
    type: string,
    schema: ZodSchema,
    owner: string,
    applyFn: (state: any, payload: any, storyId?: string) => any | Promise<any>
  ): void {
    if (this.registry.has(type)) {
      console.warn(`[ActionRegistry] Overwriting existing registration for action type: ${type}`);
    }

    this.registry.set(type, {
      type,
      schema,
      owner,
      applyFn,
    });

    // Track which modules own which state slices
    if (!this.ownerModules.has(owner)) {
      this.ownerModules.set(owner, new Set());
    }
  }

  /**
   * Get action registration by type
   */
  get(type: string): ActionRegistration | undefined {
    return this.registry.get(type);
  }

  /**
   * List all registered actions
   */
  list(): ActionRegistration[] {
    return Array.from(this.registry.values());
  }

  /**
   * Validate action payload against schema
   */
  validate(type: string, payload: unknown): { valid: boolean; error?: z.ZodError } {
    const registration = this.registry.get(type);
    if (!registration) {
      return { valid: false, error: new z.ZodError([]) };
    }

    const result = registration.schema.safeParse(payload);
    if (!result.success) {
      return { valid: false, error: result.error };
    }

    return { valid: true };
  }

  /**
   * Check if a module owns a state slice
   */
  isModuleAttached(owner: string, moduleId: string): boolean {
    const modules = this.ownerModules.get(owner);
    return modules?.has(moduleId) ?? false;
  }

  /**
   * Register a module's ownership of a state slice
   */
  registerModuleOwner(owner: string, moduleId: string): void {
    if (!this.ownerModules.has(owner)) {
      this.ownerModules.set(owner, new Set());
    }
    this.ownerModules.get(owner)!.add(moduleId);
  }

  /**
   * Clear module ownership (for cleanup/testing)
   */
  clearModuleOwners(owner: string): void {
    this.ownerModules.delete(owner);
  }

  /**
   * Get all actions for a given owner
   */
  getByOwner(owner: string): ActionRegistration[] {
    return Array.from(this.registry.values()).filter(reg => reg.owner === owner);
  }
}

// Singleton instance
export const actionRegistry = new ActionRegistry();

