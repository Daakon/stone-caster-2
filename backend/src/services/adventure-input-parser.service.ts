/**
 * Adventure Input Parser Service
 * 
 * Parses and normalizes adventure start commands with support for various formats.
 */

export interface ParsedAdventureCommand {
  command: 'begin_adventure' | 'begin_scene' | 'invalid';
  adventureId?: string;
  sceneId?: string;
  originalInput: string;
  normalizedInput: string;
}

export class AdventureInputParserService {
  /**
   * Parse adventure start commands with flexible grammar
   */
  parseAdventureCommand(input: string): ParsedAdventureCommand {
    const originalInput = input;
    const normalizedInput = this.normalizeInput(input);
    
    // Pattern 1: "Begin the adventure" (no specific adventure)
    if (this.matchesPattern(normalizedInput, /^begin\s+(?:the\s+)?adventure\s*$/)) {
      return {
        command: 'begin_adventure',
        originalInput,
        normalizedInput
      };
    }

    // Pattern 2: "Begin adventure <id>"
    const adventureMatch = normalizedInput.match(/^begin\s+(?:the\s+)?adventure\s+"?([^"]+)"?\s*$/);
    if (adventureMatch) {
      return {
        command: 'begin_adventure',
        adventureId: this.cleanId(adventureMatch[1]),
        originalInput,
        normalizedInput
      };
    }

    // Pattern 3: "Begin adventure <id> from <scene>"
    const explicitMatch = normalizedInput.match(/^begin\s+(?:the\s+)?adventure\s+"?([^"]+)"?\s+from\s+"?([^"]+)"?\s*$/);
    if (explicitMatch) {
      return {
        command: 'begin_adventure',
        adventureId: this.cleanId(explicitMatch[1]),
        sceneId: this.cleanId(explicitMatch[2]),
        originalInput,
        normalizedInput
      };
    }

    // Pattern 4: "Start adventure <id> from <scene>" (check this first)
    const startExplicitMatch = normalizedInput.match(/^start\s+(?:the\s+)?adventure\s+"?([^"]+)"?\s+from\s+"?([^"]+)"?\s*$/);
    if (startExplicitMatch) {
      return {
        command: 'begin_adventure',
        adventureId: this.cleanId(startExplicitMatch[1]),
        sceneId: this.cleanId(startExplicitMatch[2]),
        originalInput,
        normalizedInput
      };
    }

    // Pattern 5: "Start adventure <id>"
    const startMatch = normalizedInput.match(/^start\s+(?:the\s+)?adventure\s+"?([^"]+)"?\s*$/);
    if (startMatch) {
      return {
        command: 'begin_adventure',
        adventureId: this.cleanId(startMatch[1]),
        originalInput,
        normalizedInput
      };
    }

    // Pattern 6: "Begin scene <id>"
    const sceneMatch = normalizedInput.match(/^begin\s+scene\s+"?([^"]+)"?\s*$/);
    if (sceneMatch) {
      return {
        command: 'begin_scene',
        sceneId: this.cleanId(sceneMatch[1]),
        originalInput,
        normalizedInput
      };
    }

    return {
      command: 'invalid',
      originalInput,
      normalizedInput
    };
  }

  /**
   * Normalize input for consistent parsing
   */
  private normalizeInput(input: string): string {
    return input
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .replace(/[.,!?;:]+$/, ''); // Remove trailing punctuation
  }

  /**
   * Check if input matches a pattern
   */
  private matchesPattern(input: string, pattern: RegExp): boolean {
    return pattern.test(input);
  }

  /**
   * Clean and normalize IDs
   */
  private cleanId(id: string): string {
    return id
      .trim()
      .replace(/^["']|["']$/g, '') // Remove surrounding quotes
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .toLowerCase();
  }

  /**
   * Validate that a parsed command has required fields
   */
  validateParsedCommand(parsed: ParsedAdventureCommand): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (parsed.command === 'invalid') {
      errors.push('Invalid command format');
      return { valid: false, errors };
    }

    if (parsed.command === 'begin_adventure' && !parsed.adventureId) {
      errors.push('Adventure ID is required for begin_adventure command');
    }

    if (parsed.sceneId && !this.isValidSceneId(parsed.sceneId)) {
      errors.push('Invalid scene ID format');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate scene ID format
   */
  private isValidSceneId(sceneId: string): boolean {
    // Basic validation: alphanumeric, underscores, hyphens, dots
    return /^[a-zA-Z0-9._-]+$/.test(sceneId);
  }

  /**
   * Generate helpful error message for invalid commands
   */
  generateHelpMessage(): string {
    return `Valid adventure start commands:
- "Begin the adventure" (use active adventure)
- "Begin adventure <id>" (start specific adventure)
- "Begin adventure <id> from <scene>" (start at specific scene)
- "Start adventure <id>" (alternative to begin)
- "Begin scene <id>" (start specific scene)

Examples:
- "Begin the adventure"
- "Begin adventure whispercross"
- "Begin adventure whispercross from forest_meet"
- "Start adventure mystika-tutorial"`;
  }
}

export const adventureInputParserService = new AdventureInputParserService();
