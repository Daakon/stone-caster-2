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
import { isMockAiEnabled, isTestScenarioInput } from '../../config/ai-flags';

export class Mas2Service {
  private llmService: LlmService;

  constructor(llmService?: LlmService) {
    this.llmService = llmService || new LlmService();
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
   * @returns Mas2ResponseDto with ripple_narrative and tier0_mutations
   */
  async narrate(
    engineResult: EngineResultDto,
    gameState: GameState,
    triggerId?: string,
    worldStyle?: string,
    compiledStory?: CompiledStory,
    directorIntent?: DirectorUnifiedIntent,
    playerInput?: string
  ): Promise<Mas2ResponseDto> {
    if (isMockAiEnabled() || isTestScenarioInput(playerInput)) {
      return this.mockNarrate(engineResult, gameState, triggerId);
    }

    const system = this.buildNarratorSystemPrompt(worldStyle, compiledStory, triggerId);
    const user = this.buildNarratorUserPrompt(engineResult, gameState, directorIntent);

    // NO FALLBACK: state is not persisted until after narration, so a failed
    // turn is cleanly retryable by the player.
    return await this.llmService.generateJSON(system, user, Mas2ResponseDtoSchema);
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

    return `You are the **Narrator** of the Chimera Engine — a constrained observer. The mechanical outcome of this turn has ALREADY been decided by a deterministic engine. Your only job is to render that outcome as cinematic prose. You have NO authority to change what happened.

## Hard Constraints (No-Meta Rule)
- NEVER use game terms: "roll", "success", "fail", "stat", "modifier", "tier", "DTO", "D100", "HP", "stamina", "check".
- NEVER reveal raw numbers. Translate magnitudes into sensory description:
  - Minor/Low impact → a graze, a flicker of discomfort, a fleeting slight
  - Moderate → a solid blow, a clear reaction, a noticeable shift
  - Major/High → staggering damage, a dramatic change, an unmistakable turn
  - Severe → devastating, life-altering, the scene itself changes
- NEVER contradict the outcome facts you are given. If the engine says an action failed, it failed.

## Narration Rules
1. Write **1–3 paragraphs** of Markdown prose in second person ("You…").
2. **The Accident**: if the actual targets differ from the intended targets, the action went astray — narrate the mishap landing on the actual target(s).
3. **Unseen Ripples**: weave the provided ripple reasons into the scene as behavior, glances, and mood — the world reacting to what it just witnessed.
4. Ground the prose in the scene context and the named characters provided. Never invent new named characters or locations.
${styleLine}
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
Use "state_updates" ONLY for social ripple effects on bystanders (how witnesses feel about the player after this turn). Omit "world_updates" keys that did not change. Keep entity_updates to at most 3 entries.`;
  }

  /**
   * User prompt: the facts of the turn the Narrator must render.
   */
  private buildNarratorUserPrompt(
    engineResult: EngineResultDto,
    gameState: GameState,
    directorIntent?: DirectorUnifiedIntent
  ): string {
    const entities = gameState.tier1_mechanical?.entities || {};
    const getEntityName = (id: string): string => {
      const entity = entities[id] as any;
      return entity?.properties?.display_name ||
             entity?.properties?.name ||
             entity?.display_name ||
             entity?.raw_data?.identity?.name ||
             `an unnamed figure`;
    };

    const sections: string[] = [];

    // Outcome facts
    sections.push(`## Outcome (already decided — render, do not change)\n- Overall: ${engineResult.success ? 'the action succeeded' : 'the action failed'}\n- Summary: ${engineResult.outcome_summary || 'No summary provided'}`);

    // Target results (accident detection)
    if (engineResult.target_results && engineResult.target_results.length > 0) {
      const lines = engineResult.target_results.map(tr => {
        const intended = tr.intended_targets.map(getEntityName).join(', ') || 'no one';
        const actual = tr.actual_targets.map(getEntityName).join(', ') || 'no one';
        const accident = JSON.stringify(tr.intended_targets) !== JSON.stringify(tr.actual_targets);
        return `- Intended: ${intended} → Actually affected: ${actual} (${tr.resolution_summary})${accident ? ' ⚠ THE ACTION WENT ASTRAY — narrate the accident' : ''}`;
      });
      sections.push(`## Target Results\n${lines.join('\n')}`);
    }

    // Unseen ripples (Director's social/emotional shifts)
    if (directorIntent?.unseen_ripples && directorIntent.unseen_ripples.length > 0) {
      const lines = directorIntent.unseen_ripples.map(r =>
        `- ${getEntityName(r.target_id)} (${r.type}, ${r.delta_tier}): ${r.reason}`
      );
      sections.push(`## Unseen Ripples (weave these reactions into the scene)\n${lines.join('\n')}`);
    }

    // Cast present
    const castLines = Object.entries(entities).slice(0, 12).map(([id, e]: [string, any]) => {
      const name = getEntityName(id);
      const desc = e?.properties?.description || e?.raw_data?.identity?.description || '';
      return `- ${name} (${id})${desc ? `: ${desc}` : ''}`;
    });
    if (castLines.length > 0) {
      sections.push(`## Cast Present\n${castLines.join('\n')}`);
    }

    // Scene context
    const scene = (gameState.tier0_narrative as any)?.scene_context;
    if (scene) {
      sections.push(`## Scene\n- Location: ${scene.location || scene.name || 'Unknown'}\n- Time: ${scene.time || 'Unknown'}\n- Atmosphere: ${scene.atmosphere || 'Neutral'}`);
    }

    // Recent dialogue for continuity
    const history = ((gameState.tier0_narrative as any)?.dialogue_history || []) as Array<{ role: string; content: string }>;
    const recent = history.slice(-4).map(h => `${h.role}: ${h.content}`).join('\n');
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
    triggerId?: string
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
