/**
 * AI Response Adapter
 * Normalizes AI responses into TurnDTO format
 * 
 * This is the single source of truth for AI → TurnDTO transformation.
 * All paths that produce TurnDTO must use this adapter.
 */

import type { TurnDTO } from '@shared';

/**
 * Error thrown when AI response cannot be normalized to TurnDTO
 */
export class AiNormalizationError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'AiNormalizationError';
  }
}

/**
 * Base data required to construct a TurnDTO
 * Note: id should be the turn_number from the database (numeric)
 */
export interface TurnDTOBase {
  id: number; // Turn ID (turn_number from DB)
  gameId: string; // UUID
  turnCount: number; // >= 1
  createdAt: string; // ISO datetime
  castingStonesBalance: number;
}

/**
 * Normalize an AI response into TurnDTO
 * 
 * Mapping policy:
 * - narrative: prefer ai.txt (AWF v1) → else ai.narrative (legacy/custom) → else ai.scene?.txt → else fallback
 * - choices: prefer ai.choices array mapping { id, label||text } or ai['optional choices']
 * - emotion: ai.emotion || 'neutral'
 * - actions: map ai.acts || []
 * 
 * Supports both AWF v1 format ({ txt, 'optional choices' }) and legacy/custom format ({ narrative, choices })
 * 
 * @param ai - Raw AI response (parsed JSON)
 * @param base - Base TurnDTO fields (id, gameId, turnCount, createdAt, castingStonesBalance)
 * @returns Normalized TurnDTO with guaranteed non-empty narrative (fallback provided if AI returned empty)
 * @throws AiNormalizationError if choices.length === 0 or schema validation fails
 */
