// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * MAS1 Service (The Interpreter)
 * Maps user text input to structured actions using LLM
 */

import type { GameState, Mas1ResponseDto } from '@shared/types/chimera-runtime';
import { Mas1ResponseDtoSchema } from '@shared/types/chimera-runtime';
import { createLlmProvider, type LlmProvider } from './llm.provider.js';

export class Mas1Service {
  private llmProvider: LlmProvider;

  constructor(llmProvider?: LlmProvider) {
    this.llmProvider = llmProvider || createLlmProvider();
  }

  /**
   * Resolve user text input into a structured action
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
    const systemPrompt = `You are the Action Interpreter for a text-based RPG game.
Your job is to map the user's natural language input to one of the valid actions available in the game.

Available Actions:
${JSON.stringify(actionsMap, null, 2)}

Current Game State (for context):
Tier 1 (Mechanical): ${JSON.stringify(gameState.tier1_mechanical, null, 2)}
Tier 0 (Narrative): ${JSON.stringify(gameState.tier0_narrative, null, 2)}

You must output strict JSON with the following structure:
{
  "action_slug": "string (one of the action keys from the actions map)",
  "parameters": { "key": "value" (extracted parameters for the action) },
  "sentiment": "string (emotional tone: aggressive, cautious, friendly, neutral, etc.)"
}

If the user's input doesn't match any action, choose the closest match or use a generic "wait" action.
Always extract relevant parameters from the user's text (e.g., target names, item names, directions).`;

    const userPrompt = `User input: "${userText}"

Map this to an action and extract parameters. Output JSON only.`;

    try {
      const response = await this.llmProvider.generateJson<Mas1ResponseDto>(
        systemPrompt,
        userPrompt
      );

      // Validate the response
      const validated = Mas1ResponseDtoSchema.parse(response);
      return validated;
    } catch (error) {
      console.error('[MAS1] Error resolving action:', error);
      throw new Error(`Failed to resolve action: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

