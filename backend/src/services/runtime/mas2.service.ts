// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * MAS2 Service (The Narrator)
 * Phase 6-B: Real LLM Integration
 * Generates narrative text from engine outcomes using LLM
 */

import type { GameState, EngineResultDto, Mas2ResponseDto, DirectorUnifiedIntent } from '@shared/types/chimera-runtime';
import { Mas2ResponseDtoSchema } from '@shared/types/chimera-runtime';
import { LlmService } from '../llm/llm.service';
import type { CompiledStory } from '@shared/types/chimera-compiled';
import { isTestScenarioInput } from '../../config/ai-flags';
import { resolveLlmRoleConfig } from '../../config/llm-config';
import type { ConditionTransition } from './condition-rules';
import { entityDisplayName, readSceneEntities, presentEntityIds } from './scene-context';

/**
 * The Narrator may only nudge how EXISTING bystanders feel about the player. Ids it invents
 * (or the player's own id) are dropped so the model can never create or corrupt entities.
 */
export function sanitizeNarratorOutput(result: Mas2ResponseDto, gameState: any): Mas2ResponseDto {
  const { entities, playerId } = readSceneEntities(gameState);
  const updates = result.state_updates?.entity_updates;
  if (!updates || Object.keys(entities).length === 0) return result;
  const kept = updates.filter((u: any) => u?.id && entities[u.id] && u.id !== playerId);
  if (kept.length !== updates.length) {
    console.warn(`[MAS2] Dropped ${updates.length - kept.length} narrator entity_update(s) targeting unknown/player ids`);
  }
  return { ...result, state_updates: { ...result.state_updates, entity_updates: kept } } as Mas2ResponseDto;
}

/**
 * Renders the engine result as plain outcome sentences for the Narrator: explicit HIT/MISS/FAILS
 * statements, severity words instead of numbers, and who was actually affected.
 */
export function renderOutcomeFacts(
  engineResult: EngineResultDto,
  getEntityName: (id: string) => string,
  directorIntent?: DirectorUnifiedIntent
): string {
  const lines: string[] = [];
  const summary = engineResult.outcome_summary || '';
  const deltas = engineResult.numeric_deltas || {};
  const damageTo = (ids: string[]) => ids.reduce((sum, id) => sum + Math.max(0, -(deltas[`entities.${id}.properties.hp`] ?? 0)), 0);
  const severity = (dmg: number) => (dmg <= 0 ? '' : dmg <= 5 ? 'a light wound' : dmg <= 12 ? 'a solid wound' : 'a heavy wound');

  if (/^Impossible:/.test(summary)) {
    lines.push(`- ${summary}`);
  } else {
    lines.push(`- Overall: ${engineResult.success ? 'the action succeeded' : 'the action failed'}`);
    if (summary && !/Roll:/.test(summary) && !(engineResult.target_results?.length)) lines.push(`- Summary: ${summary}`);
  }

  for (const tr of engineResult.target_results || []) {
    const intended = tr.intended_targets.map(getEntityName).join(', ') || 'no one';
    // Who performed it: with several actions in a turn (attack + counter-attack) the Narrator must know
    const source = directorIntent?.intent_queue?.[tr.intent_index];
    const by = source ? `${getEntityName(source.actor_id)}'s ${source.parameters.verb} on ` : '';
    const actualIds = tr.actual_targets;
    const actual = actualIds.map(getEntityName).join(', ') || 'no one';
    const redirected = JSON.stringify(tr.intended_targets) !== JSON.stringify(actualIds);
    const sev = severity(damageTo(actualIds));
    switch (tr.resolution_summary) {
      case 'crit':
        lines.push(`- ${by}${intended}: SUCCEEDS spectacularly${sev ? ` and inflicts ${sev}` : ''}.`);
        break;
      case 'success':
        lines.push(`- ${by}${intended}: SUCCEEDS${sev ? ` and inflicts ${sev}` : ''}.`);
        break;
      case 'fumble':
        lines.push(redirected
          ? `- ${by}${intended}: FAILS badly and the blow goes astray, striking ${actual} instead${sev ? ` (${sev})` : ''}. ${intended} is unharmed.`
          : `- ${by}${intended}: FAILS badly (the attacker slips or overextends). Nobody is hurt.`);
        break;
      default:
        lines.push(`- ${by}${intended}: FAILS (dodged, parried, refused or ineffective). ${intended} is unharmed.`);
    }
  }
  return `## Outcome (already decided — render exactly this, do not change it)\n${lines.join('\n')}`;
}

export class Mas2Service {
  private llmService: LlmService;