export async function aiToTurnDTO(ai: unknown, base: TurnDTOBase): Promise<TurnDTO> {
  // Ensure ai is an object
  if (!ai || typeof ai !== 'object') {
    throw new AiNormalizationError('AI response must be an object', { ai });
  }

  const aiObj = ai as Record<string, unknown>;

  // Debug: Log the incoming AI object structure
  console.log('[AI_ADAPTER] Processing AI object:', {
    keys: Object.keys(aiObj),
    hasTxt: typeof aiObj.txt === 'string',
    txtLength: typeof aiObj.txt === 'string' ? aiObj.txt.length : 0,
    hasNarrative: typeof aiObj.narrative === 'string',
    narrativeType: typeof aiObj.narrative,
    narrativeLength: typeof aiObj.narrative === 'string' ? aiObj.narrative.length : 0,
    narrativeValue: typeof aiObj.narrative === 'string' && aiObj.narrative.length > 0 
      ? aiObj.narrative.substring(0, 100) 
      : aiObj.narrative,
  });

  // Extract narrative with priority: txt → narrative → scene.txt
  // Support both AWF v1 ({ txt }) and legacy/custom ({ narrative }) formats
  let narrative = '';
  let narrativeSource = '';
  
  // Priority 1: txt (AWF v1 format)
  if (typeof aiObj.txt === 'string' && aiObj.txt.trim().length > 0) {
    narrative = aiObj.txt.trim();
    narrativeSource = 'txt';
    console.log('[AI_ADAPTER] Extracted narrative from txt field, length:', narrative.length);
  }
  // Priority 2: narrative (legacy/custom format)
  if (!narrative && typeof aiObj.narrative === 'string') {
    const trimmed = aiObj.narrative.trim();
    if (trimmed.length > 0) {
      narrative = trimmed;
      narrativeSource = 'narrative';
      console.log('[AI_ADAPTER] Extracted narrative from narrative field, length:', narrative.length);
    } else {
      // Log warning if narrative exists but is empty/whitespace
      console.warn('[AI_ADAPTER] Narrative field exists but is empty after trim:', {
        originalLength: aiObj.narrative.length,
        trimmedLength: trimmed.length,
        aiObjKeys: Object.keys(aiObj),
        narrativeType: typeof aiObj.narrative,
        narrativeValue: aiObj.narrative,
      });
    }
  }
  // Priority 3: scene.txt (nested format)
  else if (aiObj.scene && typeof aiObj.scene === 'object' && aiObj.scene !== null) {
    const scene = aiObj.scene as Record<string, unknown>;
    if (typeof scene.txt === 'string' && scene.txt.trim().length > 0) {
      narrative = scene.txt.trim();
      narrativeSource = 'scene.txt';
    }
  }

  // If narrative is empty, provide a user-safe fallback and log warning
  if (!narrative || narrative.length === 0) {
    console.warn('[AI_ADAPTER] AI response has no narrative field (checked txt, narrative, scene.txt)', {
      hasTxt: typeof aiObj.txt === 'string',
      hasNarrative: typeof aiObj.narrative === 'string',
      hasScene: !!aiObj.scene,
      aiKeys: Object.keys(aiObj),
    });
    
    // Provide fallback narrative (user-safe, concise)
    narrative = 'The scene unfolds before you, though the details remain unclear.';
    
    // Note: We'll include this in the TurnDTO's meta.warnings if needed
    // For now, we continue with fallback rather than throwing
  }

  // Extract choices with priority: choices array
  // Also check for 'optional choices' (AWF format)
  const choices: { id: string; label: string }[] = [];
  
  // Try standard choices array first
  let choicesSource = aiObj.choices;
  if (!Array.isArray(choicesSource) && aiObj['optional choices']) {
    choicesSource = aiObj['optional choices'];
  }
  
  if (Array.isArray(choicesSource)) {
    for (const choice of choicesSource) {
      if (typeof choice === 'object' && choice !== null) {
        const choiceObj = choice as Record<string, unknown>;
        
        // Extract id: prefer id, else generate from label/text
        let id = typeof choiceObj.id === 'string' ? choiceObj.id : '';
        
        // Extract label: prefer label, else text, else choice (AWF format)
        let label = '';
        if (typeof choiceObj.label === 'string') {
          label = choiceObj.label;
        } else if (typeof choiceObj.text === 'string') {
          label = choiceObj.text;
        } else if (typeof choiceObj.choice === 'string') {
          label = choiceObj.choice;
        }
        
        // If no ID provided, generate one from label (deterministic hash-like)
        if (!id && label) {
          // Simple deterministic ID from label (not UUID, just stable string)
          id = `choice_${label.toLowerCase().replace(/\s+/g, '_').slice(0, 50)}`;
        }
        
        if (id && label) {
          choices.push({ id, label });
        }
      } else if (typeof choice === 'string') {
        // If choice is just a string, use it as label and generate ID
        const label = choice;
        const id = `choice_${label.toLowerCase().replace(/\s+/g, '_').slice(0, 50)}`;
        choices.push({ id, label });
      }
    }
  }

  // Validate choices array is non-empty
  if (choices.length === 0) {
    const fallbackChoice = buildFallbackChoice(aiObj);
    choices.push(fallbackChoice);
    console.warn('[AI_ADAPTER] AI response returned no choices, applying fallback choice.', {
      fallbackChoice,
      aiKeys: Object.keys(aiObj),
    });
  }

  // Extract emotion: ai.emotion || 'neutral'
  let emotion: string = 'neutral';
  if (typeof aiObj.emotion === 'string' && aiObj.emotion.trim()) {
    emotion = aiObj.emotion.trim();
  }

  // Extract actions: ai.acts || []
  const actions: unknown[] = [];
  if (Array.isArray(aiObj.acts)) {
    actions.push(...aiObj.acts);
  }

  // Build warnings array for any issues
  const warnings: string[] = [];
  if (!narrativeSource) {
    warnings.push('AI_EMPTY_NARRATIVE'); // Narrative was empty, fallback used
  }
  if (choices.length === 1 && choices[0].id.startsWith('choice_fallback')) {
    warnings.push('AI_EMPTY_CHOICES');
  }

  // Construct TurnDTO
  const turnDTO: TurnDTO = {
    id: base.id,
    gameId: base.gameId,
    turnCount: base.turnCount,
    narrative, // Guaranteed non-empty (fallback provided if AI returned empty)
    emotion,
    choices,
    actions,
    createdAt: base.createdAt,
    castingStonesBalance: base.castingStonesBalance,
    // Optional fields from AI response
    npcResponses: Array.isArray(aiObj.npcResponses) ? aiObj.npcResponses : undefined,
    relationshipDeltas: typeof aiObj.relationshipDeltas === 'object' && aiObj.relationshipDeltas !== null ? (aiObj.relationshipDeltas as Record<string, number>) : undefined,
    factionDeltas: typeof aiObj.factionDeltas === 'object' && aiObj.factionDeltas !== null ? (aiObj.factionDeltas as Record<string, number>) : undefined,
    // Meta field for warnings and observability
    meta: warnings.length > 0 ? { warnings } : undefined,
  };

  // Validate the constructed TurnDTO against the schema
  const { TurnDTOSchema } = await import('@shared/types/dto.js');
  const validationResult = TurnDTOSchema.safeParse(turnDTO);
  if (!validationResult.success) {
    throw new AiNormalizationError(
      'Normalized TurnDTO failed schema validation',
      { validationErrors: validationResult.error.errors, turnDTO, narrativeSource }
    );
  }

  return validationResult.data;
}

function buildFallbackChoice(aiObj: Record<string, unknown>): { id: string; label: string } {
  const fallbackLabelCandidate =
    (typeof aiObj.fallbackChoice === 'string' && aiObj.fallbackChoice.trim()) ||
    (typeof aiObj.prompt === 'string' && aiObj.prompt.includes('question') ? 'Answer the question' : '') ||
    'Continue';

  const sanitized = fallbackLabelCandidate
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return {
    id: `choice_fallback_${sanitized || 'continue'}`,
    label: fallbackLabelCandidate || 'Continue',
  };
}

