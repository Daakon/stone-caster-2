// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * MAS2 Service (The Narrator)
 * Phase 6-B: Real LLM Integration
 * Generates narrative text from engine outcomes using LLM
 */

import type { GameState, EngineResultDto, Mas2ResponseDto } from '@shared/types/chimera-runtime';
import { Mas2ResponseDtoSchema } from '@shared/types/chimera-runtime';
import { LlmService } from '../llm/llm.service';
import type { CompiledStory } from '@shared/types/chimera-compiled';

export class Mas2Service {
  private llmService: LlmService;

  constructor(llmService?: LlmService) {
    this.llmService = llmService || new LlmService();
  }

  /**
   * Narrate the outcome of an action using LLM
   * @param engineResult - The deterministic result from the Engine
   * @param gameState - Current game state (Tier 0 context for narrative)
   * @param actionSlug - The action slug from MAS1 (optional, for better narrative)
   * @param worldStyle - Optional world style/theme for narrative tone
   * @param compiledStory - Optional compiled story for lore context
   * @returns Mas2ResponseDto with ripple_narrative and tier0_mutations
   */
  async narrate(
    engineResult: EngineResultDto,
    gameState: GameState,
    actionSlug?: string,
    worldStyle?: string,
    compiledStory?: CompiledStory
  ): Promise<Mas2ResponseDto> {
    // Build system prompt with style instructions
    const styleInstructions = worldStyle 
      ? `Write in the style of: ${worldStyle}.`
      : 'Write in an engaging, immersive narrative style.';
    
    const systemPrompt = `You are the Narrator. Your job is to describe the outcome of a player's action in an engaging, immersive way.

${styleInstructions}

Describe what happened based on the Engine Result. Make it vivid and engaging, but stay true to the mechanical outcome. Write in second person ("You..."). Keep the narrative concise (2-4 sentences).`;

    // Build user prompt with engine result and context
    const loreContext = this.extractLoreContext(compiledStory, actionSlug);
    const userPrompt = `Engine Result:
- Action: ${actionSlug || 'unknown'}
- Success: ${engineResult.success}
- Outcome Summary: ${engineResult.outcome_summary}
- Numeric Deltas: ${JSON.stringify(engineResult.numeric_deltas)}

${loreContext ? `Relevant Lore Context:\n${loreContext}\n` : ''}
Current Narrative State: ${JSON.stringify(gameState.tier0_narrative, null, 2)}

Generate a narrative description of what happened.`;

    // Call LLM for creative text generation
    const rippleNarrative = await this.llmService.generateText(systemPrompt, userPrompt);

    // Generate tier0 mutations based on the action
    const tier0Mutations: Record<string, unknown> = {};
    
    // Add a memory entry
    const memories = (gameState.tier0_narrative.memory_stream as unknown[]) || [];
    const newMemory = {
      timestamp: new Date().toISOString(),
      event: engineResult.outcome_summary,
      outcome: engineResult.success ? 'success' : 'failure',
      action: actionSlug,
    };
    memories.push(newMemory);
    tier0Mutations.memory_stream = memories;

    const result: Mas2ResponseDto = {
      ripple_narrative: rippleNarrative,
      tier0_mutations: tier0Mutations,
    };

    return Mas2ResponseDtoSchema.parse(result);
  }

  /**
   * Extract relevant lore fragments for narrative context
   */
  private extractLoreContext(compiledStory?: CompiledStory, actionSlug?: string): string {
    if (!compiledStory?.narrative_index || compiledStory.narrative_index.length === 0) {
      return '';
    }

    // For now, return a summary of available lore
    // In a full implementation, this would perform RAG search based on action/context
    const loreCount = compiledStory.narrative_index.length;
    return `There are ${loreCount} lore fragments available in this world. Use them to inform the narrative style and context.`;
  }
}

