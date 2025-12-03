// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * MAS1 Service (The Interpreter)
 * Phase 6-B: Real LLM Integration
 * Maps user text input to structured actions using LLM
 */

import type { GameState, Mas1ResponseDto } from '@shared/types/chimera-runtime';
import { Mas1ResponseDtoSchema } from '@shared/types/chimera-runtime';
import { LlmService } from '../llm/llm.service';

export class Mas1Service {
  private llmService: LlmService;

  constructor(llmService?: LlmService) {
    this.llmService = llmService || new LlmService();
  }

  /**
   * Resolve user text input into a structured action using LLM
   * @param userText - The player's input text
   * @param gameState - Current game state for context
   * @param actionsMap - Map of available actions from compiled story
   * @returns Mas1ResponseDto with action_slug, parameters, and sentiment
   */
  async resolve(
    userText: string,
    gameState: GameState,
    actionsMap: Record<string, unknown>
  ): Promise<Mas1ResponseDto> {
    // Build system prompt with allowed actions
    const actionKeys = Object.keys(actionsMap);
    const systemPrompt = `You are the Game Referee. Your job is to identify the user's intent from their natural language input and map it to one of the Allowed Actions.

Allowed Actions: ${actionKeys.length > 0 ? actionKeys.join(', ') : 'wait'}

You must return a JSON object with:
- action_slug: One of the allowed action keys (must match exactly)
- parameters: An object with any extracted parameters (target, direction, item, etc.)
- sentiment: The emotional tone detected (e.g., "aggressive", "curious", "friendly", "neutral", "fearful")

If the user's intent doesn't match any allowed action, choose the closest match or default to "wait".
Extract any relevant parameters from the user's input (targets, directions, items, etc.).`;

    // Build user prompt with context
    const tier1Summary = this.summarizeTier1State(gameState.tier1_mechanical);
    const userPrompt = `User Input: "${userText}"

Current Game State Context:
${tier1Summary}

Available Actions: ${JSON.stringify(actionKeys)}

Return a JSON object matching the schema.`;

    // Call LLM with JSON mode
    const response = await this.llmService.generateJSON<Mas1ResponseDto>(
      systemPrompt,
      userPrompt,
      Mas1ResponseDtoSchema
    );

    // Validate that the action_slug exists in actionsMap
    if (!actionsMap[response.action_slug] && actionKeys.length > 0) {
      // If LLM returned an invalid action, try to find closest match
      const matchingAction = actionKeys.find(action => 
        action.includes(response.action_slug) || response.action_slug.includes(action)
      );
      
      if (matchingAction) {
        response.action_slug = matchingAction;
      } else {
        // Default to first available action or 'wait'
        response.action_slug = actionKeys[0] || 'wait';
      }
    }

    return response;
  }

  /**
   * Summarize Tier 1 mechanical state for context
   */
  private summarizeTier1State(tier1: Record<string, unknown>): string {
    const summary: string[] = [];

    // Extract player info
    if (tier1.player) {
      const player = tier1.player as Record<string, unknown>;
      if (player.stats) {
        summary.push(`Player Stats: ${JSON.stringify(player.stats)}`);
      }
      if (player.inventory) {
        summary.push(`Player Inventory: ${JSON.stringify(player.inventory)}`);
      }
    }

    // Extract location info
    if (tier1.location) {
      summary.push(`Location: ${JSON.stringify(tier1.location)}`);
    }

    // Extract entities info
    if (tier1.entities) {
      const entities = tier1.entities as Record<string, unknown>;
      const entityKeys = Object.keys(entities);
      if (entityKeys.length > 0) {
        summary.push(`Nearby Entities: ${entityKeys.join(', ')}`);
      }
    }

    return summary.length > 0 ? summary.join('\n') : 'No significant state information available.';
  }
}

