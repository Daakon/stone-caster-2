/**
 * Canonical variable surface for prompt templates
 * All template placeholders must reference variables from this allowlist
 */

export const PROMPT_VARIABLES = {
  // Character variables
  CHARACTER: {
    NAME: 'character.name',
    LEVEL: 'character.level',
    RACE: 'character.race',
    CLASS: 'character.class',
    SKILLS: 'character.skills',
    STATS: 'character.stats',
    INVENTORY: 'character.inventory',
    RELATIONSHIPS: 'character.relationships',
    FLAGS: 'character.flags',
  },

  // Game variables
  GAME: {
    ID: 'game.id',
    TURN_INDEX: 'game.turn_index',
    SUMMARY: 'game.summary',
    CURRENT_SCENE: 'game.current_scene',
    STATE_SNAPSHOT: 'game.state_snapshot',
    OPTION_ID: 'game.option_id',
  },

  // World variables
  WORLD: {
    NAME: 'world.name',
    SETTING: 'world.setting',
    GENRE: 'world.genre',
    THEMES: 'world.themes',
    RULES: 'world.rules',
    MECHANICS: 'world.mechanics',
    LORE: 'world.lore',
    LOGIC: 'world.logic',
  },

  // Adventure variables
  ADVENTURE: {
    NAME: 'adventure.name',
    SCENES: 'adventure.scenes',
    OBJECTIVES: 'adventure.objectives',
    NPCS: 'adventure.npcs',
    PLACES: 'adventure.places',
    TRIGGERS: 'adventure.triggers',
  },

  // Runtime variables
  RUNTIME: {
    TICKS: 'runtime.ticks',
    PRESENCE: 'runtime.presence',
    LEDGERS: 'runtime.ledgers',
    FLAGS: 'runtime.flags',
    LAST_ACTS: 'runtime.last_acts',
    STYLE_HINT: 'runtime.style_hint',
  },

  // System variables
  SYSTEM: {
    SCHEMA_VERSION: 'system.schema_version',
    PROMPT_VERSION: 'system.prompt_version',
    LOAD_ORDER: 'system.load_order',
    HASH: 'system.hash',
  },
} as const;

// Flattened allowlist for validation
export const ALLOWLISTED_VARIABLES = new Set([
  // Character
  'character.name',
  'character.level',
  'character.race',
  'character.class',
  'character.skills',
  'character.stats',
  'character.inventory',
  'character.relationships',
  'character.flags',

  // Game
  'game.id',
  'game.turn_index',
  'game.summary',
  'game.current_scene',
  'game.state_snapshot',
  'game.option_id',

  // World
  'world.name',
  'world.setting',
  'world.genre',
  'world.themes',
  'world.rules',
  'world.mechanics',
  'world.lore',
  'world.logic',

  // Adventure
  'adventure.name',
  'adventure.scenes',
  'adventure.objectives',
  'adventure.npcs',
  'adventure.places',
  'adventure.triggers',

  // Runtime
  'runtime.ticks',
  'runtime.presence',
  'runtime.ledgers',
  'runtime.flags',
  'runtime.last_acts',
  'runtime.style_hint',

  // System
  'system.schema_version',
  'system.prompt_version',
  'system.load_order',
  'system.hash',
]);

/**
 * Validate that a template only uses allowlisted variables
 */
export function validateTemplateVariables(template: string): {
  valid: boolean;
  invalidVariables: string[];
} {
  const variablePattern = /\{\{([^}]+)\}\}/g;
  const matches = Array.from(template.matchAll(variablePattern));
  const usedVariables = matches.map(match => match[1].trim());
  
  const invalidVariables = usedVariables.filter(
    variable => !ALLOWLISTED_VARIABLES.has(variable)
  );

  return {
    valid: invalidVariables.length === 0,
    invalidVariables,
  };
}

/**
 * Extract all variables used in a template
 */
export function extractTemplateVariables(template: string): string[] {
  const variablePattern = /\{\{([^}]+)\}\}/g;
  const matches = Array.from(template.matchAll(variablePattern));
  return matches.map(match => match[1].trim());
}

/**
 * Replace variables in a template with actual values
 */
export function replaceTemplateVariables(
  template: string,
  context: Record<string, any>
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
    const trimmedVar = variable.trim();
    const value = context[trimmedVar];
    
    if (value === undefined || value === null) {
      console.warn(`Template variable '${trimmedVar}' not found in context`);
      return match; // Keep original placeholder
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 0); // Minimize JSON
    }
    
    return String(value);
  });
}
