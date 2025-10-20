// Prompt Assembler State Adapters
// Handles dynamic content for game_state, player, rng, and input sections

import type { AssembleArgs } from './types';
import { block } from './markdown';

/**
 * Builds game state content from provided text
 * @param gameStateText The game state text
 * @returns Formatted game state block
 */
export function buildGameStateBlock(gameStateText?: string): string {
  if (!gameStateText?.trim()) return '';
  
  return block('game_state', gameStateText.trim());
}

/**
 * Builds player content from provided text
 * @param playerText The player text (character sheet, bio, etc.)
 * @returns Formatted player block
 */
export function buildPlayerBlock(playerText?: string): string {
  if (!playerText?.trim()) return '';
  
  return block('player', playerText.trim());
}

/**
 * Builds RNG content from provided text
 * @param rngText The RNG text (seed, policy, etc.)
 * @returns Formatted RNG block
 */
export function buildRngBlock(rngText?: string): string {
  if (!rngText?.trim()) return '';
  
  return block('rng', rngText.trim());
}

/**
 * Builds input content from provided text
 * @param inputText The user input text
 * @returns Formatted input block
 */
export function buildInputBlock(inputText?: string): string {
  if (!inputText?.trim()) return '';
  
  return block('input', inputText.trim());
}

/**
 * Builds all dynamic state blocks from assemble args
 * @param args Assembly arguments
 * @returns Array of formatted blocks
 */
export function buildStateBlocks(args: AssembleArgs): string[] {
  const blocks: string[] = [];

  // Game state block
  if (args.gameStateText) {
    blocks.push(buildGameStateBlock(args.gameStateText));
  }

  // Player block
  if (args.playerText) {
    blocks.push(buildPlayerBlock(args.playerText));
  }

  // RNG block
  if (args.rngText) {
    blocks.push(buildRngBlock(args.rngText));
  }

  // Input block
  if (args.inputText) {
    blocks.push(buildInputBlock(args.inputText));
  }

  return blocks;
}

/**
 * Validates state content for common issues
 * @param args Assembly arguments
 * @returns Validation result
 */
export function validateStateContent(args: AssembleArgs): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Check for empty or whitespace-only content
  if (args.gameStateText && !args.gameStateText.trim()) {
    warnings.push('Game state text is empty or whitespace-only');
  }

  if (args.playerText && !args.playerText.trim()) {
    warnings.push('Player text is empty or whitespace-only');
  }

  if (args.rngText && !args.rngText.trim()) {
    warnings.push('RNG text is empty or whitespace-only');
  }

  if (args.inputText && !args.inputText.trim()) {
    warnings.push('Input text is empty or whitespace-only');
  }

  // Check for extremely long content
  if (args.gameStateText && args.gameStateText.length > 10000) {
    warnings.push('Game state text is very long (>10k chars)');
  }

  if (args.playerText && args.playerText.length > 5000) {
    warnings.push('Player text is very long (>5k chars)');
  }

  if (args.inputText && args.inputText.length > 2000) {
    warnings.push('Input text is very long (>2k chars)');
  }

  return {
    valid: warnings.length === 0,
    warnings
  };
}

/**
 * Creates state content summary for debugging
 * @param args Assembly arguments
 * @returns Summary string
 */
export function createStateSummary(args: AssembleArgs): string {
  const parts: string[] = [];

  if (args.gameStateText) {
    parts.push(`Game state: ${args.gameStateText.length} chars`);
  }

  if (args.playerText) {
    parts.push(`Player: ${args.playerText.length} chars`);
  }

  if (args.rngText) {
    parts.push(`RNG: ${args.rngText.length} chars`);
  }

  if (args.inputText) {
    parts.push(`Input: ${args.inputText.length} chars`);
  }

  return parts.length > 0 ? parts.join(', ') : 'No state content';
}

/**
 * Estimates tokens for all state content
 * @param args Assembly arguments
 * @returns Estimated token count
 */
export function estimateStateTokens(args: AssembleArgs): number {
  let totalTokens = 0;

  if (args.gameStateText) {
    totalTokens += Math.ceil(args.gameStateText.length / 4);
  }

  if (args.playerText) {
    totalTokens += Math.ceil(args.playerText.length / 4);
  }

  if (args.rngText) {
    totalTokens += Math.ceil(args.rngText.length / 4);
  }

  if (args.inputText) {
    totalTokens += Math.ceil(args.inputText.length / 4);
  }

  return totalTokens;
}

/**
 * Creates a mock game state for testing
 * @param gameId Game ID
 * @param turnCount Current turn count
 * @returns Mock game state text
 */
export function createMockGameState(gameId?: string, turnCount: number = 0): string {
  return `Game State:
- Game ID: ${gameId || 'unknown'}
- Turn: ${turnCount}
- Location: Whispercross Inn
- Time: Evening
- Weather: Clear
- NPCs present: Innkeeper, 2 travelers
- Recent events: Player arrived at the inn`;
}

/**
 * Creates a mock player character for testing
 * @param characterName Character name
 * @param level Character level
 * @returns Mock player text
 */
export function createMockPlayer(characterName: string = 'Test Hero', level: number = 1): string {
  return `Character: ${characterName}
- Level: ${level}
- Class: Fighter
- HP: ${level * 10}
- AC: 16
- Skills: Athletics, Intimidation
- Equipment: Sword, Shield, Chain Mail
- Background: Soldier`;
}

/**
 * Creates a mock RNG seed for testing
 * @param seed RNG seed value
 * @returns Mock RNG text
 */
export function createMockRng(seed: number = 12345): string {
  return `RNG Configuration:
- Seed: ${seed}
- Policy: Fair dice rolls
- Bias: None
- History: 5 rolls made`;
}

/**
 * Creates a mock user input for testing
 * @param input The user input text
 * @returns Mock input text
 */
export function createMockInput(input: string = 'I want to talk to the innkeeper'): string {
  return `User Input: "${input}"`;
}

/**
 * Creates complete mock state for testing
 * @param overrides Optional overrides for specific fields
 * @returns Complete mock assemble args
 */
export function createMockState(overrides: Partial<AssembleArgs> = {}): AssembleArgs {
  return {
    entryPointId: 'ep.whispercross',
    worldId: 'world.mystika',
    rulesetId: 'ruleset.classic_v1',
    gameId: 'game-123',
    isFirstTurn: false,
    gameStateText: createMockGameState('game-123', 5),
    playerText: createMockPlayer('Test Hero', 3),
    rngText: createMockRng(12345),
    inputText: createMockInput('I want to explore the inn'),
    npcs: [
      { npcId: 'npc.innkeeper', tier: 1 },
      { npcId: 'npc.traveler1', tier: 0 }
    ],
    tokenBudget: 8000,
    npcTokenBudget: 600,
    ...overrides
  };
}
