// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * MAS1 Service (The Interpreter)
 * Phase 6-B: Real LLM Integration
 * Maps user text input to structured actions using LLM
 */

import type { GameState, Mas1Intent } from '@shared/types/chimera-runtime';
import { Mas1IntentSchema } from '@shared/types/chimera-runtime';
import { LlmService } from '../llm/llm.service';
import { z } from 'zod';

/**
 * Schema for MAS-1 response: Object wrapper (required by OpenAI json_object format)
 * The LLM must return an object, not a raw array, due to response_format: { type: 'json_object' }
 */
const Mas1ResponseSchema = z.object({
  intents: z.array(Mas1IntentSchema),
});

export class Mas1Service {
  private llmService: LlmService;

  constructor(llmService?: LlmService) {
    this.llmService = llmService || new LlmService();
  }

  /**
   * Resolve user text input into structured intents using LLM
   * @param userText - The player's input text
   * @param gameState - Current game state for context
   * @param actionsMap - Map of available actions from compiled story
   * @returns Array of Mas1Intent matching ruleset trigger definitions
   * @throws Error if LLM provider fails or validation fails - NO FALLBACK
   */
  async resolve(
    userText: string,
    gameState: GameState,
    actionsMap: Record<string, unknown>
  ): Promise<Mas1Intent[]> {
    const systemPrompt = this.buildSystemPrompt(gameState, actionsMap);
    
    console.log('[Mas1Service] Resolving user input:', userText);
    console.log('[Mas1Service] System prompt includes "Action Interpreter":', systemPrompt.includes('Action Interpreter'));
    
    // Call LLM provider - Expect { intents: Mas1Intent[] } wrapper
    // OpenAI requires response_format: { type: 'json_object' }, so we cannot return a raw array
    // Validation happens in LlmService.generateJSON with Mas1ResponseSchema
    // If validation fails, error is thrown immediately - no fallback
    const response = await this.llmService.generateJSON<{ intents: Mas1Intent[] }>(
      systemPrompt,
      userText,
      Mas1ResponseSchema
    );
    
    console.log('[Mas1Service] LLM response received:', {
      hasIntents: !!response.intents,
      intentCount: response.intents?.length || 0,
      firstIntent: response.intents?.[0]?.trigger_id,
      responseKeys: Object.keys(response || {})
    });
    
    // Unwrap the intents array from the response object
    if (!response.intents || !Array.isArray(response.intents)) {
      throw new Error(
        `[Mas1Service] Invalid response structure: expected { intents: Mas1Intent[] }, got ${JSON.stringify(response)}`
      );
    }
    
    if (response.intents.length === 0) {
      console.warn('[Mas1Service] ⚠️ Received empty intents array for input:', userText);
    }
    
    return response.intents;
  }

  /**
   * Build system prompt for MAS1 interpreter
   */
  private buildSystemPrompt(gameState: GameState, actionsMap: Record<string, unknown>): string {
    const stateSummary = this.summarizeTier1State(gameState.tier1_mechanical || {});
    const actionKeys = Object.keys(actionsMap);
    
    return `You are the Chimera Action Interpreter (MAS-1). Your role is to map user text input to structured Mas1Intent objects.

Available trigger IDs: combat_action, social_action, rest_action, attempt_action, navigate

Available actions: ${actionKeys.join(', ')}

Current game state:
${stateSummary}

Return a JSON object with a key 'intents' containing an array of Mas1Intent objects matching the user's input. Each intent must have:
- trigger_id: One of the valid trigger IDs
- target_ids: Array of UUID strings (empty array if no targets)
- parameters: Object with verb (required), and optionally tactic_tag, difficulty_mod, skill_id
- duration_tag: moment, scene, journey, or rest
- original_text: The user's input text`;
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

