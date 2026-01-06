// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * Narrative Service
 * Handles server-side generation of story prose and narrative events.
 */

import { LlmService } from '../llm/llm.service.js';
import { GameStateBundle } from '../../domain/game-state.types.js';
import { getChimeraSupabaseAdminClient } from '../../db/supabase-client.js';
import { AiTurnResult } from './ai-types.js';

// Define GameState interface locally if not strictly exported as such, 
// or alias GameStateBundle if that is what the user meant by "state".
// Based on usage "state.narrative.scene_context", GameStateBundle fits.
type GameState = GameStateBundle;

interface GenesisResponse {
    narrative: string;
    scene_context: {
        location: string;
        time: string;
        atmosphere: string;
    };
}

// [PHASE 6.8] Dynamic Style Configuration
const toneStyles: Record<string, string> = {
    Dark: "Focus on sensory details of shadows, decay, and tension. Use ominous metaphors.",
    HighFantasy: "Use elevated language, focusing on grandeur, magic, and history.",
    Noir: "Use short, punchy sentences. Adopt a cynical, gritty tone.",
    Cyberpunk: "Focus on neon, tech, and decay. Use slang appropriate for a high-tech low-life setting."
};

const pacingStyles: Record<string, string> = {
    Fast: "Keep paragraphs short (max 2 sentences). Focus purely on action.",
    Slow: "Indulge in introspection and environmental description.",
    Concise: "Be direct. Avoid flowery language or excessive adjectives."
};

export class NarrativeService {
    private llm: LlmService;

    constructor(llmService?: LlmService) {
        this.llm = llmService || new LlmService();
    }

