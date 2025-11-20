/**
 * Mas Context Provider Service (MAS 2: Narrative)
 * Phase 4: The Play Engine
 * 
 * This is "The Storyteller" - the only service in the loop that calls the creative AI (MAS).
 * It builds rich prompts using RAG retrieval and generates narrative responses.
 */

import type { OutcomeDto } from './action-resolver.js';
import type { GameStateTiers } from './action-parser.js';
import type { Mas1ResponseDto } from './action-parser.js';
import type { CompiledStoryJson } from '../chimera/rebuild-service.js';

/**
 * Mas2ResponseDto - Output of MAS 2 (Narrative)
 */
export interface Mas2ResponseDto {
  /**
   * The story text (narrated with player agency respected)
   */
  ripple_narrative: string;

  /**
   * AI-driven narrative changes (Tier 0 only)
   */
  mutations: Array<{
    op: 'set' | 'add' | 'remove';
    path: string;
    value: unknown;
  }>;

  /**
   * AI-driven mechanical requests for the Engine
   */
  engine_requests?: Array<{
    action: string;
    target?: string;
    parameters?: Record<string, unknown>;
  }>;
}

/**
 * Narrative context from compiled story
 */
interface NarrativeContext {
  prompt_rules_with_guardrails: string[];
  rag_index: number[][];
}

/**
 * Placeholder function to call MAS API for narrative generation
 * TODO: Replace with actual AI service integration (OpenAI, Anthropic, etc.)
 * 
 * @param prompt - The formatted prompt for the AI
 * @param model - The model identifier (optional)
 * @returns A promise that resolves to the AI's JSON response
 */
async function callMas2Api(
  prompt: string,
  model?: string
): Promise<Mas2ResponseDto> {
  // Placeholder: In production, this would call an actual AI service
  // Example:
  // const response = await openai.chat.completions.create({
  //   model: model || 'gpt-4',
  //   messages: [{ role: 'user', content: prompt }],
  //   response_format: { type: 'json_object' }
  // });
  // return JSON.parse(response.choices[0].message.content) as Mas2ResponseDto;

  // Mock response for development
  console.log('[MAS 2] Mock API call with prompt length:', prompt.length);
  
  // Extract outcome from prompt to generate appropriate narrative
  const outcomeMatch = prompt.match(/Outcome:\s*({[^}]+})/);
  const outcomeText = outcomeMatch ? outcomeMatch[1] : '';
  const isSuccess = outcomeText.includes('"success":true') || outcomeText.includes('success: true');

  return {
    ripple_narrative: isSuccess
      ? 'You successfully complete the action. The world reacts accordingly.'
      : 'Your attempt fails, but the world continues to turn.',
    mutations: [
      {
        op: 'set',
        path: '/tier0_tracked_state/events_memory/0',
        value: 'Player attempted action',
      },
    ],
    engine_requests: [],
  };
}

/**
 * Perform vector search on RAG index
 * TODO: Replace with actual vector similarity search (cosine similarity, etc.)
 * 
 * @param query - The resolved query from MAS 1
 * @param ragIndex - The RAG index (array of vectors)
 * @param topK - Number of results to return
 * @returns Array of indices of the most relevant chunks
 */
function performRagSearch(
  query: string,
  ragIndex: number[][],
  topK: number = 3
): number[] {
  // Placeholder: In production, this would:
  // 1. Vectorize the query
  // 2. Calculate cosine similarity with each vector in ragIndex
  // 3. Return top K indices

  // For now, return first K indices (or all if less than K)
  const maxResults = Math.min(topK, ragIndex.length);
  return Array.from({ length: maxResults }, (_, i) => i);
}

/**
 * Build narrative context and generate response
 * 
 * @param outcome - The outcome from ActionResolver
 * @param gameState - The current game state (all tiers)
 * @param narrativeContextJson - The narrative context from the compiled story
 * @param mas1Response - The full MAS 1 response (for resolvedQuery and detectedSentiment)
 * @returns The narrative response from MAS 2
 */
export async function generateNarrative(
  outcome: OutcomeDto,
  gameState: GameStateTiers,
  narrativeContextJson: CompiledStoryJson['narrative_context_json'],
  mas1Response: Mas1ResponseDto
): Promise<Mas2ResponseDto> {
  const context: NarrativeContext = {
    prompt_rules_with_guardrails: narrativeContextJson.prompt_rules_with_guardrails || [],
    rag_index: narrativeContextJson.rag_index || [],
  };

  // Step 1: Perform RAG search
  const ragIndices = performRagSearch(mas1Response.resolvedQuery, context.rag_index, 3);
  const ragChunks = ragIndices.map((idx) => {
    // In production, this would retrieve the actual text chunk
    // For now, return a placeholder
    return `Lore chunk ${idx + 1}: Relevant information about "${mas1Response.resolvedQuery}"`;
  });

  // Step 2: Build the prompt
  const prompt = buildNarrativePrompt(outcome, gameState, context, mas1Response, ragChunks);

  // Step 3: Call MAS 2 API
  const response = await callMas2Api(prompt);

  // Step 4: Validate response
  validateMas2Response(response);

  return response;
}

