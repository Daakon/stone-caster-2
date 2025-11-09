/**
 * Linearized Prompt Builder
 * Builds a stable-order prompt string from TurnPacketV3
 */

import type { TurnPacketV3 } from '../types/turn-packet-v3.js';
import type { LinearSection } from '../budget/budget-types.js';
import { getSlotByTypeAndName } from '../services/slots.service.js';

/**
 * Build linearized sections with metadata for budget engine
 */
export async function buildLinearizedSections(tp: TurnPacketV3): Promise<LinearSection[]> {
  const sections: LinearSection[] = [];

  // CORE section
  const coreParts: string[] = [];
  if (tp.core.style) {
    coreParts.push(`Style: ${tp.core.style}`);
  }
  if (tp.core.safety && tp.core.safety.length > 0) {
    coreParts.push(`Safety: ${tp.core.safety.join(', ')}`);
  }
  if (tp.core.output_rules) {
    coreParts.push(`Output Rules: ${tp.core.output_rules}`);
  }
  if (coreParts.length > 0) {
    sections.push({
      key: 'core.all',
      label: 'CORE',
      text: `# CORE\n\n${coreParts.join('\n')}`,
    });
  }

  // RULESET section
  if (tp.ruleset.slots?.principles) {
    const slotDef = await getSlotByTypeAndName('ruleset', 'principles');
    sections.push({
      key: 'ruleset.principles',
      label: 'RULESET - Principles',
      text: `## Principles\n${tp.ruleset.slots.principles}`,
      slot: slotDef ? {
        name: 'principles',
        must_keep: slotDef.must_keep,
        min_chars: slotDef.min_chars,
        priority: slotDef.priority,
      } : undefined,
    });
  }
  if (tp.ruleset.slots?.choice_style) {
    const slotDef = await getSlotByTypeAndName('ruleset', 'choice_style');
    sections.push({
      key: 'ruleset.choice_style',
      label: 'RULESET - Choice Style',
      text: `## Choice Style\n${tp.ruleset.slots.choice_style}`,
      slot: slotDef ? {
        name: 'choice_style',
        must_keep: slotDef.must_keep,
        min_chars: slotDef.min_chars,
        priority: slotDef.priority,
      } : undefined,
    });
  }

  // MODULES section
  if (tp.modules && tp.modules.length > 0) {
    for (const module of tp.modules) {
      // Module hints
      if (module.slots?.['module.hints']) {
        const slotDef = await getSlotByTypeAndName('module', 'hints');
        sections.push({
          key: `module.${module.id}.hints`,
          label: `MODULE - ${module.id} Hints`,
          text: `### ${module.id} Hints\n${module.slots['module.hints']}`,
          slot: slotDef ? {
            name: 'hints',
            must_keep: slotDef.must_keep,
            min_chars: slotDef.min_chars,
            priority: slotDef.priority,
          } : undefined,
        });
      }
      // Module actions
      if (module.slots?.['module.actions']) {
        const slotDef = await getSlotByTypeAndName('module', 'actions');
        sections.push({
          key: `module.${module.id}.actions`,
          label: `MODULE - ${module.id} Actions`,
          text: `### ${module.id} Actions\n${module.slots['module.actions']}`,
          slot: slotDef ? {
            name: 'actions',
            must_keep: slotDef.must_keep,
            min_chars: slotDef.min_chars,
            priority: slotDef.priority,
          } : undefined,
        });
      }
    }
  }

  // WORLD section
  if (tp.world.slots?.tone) {
    const slotDef = await getSlotByTypeAndName('world', 'tone');
    sections.push({
      key: 'world.tone',
      label: 'WORLD - Tone',
      text: `## Tone\n${tp.world.slots.tone}`,
      slot: slotDef ? {
        name: 'tone',
        must_keep: slotDef.must_keep,
        min_chars: slotDef.min_chars,
        priority: slotDef.priority,
      } : undefined,
    });
  }
  if (tp.world.slots?.taboos) {
    const slotDef = await getSlotByTypeAndName('world', 'taboos');
    sections.push({
      key: 'world.taboos',
      label: 'WORLD - Taboos',
      text: `## Taboos\n${tp.world.slots.taboos}`,
      slot: slotDef ? {
        name: 'taboos',
        must_keep: slotDef.must_keep,
        min_chars: slotDef.min_chars,
        priority: slotDef.priority,
      } : undefined,
    });
  }
  if (tp.world.slots?.canon) {
    const slotDef = await getSlotByTypeAndName('world', 'canon');
    sections.push({
      key: 'world.canon',
      label: 'WORLD - Canon',
      text: `## Canon\n${tp.world.slots.canon}`,
      slot: slotDef ? {
        name: 'canon',
        must_keep: slotDef.must_keep,
        min_chars: slotDef.min_chars,
        priority: slotDef.priority,
      } : undefined,
    });
  }
  if (tp.world.slots?.lexicon) {
    const slotDef = await getSlotByTypeAndName('world', 'lexicon');
    sections.push({
      key: 'world.lexicon',
      label: 'WORLD - Lexicon',
      text: `## Lexicon\n${tp.world.slots.lexicon}`,
      slot: slotDef ? {
        name: 'lexicon',
        must_keep: slotDef.must_keep,
        min_chars: slotDef.min_chars,
        priority: slotDef.priority,
      } : undefined,
    });
  }

  // SCENARIO section
  if (tp.scenario) {
    if (tp.scenario.slots?.setup) {
      const slotDef = await getSlotByTypeAndName('scenario', 'setup');
      sections.push({
        key: 'scenario.setup',
        label: 'SCENARIO - Setup',
        text: `## Setup\n${tp.scenario.slots.setup}`,
        slot: slotDef ? {
          name: 'setup',
          must_keep: slotDef.must_keep,
          min_chars: slotDef.min_chars,
          priority: slotDef.priority,
        } : undefined,
      });
    }
    if (tp.scenario.slots?.beats) {
      const slotDef = await getSlotByTypeAndName('scenario', 'beats');
      sections.push({
        key: 'scenario.beats',
        label: 'SCENARIO - Beats',
        text: `## Beats\n${tp.scenario.slots.beats}`,
        slot: slotDef ? {
          name: 'beats',
          must_keep: slotDef.must_keep,
          min_chars: slotDef.min_chars,
          priority: slotDef.priority,
        } : undefined,
      });
    }
    if (tp.scenario.reachability && tp.scenario.reachability.reachableNodes.length > 0) {
      sections.push({
        key: 'scenario.reachability',
        label: 'SCENARIO - Reachability',
        text: `### Reachability: [${tp.scenario.reachability.reachableNodes.join(', ')}]`,
      });
    }
  }

  // NPCS section
  if (tp.npcs && tp.npcs.length > 0) {
    for (const npc of tp.npcs) {
      if (npc.slots?.bio) {
        const slotDef = await getSlotByTypeAndName('npc', 'bio');
        sections.push({
          key: `npc.${npc.id}.bio`,
          label: `NPC - ${npc.name} Bio`,
          text: `## ${npc.name} Bio\n${npc.slots.bio}`,
          slot: slotDef ? {
            name: 'bio',
            must_keep: slotDef.must_keep,
            min_chars: slotDef.min_chars,
            priority: slotDef.priority,
          } : undefined,
        });
      }
      if (npc.slots?.persona) {
        const slotDef = await getSlotByTypeAndName('npc', 'persona');
        sections.push({
          key: `npc.${npc.id}.persona`,
          label: `NPC - ${npc.name} Persona`,
          text: `## ${npc.name} Persona\n${npc.slots.persona}`,
          slot: slotDef ? {
            name: 'persona',
            must_keep: slotDef.must_keep,
            min_chars: slotDef.min_chars,
            priority: slotDef.priority,
          } : undefined,
        });
      }
      if (npc.slots?.triggers) {
        const slotDef = await getSlotByTypeAndName('npc', 'triggers');
        sections.push({
          key: `npc.${npc.id}.triggers`,
          label: `NPC - ${npc.name} Triggers`,
          text: `## ${npc.name} Triggers\n${npc.slots.triggers}`,
          slot: slotDef ? {
            name: 'triggers',
            must_keep: slotDef.must_keep,
            min_chars: slotDef.min_chars,
            priority: slotDef.priority,
          } : undefined,
        });
      }
    }
  }

  // STATE section
  if (tp.state && Object.keys(tp.state).length > 0) {
    sections.push({
      key: 'state.all',
      label: 'STATE',
      text: `# STATE\n\n${JSON.stringify(tp.state, null, 2)}`,
    });
  }

  // INPUT section
  sections.push({
    key: 'input.all',
    label: 'INPUT',
    text: `# INPUT\n\nKind: ${tp.input.kind}\nText: ${tp.input.text}`,
  });

  return sections;
}