    /**
     * Generates the opening narrative (Turn 0) based on the Director's Slate
     * and the initial game state.
     */
    async generateOpeningNarrative(state: GameState, systemPromptOverride?: string): Promise<string> {
        // 1. Extract the Context
        const narrativeFocus = state.narrative;
        const config = narrativeFocus.director_instructions || {};
        const contextDescription = narrativeFocus.scene_context.description || "A new world awaits.";

        // [GENESIS] Build Cast Manifest
        const entities = state.mechanical.entities || {};
        const castList = Object.values(entities)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((e: any) => e.type !== 'PLAYER')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((e: any) => {
                const props = e.properties || {};
                const name = props.display_name || props.name || 'Unknown Figure';
                const desc = props.description || 'A mysterious figure.';
                const role = props.archetype ? ` (${props.archetype})` : '';
                return `- ${name}${role}: ${desc}`;
            });

        const manifestString = castList.length > 0
            ? `\nSCENE CAST (Use these visual descriptions):\n${castList.join('\n')}\n`
            : '';

        let systemPrompt = systemPromptOverride;
        let userPrompt = "Initialize the scene. Output JSON only.";

        if (systemPrompt) {
            // [PHASE 7] Standard: Context in User Prompt
            userPrompt = `
SETTING CONTEXT (MANDATORY):
${contextDescription}

CAST MANIFEST:
${manifestString}

INSTRUCTION:
Initialize the scene based STRICTLY on the SETTING CONTEXT above.
Do not invent a new location.
Output JSON only.
            `.trim();

        } else {
            // [LEGACY] Fallback: Context in System Prompt
            // [PHASE 6.8] Dynamic Style Injection
            const tone = config.tone || 'Dark';
            const pacing = config.pacing || 'Slow';

            // Use default 'Standard' if specific style not found (or fallback to Dark/Concise)
            const toneDesc = toneStyles[tone] || toneStyles.Dark;
            const pacingDesc = pacingStyles[pacing] || pacingStyles.Concise;

            const styleInstruction = `
STYLE DIRECTIVE:
- Tone: ${toneDesc}
- Pacing: ${pacingDesc}
- Formatting: Standard novel format. Double quotes for dialogue.
            `.trim();

            // 2. Construct Prompt (Legacy)
            systemPrompt = `
You are the Game Master initializing a new story.
${styleInstruction}

Setting Context:
${contextDescription}
${manifestString}

DIRECTIVE:
Generate the opening scene narrative.
ESTABLISH the location, time of day, and atmosphere based on the setting description.
OUTPUT FORMAT: Return valid JSON only. Do not use Markdown blocks.

JSON TEMPLATE:
{
  "narrative": "The story prose...",
  "scene_context": {
    "location": "Name of Location (e.g. The Wobbly Goblin)",
    "time": "Time of Day (e.g. Late Night)",
    "atmosphere": "Atmosphere (e.g. Tense, Rowdy)"
  }
}
            `.trim();
        }
        let result: GenesisResponse;

        // 3. Call LLM
        try {
            const rawResponse = await this.llm.generateText(systemPrompt, userPrompt, {
                maxTokens: 1500,
                temperature: 0.8,
                jsonMode: true
            });

            // [PHASE 6.6] JSON Sanitization & Parsing
            // Regex removes markdown code blocks or stray backticks
            const cleanJson = rawResponse.replace(/```json|```/g, '').trim();

            // Calculate mock cost (approx 4 chars per token)
            const promptTokens = Math.ceil((systemPrompt.length + userPrompt.length) / 4);
            const completionTokens = Math.ceil(cleanJson.length / 4);
            const totalTokens = promptTokens + completionTokens;
            const costStones = Math.ceil(totalTokens / 1000); // Mock rate

            const tokenUsage = {
                prompt: promptTokens,
                completion: completionTokens,
                total: totalTokens
            };

            try {
                result = JSON.parse(cleanJson);
            } catch (parseErr) {
                console.warn('[NarrativeService] Genesis JSON Parse Failed, attempting heuristic repair or fallback:', parseErr);
                // Simple Fallback if parsing completely fails but we have text
                if (cleanJson.length > 10 && !cleanJson.trim().startsWith('{')) {
                    result = {
                        narrative: cleanJson,
                        scene_context: {
                            location: narrativeFocus.scene_context.location || narrativeFocus.scene_context.name || "Unknown Location",
                            time: narrativeFocus.scene_context.time || "Unknown Time",
                            atmosphere: narrativeFocus.scene_context.atmosphere || "Neutral"
                        }
                    };
                } else {
                    throw parseErr; // Re-throw to hit the outer catch and use safe defaults
                }
            }

            // 4. Update State
            // We merge into existing context to preserve other fields
            narrativeFocus.scene_context.location = result.scene_context.location;
            narrativeFocus.scene_context.time = result.scene_context.time;
            narrativeFocus.scene_context.atmosphere = result.scene_context.atmosphere;

            // [AI AUDIT] Log the structured result
            await this.logAiTransaction({
                gameId: state.id,
                actionType: 'GENESIS',
                promptText: systemPrompt, // Truncate in DB call if needed
                rawResponse: cleanJson,
                tokenUsage,
                costStones,
                modelUsed: process.env.LLM_MODEL || 'gpt-4o-mini' // Default or ENV
            });

            return result.narrative;

        } catch (error) {
            console.error('[NarrativeService] Genesis Generation Failed:', error);

            // Safe Default Fallback
            narrativeFocus.scene_context.location = narrativeFocus.scene_context.name || "The Void";
            narrativeFocus.scene_context.time = "Timeless";
            narrativeFocus.scene_context.atmosphere = "Static";

            return narrativeFocus.scene_context.description || 'The story begins...';
        }
    }

