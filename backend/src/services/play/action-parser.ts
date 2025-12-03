/**
 * Action Parser Service (MAS 1: Pre-narrative)
 * Phase 4: The Play Engine
 * 
 * Implements the logic to resolve user intent and sentiment from natural language input.
 * This is the "Pre-narrative" AI that performs Coreference Resolution, Intent Parsing,
 * and Sentiment Analysis.
 */

import type { CompiledStoryJson } from '../chimera/rebuild-service.js';

/**
 * GameStateTiers structure
 */
export interface GameStateTiers {
  tier0_tracked_state: Record<string, unknown>;
  tier1_singular_state: Record<string, unknown>;
  tier2_relational_state: Record<string, unknown>;
}

/**
 * ActionDto - The structured action extracted from user input
 */
export interface ActionDto {
  action: string;
  target?: string;
  parameters?: Record<string, unknown>;
}

/**
 * Mas1ResponseDto - Output of MAS 1 (ActionParser Service)
 */
export interface Mas1ResponseDto {
  /**
   * For the Game Engine
   */
  actionDto: ActionDto;

  /**
   * For the RAG Search
   */
  resolvedQuery: string;

  /**
   * For MAS 2 - Sentiment detection
   */
  detectedSentiment: {
    /**
     * The primary emotion (e.g., "curious", "grudging", "sarcastic")
     */
    tone: string;
    /**
     * The strength of that emotion (1-10 scale)
     */
    intensity: number;
  };
}

/**
 * Parser context from compiled story
 */
interface ParserContext {
  prompt_rules: string[];
  available_actions: string[];
  available_entities: string[];
}

/**
 * Placeholder function to call MAS API
 * TODO: Replace with actual AI service integration (OpenAI, Anthropic, etc.)
 * 
 * @param prompt - The formatted prompt for the AI
 * @param model - The model identifier (optional)
 * @returns A promise that resolves to the AI's JSON response
 */
async function callMasApi(
  prompt: string,
  model?: string
): Promise<Mas1ResponseDto> {
  // Placeholder: In production, this would call an actual AI service
  // Example:
  // const response = await openai.chat.completions.create({
  //   model: model || 'gpt-4',
  //   messages: [{ role: 'user', content: prompt }],
  //   response_format: { type: 'json_object' }
  // });
  // return JSON.parse(response.choices[0].message.content) as Mas1ResponseDto;

  // Mock response for development
  console.log('[MAS 1] Mock API call with prompt:', prompt.substring(0, 200) + '...');
  
  // Simple mock that extracts basic action from input
  // Extract the user input from the prompt (it's at the end after "User Input: ")
  const userInputMatch = prompt.match(/User Input: "([^"]+)"/);
  const userInput = userInputMatch ? userInputMatch[1].toLowerCase() : prompt.toLowerCase();
  
  let action = 'look';
  let target: string | undefined;
  
  // Check in order of specificity (more specific first)
  if (userInput.includes('pick') || userInput.includes('lock')) {
    action = 'pick_lock';
    target = 'door';
  } else if (userInput.includes('talk') || userInput.includes('speak') || userInput.includes('say')) {
    action = 'talk';
    target = 'npc';
  } else if (userInput.includes('attack') || userInput.includes('hit') || userInput.includes('strike')) {
    action = 'attack';
    target = 'enemy';
  } else if (userInput.includes('move') || userInput.includes('go') || userInput.includes('walk')) {
    action = 'move';
  }

  return {
    actionDto: {
      action,
      target,
    },
    resolvedQuery: prompt.split('\n').pop() || 'User action',
    detectedSentiment: {
      tone: 'neutral',
      intensity: 5,
    },
  };
}

/**
 * Parse user input and extract action, intent, and sentiment
 * 
 * @param textInput - The user's natural language input
 * @param parserContextJson - The parser context from the compiled story
 * @param gameState - The current game state (all tiers)
 * @returns The parsed response containing actionDto, resolvedQuery, and detectedSentiment
 */
