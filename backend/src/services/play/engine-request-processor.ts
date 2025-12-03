/**
 * Engine Request Processor Service (Security 2: The AI Adjudicator)
 * Phase 4: The Play Engine
 * 
 * This service validates AI-requested actions against the action_rules.
 * It ensures the AI cannot request invalid or overpowered actions.
 */

import type { ActionDto } from './action-parser.js';
import type { MutationDto } from './action-resolver.js';
import type { ActionContext } from './action-resolver.js';

/**
 * Process and validate engine requests from MAS 2
 * 
 * @param engineRequests - The engine requests from MAS 2
 * @param actionContext - The action context containing action_rules
 * @returns Array of validated T1/T2 mutations
 */
export function processEngineRequests(
  engineRequests: Array<{
    action: string;
    target?: string;
    parameters?: Record<string, unknown>;
  }>,
  actionContext: ActionContext
): MutationDto[] {
  const validatedMutations: MutationDto[] = [];

  for (const request of engineRequests) {
    // Check if action exists in action_rules
    const actionRule = actionContext.action_rules[request.action];
    
    if (!actionRule) {
      console.warn(
        `[EngineRequestProcessor] Rejected unknown action: ${request.action}`
      );
      continue;
    }

    const rule = actionRule as Record<string, unknown>;
    const actionType = rule.type as string | undefined;

    // Validate based on action type
    switch (actionType) {
      case 'time_update': {
        const ticks = (request.parameters?.ticks as number) || (rule.ticks as number) || 1;
        const maxTicks = (rule.max_ticks as number) || 10;
        
        if (ticks > maxTicks) {
          console.warn(
            `[EngineRequestProcessor] Rejected time_update: ${ticks} ticks exceeds max ${maxTicks}`
          );
          continue;
        }

        // Generate mutation for time update
        validatedMutations.push({
          op: 'set',
          path: '/tier1_singular_state/world_time',
          value: new Date().toISOString(), // Simplified - in production would calculate actual time
        });
        break;
      }

      case 'health_update': {
        const delta = (request.parameters?.delta as number) || 0;
        const maxDelta = (rule.max_delta as number) || 10;
        
        if (Math.abs(delta) > maxDelta) {
          console.warn(
            `[EngineRequestProcessor] Rejected health_update: delta ${delta} exceeds max ${maxDelta}`
          );
          continue;
        }

        const target = request.target || 'player';
        validatedMutations.push({
          op: 'set',
          path: `/tier1_singular_state/actor_health/${target}`,
          value: delta, // Simplified - in production would calculate from current health
        });
        break;
      }

      case 'skill_check': {
        // Skill checks are typically player-initiated, not AI-initiated
        // But if allowed, validate the DC
        const dc = (request.parameters?.dc as number) || (rule.dc as number) || 50;
        const maxDc = (rule.max_dc as number) || 100;
        
        if (dc > maxDc) {
          console.warn(
            `[EngineRequestProcessor] Rejected skill_check: DC ${dc} exceeds max ${maxDc}`
          );
          continue;
        }

        // Note: Skill checks don't directly create mutations, they create outcomes
        // This is a placeholder - in production, this might trigger a different flow
        break;
      }

      default: {
        // Unknown or unvalidated action type - reject
        console.warn(
          `[EngineRequestProcessor] Rejected action ${request.action}: type ${actionType} not validated for AI requests`
        );
        break;
      }
    }
  }

  return validatedMutations;
}

