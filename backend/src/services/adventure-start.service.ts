/**
 * Universal Adventure Start Service
 * 
 * Provides deterministic adventure resolution with AI-first narration.
 * Validates and processes adventure start data using the new start format.
 */

import { z } from 'zod';

// Schema for the new start object
export const StartSchema = z.object({
  scene: z.string(),
  policy: z.enum(['ai_first', 'scripted']).default('ai_first'),
  hints: z.array(z.string()).optional()
});

// Schema for adventure with start structure
export const AdventureWithStartSchema = z.object({
  start: StartSchema,
  scenes: z.array(z.object({
    id: z.string(),
    description: z.string().optional(),
    choices: z.array(z.object({
      id: z.string(),
      text: z.string()
    })).optional()
  })).optional()
});

export type StartData = z.infer<typeof StartSchema>;
export type AdventureWithStart = z.infer<typeof AdventureWithStartSchema>;

export interface AdventureStartError {
  code: 'ADVENTURE_START_UNRESOLVED' | 'NO_ADVENTURE_PRESENT' | 'INVALID_SCENE';
  message: string;
  availableAdventures?: string[];
}

export class AdventureStartService {
  /**
   * Validate adventure has required start structure
   */
  validateAdventure(adventure: any): AdventureWithStart {
    const validated = AdventureWithStartSchema.parse(adventure);
    
    // Ensure start.scene exists in scenes array
    if (validated.scenes && validated.scenes.length > 0) {
      const sceneExists = validated.scenes.some(scene => scene.id === validated.start.scene);
      if (!sceneExists) {
        throw new Error(`Start scene "${validated.start.scene}" not found in adventure scenes`);
      }
    }

    return validated;
  }

  /**
   * Resolve adventure start with deterministic order
   */
  resolveAdventureStart(
    adventure: AdventureWithStart,
    explicitSceneId?: string,
    availableAdventures: string[] = []
  ): { sceneId: string; startData: StartData } | AdventureStartError {
    // Resolution order: explicit > start.scene
    if (explicitSceneId) {
      // Validate explicit scene exists
      if (adventure.scenes && adventure.scenes.some(s => s.id === explicitSceneId)) {
        return {
          sceneId: explicitSceneId,
          startData: {
            scene: explicitSceneId,
            policy: adventure.start.policy,
            hints: adventure.start.hints
          }
        };
      } else {
        return {
          code: 'INVALID_SCENE',
          message: `Scene "${explicitSceneId}" not found in adventure`,
          availableAdventures
        };
      }
    }

    // Use the required start.scene
    return {
      sceneId: adventure.start.scene,
      startData: adventure.start
    };
  }

  /**
   * Parse adventure start commands
   */
  parseAdventureCommand(input: string): {
    adventureId?: string;
    sceneId?: string;
    command: 'begin_adventure' | 'begin_scene' | 'invalid';
  } {
    const normalizedInput = input.toLowerCase().trim();
    
    // Pattern: "Begin the adventure" or "Begin adventure"
    if (normalizedInput.startsWith('begin the adventure') || normalizedInput.startsWith('begin adventure')) {
      const match = input.match(/begin\s+(?:the\s+)?adventure\s+"?([^"]+)"?(?:\s+from\s+"?([^"]+)"?)?/i);
      if (match) {
        return {
          adventureId: match[1],
          sceneId: match[2],
          command: 'begin_adventure'
        };
      }
    }

    // Pattern: "Begin adventure <id> from <scene>"
    const explicitMatch = input.match(/begin\s+adventure\s+"?([^"]+)"?\s+from\s+"?([^"]+)"?/i);
    if (explicitMatch) {
      return {
        adventureId: explicitMatch[1],
        sceneId: explicitMatch[2],
        command: 'begin_adventure'
      };
    }

    return { command: 'invalid' };
  }

  /**
   * Generate first-turn AWF with AI-first narration
   */
  generateFirstTurnAWF(
    sceneId: string,
    startData: StartData,
    sceneData: any,
    worldContext: any,
    playerContext: any,
    timeData: { band: string; ticks: number }
  ): any {
    // Fire on_scene_start events if present
    const sceneEvents = this.fireSceneStartEvents(sceneId, sceneData);

    // Build AI prompt context
    const aiContext = this.buildAIContext(
      startData,
      sceneData,
      worldContext,
      playerContext,
      timeData
    );

    // Generate choices from scene affordances or context
    const choices = this.deriveChoices(sceneData, worldContext);

    // Ensure exactly one TIME_ADVANCE act
    const acts = [
      {
        eid: 'time_advance',
        t: 'TIME_ADVANCE',
        payload: { ticks: Math.max(1, timeData.ticks) }
      },
      ...sceneEvents
    ];

    return {
      scn: { id: sceneId, ph: 'scene_body' },
      txt: '', // Will be filled by AI based on context
      choices,
      acts,
      val: { ok: true, errors: [], repairs: [] }
    };
  }

  /**
   * Fire scene start events
   */
  private fireSceneStartEvents(sceneId: string, sceneData: any): any[] {
    const events: any[] = [];
    
    // Look for on_scene_start events in scene data
    if (sceneData.events?.on_scene_start) {
      for (const event of sceneData.events.on_scene_start) {
        events.push({
          eid: `scene_start_${Date.now()}`,
          t: event.type,
          payload: event.payload
        });
      }
    }

    return events;
  }

  /**
   * Build AI context for first-turn narration
   */
  private buildAIContext(
    startData: StartData,
    sceneData: any,
    worldContext: any,
    playerContext: any,
    timeData: { band: string; ticks: number }
  ): any {
    return {
      scene: {
        id: startData.scene,
        location: sceneData.location || 'unknown',
        description: sceneData.description || '',
        affordances: sceneData.affordances || []
      },
      world: {
        name: worldContext.name || 'Unknown World',
        description: worldContext.description || '',
        tone: worldContext.tone || 'neutral'
      },
      player: {
        name: playerContext.name || 'Adventurer',
        background: playerContext.background || '',
        stats: playerContext.stats || {}
      },
      hints: startData.hints || [],
      time: timeData,
      policy: startData.policy
    };
  }

  /**
   * Derive choices from scene affordances or context
   */
  private deriveChoices(sceneData: any, worldContext: any): Array<{id: string, label: string}> {
    // If scene has explicit choices, use them
    if (sceneData.choices && sceneData.choices.length > 0) {
      return sceneData.choices.map((choice: any, index: number) => ({
        id: choice.id || `choice_${index}`,
        label: choice.text || choice.label || `Choice ${index + 1}`
      }));
    }

    // Otherwise, derive 2-3 sensible choices from context
    const choices = [
      { id: 'explore', label: 'Explore the area' },
      { id: 'observe', label: 'Look around carefully' }
    ];

    // Add context-specific choice based on scene type
    if (sceneData.type === 'combat') {
      choices.push({ id: 'prepare', label: 'Prepare for battle' });
    } else if (sceneData.type === 'social') {
      choices.push({ id: 'interact', label: 'Engage with others' });
    } else {
      choices.push({ id: 'proceed', label: 'Continue forward' });
    }

    return choices.slice(0, 3); // Limit to 3 choices
  }
}

export const adventureStartService = new AdventureStartService();