  constructor(llmService?: LlmService) {
    this.llmService = llmService || new LlmService(undefined, undefined, 'narrator');
  }

  /**
   * Narrate the outcome of an action.
   * Uses the deterministic mock when ENABLE_MOCK_AI is set or the input is a
   * scripted `test_*` scenario; otherwise calls the real LLM per the Narrator
   * Constraint Model (docs/05).
   *
   * @param engineResult - The deterministic result from the Engine (aggregated from multiple intents)
   * @param gameState - Current game state (Tier 0 context for narrative)
   * @param triggerId - The trigger_id of the first intent (for mock branching)
   * @param worldStyle - Optional world style/theme for narrative tone
   * @param compiledStory - Optional compiled story for lore context
   * @param directorIntent - The Director's Unified Intent (ripples/accident context)
   * @param playerInput - The raw player input (test-scenario bypass detection)
   * @param conditionTransitions - Rules-engine condition transitions (injury/
   *        collapse/surrender) this turn — facts the Narrator renders as prose
   * @returns Mas2ResponseDto with ripple_narrative and tier0_mutations
   */
  async narrate(
    engineResult: EngineResultDto,
    gameState: GameState,
    triggerId?: string,
    worldStyle?: string,
    compiledStory?: CompiledStory,
    directorIntent?: DirectorUnifiedIntent,
    playerInput?: string,
    conditionTransitions?: ConditionTransition[]
  ): Promise<Mas2ResponseDto> {
    if (resolveLlmRoleConfig('narrator').provider === 'mock' || isTestScenarioInput(playerInput)) {
      return this.mockNarrate(engineResult, gameState, triggerId, conditionTransitions);
    }

    const system = this.buildNarratorSystemPrompt(worldStyle, compiledStory, triggerId);
    const user = this.buildNarratorUserPrompt(engineResult, gameState, directorIntent, conditionTransitions, playerInput);

    // NO FALLBACK: state is not persisted until after narration, so a failed
    // turn is cleanly retryable by the player.
    const result = await this.llmService.generateJSON(system, user, Mas2ResponseDtoSchema);
    return sanitizeNarratorOutput(result, gameState);
  }

