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
            // Fallback to static description if LLM fails
            return contextDescription || 'The story begins...';
        }
    }

    /**
     * Generates a reaction to the player's action (Turn N)
     */
    /**
     * Generates a reaction to the player's action (Turn N)
     * Returns structured data: narrative prose, system logs, and state mutations.
     */
    async generateReaction(state: GameState, playerInput: string): Promise<{
        narrative: string;
        system_logs: string[];
        state_delta: Record<string, any>;
    }> {
        // 1. Production Context Assembly (Keep this logic active so we know it works)
        const narrativeFocus = state.narrative;
        const history = narrativeFocus.history || [];
        const recentHistory = history.slice(-5);

        const historyText = recentHistory.map((h: any) =>
            `${h.role === 'player' ? 'Player' : 'Narrator'}: ${h.content || h.text}`
        ).join('\n');

        const contextDescription = narrativeFocus.scene_context.description;

        // 2. The Mock Switch (Simulate the LLM)
        // IF input contains "attack", return a Combat Simulation.
        if (playerInput.toLowerCase().includes('attack')) {
            return {
                narrative: "You lunge forward, your blade catching the guard off balance. He stumbles back, clutching his side, a look of shock replacing his stoic veneer.",
                system_logs: [
                    "[MECHANICAL] Strength Check (Roll: 15) vs Difficulty (10) -> SUCCESS.",
                    "[MECHANICAL] Damage Dealt: 12.",
                    "[MECHANICAL] Enemy Status: Staggered."
                ],
                state_delta: {
                    // Force a mutation to trigger Visual FX
                    "tier1_mechanical.current_stamina": -25, // Triggers "Screen Shake"
                    "tier1_mechanical.current_hp": -5
                }
            };
        }

        // ELSE return generic narrative
        const systemInstruction = narrativeFocus.director_instructions
            ? `Tone: ${narrativeFocus.director_instructions.tone}`
            : 'Style: Standard RPG Narrator';

        // We will still allow the LLM to run for non-combat to keep the "vibe" alive if we wanted, 
        // but for this strict Phase 5.5 Mock objective, we stick to the script or a simple generic response 
        // to strictly control the pipeline testing.

        return {
            narrative: `The world acknowledges your intent to "${playerInput}", but the mists hold fast. You feel the weight of your choices, yet nothing immediate shifts around you.`,
            system_logs: ["[SYSTEM] World State Unchanged."],
            state_delta: {}
        };
    }
}
