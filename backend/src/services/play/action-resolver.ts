/**
 * Action Resolver Service (Game Engine)
 * Phase 4: The Play Engine
 * 
 * This is "The Calculator" - a non-AI, deterministic, rules-based function
 * that resolves actions and applies game mechanics.
 */

import type { ActionDto } from './action-parser.js';

/**
 * GameStateTiers structure
 */
export interface GameStateTiers {
  tier0_tracked_state: Record<string, unknown>;
  tier1_singular_state: Record<string, unknown>;
  tier2_relational_state: Record<string, unknown>;
}

/**
 * OutcomeDto - The result of an action resolution
 */
export interface OutcomeDto {
  success: boolean;
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * MutationDto - A state mutation operation
 */
export interface MutationDto {
  op: 'set' | 'add' | 'remove';
  path: string;
  value: unknown;
}

/**
 * Action context from compiled story
 */
export interface ActionContext {
  action_rules: Record<string, unknown>;
  elements: Record<string, unknown>;
}

/**
 * Roll a D100 (1-100) die
 */
function rollD100(): number {
  return Math.floor(Math.random() * 100) + 1;
}

/**
 * Get a skill value from game state
 */
function getSkillValue(
  gameState: GameStateTiers,
  skillName: string
): number {
  const skills = gameState.tier2_relational_state.player_skills as Record<string, unknown> | undefined;
  if (!skills) {
    return 0;
  }
  const skillValue = skills[skillName];
  if (typeof skillValue === 'number') {
    return skillValue;
  }
  return 0;
}

/**
 * Resolve an action and return the outcome and mutations
 * 
 * @param actionDto - The structured action from MAS 1
 * @param gameState - The current game state (all tiers)
 * @param actionContext - The action context from the compiled story
 * @returns The outcome and mutations to apply
 */
export async function resolveAction(
  actionDto: ActionDto,
  gameState: GameStateTiers,
  actionContext: ActionContext
): Promise<{
  outcome: OutcomeDto;
  mutations: MutationDto[];
}> {
  const actionRule = actionContext.action_rules[actionDto.action];
  
  if (!actionRule) {
    // Action not found in rules - return neutral outcome
    return {
      outcome: {
        success: true,
        message: `Action "${actionDto.action}" executed`,
      },
      mutations: [],
    };
  }

  const rule = actionRule as Record<string, unknown>;
  const actionType = rule.type as string | undefined;

  // Switch based on action type
  switch (actionType) {
    case 'skill_check': {
      return resolveSkillCheck(actionDto, gameState, rule);
    }
    case 'time_update': {
      return resolveTimeUpdate(actionDto, gameState, rule);
    }
    case 'health_update': {
      return resolveHealthUpdate(actionDto, gameState, rule);
    }
    case 'combat': {
      return resolveCombat(actionDto, gameState, rule);
    }
    default: {
      // Unknown action type - return neutral outcome
      return {
        outcome: {
          success: true,
          message: `Action "${actionDto.action}" executed (unknown type: ${actionType})`,
        },
        mutations: [],
      };
    }
  }
}

/**
 * Resolve a skill check action
 */
function resolveSkillCheck(
  actionDto: ActionDto,
  gameState: GameStateTiers,
  rule: Record<string, unknown>
): {
  outcome: OutcomeDto;
  mutations: MutationDto[];
} {
  const skillName = (rule.skill as string) || actionDto.parameters?.skill as string;
  const dc = (rule.dc as number) || (rule.difficulty as number) || 50;
  
  if (!skillName) {
    return {
      outcome: {
        success: false,
        message: 'Skill check requires a skill name',
      },
      mutations: [],
    };
  }

  // Get skill value from game state
  const skillValue = getSkillValue(gameState, skillName);
  
  // Roll D100
  const roll = rollD100();
  
  // Calculate total: roll + skill value
  const total = roll + skillValue;
  
  // Determine success
  const success = total >= dc;
  const margin = total - dc;
  
  // Determine degree of success/failure
  let degree: string;
  if (margin >= 20) {
    degree = 'critical_success';
  } else if (margin >= 5) {
    degree = 'success';
  } else if (margin > -5) {
    degree = 'partial';
  } else if (margin > -20) {
    degree = 'fail';
  } else {
    degree = 'critical_fail';
  }

  const mutations: MutationDto[] = [];
  
  // If the action has a target and succeeds, we might unlock/open it
  if (success && actionDto.target) {
    // Example: If picking a lock, unlock the target
    if (actionDto.action === 'pick_lock') {
      mutations.push({
        op: 'set',
        path: `/tier1_singular_state/${actionDto.target}/is_locked`,
        value: false,
      });
    }
  }

  return {
    outcome: {
      success,
      message: `Skill check: ${skillName} (${skillValue}) + roll (${roll}) = ${total} vs DC ${dc}`,
      details: {
        skill: skillName,
        skillValue,
        roll,
        total,
        dc,
        margin,
        degree,
      },
    },
    mutations,
  };
}

/**
 * Resolve a time update action
 */
function resolveTimeUpdate(
  actionDto: ActionDto,
  gameState: GameStateTiers,
  rule: Record<string, unknown>
): {
  outcome: OutcomeDto;
  mutations: MutationDto[];
} {
  const ticks = (rule.ticks as number) || (actionDto.parameters?.ticks as number) || 1;
  
  // Get current time
  const currentTime = gameState.tier1_singular_state.world_time as string | undefined;
  let newTime: Date;
  
  if (currentTime) {
    newTime = new Date(currentTime);
  } else {
    newTime = new Date();
  }
  
  // Add ticks (assuming 1 tick = 1 minute for simplicity)
  newTime.setMinutes(newTime.getMinutes() + ticks);

  return {
    outcome: {
      success: true,
      message: `Time advanced by ${ticks} tick(s)`,
      details: {
        ticks,
        newTime: newTime.toISOString(),
      },
    },
    mutations: [
      {
        op: 'set',
        path: '/tier1_singular_state/world_time',
        value: newTime.toISOString(),
      },
    ],
  };
}

/**
 * Resolve a health update action
 */
function resolveHealthUpdate(
  actionDto: ActionDto,
  gameState: GameStateTiers,
  rule: Record<string, unknown>
): {
  outcome: OutcomeDto;
  mutations: MutationDto[];
} {
  const delta = (rule.delta as number) || (actionDto.parameters?.delta as number) || 0;
  const target = (rule.target as string) || actionDto.target || 'player';
  
  // Get current health
  const actorHealth = gameState.tier1_singular_state.actor_health as Record<string, unknown> | undefined;
  let currentHealth = 100;
  if (actorHealth && typeof actorHealth[target] === 'number') {
    currentHealth = actorHealth[target] as number;
  }
  
  const newHealth = Math.max(0, Math.min(100, currentHealth + delta));

  return {
    outcome: {
      success: true,
      message: `${target} health ${delta >= 0 ? 'increased' : 'decreased'} by ${Math.abs(delta)}`,
      details: {
        target,
        delta,
        previousHealth: currentHealth,
        newHealth,
      },
    },
    mutations: [
      {
        op: 'set',
        path: `/tier1_singular_state/actor_health/${target}`,
        value: newHealth,
      },
    ],
  };
}

/**
 * Resolve a combat action
 */
function resolveCombat(
  actionDto: ActionDto,
  gameState: GameStateTiers,
  rule: Record<string, unknown>
): {
  outcome: OutcomeDto;
  mutations: MutationDto[];
} {
  // For combat, we'll do a simple attack roll
  const attackSkill = getSkillValue(gameState, 'combat') || getSkillValue(gameState, 'attack') || 50;
  const defense = (rule.defense as number) || 50;
  
  const roll = rollD100();
  const total = roll + attackSkill;
  const success = total >= defense;
  
  const damage = success ? ((rule.damage as number) || 10) : 0;
  const target = actionDto.target || 'enemy';

  const mutations: MutationDto[] = [];
  
  if (success && damage > 0) {
    // Apply damage to target
    const targetHealth = gameState.tier1_singular_state.actor_health as Record<string, unknown> | undefined;
    const currentHealth = (targetHealth?.[target] as number | undefined) || 100;
    const newHealth = Math.max(0, currentHealth - damage);
    
    mutations.push({
      op: 'set',
      path: `/tier1_singular_state/actor_health/${target}`,
      value: newHealth,
    });
  }

  return {
    outcome: {
      success,
      message: success 
        ? `Attack hit ${target} for ${damage} damage`
        : `Attack missed ${target}`,
      details: {
        attackSkill,
        roll,
        total,
        defense,
        damage: success ? damage : 0,
        target,
      },
    },
    mutations,
  };
}