  /**
   * System prompt per docs/05 (The Narrator Constraint Model): a constrained
   * observer that renders mechanics as prose but never reveals them.
   */
  private buildNarratorSystemPrompt(
    worldStyle?: string,
    compiledStory?: CompiledStory,
    triggerId?: string
  ): string {
    const loreContext = this.extractLoreContext(compiledStory, triggerId);
    const styleLine = worldStyle ? `\n**World Style**: ${worldStyle}` : '';
    const frozenStyle = compiledStory?.prompt_narrator_style ? `\n## Frozen story narration rules\n${compiledStory.prompt_narrator_style}` : '';

    return `You are the **Narrator** of the Chimera Engine — a constrained observer. The mechanical outcome of this turn has ALREADY been decided by a deterministic engine. Your only job is to render that outcome as cinematic prose. You have NO authority to change what happened.

## Hard Constraints (No-Meta Rule)
- NEVER use game terms: "roll", "success", "fail", "stat", "modifier", "tier", "DTO", "D100", "HP", "stamina", "check".
- NEVER reveal raw numbers. Translate magnitudes into sensory description:
  - Minor/Low impact → a graze, a flicker of discomfort, a fleeting slight
  - Moderate → a solid blow, a clear reaction, a noticeable shift
  - Major/High → staggering damage, a dramatic change, an unmistakable turn
  - Severe → devastating, life-altering, the scene itself changes
- NEVER contradict the outcome facts you are given. If the engine says an action failed, it failed.
- Read outcome words literally: "success"/"critical success" = the action lands (a critical is spectacular). "fail" = an ordinary miss: dodged, parried, blocked, ignored, refused. NOT a fumble. "critical failure (accident)" = the attempt goes badly wrong (a slip, a stumble), and only then may the mishap hit a bystander if Target Results say so. Damage happens ONLY to targets listed as actually affected; anyone else is unharmed. "Impossible" = the attempt simply does not work and nothing changes.

## Narration Rules
1. Write **1–3 paragraphs** of Markdown prose in second person ("You…").
2. **The Accident**: if the actual targets differ from the intended targets, the action went astray — narrate the mishap landing on the actual target(s).
3. **Unseen Ripples**: weave the provided ripple reasons into the scene as behavior, glances, and mood — the world reacting to what it just witnessed.
4. Ground the prose in the scene context and the named characters provided. Refer to cast members BY NAME. Never invent new named characters, locations, or plot facts; unnamed background color (a passing vendor, a barking dog) is fine.
5. **Answer the Player Action.** Your first sentences must show the player's actual attempt (what they said, asked, examined or did), not a generic "you carry out your plan". Never write filler like "you successfully complete your action".
6. **Dialogue.** When the player speaks to or asks something of a character, that character REPLIES in quoted speech that fits their traits and personality, using only facts present in the context. If they would not know or would not tell, they deflect or say so in character. Characters a player hasn't addressed should not suddenly monologue.
7. **Invalid or impossible actions.** If the player attempts something impossible, absurd, or that the scene does not support (flying, conjuring items or money from nothing, using an item they were never given, commanding people who owe them nothing), narrate the attempt failing or being met with confusion or refusal in a natural way. Do NOT grant items, wealth, powers, information, quests or rewards that are not in the context.
8. **Continuity.** Stay consistent with Recent Events and the scene location and time. Do not move the player to a new location unless the outcome facts say they traveled. Do not repeat earlier prose.
9. **Memory.** When the player or a character recalls past events, answer ONLY from Recent Events and the Cast list. If the answer is not there, the character does not remember or does not know: never invent names, places or facts to fill the gap.
${styleLine}
${frozenStyle}
${loreContext ? `\n## Lore Context\n${loreContext}` : ''}

## Output Format
Return a single JSON object (no markdown fences) with exactly this shape:
{
  "ripple_narrative": "1-3 paragraphs of Markdown prose",
  "thought_chain": "One short sentence of hidden reasoning (never shown to the player)",
  "tier0_mutations": {
    "memory_stream": [{ "timestamp": "<ISO timestamp>", "event": "<one-line factual summary>", "outcome": "success" | "failure", "action": "<verb>" }]
  },
  "state_updates": {
    "entity_updates": [
      { "id": "<entity uuid>", "path": "relationships.player.<trust|warmth|respect|desire|awe>", "value": <small integer delta between -10 and 10>, "description": "<why>" }
    ],
    "world_updates": { "narrative.atmosphere": "<one-word atmosphere, only if it changed>" }
  }
}
Use "state_updates" ONLY when a specific bystander has a genuine, visible reaction to something the player did or said this turn. Passive or solitary actions (looking around, walking, resting, thinking) or actions nobody reacts to MUST leave "entity_updates" as an empty array. Use "state_updates" ONLY for social ripple effects on bystanders (how witnesses feel about the player after this turn). Omit "world_updates" keys that did not change. Keep entity_updates to at most 3 entries.`;
  }

  /**
   * User prompt: the facts of the turn the Narrator must render.
   */
  private buildNarratorUserPrompt(
    engineResult: EngineResultDto,
    gameState: GameState,
    directorIntent?: DirectorUnifiedIntent,
    conditionTransitions?: ConditionTransition[],
    playerInput?: string
  ): string {
    const { entities, playerId } = readSceneEntities(gameState);
    const getEntityName = (id: string): string => entityDisplayName(entities[id], 'an unnamed figure');

    const sections: string[] = [];

    // What the player actually did: the prose must answer THIS, not a generic action
    if (playerInput) {
      const who = playerId ? getEntityName(playerId) : 'the player';
      sections.push(`## Player Action (this is what ${who} just did or said - respond to it directly)\n"${playerInput}"`);
    }

    // Outcome facts, stated plainly (raw rolls/numbers are easy for a model to misread)
    sections.push(renderOutcomeFacts(engineResult, getEntityName, directorIntent));

    // Condition transitions (rules-engine facts: injuries, collapse, surrender)
    if (conditionTransitions && conditionTransitions.length > 0) {
      const lines = conditionTransitions.map(t =>
        `- ${getEntityName(t.entity_id)}: ${t.from || 'previous state'} → ${t.to}`
      );
      sections.push(`## Condition Changes (these ALREADY happened — show them through action and sensory detail, like a DM would; NEVER print these labels)\n${lines.join('\n')}\nExamples of intent: "Surrendered" → they throw down their weapon and yield; "Unconscious" → they crumple and do not rise; "Defeated" → the fight leaves them entirely; "Exhausted"/"Collapsed" → their body betrays them mid-motion.`);
    }

    // Unseen ripples (Director's social/emotional shifts)
    if (directorIntent?.unseen_ripples && directorIntent.unseen_ripples.length > 0) {
      const lines = directorIntent.unseen_ripples.map(r =>
        `- ${getEntityName(r.target_id)} (${r.type}, ${r.delta_tier}): ${r.reason}`
      );
      sections.push(`## Unseen Ripples (weave these reactions into the scene)\n${lines.join('\n')}`);
    }

