// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * MAS1 Service (The Interpreter)
 * Phase 6-A: Mock/Heuristic implementation for intent resolution
 * Maps user text input to structured actions using pattern matching
 */

import type { GameState, Mas1ResponseDto } from '@shared/types/chimera-runtime';
import { Mas1ResponseDtoSchema } from '@shared/types/chimera-runtime';

export class Mas1Service {
  /**
   * Resolve user text input into a structured action (Mock/Heuristic)
   * @param userText - The player's input text
   * @param gameState - Current game state for context
   * @param actionsMap - Map of available actions from compiled story
   * @returns Mas1ResponseDto with action_slug, parameters, and sentiment
   */
  async resolve(
    userText: string,
    gameState: GameState,
    actionsMap: Record<string, unknown>
  ): Promise<Mas1ResponseDto> {
    const text = userText.toLowerCase().trim();

    // Mock logic: Pattern matching for common actions
    let actionSlug = 'wait';
    const parameters: Record<string, unknown> = {};
    let sentiment = 'neutral';

    // Attack patterns
    if (text.includes('attack') || text.includes('hit') || text.includes('strike') || text.includes('fight')) {
      actionSlug = 'attack';
      sentiment = 'aggressive';
      
      // Try to extract target
      const targetMatch = text.match(/(?:attack|hit|strike|fight)\s+(?:the\s+)?(\w+)/);
      if (targetMatch) {
        parameters.target = targetMatch[1];
      } else {
        parameters.target = 'enemy'; // Default target
      }
    }
    // Look/Inspect patterns
    else if (text.includes('look') || text.includes('examine') || text.includes('inspect') || text.includes('check')) {
      actionSlug = 'inspect';
      sentiment = 'curious';
      
      // Try to extract what to look at
      const objectMatch = text.match(/(?:look|examine|inspect|check)\s+(?:at|around|for)?\s*(?:the\s+)?(\w+)/);
      if (objectMatch) {
        parameters.object = objectMatch[1];
      }
    }
    // Move patterns
    else if (text.includes('go') || text.includes('move') || text.includes('walk') || text.includes('run')) {
      actionSlug = 'move';
      sentiment = 'neutral';
      
      // Try to extract direction
      const directionMatch = text.match(/(?:go|move|walk|run)\s+(?:to|towards|north|south|east|west|up|down|forward|backward)/);
      if (directionMatch) {
        const dir = directionMatch[0].split(/\s+/).pop();
        if (dir) parameters.direction = dir;
      }
    }
    // Talk patterns
    else if (text.includes('talk') || text.includes('speak') || text.includes('say') || text.includes('tell')) {
      actionSlug = 'talk';
      sentiment = 'friendly';
      
      // Try to extract target
      const targetMatch = text.match(/(?:talk|speak|say|tell)\s+(?:to|with)?\s*(?:the\s+)?(\w+)/);
      if (targetMatch) {
        parameters.target = targetMatch[1];
      }
    }
    // Use item patterns
    else if (text.includes('use') || text.includes('take') || text.includes('pick')) {
      actionSlug = 'use';
      sentiment = 'neutral';
      
      // Try to extract item
      const itemMatch = text.match(/(?:use|take|pick)\s+(?:up)?\s*(?:the\s+)?(\w+)/);
      if (itemMatch) {
        parameters.item = itemMatch[1];
      }
    }

    // Check if the resolved action exists in actionsMap
    // If not, try to find a similar action or default to 'wait'
    if (!actionsMap[actionSlug]) {
      // Try to find a matching action in the map
      const availableActions = Object.keys(actionsMap);
      const matchingAction = availableActions.find(action => 
        action.includes(actionSlug) || actionSlug.includes(action)
      );
      
      if (matchingAction) {
        actionSlug = matchingAction;
      } else if (availableActions.length > 0) {
        // Default to first available action if none match
        actionSlug = availableActions[0];
      } else {
        actionSlug = 'wait';
      }
    }

    const result: Mas1ResponseDto = {
      action_slug: actionSlug,
      parameters,
      sentiment,
    };

    return Mas1ResponseDtoSchema.parse(result);
  }
}

