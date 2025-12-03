// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * MAS2 Service (The Narrator)
 * Phase 6-A: Mock/Heuristic implementation for narrative generation
 * Generates narrative text from engine outcomes using template-based logic
 */

import type { GameState, EngineResultDto, Mas2ResponseDto } from '@shared/types/chimera-runtime';
import { Mas2ResponseDtoSchema } from '@shared/types/chimera-runtime';

export class Mas2Service {
  /**
   * Narrate the outcome of an action (Mock/Heuristic)
   * @param engineResult - The deterministic result from the Engine
   * @param gameState - Current game state (Tier 0 context for narrative)
   * @param actionSlug - The action slug from MAS1 (optional, for better narrative)
   * @param worldStyle - Optional world style/theme for narrative tone (not used in mock)
   * @returns Mas2ResponseDto with ripple_narrative and tier0_mutations
   */
  async narrate(
    engineResult: EngineResultDto,
    gameState: GameState,
    actionSlug?: string,
    worldStyle?: string
  ): Promise<Mas2ResponseDto> {
    // Mock logic: Generate narrative based on engine result
    let rippleNarrative = '';
    const tier0Mutations: Record<string, unknown> = {};

    // Use action slug if provided, otherwise try to extract from summary
    const actionType = actionSlug || (engineResult.outcome_summary.match(/(attack|inspect|move|talk|use|wait)/i)?.[1]?.toLowerCase()) || 'action';
    
    if (engineResult.success) {
      rippleNarrative = `You executed ${actionType}. ${engineResult.outcome_summary}. The result was successful.`;
    } else {
      rippleNarrative = `You attempted ${actionType}. ${engineResult.outcome_summary}. The result was not as expected.`;
    }

    // Add details from numeric deltas
    const deltaEntries = Object.entries(engineResult.numeric_deltas);
    if (deltaEntries.length > 0) {
      const deltaDescriptions: string[] = [];
      
      for (const [path, delta] of deltaEntries) {
        if (typeof delta === 'number') {
          // Parse path to extract meaningful info
          if (path.includes('hp')) {
            if (delta < 0) {
              deltaDescriptions.push(`You take ${Math.abs(delta)} damage.`);
            } else if (delta > 0) {
              deltaDescriptions.push(`You recover ${delta} health.`);
            }
          } else if (path.includes('mana') || path.includes('mp')) {
            if (delta < 0) {
              deltaDescriptions.push(`You spend ${Math.abs(delta)} mana.`);
            } else if (delta > 0) {
              deltaDescriptions.push(`You recover ${delta} mana.`);
            }
          } else {
            // Generic delta description
            const change = delta > 0 ? 'increased' : 'decreased';
            deltaDescriptions.push(`Your ${path} has ${change} by ${Math.abs(delta)}.`);
          }
        }
      }
      
      if (deltaDescriptions.length > 0) {
        rippleNarrative += ' ' + deltaDescriptions.join(' ');
      }
    }

    // Add a closing sentence
    rippleNarrative += ' The world around you shifts slightly in response to your actions.';

    // Generate tier0 mutations based on the action
    // Add a memory entry
    const memories = (gameState.tier0_narrative.memory_stream as unknown[]) || [];
    const newMemory = {
      timestamp: new Date().toISOString(),
      event: engineResult.outcome_summary,
      outcome: engineResult.success ? 'success' : 'failure',
    };
    memories.push(newMemory);
    tier0Mutations.memory_stream = memories;

    const result: Mas2ResponseDto = {
      ripple_narrative: rippleNarrative,
      tier0_mutations: tier0Mutations,
    };

    return Mas2ResponseDtoSchema.parse(result);
  }
}