    // Cast present
    const presentIds = new Set(presentEntityIds(gameState));
    const away = Object.keys(entities).filter((id) => !presentIds.has(id));
    const castLines = Object.entries(entities).filter(([id]) => presentIds.has(id)).slice(0, 12).map(([id, e]: [string, any]) => {
      const name = getEntityName(id);
      const p = e?.properties || {};
      const bits = [
        id === playerId && 'the PLAYER character',
        p.species && `species: ${p.species}`,
        p.archetype && `role: ${p.archetype}`,
        Array.isArray(p.traits) && p.traits.length && `traits: ${p.traits.join(', ')}`,
        Array.isArray(p.personality) && p.personality.length && `personality: ${p.personality.join(', ')}`,
        Array.isArray(p.ai_hints) && p.ai_hints.length && `note: ${p.ai_hints.join('; ')}`,
        p.description || e?.raw_data?.identity?.description,
      ].filter(Boolean).join('; ');
      return `- ${name} (${id})${bits ? ': ' + bits : ''}`;
    });
    if (castLines.length > 0) {
      sections.push(`## Cast Present (the only characters who can appear, speak or react)\n${castLines.join('\n')}`);
    }
    if (away.length > 0) {
      sections.push(`## Elsewhere (NOT here: they cannot appear, speak or react this turn)\n${away.map((id) => `- ${getEntityName(id)}`).join('\n')}`);
    }
    sections.push('## Player Possessions\nOrdinary travel gear only (a pack, simple tools, a knife, food and water). Nothing magical, rare or valuable, and no companions beyond the cast above.');

    // Scene context
    const scene = (gameState.tier0_narrative as any)?.scene_context;
    if (scene) {
      sections.push(`## Scene (the player is HERE right now: narrate this place, not places they have left)\n- Location: ${scene.location || scene.name || 'Unknown'}\n- Time: ${scene.time || 'Unknown'}\n- Atmosphere: ${scene.atmosphere || 'Neutral'}`);
    }

    // Recent dialogue for continuity
    const history = ((gameState.tier0_narrative as any)?.dialogue_history || []) as Array<{ role: string; content: string }>;
    const recent = history.slice(-10).map(h => `${h.role}: ${String(h.content).slice(0, 350)}`).join('\n');
    if (recent) {
      sections.push(`## Recent Events\n${recent}`);
    }

