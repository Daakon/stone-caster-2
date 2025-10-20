// Prompt Assembler Markdown Formatting
// Provides consistent delimiters and formatting for prompt sections

import type { Scope } from './types';

/**
 * Creates a formatted block with consistent delimiters
 * @param scope The scope of the block
 * @param body The content to wrap
 * @returns Formatted block with delimiters
 */
export const block = (scope: Scope, body: string): string => {
  if (!body.trim()) return '';
  
  return `\n=== ${scope.toUpperCase()}_BEGIN ===\n${body.trim()}\n=== ${scope.toUpperCase()}_END ===\n`;
};

/**
 * Creates a section header for debugging and parsing
 * @param scope The scope of the section
 * @param metadata Optional metadata to include
 * @returns Formatted section header
 */
export const sectionHeader = (scope: Scope, metadata?: Record<string, any>): string => {
  const metaStr = metadata ? ` (${JSON.stringify(metadata)})` : '';
  return `\n--- ${scope.toUpperCase()} SECTION${metaStr} ---\n`;
};

/**
 * Creates a simple text block without delimiters (for internal use)
 * @param content The content to format
 * @returns Formatted content
 */
export const textBlock = (content: string): string => {
  return content.trim();
};

/**
 * Creates a truncated content indicator
 * @param originalLength Original content length
 * @param truncatedLength Truncated content length
 * @param reason Reason for truncation
 * @returns Truncation indicator
 */
export const truncationIndicator = (
  originalLength: number, 
  truncatedLength: number, 
  reason: string
): string => {
  return `\n[TRUNCATED: ${originalLength} → ${truncatedLength} chars (${reason})]\n`;
};

/**
 * Creates a compression indicator for game state
 * @param originalLength Original content length
 * @param compressedLength Compressed content length
 * @returns Compression indicator
 */
export const compressionIndicator = (
  originalLength: number, 
  compressedLength: number
): string => {
  return `\n[COMPRESSED: ${originalLength} → ${compressedLength} chars]\n`;
};

/**
 * Creates an NPC tier drop indicator
 * @param npcId NPC identifier
 * @param fromTier Original tier
 * @param toTier Final tier
 * @returns Tier drop indicator
 */
export const npcTierDropIndicator = (
  npcId: string, 
  fromTier: number, 
  toTier: number
): string => {
  return `\n[NPC ${npcId}: tier ${fromTier} → ${toTier}]\n`;
};

/**
 * Creates a scope drop indicator
 * @param scope The scope that was dropped
 * @param reason Reason for dropping
 * @returns Scope drop indicator
 */
export const scopeDropIndicator = (scope: Scope, reason: string): string => {
  return `\n[DROPPED: ${scope.toUpperCase()} (${reason})]\n`;
};

/**
 * Formats multiple segments into a single block
 * @param segments Array of segment content
 * @param separator Separator between segments (default: '\n\n')
 * @returns Formatted content
 */
export const formatSegments = (segments: string[], separator: string = '\n\n'): string => {
  return segments.filter(s => s.trim()).join(separator);
};

/**
 * Creates a summary cue for truncated NPC content
 * @param npcId NPC identifier
 * @param originalTier Original tier
 * @returns Summary cue
 */
export const npcSummaryCue = (npcId: string, originalTier: number): string => {
  return `NPC ${npcId}: [Behavior cue from tier ${originalTier} content]`;
};

/**
 * Creates a game state compression cue
 * @param originalLength Original content length
 * @returns Compression cue
 */
export const gameStateCompressionCue = (originalLength: number): string => {
  return `(Game state compressed from ${originalLength} chars)`;
};

/**
 * Validates that a block has proper delimiters
 * @param content The content to validate
 * @param scope The expected scope
 * @returns True if properly formatted
 */
export const validateBlock = (content: string, scope: Scope): boolean => {
  const beginMarker = `=== ${scope.toUpperCase()}_BEGIN ===`;
  const endMarker = `=== ${scope.toUpperCase()}_END ===`;
  
  return content.includes(beginMarker) && content.includes(endMarker);
};

/**
 * Extracts content from a formatted block
 * @param content The formatted block content
 * @param scope The expected scope
 * @returns Extracted content without delimiters
 */
export const extractBlockContent = (content: string, scope: Scope): string => {
  const beginMarker = `=== ${scope.toUpperCase()}_BEGIN ===`;
  const endMarker = `=== ${scope.toUpperCase()}_END ===`;
  
  const beginIndex = content.indexOf(beginMarker);
  const endIndex = content.indexOf(endMarker);
  
  if (beginIndex === -1 || endIndex === -1) {
    return content; // Return as-is if not properly formatted
  }
  
  const start = beginIndex + beginMarker.length;
  const end = endIndex;
  
  return content.substring(start, end).trim();
};