export async function parseAction(
  textInput: string,
  parserContextJson: CompiledStoryJson['parser_context_json'],
  gameState: GameStateTiers
): Promise<Mas1ResponseDto> {
  const context: ParserContext = {
    prompt_rules: parserContextJson.prompt_rules || [],
    available_actions: parserContextJson.available_actions || [],
    available_entities: parserContextJson.available_entities || [],
  };

  // Build the prompt for MAS 1
  const prompt = buildParserPrompt(textInput, context, gameState);

  // Call the AI service (mock for now)
  const response = await callMasApi(prompt);

  // Validate the response
  validateMas1Response(response, context);

  return response;
}

/**
 * Build the prompt for MAS 1 (Action Parser)
 */
function buildParserPrompt(
  textInput: string,
  context: ParserContext,
  gameState: GameStateTiers
): string {
  const promptRules = context.prompt_rules.join('\n');
  const availableActions = context.available_actions.length > 0
    ? `Available actions: ${context.available_actions.join(', ')}`
    : 'No specific actions defined';
  const availableEntities = context.available_entities.length > 0
    ? `Available entities: ${context.available_entities.join(', ')}`
    : 'No specific entities defined';

  // Build a summary of relevant game state for context
  const stateSummary = buildStateSummary(gameState);

  return `You are an action parser for an interactive narrative game. Your job is to:
1. Parse the user's natural language input into a structured action
2. Resolve coreferences (e.g., "it", "her", "that door")
3. Detect the user's sentiment and emotional intensity

${promptRules}

${availableActions}
${availableEntities}

Current Game State:
${stateSummary}

User Input: "${textInput}"

Return a JSON object with this exact structure:
{
  "actionDto": {
    "action": "string (one of the available actions)",
    "target": "string (optional, entity ID or name)",
    "parameters": {}
  },
  "resolvedQuery": "string (the resolved query for RAG search, e.g., 'User asks Kiera about the Slaver Camp')",
  "detectedSentiment": {
    "tone": "string (emotion: curious, angry, happy, sarcastic, etc.)",
    "intensity": number (1-10 scale, where 1 is barely noticeable and 10 is extreme)
  }
}`;
}

/**
 * Build a summary of the game state for the parser context
 */
function buildStateSummary(gameState: GameStateTiers): string {
  const parts: string[] = [];

  // Include relevant tier 0 state (narrative context)
  if (Object.keys(gameState.tier0_tracked_state).length > 0) {
    parts.push('Narrative State: ' + JSON.stringify(gameState.tier0_tracked_state, null, 2));
  }

  // Include relevant tier 1 state (simple mechanics)
  if (Object.keys(gameState.tier1_singular_state).length > 0) {
    parts.push('Game Mechanics: ' + JSON.stringify(gameState.tier1_singular_state, null, 2));
  }

  return parts.join('\n\n') || 'No significant game state';
}

/**
 * Validate the MAS 1 response
 */
function validateMas1Response(
  response: Mas1ResponseDto,
  context: ParserContext
): void {
  if (!response.actionDto || !response.actionDto.action) {
    throw new Error('MAS 1 response missing actionDto.action');
  }

  if (!response.resolvedQuery || typeof response.resolvedQuery !== 'string') {
    throw new Error('MAS 1 response missing or invalid resolvedQuery');
  }

  if (!response.detectedSentiment) {
    throw new Error('MAS 1 response missing detectedSentiment');
  }

  if (!response.detectedSentiment.tone || typeof response.detectedSentiment.tone !== 'string') {
    throw new Error('MAS 1 response missing or invalid detectedSentiment.tone');
  }

  if (
    typeof response.detectedSentiment.intensity !== 'number' ||
    response.detectedSentiment.intensity < 1 ||
    response.detectedSentiment.intensity > 10
  ) {
    throw new Error('MAS 1 response missing or invalid detectedSentiment.intensity (must be 1-10)');
  }

  // Warn if action is not in available actions (but don't fail - might be a valid new action)
  if (
    context.available_actions.length > 0 &&
    !context.available_actions.includes(response.actionDto.action)
  ) {
    console.warn(
      `[MAS 1] Action "${response.actionDto.action}" not in available actions list:`,
      context.available_actions
    );
  }
}