    sections.push(`Narrate this turn now. Return JSON only.`);
    return sections.join('\n\n');
  }

  /**
   * Deterministic mock narration for dev/testing (ENABLE_MOCK_AI or test_* inputs).
   */
  private mockNarrate(
    engineResult: EngineResultDto,
    gameState: GameState,
    triggerId?: string,
    conditionTransitions?: ConditionTransition[]
  ): Mas2ResponseDto {
    console.log('[MAS2] Using Mock Mode (deterministic narrative generation)');

    // Generate deterministic narrative based on trigger and outcome
    // The outcome_summary now contains aggregated results (e.g., "You slashed Goblin (Success) AND you slashed Orc (Fail)")
    let rippleNarrative = '';

    // Extract entity names from game state for narrative context
    const entities = gameState.tier1_mechanical?.entities || {};
    const getEntityName = (id: string): string => {
      const entity = entities[id] as any;
      return entity?.properties?.display_name ||
             entity?.properties?.name ||
             entity?.display_name ||
             `entity-${id.substring(0, 8)}`;
    };

    if (triggerId === 'combat_action' || triggerId?.includes('combat')) {
      if (engineResult.success) {
        // Use actual entity names from outcome_summary or state
        const targetNames = engineResult.outcome_summary?.match(/entity-([a-f0-9-]+)/g)?.map(m => {
          const id = m.replace('entity-', '');
          return getEntityName(id);
        }).join(' and ') || 'your opponent';

        rippleNarrative = `You lash out with your weapon! The clash is intense, and you manage to land a solid blow against ${targetNames}. ${targetNames.includes('Garret') ? 'The Guard Captain staggers back, clearly wounded.' : 'Your opponent staggers back, clearly wounded.'} The room falls silent as the violence spills over. The Bartender glares at you, hand reaching for a club, while the Bard hides behind his lute.`;
      } else {
        rippleNarrative = `You attempt to strike, but your opponent evades or parries your attack. The exchange leaves you off-balance.`;
      }
    } else if (triggerId === 'rest_action' || triggerId?.includes('rest')) {
      rippleNarrative = `You find a moment to catch your breath in the bustling tavern. The brief rest helps you recover some energy. The sounds of the Bard's lute and the chatter of patrons continue around you.`;
    } else if (triggerId === 'social_action' || triggerId?.includes('social')) {
      // Extract target from outcome_summary if available
      const targetMatch = engineResult.outcome_summary?.match(/entity-([a-f0-9-]+)/);
      const targetName = targetMatch ? getEntityName(targetMatch[1]) : 'the person';
      rippleNarrative = `You engage ${targetName} in conversation. ${targetName === 'Bartender' ? 'The jovial bartender responds warmly, his heavy frame shifting behind the bar.' : 'The interaction seems to have an effect on your relationship.'}`;
    } else if (triggerId === 'navigate' || triggerId?.includes('travel')) {
      rippleNarrative = `You prepare to travel. The journey from the tavern will take time and energy. The night air outside promises new adventures.`;
    } else {
      rippleNarrative = `You ${triggerId || 'act'}. ${engineResult.success ? 'The action succeeds.' : 'The action fails.'}`;
    }

    // Render condition transitions as prose, the way the real Narrator would —
    // the labels themselves never reach the player.
    if (conditionTransitions && conditionTransitions.length > 0) {
      const conditionProse: Record<string, string> = {
        Wounded: 'staggers, blood seeping through torn cloth',
        Critical: 'sways on unsteady legs, barely able to stand',
        Surrendered: 'throws down their weapon and raises trembling hands in surrender',
        Defeated: 'collapses in a heap, the fight gone out of them entirely',
        Unconscious: 'crumples to the ground and does not rise',
        Fatigued: 'is breathing hard now, movements slowing',
        Exhausted: 'can barely lift their arms, utterly spent',
        Collapsed: 'drops to their knees as their body gives out',
      };
      const sentences = conditionTransitions.map(t => {
        const name = getEntityName(t.entity_id);
        const prose = conditionProse[t.to] || `is visibly changed`;
        return `${name} ${prose}.`;
      });
      rippleNarrative += ` ${sentences.join(' ')}`;
    }

    // Generate tier0 mutations based on the action
    const tier0Mutations: Record<string, unknown> = {};

    // Add a memory entry
    const memories = (gameState.tier0_narrative?.memory_stream as unknown[]) || [];
    const newMemory = {
      timestamp: new Date().toISOString(),
      event: engineResult.outcome_summary || 'Action executed',
      outcome: engineResult.success ? 'success' : 'failure',
      action: triggerId || 'unknown',
    };
    memories.push(newMemory);
    tier0Mutations.memory_stream = memories;

    // For social_action, ensure we emit a trust mutation for the Bartender so test_social passes.
    if (triggerId === 'social_action' || triggerId?.includes('social')) {
      tier0Mutations['entities.00f2f66c-4ece-46df-ace9-af89a488c077.relationships.trust'] = 5;
    }
    const stateUpdates: Mas2ResponseDto['state_updates'] = triggerId === 'combat_action' && engineResult.success ? {
      entity_updates: [
        {
          id: '00f2f66c-4ece-46df-ace9-af89a488c077', // Bartender
          path: 'relationships.player.trust',
          value: -10, // Angry about fighting
          description: 'The Bartender glares at you, hand reaching for a club.',
        },
        {
          id: '7a70ee42-101d-4dd3-8cee-2882fdd8a84e', // Bard
          path: 'relationships.player.trust',
          value: -5, // Scared
          description: 'The Bard hides behind his lute.',
        },
      ],
      world_updates: {
        'narrative.atmosphere': 'Hostile',
      },
    } : undefined;

    const result: Mas2ResponseDto = {
      ripple_narrative: rippleNarrative,
      tier0_mutations: tier0Mutations,
      thought_chain: triggerId === 'combat_action' && engineResult.success
        ? '[MockAI] Observed Violence. Triggering social consequences for bystanders.'
        : undefined,
      state_updates: stateUpdates,
    };

    return Mas2ResponseDtoSchema.parse(result);
  }

  /**
   * Extract relevant lore fragments for narrative context
   */
  private extractLoreContext(compiledStory?: CompiledStory, triggerId?: string): string {
    if (!compiledStory?.narrative_index || compiledStory.narrative_index.length === 0) {
      return '';
    }

    // For now, return a summary of available lore
    // In a full implementation, this would perform RAG search based on action/context
    const loreCount = compiledStory.narrative_index.length;
    return `There are ${loreCount} lore fragments available in this world. Use them to inform the narrative style and context.`;
  }
}
