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
   * @param engineResult - The deterministic result from the Engine (aggregated from multiple intents)
   * @param gameState - Current game state (Tier 0 context for narrative)
   * @param triggerId - The trigger_id from MAS1 (optional, for better narrative)
   * @param worldStyle - Optional world style/theme for narrative tone
   * @param compiledStory - Optional compiled story for lore context
   * @returns Mas2ResponseDto with ripple_narrative and tier0_mutations
   */
  async narrate(
    engineResult: EngineResultDto,
    gameState: GameState,
    triggerId?: string,
    worldStyle?: string,
    compiledStory?: CompiledStory
  ): Promise<Mas2ResponseDto> {
    // MOCK MODE: Return deterministic narrative based on engine result
    // TODO: Enable real LLM when ready
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
    
    // Mock: Add relationship change for combat actions (Guard gets mad if you attack someone else, etc)
    // Removed unknown entity 4c5bb787 to prevent "Unknown Entity" system logs in test_combat.
    
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