/**
 * Build linearized prompt from TurnPacketV3
 * Order: CORE → RULESET → MODULES → WORLD → SCENARIO → NPCS
 */
export async function buildLinearizedPrompt(tp: TurnPacketV3): Promise<string> {
  const sections = await buildLinearizedSections(tp);
  return sections.map(s => s.text).join('\n\n');
}

/**
 * Build linearized prompt (synchronous fallback for backward compatibility)
 */
export function buildLinearizedPromptSync(tp: TurnPacketV3): string {
  const sections: string[] = [];

  // CORE section
  const coreParts: string[] = [];
  if (tp.core.style) {
    coreParts.push(`Style: ${tp.core.style}`);
  }
  if (tp.core.safety && tp.core.safety.length > 0) {
    coreParts.push(`Safety: ${tp.core.safety.join(', ')}`);
  }
  if (tp.core.output_rules) {
    coreParts.push(`Output Rules: ${tp.core.output_rules}`);
  }
  if (coreParts.length > 0) {
    sections.push(`# CORE\n\n${coreParts.join('\n')}`);
  }

  // RULESET section
  const rulesetParts: string[] = [];
  if (tp.ruleset.slots?.principles) {
    rulesetParts.push(`## Principles\n${tp.ruleset.slots.principles}`);
  }
  if (tp.ruleset.slots?.choice_style) {
    rulesetParts.push(`## Choice Style\n${tp.ruleset.slots.choice_style}`);
  }
  if (rulesetParts.length > 0) {
    sections.push(`# RULESET (${tp.ruleset.id} v${tp.ruleset.version})\n\n${rulesetParts.join('\n\n')}`);
  }

  // MODULES section
  if (tp.modules && tp.modules.length > 0) {
    const moduleLines = tp.modules.map(m => {
      // Extract action types from module.actions slot if present
      const actionsSlot = m.slots?.['module.actions'] || '';
      const actionTypes = actionsSlot
        .split(';')
        .map(s => s.trim())
        .filter(Boolean);
      
      const actionTypesStr = actionTypes.length > 0 
        ? actionTypes.join(', ')
        : 'no actions';
      
      return `${m.id}: ${actionTypesStr}`;
    });
    sections.push(`### MODULES\n${moduleLines.join('\n')}`);
  }

  // WORLD section
  const worldParts: string[] = [];
  if (tp.world.slots?.tone) {
    worldParts.push(`## Tone\n${tp.world.slots.tone}`);
  }
  if (tp.world.slots?.taboos) {
    worldParts.push(`## Taboos\n${tp.world.slots.taboos}`);
  }
  if (tp.world.slots?.canon) {
    worldParts.push(`## Canon\n${tp.world.slots.canon}`);
  }
  if (tp.world.slots?.lexicon) {
    worldParts.push(`## Lexicon\n${tp.world.slots.lexicon}`);
  }
  if (worldParts.length > 0) {
    sections.push(`# WORLD (${tp.world.id} v${tp.world.version})\n\n${worldParts.join('\n\n')}`);
  }

  // SCENARIO section
  if (tp.scenario) {
    const scenarioParts: string[] = [];
    if (tp.scenario.slots?.setup) {
      scenarioParts.push(`## Setup\n${tp.scenario.slots.setup}`);
    }
    if (tp.scenario.slots?.beats) {
      scenarioParts.push(`## Beats\n${tp.scenario.slots.beats}`);
    }
    if (tp.scenario.slots?.guards) {
      scenarioParts.push(`## Guards\n${tp.scenario.slots.guards}`);
    }
    if (scenarioParts.length > 0) {
      sections.push(`# SCENARIO (${tp.scenario.id} v${tp.scenario.version})\n\n${scenarioParts.join('\n\n')}`);
    }
    
    // Add reachability section
    if (tp.scenario.reachability && tp.scenario.reachability.reachableNodes.length > 0) {
      sections.push(`### SCENARIO.reachability: [${tp.scenario.reachability.reachableNodes.join(', ')}]`);
    }
  }

  // MODULE PARAMS section (compact)
  if (tp.modules && tp.modules.length > 0) {
    const paramsLines: string[] = [];
    for (const module of tp.modules) {
      if (module.params && Object.keys(module.params).length > 0) {
        // Build compact param summary (1-2 phrases)
        const parts: string[] = [];
        
        // Relationships-specific
        if (module.params.gainCurve?.scale !== undefined) {
          parts.push(`scale=${module.params.gainCurve.scale}`);
        }
        if (module.params.minTrustToRomance !== undefined) {
          parts.push(`minTrust=${module.params.minTrustToRomance}`);
        }
        
        if (parts.length > 0) {
          paramsLines.push(`${module.id}: ${parts.join(', ')}`);
        }
      }
    }
    
    if (paramsLines.length > 0) {
      sections.push(`### MODULE PARAMS\n${paramsLines.join('\n')}`);
    }
  }

  // NPCS section
  if (tp.npcs && tp.npcs.length > 0) {
    const npcParts = tp.npcs.map(npc => {
      const parts: string[] = [`## ${npc.name} (${npc.id})`];
      if (npc.slots?.bio) {
        parts.push(`Bio: ${npc.slots.bio}`);
      }
      if (npc.slots?.persona) {
        parts.push(`Persona: ${npc.slots.persona}`);
      }
      if (npc.slots?.triggers) {
        parts.push(`Triggers: ${npc.slots.triggers}`);
      }
      if (npc.slots?.voice) {
        parts.push(`Voice: ${npc.slots.voice}`);
      }
      return parts.join('\n');
    });
    sections.push(`# NPCS\n\n${npcParts.join('\n\n')}`);
  }

  // STATE section
  if (tp.state && Object.keys(tp.state).length > 0) {
    sections.push(`# STATE\n\n${JSON.stringify(tp.state, null, 2)}`);
  }

  // INPUT section
  sections.push(`# INPUT\n\nKind: ${tp.input.kind}\nText: ${tp.input.text}`);

  return sections.join('\n\n');
}

