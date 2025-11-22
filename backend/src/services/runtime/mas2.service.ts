// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * MAS2 Service (The Narrator)
 * Generates narrative text from engine outcomes
 */

import type { GameState, EngineResultDto, Mas2ResponseDto } from '@shared/types/chimera-runtime';
import { Mas2ResponseDtoSchema } from '@shared/types/chimera-runtime';
import { createLlmProvider, type LlmProvider } from './llm.provider.js';

export class Mas2Service {
  private llmProvider: LlmProvider;

  constructor(llmProvider?: LlmProvider) {
    this.llmProvider = llmProvider || createLlmProvider();
  }

  /**
   * Narrate the outcome of an action
   * @param engineResult - The deterministic result from the Engine
   * @param gameState - Current game state (Tier 0 context for narrative)
   * @param worldStyle - Optional world style/theme for narrative tone
   * @returns Mas2ResponseDto with ripple_narrative and tier0_mutations
   */
  async narrate(
    engineResult: EngineResultDto,
    gameState: GameState,
    worldStyle?: string
  ): Promise<Mas2ResponseDto> {
    const systemPrompt = `You are the Narrator for a text-based RPG game.
Your job is to create engaging narrative text that describes what happened based on the mechanical outcome.

Engine Outcome:
- Success: ${engineResult.success}
- Summary: ${engineResult.outcome_summary}
- Numeric Deltas: ${JSON.stringify(engineResult.numeric_deltas, null, 2)}

Current Narrative State (Tier 0):
${JSON.stringify(gameState.tier0_narrative, null, 2)}

${worldStyle ? `World Style: ${worldStyle}` : ''}

You must output strict JSON with the following structure:
{
  "ripple_narrative": "string (2-3 sentences describing what happened in an engaging, narrative style)",
  "tier0_mutations": {
    "key": "value (updates to narrative state like memories, relationships, story flags)"
  }
}

The narrative should:
- Be engaging and immersive
- Reflect the mechanical outcome (success/failure)
- Incorporate the numeric deltas naturally (e.g., "You take 5 damage" if hp: -5)
- Update narrative state appropriately (e.g., add memories, update relationships)
- Match the world style if provided`;

    const userPrompt = `Generate narrative for this outcome. Output JSON only.`;

    try {
      const response = await this.llmProvider.generateJson<Mas2ResponseDto>(
        systemPrompt,
        userPrompt
      );

      // Validate the response
      const validated = Mas2ResponseDtoSchema.parse(response);
      return validated;
    } catch (error) {
      console.error('[MAS2] Error generating narrative:', error);
      throw new Error(`Failed to generate narrative: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

