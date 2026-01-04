// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * Narrative Service
 * Handles server-side generation of story prose and narrative events.
 */

import { LlmService } from '../llm/llm.service.js';
import { GameStateBundle } from '../../domain/game-state.types.js';

// Define GameState interface locally if not strictly exported as such, 
// or alias GameStateBundle if that is what the user meant by "state".
// Based on usage "state.narrative.scene_context", GameStateBundle fits.
type GameState = GameStateBundle;

export class NarrativeService {
    private llm: LlmService;

    constructor(llmService?: LlmService) {
        this.llm = llmService || new LlmService();
    }

    /**
     * Generates the opening narrative (Turn 0) based on the Director's Slate
     * and the initial game state.
     */
    async generateOpeningNarrative(state: GameState): Promise<string> {
        // 1. Extract the Context
        // We prioritize Director's Instructions if present, otherwise fall back to description.
        const narrativeFocus = state.narrative;
        const systemInstruction = narrativeFocus.director_instructions
            ? `
Tone: ${narrativeFocus.director_instructions.tone}
Pacing: ${narrativeFocus.director_instructions.pacing}
Perspective: ${narrativeFocus.director_instructions.perspective}
      `.trim()
            : 'Style: Standard RPG Narrator';

        const contextDescription = narrativeFocus.scene_context.description;

        // 2. Construct Prompt
        const systemPrompt = `
You are the Narrator of an interactive story.
${systemInstruction}

Setting Context:
${contextDescription}
    `.trim();

        const userPrompt = "Generate the opening scene narrative based on the Director's Instructions. Do not output system logs, just the story prose.";

        // 3. Call LLM
        try {
            const response = await this.llm.generateText(systemPrompt, userPrompt);
            return response;
        } catch (error) {
            console.error('[NarrativeService] Failed to generate opening narrative:', error);
            // Fallback to static description if LLM fails
            return contextDescription || 'The story begins...';
        }
    }
}
