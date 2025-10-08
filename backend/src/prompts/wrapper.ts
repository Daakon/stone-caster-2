/**
 * Ultra-lean prompt wrapper that assembles all model-facing context per turn
 * into one prompt string with strict section delimiters and compact SYSTEM preamble.
 */

import type { PromptContext } from './schemas.js';

export interface PromptWrapperResult {
  prompt: string;
  metadata: {
    sections: string[];
    tokenCount: number;
    assembledAt: string;
  };
}

export interface RNGData {
  policy: string;
  d20: number;
  d100: number;
}

export interface TimeData {
  band: 'dawn_to_mid_day' | 'mid_day_to_evening' | 'evening_to_mid_night' | 'mid_night_to_dawn';
  ticks: number;
}

export interface GameStateData {
  time: TimeData;
  rng: RNGData;
  playerInput: string;
  isFirstTurn: boolean;
}

/**
 * Ultra-lean prompt wrapper that creates a single prompt string
 * with strict section delimiters and SYSTEM preamble
 */
export class PromptWrapper {
  private readonly SYSTEM_PREAMBLE = `You are the runtime engine. Return ONE JSON object (AWF) with keys: scn, txt, optional choices, optional acts, optional val. No markdown, no code fences, no extra keys. Resolve checks using rng BEFORE composing txt. Include exactly one TIME_ADVANCE (ticks ≥ 1) each turn. Use 0–100 scales (50 baseline) for skills/relationships. Essence alignment affects behavior (Life/Death/Order/Chaos). NPCs may act on their own; offer reaction choices only if impact is major or consent unclear. Limit 2 ambient + 1 NPC↔NPC beat per turn; respect cooldowns. Time uses 60-tick bands (Dawn→Mid-Day→Evening→Mid-Night→Dawn); avoid real-world units.`;

  /**
   * Assemble a complete prompt with strict section delimiters
   */
  async assemblePrompt(
    context: PromptContext,
    gameState: GameStateData,
    coreData: any,
    worldData: any,
    adventureData: any,
    playerData: any
  ): Promise<PromptWrapperResult> {
    const sections: string[] = [];
    
    // SYSTEM preamble (always first)
    sections.push(this.SYSTEM_PREAMBLE);
    
    // Core section
    sections.push(this.createSection('CORE', this.minifyJson(coreData)));
    
    // World section
    sections.push(this.createSection('WORLD', this.minifyJson(worldData)));
    
    // Adventure section
    sections.push(this.createSection('ADVENTURE', this.minifyJson(adventureData)));
    
    // Game state section (only on first turn)
    if (gameState.isFirstTurn) {
      sections.push(this.createSection('GAME_STATE', this.minifyJson({
        time: gameState.time,
        rng: gameState.rng,
        turn: context.game.turn_index
      })));
    }
    
    // Player section
    sections.push(this.createSection('PLAYER', this.minifyJson(playerData)));
    
    // RNG section (always present)
    sections.push(this.createSection('RNG', this.minifyJson(gameState.rng)));
    
    // Input section
    sections.push(this.createSection('INPUT', gameState.playerInput));
    
    // Join sections and collapse redundant blank lines
    const prompt = sections
      .join('\n\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    return {
      prompt,
      metadata: {
        sections: ['SYSTEM', 'CORE', 'WORLD', 'ADVENTURE', ...(gameState.isFirstTurn ? ['GAME_STATE'] : []), 'PLAYER', 'RNG', 'INPUT'],
        tokenCount: this.estimateTokenCount(prompt),
        assembledAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Create a section with strict delimiters
   */
  private createSection(name: string, content: string): string {
    return `=== ${name}_BEGIN ===\n${content}\n=== ${name}_END ===`;
  }

  /**
   * Minify JSON by removing spaces, newlines, and comments
   */
  private minifyJson(data: any): string {
    return JSON.stringify(data, null, 0);
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokenCount(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Generate RNG data with policy and values
   */
  generateRNGData(): RNGData {
    return {
      policy: "d20 for checks, d100 for chance rolls",
      d20: Math.floor(Math.random() * 20) + 1,
      d100: Math.floor(Math.random() * 100) + 1,
    };
  }

  /**
   * Generate time data with band and ticks
   */
  generateTimeData(ticks: number): TimeData {
    const bands: TimeData['band'][] = [
      'dawn_to_mid_day',
      'mid_day_to_evening', 
      'evening_to_mid_night',
      'mid_night_to_dawn'
    ];
    
    const bandIndex = Math.floor(ticks / 60) % 4;
    const ticksInBand = ticks % 60;
    
    return {
      band: bands[bandIndex],
      ticks: ticksInBand,
    };
  }

  /**
   * Resolve player choice ID to human-readable label
   */
  resolvePlayerInput(optionId: string, choices: Array<{id: string, label: string}>): string {
    const choice = choices.find(c => c.id === optionId);
    return choice ? choice.label : optionId;
  }

  /**
   * Validate that all required content fixes are applied
   */
  validateContentFixes(
    gameState: GameStateData,
    coreData: any,
    worldData: any,
    adventureData: any
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check RNG policy is present
    if (!gameState.rng.policy || !gameState.rng.d20 || !gameState.rng.d100) {
      errors.push('RNG policy and values must be present each turn');
    }

    // Check time format uses bands + ticks
    if (!gameState.time.band || typeof gameState.time.ticks !== 'number') {
      errors.push('Time must use band + ticks format');
    }

    // Check band naming consistency (mid-day, mid-night)
    const allData = [coreData, worldData, adventureData];
    
    for (const data of allData) {
      if (data && typeof data === 'object') {
        const jsonStr = JSON.stringify(data);
        // Check for inconsistent naming - if we find both forms, it's inconsistent
        const hasCorrectForm = jsonStr.includes('mid-day') || jsonStr.includes('mid-night');
        const hasIncorrectForm = jsonStr.includes('midday') || jsonStr.includes('midnight');
        
        if (hasCorrectForm && hasIncorrectForm) {
          errors.push('Band names must use mid-day and mid-night consistently');
        }
      }
    }

    // Check player input is text, not UUID
    if (gameState.playerInput && gameState.playerInput.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      errors.push('Player input must be text, not UUID');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