/**
 * Build the prompt for MAS 2 (Narrative)
 */
function buildNarrativePrompt(
  outcome: OutcomeDto,
  gameState: GameStateTiers,
  context: NarrativeContext,
  mas1Response: Mas1ResponseDto,
  ragChunks: string[]
): string {
  // Top: Guardrails and Narrative Rules
  const guardrails = context.prompt_rules_with_guardrails
    .filter((rule) => rule.includes('NEVER') || rule.includes('DON\'T') || rule.includes('MUST NOT'))
    .join('\n');
  
  const narrativeRules = context.prompt_rules_with_guardrails
    .filter((rule) => !rule.includes('NEVER') && !rule.includes('DON\'T') && !rule.includes('MUST NOT'))
    .join('\n');

  // Middle: Current Game State
  const stateText = buildStateText(gameState);

  // Middle: RAG Results
  const ragText = ragChunks.length > 0
    ? `\n\nRelevant Lore:\n${ragChunks.join('\n\n')}`
    : '';

  // Bottom: Outcome and Sentiment
  const outcomeText = JSON.stringify(outcome, null, 2);
  const sentimentText = `The player's tone was ${mas1Response.detectedSentiment.tone} with an intensity of ${mas1Response.detectedSentiment.intensity}/10.`;

  return `You are a master storyteller for an interactive narrative game. Your job is to narrate the outcome of player actions in a compelling, immersive way.

${guardrails ? `\n🚨 CRITICAL RULES (NEVER VIOLATE):\n${guardrails}\n` : ''}

${narrativeRules ? `\nNarrative Guidelines:\n${narrativeRules}\n` : ''}

Current Game State:
${stateText}${ragText}

Action Outcome:
${outcomeText}

${sentimentText}

Generate a narrative response (2-6 sentences) that:
1. Describes what happened based on the outcome
2. Shows the world's reaction
3. Respects player agency (NEVER narrate actions for the player)
4. Incorporates relevant lore when appropriate
5. Matches the player's emotional tone and intensity

Return a JSON object with this structure:
{
  "ripple_narrative": "string (the narrative text, 2-6 sentences)",
  "mutations": [
    {
      "op": "set",
      "path": "/tier0_tracked_state/...",
      "value": "..."
    }
  ],
  "engine_requests": [] // Optional: AI-driven mechanical requests (will be validated)
}`;
}

/**
 * Build a text representation of the game state
 */
function buildStateText(gameState: GameStateTiers): string {
  const parts: string[] = [];

  // Tier 0: Narrative state
  if (Object.keys(gameState.tier0_tracked_state).length > 0) {
    parts.push('Narrative State:');
    parts.push(JSON.stringify(gameState.tier0_tracked_state, null, 2));
  }

  // Tier 1: Simple mechanics
  if (Object.keys(gameState.tier1_singular_state).length > 0) {
    parts.push('\nGame Mechanics:');
    parts.push(JSON.stringify(gameState.tier1_singular_state, null, 2));
  }

  // Tier 2: Complex mechanics (simplified for narrative)
  if (Object.keys(gameState.tier2_relational_state).length > 0) {
    const skills = gameState.tier2_relational_state.player_skills as Record<string, unknown> | undefined;
    if (skills && Object.keys(skills).length > 0) {
      parts.push('\nPlayer Skills:');
      parts.push(JSON.stringify(skills, null, 2));
    }
  }

  return parts.join('\n') || 'No significant game state';
}

/**
 * Validate the MAS 2 response
 */
function validateMas2Response(response: Mas2ResponseDto): void {
  if (!response.ripple_narrative || typeof response.ripple_narrative !== 'string') {
    throw new Error('MAS 2 response missing or invalid ripple_narrative');
  }

  if (!Array.isArray(response.mutations)) {
    throw new Error('MAS 2 response missing or invalid mutations array');
  }

  // Validate mutation paths (should only be tier0)
  for (const mutation of response.mutations) {
    if (!mutation.path.startsWith('/tier0_tracked_state')) {
      throw new Error(
        `MAS 2 mutation path "${mutation.path}" is not allowed. Only tier0_tracked_state mutations are permitted.`
      );
    }
  }

  if (response.engine_requests && !Array.isArray(response.engine_requests)) {
    throw new Error('MAS 2 response engine_requests must be an array if present');
  }
}

