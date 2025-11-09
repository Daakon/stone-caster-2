/**
 * Action Registry Boot
 * Registers all actions from modules and core actions on startup
 */

import { actionRegistry } from './registry.js';
import { RelationshipDeltaSchema, RelationshipSetSchema } from './schemas/relationships.js';
import { applyRelationshipDelta, applyRelationshipSet } from './reducers/relationships.js';
import { supabaseAdmin } from '../services/supabase.js';
import { z } from 'zod';

/**
 * Register core actions (backward compatibility)
 */
function registerCoreActions() {
  // Core actions that don't require modules
  // These are handled by the existing switch statement in game-state.service.ts
  // We register them here for validation purposes only
  
  actionRegistry.register(
    'MOVE',
    z.object({
      to: z.object({
        name: z.string(),
      }).optional(),
    }),
    'core',
    (state, payload) => state // No-op, handled by existing code
  );

  actionRegistry.register(
    'FLAG_SET',
    z.object({
      key: z.string(),
      value: z.any(),
    }),
    'core',
    (state, payload) => state // No-op, handled by existing code
  );

  actionRegistry.register(
    'STAT_DELTA',
    z.object({
      key: z.string(),
      delta: z.number(),
    }),
    'core',
    (state, payload) => state // No-op, handled by existing code
  );

  actionRegistry.register(
    'TIME_ADVANCE',
    z.object({
      minutes: z.number(),
    }),
    'core',
    (state, payload) => state // No-op, handled by existing code
  );

  actionRegistry.register(
    'NPC_ADD',
    z.object({
      who: z.object({
        name: z.string(),
      }),
    }),
    'core',
    (state, payload) => state // No-op, handled by existing code
  );

  actionRegistry.register(
    'PLACE_ADD',
    z.object({
      where: z.object({
        name: z.string(),
      }),
    }),
    'core',
    (state, payload) => state // No-op, handled by existing code
  );
}

/**
 * Register module actions from database
 */
async function registerModuleActions() {
  try {
    // Load all modules
    const { data: modules, error } = await supabaseAdmin
      .from('modules')
      .select('id, base_id, state_slice, exports');

    if (error) {
      console.error('[ActionRegistry] Error loading modules:', error);
      return;
    }

    if (!modules || modules.length === 0) {
      console.log('[ActionRegistry] No modules found in database');
      return;
    }

    // Register actions for each module
    for (const module of modules) {
      const exports = module.exports as {
        actions?: Array<{
          type: string;
          payload_schema: string;
        }>;
      };

      if (!exports?.actions) {
        continue;
      }

      // Map schema names to actual schemas
      const schemaMap: Record<string, z.ZodSchema> = {
        'zod:RelationshipDelta': RelationshipDeltaSchema,
        'zod:RelationshipSet': RelationshipSetSchema,
      };

      // Map action types to reducers
      const reducerMap: Record<string, (state: any, payload: any) => any> = {
        'relationship.delta': applyRelationshipDelta,
        'relationship.set': applyRelationshipSet,
      };

      for (const actionDef of exports.actions) {
        const schema = schemaMap[actionDef.payload_schema];
        const reducer = reducerMap[actionDef.type];

        if (!schema) {
          console.warn(`[ActionRegistry] Unknown schema: ${actionDef.payload_schema} for action ${actionDef.type}`);
          continue;
        }

        if (!reducer) {
          console.warn(`[ActionRegistry] Unknown reducer for action: ${actionDef.type}`);
          continue;
        }

        // Wrap reducer to pass storyId if available
        const wrappedReducer = async (state: any, payload: any, storyId?: string) => {
          // Try to extract storyId from state if not provided
          const finalStoryId = storyId || state.gameId || undefined;
          return reducer(state, payload, finalStoryId);
        };

        // Register the action
        actionRegistry.register(
          actionDef.type,
          schema,
          module.state_slice,
          wrappedReducer
        );

        // Track module ownership
        actionRegistry.registerModuleOwner(module.state_slice, module.id);

        console.log(`[ActionRegistry] Registered action ${actionDef.type} from module ${module.id}`);
      }
    }
  } catch (error) {
    console.error('[ActionRegistry] Error registering module actions:', error);
  }
}

/**
 * Health check: warn about duplicate state slices
 */
async function healthCheckModules() {
  try {
    const { data: modules, error } = await supabaseAdmin
      .from('modules')
      .select('id, state_slice');

    if (error || !modules) {
      return;
    }

    const stateSliceMap = new Map<string, string[]>();
    for (const module of modules) {
      const slice = module.state_slice;
      if (!stateSliceMap.has(slice)) {
        stateSliceMap.set(slice, []);
      }
      stateSliceMap.get(slice)!.push(module.id);
    }

    for (const [slice, moduleIds] of stateSliceMap.entries()) {
      if (moduleIds.length > 1) {
        console.warn(`[ActionRegistry] Health check: Multiple modules declare state_slice "${slice}": ${moduleIds.join(', ')}`);
      }
    }
  } catch (error) {
    console.warn('[ActionRegistry] Health check failed:', error);
  }
}

/**
 * Initialize action registry on boot
 */
export async function initializeActionRegistry() {
  console.log('[ActionRegistry] Initializing...');
  
  // Register core actions first
  registerCoreActions();
  console.log('[ActionRegistry] Core actions registered');

  // Register module actions
  await registerModuleActions();
  console.log('[ActionRegistry] Module actions registered');

  // Health check
  await healthCheckModules();

  const totalActions = actionRegistry.list().length;
  console.log(`[ActionRegistry] Initialization complete. ${totalActions} actions registered.`);
}