    /**
     * Private Audit Logger
     * [PHASE 6.8] Writes to ai_audit_logs table via Service Role
     */
    private async logAiTransaction(params: {
        gameId: string;
        actionType: string;
        promptText: string;
        rawResponse: string;
        tokenUsage: Record<string, number>;
        costStones: number;
        modelUsed: string;
    }): Promise<void> {
        try {
            const supabase = getChimeraSupabaseAdminClient();

            // Console backup for quick debugging
            console.log(`[AI_AUDIT] ${params.actionType} | Cost: ${params.costStones} stones`);

            const { error } = await supabase
                .from('ai_audit_logs')
                .insert({
                    game_id: params.gameId,
                    action_type: params.actionType,
                    prompt_text: params.promptText,
                    raw_response: params.rawResponse,
                    token_usage: params.tokenUsage,
                    cost_stones: params.costStones,
                    model_used: params.modelUsed,
                    turn_index: null // Optional, passed if in turn loop
                });

            if (error) {
                console.error('[NarrativeService] Audit Log Failed:', error.message);
            }
        } catch (err) {
            console.error('[NarrativeService] Audit Log Exception:', err);
        }
    }

    /**
     * Generates a reaction to the player's action (Turn N)
     * Returns structured data: narrative prose, system logs, and state mutations.
     */
    async generateReaction(state: GameState, playerInput: string, systemPromptOverride?: string): Promise<AiTurnResult> {
        // 1. Production Context Assembly
        const narrativeFocus = state.narrative;

        let systemPrompt = systemPromptOverride;

        // FALLBACK: If no compiled prompt, build a basic one on the fly
        if (!systemPrompt) {
            const config = narrativeFocus.director_instructions || {};
            const tone = config.tone || 'Dark';
            const pacing = config.pacing || 'Concise';

            systemPrompt = `
[PRIME DIRECTIVE]
You are the Game Master. Output strict JSON.

[NARRATIVE STYLE]
Tone: ${tone}
Pacing: ${pacing}
            `.trim();
        }

        // 2. [PHASE 7] Real LLM Call
        // Context Assembly
        const historyUtils = narrativeFocus.dialogue_history || [];
        const recentHistory = historyUtils.slice(-3).map(h => `${h.role}: ${h.content}`).join('\n');

        // Safety check for nulls
        const mech = state.mechanical || { entities: {} };
        const playerEntity = mech.entities?.[state.index?.player_id || ''] || null;

        const userPrompt = `
[CURRENT STATE]
HP: ${playerEntity?.properties?.hp || 'Unknown'}
Stamina: ${playerEntity?.properties?.stamina || 'Unknown'}
Location: ${narrativeFocus.scene_context.location}

[RECENT HISTORY]
${recentHistory}

[PLAYER INPUT]
"${playerInput}"

[INSTRUCTION]
Process the player's input. Adhere to the mechanics in the system prompt.
Return the structured JSON object EXACTLY as defined in the output schema.
        `.trim();

        try {
            const jsonResponseText = await this.llm.generateText({
                systemPrompt: systemPrompt,
                userPrompt: userPrompt,
                temperature: 0.7,
                maxTokens: 500,
                jsonMode: true
            });

            // Parse JSON
            let result: AiTurnResult;
            try {
                result = JSON.parse(jsonResponseText);
            } catch (e) {
                console.error("Failed to parse AI JSON response", jsonResponseText);
                result = {
                    narrative: "The world blurs. (AI Error - Invalid JSON)",
                    thought_chain: "JSON Parse Failure",
                    state_updates: {}
                };
            }

            // [AI AUDIT]
            await this.logAiTransaction({
                gameId: state.id!,
                actionType: 'TURN_REACTION',
                promptText: systemPrompt + "\n---USER---\n" + userPrompt,
                rawResponse: jsonResponseText,
                tokenUsage: { total: Math.ceil(jsonResponseText.length / 4) },
                costStones: 0,
                modelUsed: process.env.LLM_MODEL || 'mock-rules-engine'
            });

            return result;

        } catch (error) {
            console.error('[NarrativeService] LLM Failure:', error);
            return {
                narrative: "Silence greets your action. The gods are silent.",
                thought_chain: "LLM Service Failure",
                state_updates: {}
            };
        }
    }
}
